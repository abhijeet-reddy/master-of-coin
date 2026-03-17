//! Bank Sync Service
//!
//! Core service for bank provider operations: OAuth callback handling,
//! transaction syncing, balance fetching, and transaction importing.
//! Called by handlers (thin) and the worker binary.
//!
//! This module uses free functions (not a struct).

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::Json;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::bank_provider::{
    BankBalanceResponse, BankProviderRecord, ExternalBankAccountResponse, NewBankProvider,
};
use crate::models::bank_sync::{
    BankBalanceInfo, BankImportResult, BankSyncReport, BankSyncSummary, FetchedBankTransaction,
    NewBankSyncRecord,
};
use crate::models::transaction::NewTransaction;
use crate::repositories;
use crate::services::bank_provider::{BankProvider, BankProviderError, TrueLayerProvider};
use crate::types::BankProviderType;
use crate::utils::encryption;

/// Maximum number of retry attempts for provider API calls
const MAX_RETRIES: u32 = 3;

/// Default lookback period for transaction fetching (days)
const DEFAULT_LOOKBACK_DAYS: i64 = 30;

// ─── OAuth & Connection ──────────────────────────────────────────────

/// Generate a TrueLayer OAuth authorization URL.
///
/// Creates the provider, generates a signed state embedding user_id + account_id,
/// and returns the auth URL + state.
pub fn generate_auth_url(user_id: Uuid, account_id: Uuid) -> ApiResult<(String, String)> {
    let provider = TrueLayerProvider::from_env()
        .map_err(|e| ApiError::Configuration(format!("TrueLayer not configured: {}", e)))?;

    let state_str = crate::utils::create_bank_oauth_state(user_id, account_id).map_err(|e| {
        ApiError::InternalWithMessage(format!("Failed to create OAuth state: {}", e))
    })?;

    let redirect_uri = std::env::var("TRUELAYER_REDIRECT_URI")
        .map_err(|_| ApiError::Configuration("TRUELAYER_REDIRECT_URI not set".to_string()))?;

    let auth_url = provider
        .generate_auth_url(&state_str, &redirect_uri)
        .map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to generate auth URL: {}", e))
        })?;

    Ok((auth_url, state_str))
}

/// Handle the OAuth callback: exchange code for tokens, encrypt, and store provider.
pub async fn handle_oauth_callback(
    pool: &DbPool,
    user_id: Uuid,
    account_id: Uuid,
    code: &str,
) -> ApiResult<()> {
    // Check if account already has a bank provider — replace if so
    if let Some(existing) =
        repositories::bank_provider::find_by_account_id(pool, account_id).await?
    {
        tracing::warn!(
            "Account {} already has bank provider {}, replacing",
            account_id,
            existing.id
        );
        repositories::bank_provider::delete(pool, existing.id).await?;
    }

    // Create TrueLayer provider and exchange code for tokens
    let provider = TrueLayerProvider::from_env()
        .map_err(|e| ApiError::Configuration(format!("TrueLayer not configured: {}", e)))?;

    let redirect_uri = std::env::var("TRUELAYER_REDIRECT_URI")
        .map_err(|_| ApiError::Configuration("TRUELAYER_REDIRECT_URI not set".to_string()))?;

    let tokens = provider
        .exchange_code(code, &redirect_uri)
        .await
        .map_err(|e| {
            tracing::error!("TrueLayer token exchange failed: {}", e);
            ApiError::InternalWithMessage(format!("Token exchange failed: {}", e))
        })?;

    // Build and encrypt credentials
    let creds = serde_json::json!({
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_expires_at": tokens.expires_at.map(|e| e.to_rfc3339()),
    });

    let encrypted = encryption::encrypt_credentials(&creds).map_err(|e| {
        tracing::error!("Failed to encrypt credentials: {}", e);
        ApiError::InternalWithMessage("Failed to encrypt credentials".to_string())
    })?;

    // Store the bank provider
    let new_provider = NewBankProvider {
        user_id,
        account_id,
        provider_type: BankProviderType::TrueLayer,
        credentials: serde_json::Value::String(encrypted),
        external_account_id: None,
        is_active: true,
    };

    repositories::bank_provider::create(pool, new_provider).await?;

    tracing::info!(
        "TrueLayer bank provider created for user {} account {}",
        user_id,
        account_id
    );

    Ok(())
}

