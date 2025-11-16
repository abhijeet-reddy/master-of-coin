use super::common;

use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::{Account, NewAccount};
use master_of_coin_backend::schema::accounts;
use master_of_coin_backend::types::{AccountType, BudgetPeriod, CurrencyCode};
use serial_test::serial;

#[test]
#[serial]
fn test_account_type_enum() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    let user = common::create_test_user(&mut conn, "account_type").expect("Failed to create user");

    let account_types = vec![
        AccountType::Checking,
        AccountType::Savings,
        AccountType::CreditCard,
        AccountType::Investment,
        AccountType::Cash,
    ];

    for (idx, account_type) in account_types.iter().enumerate() {
        let new_account = NewAccount {
            user_id: user.id,
            name: format!("Test Account {}", idx),
            account_type: *account_type,
            currency: CurrencyCode::Usd,
            notes: None,
        };

        let created_account: Account = diesel::insert_into(accounts::table)
            .values(&new_account)
            .get_result(&mut conn)
            .expect("Failed to create account");

        assert_eq!(created_account.account_type, *account_type);

        // Verify we can query it back
        let found_account: Account = accounts::table
            .filter(accounts::id.eq(created_account.id))
            .first(&mut conn)
            .expect("Failed to find account");

        assert_eq!(found_account.account_type, *account_type);
    }

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_currency_code_enum() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    let user = common::create_test_user(&mut conn, "currency").expect("Failed to create user");

    let currencies = vec![
        CurrencyCode::Usd,
        CurrencyCode::Eur,
        CurrencyCode::Gbp,
        CurrencyCode::Inr,
        CurrencyCode::Jpy,
        CurrencyCode::Aud,
        CurrencyCode::Cad,
    ];

    for (idx, currency) in currencies.iter().enumerate() {
        let new_account = NewAccount {
            user_id: user.id,
            name: format!("Currency Test {}", idx),
            account_type: AccountType::Checking,
            currency: *currency,
            notes: None,
        };

        let created_account: Account = diesel::insert_into(accounts::table)
            .values(&new_account)
            .get_result(&mut conn)
            .expect("Failed to create account with currency");

        assert_eq!(created_account.currency, *currency);

        // Verify we can query it back
        let found_account: Account = accounts::table
            .filter(accounts::id.eq(created_account.id))
            .first(&mut conn)
            .expect("Failed to find account");

        assert_eq!(found_account.currency, *currency);
    }

    common::cleanup_test_data(&mut conn);
}

#[test]
fn test_budget_period_enum() {
    // Test that BudgetPeriod enum values can be created and used
    let periods = vec![
        BudgetPeriod::Daily,
        BudgetPeriod::Weekly,
        BudgetPeriod::Monthly,
        BudgetPeriod::Quarterly,
        BudgetPeriod::Yearly,
    ];

    // Verify all variants exist and can be compared
    assert_eq!(periods.len(), 5);
    assert_eq!(periods[0], BudgetPeriod::Daily);
    assert_eq!(periods[1], BudgetPeriod::Weekly);
    assert_eq!(periods[2], BudgetPeriod::Monthly);
    assert_eq!(periods[3], BudgetPeriod::Quarterly);
    assert_eq!(periods[4], BudgetPeriod::Yearly);
}

#[test]
#[serial]
fn test_account_with_all_custom_types() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    let user = common::create_test_user(&mut conn, "all_types").expect("Failed to create user");

    // Create an account with custom enum types
    let new_account = NewAccount {
        user_id: user.id,
        name: "Savings Account".to_string(),
        account_type: AccountType::Savings,
        currency: CurrencyCode::Eur,
        notes: Some("Test savings account".to_string()),
    };

    let created_account: Account = diesel::insert_into(accounts::table)
        .values(&new_account)
        .get_result(&mut conn)
        .expect("Failed to create account");

    // Verify all fields
    assert_eq!(created_account.name, "Savings Account");
    assert_eq!(created_account.account_type, AccountType::Savings);
    assert_eq!(created_account.currency, CurrencyCode::Eur);
    assert_eq!(
        created_account.notes,
        Some("Test savings account".to_string())
    );
    assert_eq!(created_account.user_id, user.id);

    // Query it back and verify
    let found_account: Account = accounts::table
        .filter(accounts::id.eq(created_account.id))
        .first(&mut conn)
        .expect("Failed to find account");

    assert_eq!(found_account.account_type, AccountType::Savings);
    assert_eq!(found_account.currency, CurrencyCode::Eur);

    common::cleanup_test_data(&mut conn);
}
