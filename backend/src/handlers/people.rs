use std::collections::HashMap;

use bigdecimal::BigDecimal;
use uuid::Uuid;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{
        CreatePersonRequest, DebtSummaryResponse, NewPerson, NewPersonSplitConfig, PersonResponse,
        PersonSplitConfigResponse, SetPersonSplitConfigRequest, TransactionSplit, UpdatePerson,
        UpdatePersonRequest,
    },
    repositories, services,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use validator::Validate;

/// Request DTO for settling debt
#[derive(Debug, Deserialize)]
pub struct SettleDebtRequest {
    pub amount: f64,
    pub account_id: Uuid,
}

/// List all people for the authenticated user
/// GET /people
pub async fn list(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<PersonResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing people for user {}", user_id);

    let people = repositories::person::list_by_user(&state.db, user_id).await?;

    // Batch-fetch all splits for all people (2 queries total, no N+1)
    let person_ids: Vec<Uuid> = people.iter().map(|p| p.id).collect();
    let all_splits = repositories::person::list_splits_for_people(&state.db, person_ids).await?;

    // Group splits by person_id
    let mut splits_by_person: HashMap<Uuid, Vec<&TransactionSplit>> = HashMap::new();
    for split in &all_splits {
        splits_by_person
            .entry(split.person_id)
            .or_default()
            .push(split);
    }

    // Build responses with debt summaries
    let responses: Vec<PersonResponse> = people
        .into_iter()
        .map(|p| {
            let person_id = p.id;
            let mut response: PersonResponse = p.into();
            let splits = splits_by_person
                .get(&person_id)
                .cloned()
                .unwrap_or_default();
            let (debt_summary, transaction_count) = calculate_debt_summary(&splits);
            response.debt_summary = Some(debt_summary);
            response.transaction_count = transaction_count;
            response
        })
        .collect();

    Ok(Json(responses))
}

/// Create a new person
/// POST /people
pub async fn create(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<CreatePersonRequest>,
) -> Result<(StatusCode, Json<PersonResponse>), ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Creating person for user {}", user_id);

    // Validate request
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Validation failed: {}", e)))?;

    let new_person = NewPerson {
        user_id,
        name: request.name,
        email: request.email,
        phone: request.phone,
        notes: request.notes,
    };

    let person = repositories::person::create_person(&state.db, user_id, new_person).await?;

    let response = person.into();

    Ok((StatusCode::CREATED, Json(response)))
}

/// Get a single person by ID
/// GET /people/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<PersonResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching person {} for user {}", id, user_id);

    let person = repositories::person::find_by_id(&state.db, id).await?;

    // Verify ownership
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    // Fetch splits and calculate debt summary
    let splits = repositories::person::list_splits_for_person(&state.db, id).await?;
    let split_refs: Vec<&TransactionSplit> = splits.iter().collect();
    let (debt_summary, transaction_count) = calculate_debt_summary(&split_refs);

    let mut response: PersonResponse = person.into();
    response.debt_summary = Some(debt_summary);
    response.transaction_count = transaction_count;

    Ok(Json(response))
}

/// Update a person
/// PUT /people/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdatePersonRequest>,
) -> Result<Json<PersonResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Updating person {} for user {}", id, user_id);

    // Validate request (manual validation for double-Option fields)
    request
        .validate_fields()
        .map_err(|e| ApiError::Validation(format!("Validation failed: {}", e)))?;

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    let updates = UpdatePerson {
        name: request.name,
        email: request.email,
        phone: request.phone,
        notes: request.notes,
    };

    let updated_person = repositories::person::update_person(&state.db, id, updates).await?;

    let response = updated_person.into();

    Ok(Json(response))
}