// ─── Balance & Accounts ──────────────────────────────────────────────

/// Fetch current balance from the bank provider.
///
/// Decrypts credentials, calls the provider API, and returns formatted balance.
pub async fn fetch_balance(
    pool: &DbPool,
    record: &BankProviderRecord,
) -> ApiResult<Json<BankBalanceResponse>> {
    let external_account_id = record
        .external_account_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("No external bank account linked".to_string()))?;

    let provider = TrueLayerProvider::from_env()
        .map_err(|e| ApiError::Configuration(format!("TrueLayer not configured: {}", e)))?;

    let (access_token, _) = get_valid_access_token(pool, record, &provider).await?;

    let balance = provider
        .fetch_balance(&access_token, external_account_id)
        .await
        .map_err(|e| ApiError::InternalWithMessage(format!("Failed to fetch balance: {}", e)))?;

    Ok(Json(BankBalanceResponse {
        current: format!("{:.2}", balance.current),
        available: balance.available.map(|a| format!("{:.2}", a)),
        currency: balance.currency,
        updated_at: balance.updated_at,
    }))
}

/// Fetch external bank accounts from the provider (for linking after OAuth).
///
/// Decrypts credentials and calls the provider API.
pub async fn fetch_external_accounts(
    record: &BankProviderRecord,
) -> ApiResult<Json<Vec<ExternalBankAccountResponse>>> {
    let provider = TrueLayerProvider::from_env()
        .map_err(|e| ApiError::Configuration(format!("TrueLayer not configured: {}", e)))?;

    let access_token = decrypt_access_token(record)?;

    let accounts = provider
        .fetch_accounts(&access_token)
        .await
        .map_err(|e| ApiError::InternalWithMessage(format!("Failed to fetch accounts: {}", e)))?;

    let responses: Vec<ExternalBankAccountResponse> = accounts
        .into_iter()
        .map(|a| ExternalBankAccountResponse {
            account_id: a.account_id,
            account_name: a.display_name,
            account_type: a.account_type,
            currency: a.currency,
            account_number: a.account_number,
            sort_code: a.sort_code,
        })
        .collect();

    Ok(Json(responses))
}

// ─── Sync Report ─────────────────────────────────────────────────────

/// Parse a sync report from job result and re-check already_imported flags live.
///
/// Single DB query to get all imported IDs for the provider, then updates flags.
pub async fn get_sync_report_with_live_status(
    pool: &DbPool,
    job_result: &Option<serde_json::Value>,
) -> Option<BankSyncReport> {
    let result_json = job_result.as_ref()?;
    let mut report: BankSyncReport = serde_json::from_value(result_json.clone()).ok()?;

    // Re-check bank_sync_records to update stale already_imported flags
    if let Ok(provider_id) = Uuid::parse_str(&report.bank_provider_id) {
        if let Ok(imported_ids) =
            repositories::bank_sync::find_imported_ids(pool, provider_id).await
        {
            let imported_set: HashSet<String> = imported_ids.into_iter().collect();
            let mut already_count: i64 = 0;
            let mut new_count: i64 = 0;
            for txn in &mut report.transactions {
                txn.already_imported = imported_set.contains(&txn.external_id);
                if txn.already_imported {
                    already_count += 1;
                } else {
                    new_count += 1;
                }
            }
            report.summary.already_imported = already_count;
            report.summary.new_transactions = new_count;
        }
    }

    Some(report)
}

// ─── Transaction Sync (Worker) ───────────────────────────────────────

