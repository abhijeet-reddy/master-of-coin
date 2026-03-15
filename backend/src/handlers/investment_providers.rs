use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    services::investment_provider::InvestmentProvider,
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::investment_provider::{
        ConnectInvestmentProviderRequest, InvestmentProviderResponse, NewInvestmentProvider,
    },
    repositories,
    services::investment_provider::Trading212Provider,
    types::AccountType,
    utils::encryption,
};

/// Connect a brokerage provider to an investment account.
///
/// Validates the account is type INVESTMENT, tests the credentials by making
/// a real API call, encrypts them, and stores the provider record.
///
/// POST /api/v1/investment-providers
pub async fn connect_provider(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<ConnectInvestmentProviderRequest>,
) -> Result<(StatusCode, Json<InvestmentProviderResponse>), ApiError> {
    let user_id = auth_context.user_id();

    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Investment provider validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    tracing::info!(
        "Connecting investment provider {:?} to account {} for user {}",
        request.provider_type,
        request.account_id,
        user_id
    );

    // Verify account exists and belongs to user
    let account = repositories::account::find_by_id(&state.db, request.account_id).await?;

    if account.user_id != user_id {
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Verify account is type INVESTMENT
    if account.account_type != AccountType::Investment {
        return Err(ApiError::Validation(
            "Only INVESTMENT accounts can have brokerage providers connected".to_string(),
        ));
    }

    // Check if a provider already exists for this account
    let existing =
        repositories::investment_provider::find_by_account_id(&state.db, request.account_id)
            .await?;

    if existing.is_some() {
        return Err(ApiError::Validation(
            "This account already has a connected provider. Disconnect it first.".to_string(),
        ));
    }

    // Build credentials JSON for the provider
    let environment = request.environment.as_deref().unwrap_or("live");
    let credentials_plain = serde_json::json!({
        "api_key": request.api_key,
        "api_secret": request.api_secret,
        "environment": environment,
    });

    // Test credentials by making a real API call
    let provider = Trading212Provider::new();
    provider
        .get_portfolio_value(&credentials_plain)
        .await
        .map_err(|e| {
            tracing::warn!(
                "Credential validation failed for account {}: {}",
                request.account_id,
                e
            );
            ApiError::Validation(format!(
                "Failed to validate credentials with Trading 212: {}",
                e
            ))
        })?;

    tracing::info!(
        "Credentials validated successfully for account {}",
        request.account_id
    );

    // Encrypt credentials
    let encrypted = encryption::encrypt_credentials(&credentials_plain).map_err(|e| {
        tracing::error!("Failed to encrypt credentials: {}", e);
        ApiError::Internal
    })?;

    let credentials_stored = serde_json::json!({
        "encrypted": encrypted,
    });

    // Store the provider
    let new_provider = NewInvestmentProvider {
        user_id,
        account_id: request.account_id,
        provider_type: request.provider_type,
        credentials: credentials_stored,
        is_active: true,
    };

    let provider_record =
        repositories::investment_provider::create(&state.db, new_provider).await?;

    tracing::info!(
        "Connected investment provider {} for account {} (user {})",
        provider_record.id,
        request.account_id,
        user_id
    );

    Ok((
        StatusCode::CREATED,
        Json(InvestmentProviderResponse::from(provider_record)),
    ))
}

/// List all connected investment providers for the current user.
///
/// GET /api/v1/investment-providers
pub async fn list_providers(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<InvestmentProviderResponse>>, ApiError> {
    let user_id = auth_context.user_id();

    let providers = repositories::investment_provider::list_by_user(&state.db, user_id).await?;

    let responses: Vec<InvestmentProviderResponse> =
        providers.into_iter().map(|p| p.into()).collect();

    Ok(Json(responses))
}

/// Disconnect (delete) an investment provider.
///
/// DELETE /api/v1/investment-providers/:id
pub async fn disconnect_provider(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(provider_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();

    // Find the provider and verify ownership
    let provider = repositories::investment_provider::find_by_id(&state.db, provider_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Investment provider not found".to_string()))?;

    if provider.user_id != user_id {
        return Err(ApiError::NotFound(
            "Investment provider not found".to_string(),
        ));
    }

    repositories::investment_provider::delete(&state.db, provider_id).await?;

    tracing::info!(
        "Disconnected investment provider {} for user {}",
        provider_id,
        user_id
    );

    Ok(StatusCode::NO_CONTENT)
}
