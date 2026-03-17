pub mod account;
pub mod api_key;
pub mod background_job;
pub mod bank_provider;
pub mod bank_sync;
pub mod budget;
pub mod budget_range;
pub mod bulk_sync;
pub mod bulk_transaction;
pub mod category;
pub mod debt_transaction_metadata;
pub mod drift_detection;
pub mod exchange_rate;
pub mod import;
pub mod investment_provider;
pub mod job_summary;
pub mod parser_error;
pub mod person;
pub mod person_split_config;
pub mod portfolio_sync;
pub mod schedule;
pub mod split_provider;
pub mod split_sync_record;
pub mod transaction;
pub mod transaction_split;
pub mod transfer;
pub mod user;

// Re-export base models
pub use account::{Account, CreateAccount, UpdateAccount};
pub use api_key::ApiKey;
pub use bank_provider::{BankProviderRecord, NewBankProvider};
pub use bank_sync::{BankSyncRecord, NewBankSyncRecord};
pub use budget::{Budget, CreateBudget, UpdateBudget};
pub use budget_range::{BudgetRange, CreateBudgetRange, UpdateBudgetRange};
pub use category::{Category, CreateCategory, UpdateCategory};
pub use debt_transaction_metadata::{DebtTransactionMetadata, NewDebtTransactionMetadata};
pub use investment_provider::{InvestmentProviderRecord, NewInvestmentProvider};
pub use person::{CreatePerson, Person, UpdatePerson};
pub use person_split_config::{PersonSplitConfig, UpdatePersonSplitConfig};
pub use split_provider::{SplitProvider, UpdateSplitProvider};
pub use split_sync_record::{SplitSyncRecord, SyncStatus, UpdateSplitSyncRecord};
pub use transaction::{CreateTransaction, Transaction, UpdateTransaction};
pub use transaction_split::{CreateTransactionSplit, TransactionSplit, UpdateTransactionSplit};
pub use transfer::{NewTransfer, Transfer};
pub use user::{CreateUser, UpdateUser, User};

// Re-export New* structs for insertions
pub use account::NewAccount;
pub use api_key::NewApiKey;
pub use budget::NewBudget;
pub use budget_range::NewBudgetRange;
pub use category::NewCategory;
pub use person::NewPerson;
pub use person_split_config::NewPersonSplitConfig;
pub use split_provider::NewSplitProvider;
pub use split_sync_record::NewSplitSyncRecord;
pub use transaction::NewTransaction;
pub use transaction_split::NewTransactionSplit;
pub use user::NewUser;

// Re-export Request DTOs
pub use account::{CreateAccountRequest, UpdateAccountRequest};
pub use api_key::{CreateApiKeyRequest, UpdateApiKeyRequest};
pub use budget::{CreateBudgetRequest, UpdateBudgetRequest};
pub use budget_range::{CreateBudgetRangeRequest, UpdateBudgetRangeRequest};
pub use category::{CreateCategoryRequest, UpdateCategoryRequest};
pub use debt_transaction_metadata::{CreateDebtTransactionRequest, UpdateExpenseDetailsRequest};
pub use exchange_rate::ExchangeRateQuery;
pub use investment_provider::ConnectInvestmentProviderRequest;
pub use person::{CreatePersonRequest, UpdatePersonRequest};
pub use person_split_config::SetPersonSplitConfigRequest;
pub use portfolio_sync::PortfolioSyncRequest;
pub use split_provider::CreateSplitProviderRequest;
pub use transaction::{
    CreateTransactionRequest, DeleteTransactionQuery, TransactionFilter, TransactionType,
    UpdateTransactionRequest,
};
pub use transfer::CreateTransferRequest;
pub use user::{AuthResponse, CreateUserRequest, LoginRequest};

// Re-export Response DTOs
pub use account::AccountResponse;
pub use api_key::{ApiKeyResponse, CreateApiKeyResponse, ListApiKeysResponse};
pub use budget::BudgetResponse;
pub use budget_range::BudgetRangeResponse;
pub use category::CategoryResponse;
pub use debt_transaction_metadata::DebtMetadataResponse;
pub use exchange_rate::ExchangeRateResponse;
pub use investment_provider::InvestmentProviderResponse;
pub use person::PersonResponse;
pub use person_split_config::PersonSplitConfigResponse;
pub use portfolio_sync::{
    AccountSyncResult, PortfolioSyncJobResponse, PortfolioSyncReport, StartPortfolioSyncResponse,
};
pub use split_provider::{SplitProviderResponse, SplitwiseCredentials};
pub use split_sync_record::SplitSyncStatusResponse;
pub use transaction::TransactionResponse;
pub use transaction_split::TransactionSplitResponse;
pub use transfer::{TransferInfo, TransferResponse};
pub use user::UserResponse;

// Re-export API key specific types
pub use api_key::{ApiKeyScopes, OperationType, ResourceType, ScopePermission};

// Re-export import models
pub use bulk_transaction::{
    BankSyncMetadata, BulkCreateData, BulkCreateError, BulkCreateRequest, BulkCreateResponse,
};
pub use import::{DuplicateMatch, ImportSummary, ParseData, ParseResponse, ParsedTransaction};

// Re-export types from types module for convenience
pub use crate::types::{
    AccountType, ApiKeyStatus, BankProviderType, BudgetPeriod, ConfidenceLevel, CurrencyCode,
    InvestmentProviderType,
};
pub use crate::types::{JobStatus, JobType};

// Re-export background job models
pub use background_job::{BackgroundJob, NewBackgroundJob};

// Re-export drift detection models
pub use drift_detection::{
    DriftDetectionJobResponse, DriftDetectionRequest, DriftReport, DriftSummary, DriftedItem,
    ExternalSplitInfo, LocalSplitInfo, LocalSplitRow, LocalTransactionGroup, MissingOnExternal,
    MissingOnLocal, StartJobResponse, UnmappedUser,
};

// Re-export bulk sync models
pub use bulk_sync::{
    BulkSyncJobResponse, BulkSyncReport, BulkSyncRequest, BulkSyncSummary, StartSyncJobResponse,
    SyncAction, SyncItem, SyncItemResult,
};

// Re-export job summary models
pub use job_summary::{BackgroundJobSummary, ListJobsQuery};

// Re-export bank provider models
pub use bank_provider::{
    BankAuthUrlResponse, BankBalanceResponse, BankProviderResponse, BankSyncImportRequest,
    BankSyncRequest, ExternalBankAccountResponse, LinkExternalAccountRequest,
};
pub use bank_sync::{
    BankImportResult, BankSyncJobResponse, BankSyncReport, BankSyncSummary, FetchedBankTransaction,
    StartBankSyncResponse,
};

// Re-export schedule models
pub use schedule::{
    CreateScheduleRequest, NewSchedule, Schedule, ScheduleDetailResponse, ScheduleResponse,
    UpdateSchedule, UpdateScheduleRequest,
};