/// Main entry point for bank sync (called by worker).
///
/// Fetches transactions and balance from the bank provider, checks for
/// previously-imported transactions, and builds a sync report.
pub async fn sync_bank_transactions(
    pool: &DbPool,
    providers: &HashMap<BankProviderType, Arc<dyn BankProvider>>,
    user_id: Uuid,
    bank_provider_id: Uuid,
    from_date: Option<DateTime<Utc>>,
    to_date: Option<DateTime<Utc>>,
) -> ApiResult<BankSyncReport> {
    tracing::info!(
        "Starting bank sync for user {} provider {}",
        user_id,
        bank_provider_id
    );

    // Step 1: Load bank provider record
    let provider_record = repositories::bank_provider::find_by_id(pool, bank_provider_id)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!("Bank provider {} not found", bank_provider_id))
        })?;

    if provider_record.user_id != user_id {
        return Err(ApiError::NotFound(format!(
            "Bank provider {} not found",
            bank_provider_id
        )));
    }

    if !provider_record.is_active {
        return Err(ApiError::BadRequest(
            "Bank provider is not active. Please reconnect.".to_string(),
        ));
    }

    // Step 2: Get the provider implementation
    let provider = providers
        .get(&provider_record.provider_type)
        .ok_or_else(|| {
            ApiError::InternalWithMessage(format!(
                "No implementation for provider type: {}",
                provider_record.provider_type
            ))
        })?;

    // Step 3: Get valid access token (auto-refresh if expired)
    let (access_token, _) =
        get_valid_access_token(pool, &provider_record, provider.as_ref()).await?;

    // Step 4: Get the external account ID
    let external_account_id = provider_record
        .external_account_id
        .as_deref()
        .ok_or_else(|| {
            ApiError::BadRequest(
                "No external bank account linked. Please link a bank account first.".to_string(),
            )
        })?;

    // Step 5: Fetch transactions
    let from = from_date.unwrap_or_else(|| Utc::now() - Duration::days(DEFAULT_LOOKBACK_DAYS));
    let to = to_date.unwrap_or_else(Utc::now);

    tracing::info!(
        "Fetching transactions from {} to {} for account {}",
        from,
        to,
        external_account_id
    );

    let bank_transactions = retry_with_backoff(|| async {
        provider
            .fetch_transactions(&access_token, external_account_id, from, to)
            .await
    })
    .await
    .map_err(|e| ApiError::InternalWithMessage(format!("Failed to fetch transactions: {}", e)))?;

    tracing::info!("Fetched {} transactions", bank_transactions.len());

    // Step 6: Fetch balance
    let balance = match retry_with_backoff(|| async {
        provider
            .fetch_balance(&access_token, external_account_id)
            .await
    })
    .await
    {
        Ok(bal) => Some(BankBalanceInfo {
            current: format!("{:.2}", bal.current),
            available: bal.available.map(|a| format!("{:.2}", a)),
            currency: bal.currency,
            updated_at: bal.updated_at,
        }),
        Err(e) => {
            tracing::warn!(
                "Failed to fetch balance: {}. Continuing without balance.",
                e
            );
            None
        }
    };

    // Step 7: Load previously-imported transaction IDs (single DB query)
    let imported_ids: HashSet<String> =
        repositories::bank_sync::find_imported_ids(pool, bank_provider_id)
            .await?
            .into_iter()
            .collect();

    tracing::info!(
        "Found {} previously imported transactions",
        imported_ids.len()
    );

    // Step 8: Build the sync report
    let mut already_imported_count: i64 = 0;
    let mut new_count: i64 = 0;

    let fetched_transactions: Vec<FetchedBankTransaction> = bank_transactions
        .into_iter()
        .map(|t| {
            let already_imported = imported_ids.contains(&t.transaction_id);
            if already_imported {
                already_imported_count += 1;
            } else {
                new_count += 1;
            }

            FetchedBankTransaction {
                external_id: t.transaction_id,
                description: t.description,
                amount: format!("{:.2}", t.amount),
                currency: t.currency,
                date: t.timestamp,
                transaction_type: t.transaction_type,
                merchant_name: t.merchant_name,
                category: t.category,
                already_imported,
            }
        })
        .collect();

    let total_fetched = fetched_transactions.len() as i64;

    // Step 9: Update last_sync_at
    repositories::bank_provider::update_last_sync(pool, bank_provider_id).await?;

    let report = BankSyncReport {
        provider_type: provider_record.provider_type,
        account_name: provider_record
            .external_account_id
            .unwrap_or_else(|| "Unknown".to_string()),
        bank_provider_id: bank_provider_id.to_string(),
        balance,
        transactions: fetched_transactions,
        summary: BankSyncSummary {
            total_fetched,
            already_imported: already_imported_count,
            new_transactions: new_count,
        },
    };

    tracing::info!(
        "Bank sync complete: {} fetched, {} new, {} already imported",
        total_fetched,
        new_count,
        already_imported_count
    );

    Ok(report)
}

