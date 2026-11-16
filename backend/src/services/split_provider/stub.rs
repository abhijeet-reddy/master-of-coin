//! In-memory [`SplitProvider`] test double.
//!
//! The real providers talk HTTP, so integration tests cannot exercise the matcher
//! (`SplitSyncService::find_split_match` and the sync flow that links or creates
//! expenses) against them. `StubSplitProvider` keeps the expenses it is given and the
//! ones it "creates" in memory, so a test can push a transaction, observe what was
//! created, and then push a second transaction against that same expense list — which
//! is exactly how the already-claimed-expense collision reproduces.
//!
//! Register it with
//! [`SplitSyncService::with_providers`](crate::services::split_sync_service::SplitSyncService::with_providers).
//! It is never part of [`all_providers`](super::all_providers), so production never
//! sees it.

use std::sync::Mutex;

use async_trait::async_trait;
use serde_json::Value;

use super::SplitProvider;
use super::types::{
    CreateExternalExpense, ExternalExpenseDetail, ExternalExpenseResult, ExternalExpenseUser,
    SplitProviderError, UpdateExternalExpense,
};
use crate::types::SplitProviderType;

#[derive(Default)]
struct StubState {
    expenses: Vec<ExternalExpenseDetail>,
    created: Vec<CreateExternalExpense>,
    updated: Vec<String>,
    deleted: Vec<String>,
    next_id: u32,
}

/// Deterministic in-memory split provider for integration tests.
pub struct StubSplitProvider {
    provider_type: SplitProviderType,
    state: Mutex<StubState>,
}

impl StubSplitProvider {
    /// Create a stub that answers for `provider_type` with no expenses.
    pub fn new(provider_type: SplitProviderType) -> Self {
        Self {
            provider_type,
            state: Mutex::new(StubState::default()),
        }
    }

    /// Add an expense that `get_expenses` will offer as a candidate.
    pub fn seed_expense(&self, expense: ExternalExpenseDetail) {
        self.lock().expenses.push(expense);
    }

    /// Every expense the stub currently holds (seeded plus created).
    pub fn expenses(&self) -> Vec<ExternalExpenseDetail> {
        self.lock().expenses.clone()
    }

    /// The expense IDs the stub currently holds, in creation order.
    pub fn expense_ids(&self) -> Vec<String> {
        self.lock()
            .expenses
            .iter()
            .map(|e| e.external_expense_id.clone())
            .collect()
    }

    /// The `create_expense` requests the service made, in order.
    pub fn created(&self) -> Vec<CreateExternalExpense> {
        self.lock().created.clone()
    }

    /// How many expenses the service asked the stub to create.
    pub fn created_count(&self) -> usize {
        self.lock().created.len()
    }

    /// The expense IDs the service asked the stub to update, in order.
    pub fn updated_expense_ids(&self) -> Vec<String> {
        self.lock().updated.clone()
    }

    /// The expense IDs the service asked the stub to delete, in order.
    pub fn deleted_expense_ids(&self) -> Vec<String> {
        self.lock().deleted.clone()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, StubState> {
        self.state.lock().expect("stub provider mutex poisoned")
    }
}

#[async_trait]
impl SplitProvider for StubSplitProvider {
    fn provider_type(&self) -> SplitProviderType {
        self.provider_type
    }

    async fn create_expense(
        &self,
        _credentials: &Value,
        request: CreateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let mut state = self.lock();
        state.next_id += 1;
        let external_expense_id = format!("stub-expense-{}", state.next_id);

        state.expenses.push(ExternalExpenseDetail {
            external_expense_id: external_expense_id.clone(),
            description: request.description.clone(),
            cost: request.cost.clone(),
            currency_code: request.currency_code.clone(),
            date: request.date.to_rfc3339(),
            users: request
                .users
                .iter()
                .map(|u| ExternalExpenseUser {
                    external_user_id: u.external_user_id.clone(),
                    first_name: "Stub".to_string(),
                    last_name: "User".to_string(),
                    paid_share: u.paid_share.clone(),
                    owed_share: u.owed_share.clone(),
                })
                .collect(),
            provider_type: self.provider_type,
        });
        state.created.push(request);

        Ok(ExternalExpenseResult {
            external_expense_id,
            external_url: None,
        })
    }

    async fn update_expense(
        &self,
        _credentials: &Value,
        external_expense_id: &str,
        request: UpdateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let mut state = self.lock();
        state.updated.push(external_expense_id.to_string());

        if let Some(expense) = state
            .expenses
            .iter_mut()
            .find(|e| e.external_expense_id == external_expense_id)
        {
            if let Some(description) = request.description {
                expense.description = description;
            }
            if let Some(cost) = request.cost {
                expense.cost = cost;
            }
            if let Some(date) = request.date {
                expense.date = date.to_rfc3339();
            }
            if let Some(users) = request.users {
                expense.users = users
                    .iter()
                    .map(|u| ExternalExpenseUser {
                        external_user_id: u.external_user_id.clone(),
                        first_name: "Stub".to_string(),
                        last_name: "User".to_string(),
                        paid_share: u.paid_share.clone(),
                        owed_share: u.owed_share.clone(),
                    })
                    .collect();
            }
        }

        Ok(ExternalExpenseResult {
            external_expense_id: external_expense_id.to_string(),
            external_url: None,
        })
    }

    async fn delete_expense(
        &self,
        _credentials: &Value,
        external_expense_id: &str,
    ) -> Result<(), SplitProviderError> {
        let mut state = self.lock();
        state.deleted.push(external_expense_id.to_string());
        state
            .expenses
            .retain(|e| e.external_expense_id != external_expense_id);
        Ok(())
    }

    /// Returns every held expense, optionally narrowed to those involving `friend_id`.
    ///
    /// The date window is ignored on purpose: tests set the dates they want and the
    /// service applies its own cost and candidate filtering on top of this list.
    async fn get_expenses(
        &self,
        _credentials: &Value,
        friend_id: Option<&str>,
        _dated_after: Option<&str>,
        _dated_before: Option<&str>,
        _limit: Option<u32>,
    ) -> Result<Vec<ExternalExpenseDetail>, SplitProviderError> {
        let expenses = self.lock().expenses.clone();

        Ok(match friend_id {
            Some(friend) => expenses
                .into_iter()
                .filter(|e| e.users.iter().any(|u| u.external_user_id == friend))
                .collect(),
            None => expenses,
        })
    }

    async fn get_expense_by_id(
        &self,
        _credentials: &Value,
        external_expense_id: &str,
    ) -> Result<Option<ExternalExpenseDetail>, SplitProviderError> {
        Ok(self
            .lock()
            .expenses
            .iter()
            .find(|e| e.external_expense_id == external_expense_id)
            .cloned())
    }

    async fn validate_credentials(&self, _credentials: &Value) -> Result<bool, SplitProviderError> {
        Ok(true)
    }

    async fn refresh_credentials(
        &self,
        _credentials: &Value,
    ) -> Result<Option<Value>, SplitProviderError> {
        Ok(None)
    }
}
