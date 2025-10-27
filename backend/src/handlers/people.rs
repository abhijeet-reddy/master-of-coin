use crate::{
    AppState,
    errors::ApiError,
    models::{
        CreatePersonRequest, NewPerson, PersonResponse, UpdatePerson, UpdatePersonRequest, User,
    },
    repositories, services,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use uuid::Uuid;

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
    Extension(user): Extension<User>,
) -> Result<Json<Vec<PersonResponse>>, ApiError> {
    tracing::info!("Listing people for user {}", user.id);

    let people = repositories::person::list_by_user(&state.db, user.id).await?;

    let responses: Vec<PersonResponse> = people.into_iter().map(|p| p.into()).collect();

    Ok(Json(responses))
}

/// Create a new person
/// POST /people
pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(request): Json<CreatePersonRequest>,
) -> Result<(StatusCode, Json<PersonResponse>), ApiError> {
    tracing::info!("Creating person for user {}", user.id);

    let new_person = NewPerson {
        user_id: user.id,
        name: request.name,
        email: request.email,
        phone: request.phone,
        notes: request.notes,
    };

    let person = repositories::person::create_person(&state.db, user.id, new_person).await?;

    let response = person.into();

    Ok((StatusCode::CREATED, Json(response)))
}

/// Get a single person by ID
/// GET /people/:id
pub async fn get(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<Json<PersonResponse>, ApiError> {
    tracing::debug!("Fetching person {} for user {}", id, user.id);

    let person = repositories::person::find_by_id(&state.db, id).await?;

    // Verify ownership
    if person.user_id != user.id {
        return Err(ApiError::Unauthorized(
            "Person does not belong to user".to_string(),
        ));
    }

    let response = person.into();

    Ok(Json(response))
}

/// Update a person
/// PUT /people/:id
pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdatePersonRequest>,
) -> Result<Json<PersonResponse>, ApiError> {
    tracing::info!("Updating person {} for user {}", id, user.id);

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user.id {
        return Err(ApiError::Unauthorized(
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
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    tracing::info!("Deleting person {} for user {}", id, user.id);

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user.id {
        return Err(ApiError::Unauthorized(
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
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
) -> Result<Json<services::debt_service::PersonDebt>, ApiError> {
    tracing::debug!("Fetching debts for person {} and user {}", id, user.id);

    // Verify ownership
    let person = repositories::person::find_by_id(&state.db, id).await?;
    if person.user_id != user.id {
        return Err(ApiError::Unauthorized(
            "Person does not belong to user".to_string(),
        ));
    }

    let debt_amount =
        services::debt_service::calculate_debt_for_person(&state.db, id, user.id).await?;

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
    Extension(user): Extension<User>,
    Path(id): Path<Uuid>,
    Json(request): Json<SettleDebtRequest>,
) -> Result<StatusCode, ApiError> {
    tracing::info!(
        "Settling debt of {} with person {} for user {}",
        request.amount,
        id,
        user.id
    );

    services::debt_service::settle_debt(&state.db, id, user.id, request.amount, request.account_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