// ─── Transaction Import ──────────────────────────────────────────────

/// Import selected transactions from a sync report into the user's account.
pub async fn import_transactions(
    pool: &DbPool,
    user_id: Uuid,
    bank_provider_id: Uuid,
    account_id: Uuid,
    report: &BankSyncReport,
    selected_ids: &[String],
) -> ApiResult<BankImportResult> {
    let selected_set: HashSet<&str> = selected_ids.iter().map(|s| s.as_str()).collect();

    let mut imported_count: i64 = 0;
    let mut skipped_count: i64 = 0;
    let mut errors: Vec<String> = Vec::new();
    let mut sync_records: Vec<NewBankSyncRecord> = Vec::new();

    for txn in &report.transactions {
        if !selected_set.contains(txn.external_id.as_str()) {
            continue;
        }

        if txn.already_imported {
            skipped_count += 1;
            continue;
        }

        let amount = match txn.amount.parse::<f64>() {
            Ok(a) => a,
            Err(e) => {
                errors.push(format!(
                    "Failed to parse amount for {}: {}",
                    txn.external_id, e
                ));
                continue;
            }
        };

        let amount_bd = bigdecimal::BigDecimal::try_from(amount)
            .unwrap_or_else(|_| bigdecimal::BigDecimal::from(0));

        // Build title from description and merchant
        let title = if let Some(ref merchant) = txn.merchant_name {
            if txn.description.contains(merchant.as_str()) {
                txn.description.clone()
            } else {
                format!("{} - {}", merchant, txn.description)
            }
        } else {
            txn.description.clone()
        };

        let title = if title.len() > 255 {
            title[..255].to_string()
        } else {
            title
        };

        let new_txn = NewTransaction {
            user_id,
            account_id,
            category_id: None,
            title,
            amount: amount_bd,
            date: txn.date,
            notes: txn
                .merchant_name
                .clone()
                .map(|m| format!("Imported from bank - Merchant: {}", m)),
        };

        match repositories::transaction::create_transaction(pool, user_id, new_txn).await {
            Ok(created) => {
                sync_records.push(NewBankSyncRecord {
                    bank_provider_id,
                    external_transaction_id: txn.external_id.clone(),
                    transaction_id: Some(created.id),
                });
                imported_count += 1;
            }
            Err(e) => {
                errors.push(format!(
                    "Failed to create transaction for {}: {}",
                    txn.external_id, e
                ));
            }
        }
    }

    // Batch insert sync records
    if !sync_records.is_empty() {
        repositories::bank_sync::create_records(pool, sync_records).await?;
    }

    Ok(BankImportResult {
        imported_count,
        skipped_count,
        errors,
    })
}

// ─── Internal Helpers ────────────────────────────────────────────────

/// Decrypt the access token from a bank provider record.
fn decrypt_access_token(record: &BankProviderRecord) -> ApiResult<String> {
    let encrypted = record
        .credentials
        .as_str()
        .ok_or_else(|| ApiError::InternalWithMessage("Invalid credentials format".to_string()))?;

    let creds = encryption::decrypt_credentials(encrypted).map_err(|e| {
        tracing::error!("Failed to decrypt bank provider credentials: {}", e);
        ApiError::InternalWithMessage("Failed to decrypt credentials".to_string())
    })?;

    creds
        .get("access_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            ApiError::InternalWithMessage("Missing access_token in credentials".to_string())
        })
}

