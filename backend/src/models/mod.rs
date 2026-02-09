pub mod account;
pub mod api_key;
pub mod budget;
pub mod budget_range;
pub mod bulk_transaction;
pub mod category;
pub mod exchange_rate;
pub mod import;
pub mod parser_error;
pub mod person;
pub mod transaction;
pub mod transaction_split;
pub mod user;

// Re-export base models
pub use account::{Account, CreateAccount, UpdateAccount};
pub use api_key::ApiKey;
pub use budget::{Budget, CreateBudget, UpdateBudget};
pub use budget_range::{BudgetRange, CreateBudgetRange, UpdateBudgetRange};
pub use category::{Category, CreateCategory, UpdateCategory};
pub use person::{CreatePerson, Person, UpdatePerson};
pub use transaction::{CreateTransaction, Transaction, UpdateTransaction};
pub use transaction_split::{CreateTransactionSplit, TransactionSplit, UpdateTransactionSplit};
pub use user::{CreateUser, UpdateUser, User};

// Re-export New* structs for insertions
pub use account::NewAccount;
pub use api_key::NewApiKey;
pub use budget::NewBudget;
pub use budget_range::NewBudgetRange;
pub use category::NewCategory;
pub use person::NewPerson;
pub use transaction::NewTransaction;
pub use transaction_split::NewTransactionSplit;
pub use user::NewUser;

// Re-export Request DTOs
pub use account::{CreateAccountRequest, UpdateAccountRequest};
pub use api_key::{CreateApiKeyRequest, UpdateApiKeyRequest};
pub use budget::{CreateBudgetRequest, UpdateBudgetRequest};
pub use budget_range::{CreateBudgetRangeRequest, UpdateBudgetRangeRequest};
pub use category::{CreateCategoryRequest, UpdateCategoryRequest};
pub use exchange_rate::ExchangeRateQuery;
pub use person::{CreatePersonRequest, UpdatePersonRequest};
pub use transaction::{
    CreateTransactionRequest, TransactionFilter, TransactionType, UpdateTransactionRequest,
};
pub use user::{AuthResponse, CreateUserRequest, LoginRequest};

// Re-export Response DTOs
pub use account::AccountResponse;
pub use api_key::{ApiKeyResponse, CreateApiKeyResponse, ListApiKeysResponse};
pub use budget::BudgetResponse;
pub use budget_range::BudgetRangeResponse;
pub use category::CategoryResponse;
pub use exchange_rate::ExchangeRateResponse;
pub use person::PersonResponse;
pub use transaction::TransactionResponse;
pub use transaction_split::TransactionSplitResponse;
pub use user::UserResponse;

// Re-export API key specific types
pub use api_key::{ApiKeyScopes, OperationType, ResourceType, ScopePermission};

// Re-export import models
pub use bulk_transaction::{
    BulkCreateData, BulkCreateError, BulkCreateRequest, BulkCreateResponse,
};
pub use import::{DuplicateMatch, ImportSummary, ParseData, ParseResponse, ParsedTransaction};

// Re-export types from types module for convenience
pub use crate::types::{AccountType, ApiKeyStatus, BudgetPeriod, ConfidenceLevel, CurrencyCode};
