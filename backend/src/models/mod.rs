pub mod account;
pub mod budget;
pub mod budget_range;
pub mod category;
pub mod person;
pub mod transaction;
pub mod transaction_split;
pub mod user;

// Re-export base models
pub use account::{Account, CreateAccount, UpdateAccount};
pub use budget::{Budget, CreateBudget, UpdateBudget};
pub use budget_range::{BudgetRange, CreateBudgetRange, UpdateBudgetRange};
pub use category::{Category, CreateCategory, UpdateCategory};
pub use person::{CreatePerson, Person, UpdatePerson};
pub use transaction::{CreateTransaction, Transaction, UpdateTransaction};
pub use transaction_split::{CreateTransactionSplit, TransactionSplit, UpdateTransactionSplit};
pub use user::{CreateUser, UpdateUser, User};

// Re-export New* structs for insertions
pub use account::NewAccount;
pub use budget::NewBudget;
pub use budget_range::NewBudgetRange;
pub use category::NewCategory;
pub use person::NewPerson;
pub use transaction::NewTransaction;
pub use transaction_split::NewTransactionSplit;
pub use user::NewUser;

// Re-export Request DTOs
pub use account::{CreateAccountRequest, UpdateAccountRequest};
pub use budget::{CreateBudgetRequest, UpdateBudgetRequest};
pub use budget_range::{CreateBudgetRangeRequest, UpdateBudgetRangeRequest};
pub use category::{CategoryType, CreateCategoryRequest, UpdateCategoryRequest};
pub use person::{CreatePersonRequest, UpdatePersonRequest};
pub use transaction::{
    CreateTransactionRequest, TransactionFilter, TransactionType, UpdateTransactionRequest,
};
pub use user::{AuthResponse, CreateUserRequest, LoginRequest};

// Re-export Response DTOs
pub use account::AccountResponse;
pub use budget::BudgetResponse;
pub use budget_range::BudgetRangeResponse;
pub use category::CategoryResponse;
pub use person::PersonResponse;
pub use transaction::TransactionResponse;
pub use user::UserResponse;

// Re-export types from types module for convenience
pub use crate::types::{AccountType, BudgetPeriod, CurrencyCode};