/// Get a valid access token, refreshing if expired.
async fn get_valid_access_token(
    pool: &DbPool,
    record: &BankProviderRecord,
    provider: &dyn BankProvider,
) -> ApiResult<(String, BankProviderRecord)> {
    let encrypted = record
        .credentials
        .as_str()
        .ok_or_else(|| ApiError::InternalWithMessage("Invalid credentials format".to_string()))?;

    let creds = encryption::decrypt_credentials(encrypted).map_err(|e| {
        tracing::error!("Failed to decrypt bank provider credentials: {}", e);
        ApiError::InternalWithMessage("Failed to decrypt credentials".to_string())
    })?;

    let access_token = creds
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            ApiError::InternalWithMessage("Missing access_token in credentials".to_string())
        })?
        .to_string();

    let refresh_token = creds
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let expires_at = creds
        .get("token_expires_at")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    // Check if token is expired or about to expire (5 minute buffer)
    let needs_refresh = expires_at
        .map(|exp| exp < Utc::now() + Duration::minutes(5))
        .unwrap_or(false);

    if needs_refresh {
        if let Some(ref rt) = refresh_token {
            tracing::info!("Access token expired, refreshing...");
            match provider.refresh_token(rt).await {
                Ok(new_tokens) => {
                    let new_creds = serde_json::json!({
                        "access_token": new_tokens.access_token,
                        "refresh_token": new_tokens.refresh_token.as_deref().unwrap_or(rt),
                        "token_expires_at": new_tokens.expires_at.map(|e| e.to_rfc3339()),
                    });

                    let encrypted_new =
                        encryption::encrypt_credentials(&new_creds).map_err(|e| {
                            ApiError::InternalWithMessage(format!(
                                "Failed to encrypt credentials: {}",
                                e
                            ))
                        })?;

                    let updated = repositories::bank_provider::update_credentials(
                        pool,
                        record.id,
                        serde_json::Value::String(encrypted_new),
                    )
                    .await?;

                    return Ok((new_tokens.access_token, updated));
                }
                Err(BankProviderError::TokenExpired) => {
                    tracing::warn!("Refresh token expired, deactivating bank provider");
                    repositories::bank_provider::deactivate(pool, record.id).await?;
                    return Err(ApiError::BadRequest(
                        "Bank consent has expired. Please reconnect your bank account.".to_string(),
                    ));
                }
                Err(e) => {
                    tracing::error!("Failed to refresh token: {}", e);
                    return Err(ApiError::InternalWithMessage(format!(
                        "Failed to refresh access token: {}",
                        e
                    )));
                }
            }
        } else {
            tracing::warn!("Token expired but no refresh token available");
            repositories::bank_provider::deactivate(pool, record.id).await?;
            return Err(ApiError::BadRequest(
                "Bank consent has expired. Please reconnect your bank account.".to_string(),
            ));
        }
    }

    Ok((access_token, record.clone()))
}

/// Retry a provider API call with exponential backoff for transient errors.
async fn retry_with_backoff<F, Fut, T>(f: F) -> Result<T, BankProviderError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, BankProviderError>>,
{
    let mut last_error = BankProviderError::NetworkError("No attempts made".to_string());

    for attempt in 0..MAX_RETRIES {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if e.is_retryable() && attempt < MAX_RETRIES - 1 => {
                let delay = std::time::Duration::from_millis(500 * 2u64.pow(attempt));
                tracing::warn!(
                    "Retryable error on attempt {}/{}: {}. Retrying in {:?}",
                    attempt + 1,
                    MAX_RETRIES,
                    e,
                    delay
                );
                tokio::time::sleep(delay).await;
                last_error = e;
            }
            Err(e) => return Err(e),
        }
    }

    Err(last_error)
}
