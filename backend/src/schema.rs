// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "account_type"))]
    pub struct AccountType;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "budget_period"))]
    pub struct BudgetPeriod;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "currency_code"))]
    pub struct CurrencyCode;
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
    use super::sql_types::BudgetPeriod;

    budget_ranges (id) {
        id -> Uuid,
        budget_id -> Uuid,
        limit_amount -> Numeric,
        period -> BudgetPeriod,
        start_date -> Date,
        end_date -> Date,
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
diesel::joinable!(budget_ranges -> budgets (budget_id));
diesel::joinable!(budgets -> users (user_id));
diesel::joinable!(categories -> users (user_id));
diesel::joinable!(people -> users (user_id));
diesel::joinable!(transaction_splits -> people (person_id));
diesel::joinable!(transaction_splits -> transactions (transaction_id));
diesel::joinable!(transactions -> accounts (account_id));
diesel::joinable!(transactions -> categories (category_id));
diesel::joinable!(transactions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    accounts,
    budget_ranges,
    budgets,
    categories,
    people,
    transaction_splits,
    transactions,
    users,
);
