// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "account_type"))]
    pub struct AccountType;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "api_key_status"))]
    pub struct ApiKeyStatus;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "budget_period"))]
    pub struct BudgetPeriod;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "currency_code"))]
    pub struct CurrencyCode;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "investment_provider_type"))]
    pub struct InvestmentProviderType;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "job_status"))]
    pub struct JobStatus;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "job_type"))]
    pub struct JobType;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "split_provider_type"))]
    pub struct SplitProviderType;
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AccountType;
    use super::sql_types::CurrencyCode;

    accounts (id) {
        id -> Uuid,
        user_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        #[sql_name = "type"]
        type_ -> AccountType,
        currency -> CurrencyCode,
        notes -> Nullable<Text>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ApiKeyStatus;

    api_keys (id) {
        id -> Uuid,
        user_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 255]
        key_hash -> Varchar,
        #[max_length = 20]
        key_prefix -> Varchar,
        scopes -> Jsonb,
        status -> ApiKeyStatus,
        expires_at -> Nullable<Timestamptz>,
        last_used_at -> Nullable<Timestamptz>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::JobType;
    use super::sql_types::JobStatus;

    background_jobs (id) {
        id -> Uuid,
        user_id -> Uuid,
        job_type -> JobType,
        status -> JobStatus,
        previous_job_id -> Nullable<Uuid>,
        input -> Nullable<Jsonb>,
        result -> Nullable<Jsonb>,
        error -> Nullable<Text>,
        created_at -> Timestamptz,
        started_at -> Nullable<Timestamptz>,
        completed_at -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::BudgetPeriod;

    budget_ranges (id) {
        id -> Uuid,
        budget_id -> Uuid,
        limit_amount -> Numeric,
        period -> BudgetPeriod,
        start_date -> Date,
        end_date -> Nullable<Date>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    budgets (id) {
        id -> Uuid,
        user_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        filters -> Jsonb,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    categories (id) {
        id -> Uuid,
        user_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 50]
        icon -> Nullable<Varchar>,
        #[max_length = 7]
        color -> Nullable<Varchar>,
        parent_id -> Nullable<Uuid>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    debt_transaction_metadata (id) {
        id -> Uuid,
        transaction_id -> Uuid,
        payer_person_id -> Uuid,
        created_at -> Timestamptz,
        total_cost -> Numeric,
        expense_participants -> Nullable<Jsonb>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::InvestmentProviderType;

    investment_providers (id) {
        id -> Uuid,
        user_id -> Uuid,
        account_id -> Uuid,
        provider_type -> InvestmentProviderType,
        credentials -> Jsonb,
        is_active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    people (id) {
        id -> Uuid,
        user_id -> Uuid,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 255]
        email -> Nullable<Varchar>,
        #[max_length = 50]
        phone -> Nullable<Varchar>,
        notes -> Nullable<Text>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    person_split_configs (id) {
        id -> Uuid,
        person_id -> Uuid,
        split_provider_id -> Uuid,
        #[max_length = 255]
        external_user_id -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::JobType;

    schedules (id) {
        id -> Uuid,
        user_id -> Uuid,
        name -> Text,
        job_type -> JobType,
        cron_expr -> Text,
        parameters -> Nullable<Jsonb>,
        is_active -> Bool,
        next_run_at -> Nullable<Timestamptz>,
        last_run_at -> Nullable<Timestamptz>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::SplitProviderType;

    split_providers (id) {
        id -> Uuid,
        user_id -> Uuid,
        provider_type -> SplitProviderType,
        credentials -> Jsonb,
        is_active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    split_sync_records (id) {
        id -> Uuid,
        transaction_split_id -> Uuid,
        split_provider_id -> Uuid,
        #[max_length = 255]
        external_expense_id -> Nullable<Varchar>,
        #[max_length = 20]
        sync_status -> Varchar,
        last_sync_at -> Nullable<Timestamptz>,
        last_error -> Nullable<Text>,
        retry_count -> Int4,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    transaction_splits (id) {
        id -> Uuid,
        transaction_id -> Uuid,
        person_id -> Uuid,
        amount -> Numeric,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    transactions (id) {
        id -> Uuid,
        user_id -> Uuid,
        account_id -> Uuid,
        category_id -> Nullable<Uuid>,
        #[max_length = 255]
        title -> Varchar,
        amount -> Numeric,
        date -> Timestamptz,
        notes -> Nullable<Text>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    transfers (id) {
        id -> Uuid,
        from_transaction_id -> Uuid,
        to_transaction_id -> Uuid,
        exchange_rate -> Numeric,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        #[max_length = 50]
        username -> Varchar,
        #[max_length = 255]
        email -> Varchar,
        #[max_length = 255]
        password_hash -> Varchar,
        #[max_length = 255]
        name -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(accounts -> users (user_id));
diesel::joinable!(api_keys -> users (user_id));
diesel::joinable!(background_jobs -> users (user_id));
diesel::joinable!(budget_ranges -> budgets (budget_id));
diesel::joinable!(budgets -> users (user_id));
diesel::joinable!(categories -> users (user_id));
diesel::joinable!(debt_transaction_metadata -> people (payer_person_id));
diesel::joinable!(debt_transaction_metadata -> transactions (transaction_id));
diesel::joinable!(investment_providers -> accounts (account_id));
diesel::joinable!(investment_providers -> users (user_id));
diesel::joinable!(people -> users (user_id));
diesel::joinable!(person_split_configs -> people (person_id));
diesel::joinable!(person_split_configs -> split_providers (split_provider_id));
diesel::joinable!(schedules -> users (user_id));
diesel::joinable!(split_providers -> users (user_id));
diesel::joinable!(split_sync_records -> split_providers (split_provider_id));
diesel::joinable!(split_sync_records -> transaction_splits (transaction_split_id));
diesel::joinable!(transaction_splits -> people (person_id));
diesel::joinable!(transaction_splits -> transactions (transaction_id));
diesel::joinable!(transactions -> accounts (account_id));
diesel::joinable!(transactions -> categories (category_id));
diesel::joinable!(transactions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    accounts,
    api_keys,
    background_jobs,
    budget_ranges,
    budgets,
    categories,
    debt_transaction_metadata,
    investment_providers,
    people,
    person_split_configs,
    schedules,
    split_providers,
    split_sync_records,
    transaction_splits,
    transactions,
    transfers,
    users,
);
