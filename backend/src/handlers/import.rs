//! Import API handlers
//!
//! This module provides HTTP endpoints for CSV statement import functionality:
//! - Parse CSV files and return transactions for preview
//! - Bulk create transactions from parsed data

use axum::{
    Extension, Json,
    extract::{Multipart, State},
};
use std::path::Path;
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        BulkCreateData, BulkCreateError, BulkCreateRequest, BulkCreateResponse, ParseData,
        ParseResponse,
    },
    services::{account_service, csv_parser_service::*, import_service, transaction_service},
};

/// Parse CSV file and return transactions for preview
///
/// POST /api/v1/transactions/import/parse
///
/// # Request
///
/// Multipart form data with:
/// - `file`: CSV file
/// - `account_id`: UUID of target account
///
/// # Response
///
/// Returns parsed transactions with duplicate detection and validation
pub async fn parse_csv(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    mut multipart: Multipart,
) -> Result<Json<ParseResponse>, ApiError> {
    let user_id = auth_context.user_id();

    let mut file_data: Option<Vec<u8>> = None;
    let mut account_id: Option<Uuid> = None;
    let mut filename: Option<String> = None;

    // Extract multipart fields
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::Validation("Invalid multipart data".to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                let data = field
                    .bytes()
                    .await
                    .map_err(|_| ApiError::Validation("Failed to read file data".to_string()))?;

                // Validate file size
                if data.len() > state.config.import.max_file_size {
                    return Err(ApiError::Validation(format!(
                        "File size exceeds maximum of {} bytes",
                        state.config.import.max_file_size
                    )));
                }

                file_data = Some(data.to_vec());
            }
            "account_id" => {
                let text = field
                    .text()
                    .await
                    .map_err(|_| ApiError::Validation("Invalid account_id".to_string()))?;
                account_id =
                    Some(Uuid::parse_str(&text).map_err(|_| {
                        ApiError::Validation("Invalid account_id format".to_string())
                    })?);
            }
            _ => {}
        }
    }

    let file_data = file_data.ok_or_else(|| ApiError::Validation("Missing file".to_string()))?;
    let account_id =
        account_id.ok_or_else(|| ApiError::Validation("Missing account_id".to_string()))?;
    let filename = filename.ok_or_else(|| ApiError::Validation("Missing filename".to_string()))?;

    // Verify account belongs to user
    account_service::get_account(&state.db, account_id, user_id).await?;

    // Get file extension
    let extension = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e))
        .ok_or_else(|| ApiError::Validation("Invalid file type".to_string()))?;

    // Get appropriate parser
    let parser =
        ParserFactory::get_parser(&extension).map_err(|e| ApiError::Validation(e.to_string()))?;

    // Parse file
    let mut transactions = parser
        .parse(&file_data, &state.config.import)
        .map_err(|e| ApiError::Validation(e.to_string()))?;

    // Validate each transaction
    for transaction in &mut transactions {
        let errors = parser.validate(transaction);
        if !errors.is_empty() {
            transaction.is_valid = false;
            transaction.validation_errors = Some(errors.iter().map(|e| e.to_string()).collect());
        }
    }

    // Check for duplicates against database
    import_service::check_duplicates(&state.db, user_id, account_id, &mut transactions).await?;

    // Calculate summary
    let summary = import_service::calculate_summary(&transactions);

    Ok(Json(ParseResponse {
        success: true,
        data: ParseData {
            account_id,
            transactions,
            summary,
        },
        errors: None,
    }))
}

/// Bulk create transactions
///
/// POST /api/v1/transactions/bulk-create
///
/// # Request
///
/// JSON body with:
/// - `account_id`: UUID of target account
/// - `transactions`: Array of transaction requests
///
/// # Response
///
/// Returns count of created/failed transactions and any errors
pub async fn bulk_create_transactions(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<BulkCreateRequest>,
) -> Result<Json<BulkCreateResponse>, ApiError> {
    let user_id = auth_context.user_id();

    // Verify account belongs to user
    account_service::get_account(&state.db, request.account_id, user_id).await?;

    let mut created_transactions = Vec::new();
    let mut errors = Vec::new();

    // Create transactions one by one
    for (index, transaction_request) in request.transactions.iter().enumerate() {
        match transaction_service::create_transaction(
            &state.db,
            user_id,
            (*transaction_request).clone(),
        )
        .await
        {
            Ok(transaction) => created_transactions.push(transaction),
            Err(e) => {
                errors.push(BulkCreateError {
                    index,
                    error: e.to_string(),
                });
            }
        }
    }

    Ok(Json(BulkCreateResponse {
        success: errors.is_empty(),
        data: BulkCreateData {
            created: created_transactions.len(),
            failed: errors.len(),
            transactions: created_transactions,
            errors: if errors.is_empty() {
                None
            } else {
                Some(errors)
            },
        },
    }))
}