/// Delete a person
/// DELETE /people/:id
pub async fn delete(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Deleting person {} for user {}", id, user_id);

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    repositories::person::delete_person(&state.db, id).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get debts for a specific person
/// GET /people/:id/debts
pub async fn get_debts(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<services::debt_service::PersonDebt>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching debts for person {} and user {}", id, user_id);

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    let debt_amount =
        services::debt_service::calculate_debt_for_person(&state.db, id, user_id).await?;

    let debt = services::debt_service::PersonDebt {
        person_id: id,
        person_name: person.name,
        debt_amount,
    };

    Ok(Json(debt))
}

/// Settle debt with a person
/// POST /people/:id/settle
pub async fn settle_debt(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
    Json(request): Json<SettleDebtRequest>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Settling debt of {} with person {} for user {}",
        request.amount,
        id,
        user_id
    );

    services::debt_service::settle_debt(&state.db, id, user_id, request.amount, request.account_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Set or update split provider configuration for a person
/// PUT /people/:id/split-config
pub async fn set_split_config(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(person_id): Path<Uuid>,
    Json(request): Json<SetPersonSplitConfigRequest>,
) -> Result<Json<PersonSplitConfigResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Setting split config for person {} by user {}",
        person_id,
        user_id
    );

    // Validate request
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Validation failed: {}", e)))?;

    // Verify person ownership
    let person = repositories::person::find_by_id(&state.db, person_id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    // Verify provider exists and belongs to user
    let provider = repositories::split_provider::find_by_id(&state.db, request.split_provider_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Split provider not found".to_string()))?;

    if provider.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Split provider does not belong to user".to_string(),
        ));
    }

    // Create or update config
    let new_config = NewPersonSplitConfig {
        person_id,
        split_provider_id: request.split_provider_id,
        external_user_id: request.external_user_id,
    };

    let config = repositories::person_split_config::upsert_config(&state.db, new_config).await?;

    // Build response with provider type
    let mut response = PersonSplitConfigResponse::from(config);
    response.provider_type = provider.provider_type;

    Ok(Json(response))
}

/// Get split provider configuration for a person
/// GET /people/:id/split-config
pub async fn get_split_config(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(person_id): Path<Uuid>,
) -> Result<Json<PersonSplitConfigResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::debug!("Fetching split config for person {}", person_id);

    // Verify person ownership
    let person = repositories::person::find_by_id(&state.db, person_id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    // Get config
    let config = repositories::person_split_config::find_by_person_id(&state.db, person_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Split config not found".to_string()))?;

    // Get provider to include type in response
    let provider = repositories::split_provider::find_by_id(&state.db, config.split_provider_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Split provider not found".to_string()))?;

    let mut response = PersonSplitConfigResponse::from(config);
    response.provider_type = provider.provider_type;

    Ok(Json(response))
}

/// Delete split provider configuration for a person
/// DELETE /people/:id/split-config
pub async fn delete_split_config(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(person_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Deleting split config for person {}", person_id);

    // Verify person ownership
    let person = repositories::person::find_by_id(&state.db, person_id).await?;
    if person.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    repositories::person_split_config::delete_config(&state.db, person_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// --- Private helpers ---

/// Calculate debt summary and transaction count from a set of splits.
///
/// Returns `(DebtSummaryResponse, transaction_count)`.
/// - `owes_me`: sum of positive split amounts (they owe you)
/// - `i_owe`: sum of absolute values of negative split amounts (you owe them)
/// - `net`: total sum of all split amounts
/// - `transaction_count`: number of distinct transactions
fn calculate_debt_summary(splits: &[&TransactionSplit]) -> (DebtSummaryResponse, i64) {
    use std::collections::HashSet;

    let zero = BigDecimal::from(0);
    let mut owes_me = zero.clone();
    let mut i_owe = zero.clone();
    let mut net = zero.clone();
    let mut transaction_ids = HashSet::new();

    for split in splits {
        let amount = &split.amount;
        net += amount;

        if *amount > zero {
            owes_me += amount;
        } else if *amount < zero {
            i_owe += amount.abs();
        }

        transaction_ids.insert(split.transaction_id);
    }

    let summary = DebtSummaryResponse {
        owes_me: owes_me.to_string(),
        i_owe: i_owe.to_string(),
        net: net.to_string(),
    };

    (summary, transaction_ids.len() as i64)
}
