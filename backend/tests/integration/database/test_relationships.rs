use super::common;

use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::{Account, NewAccount, User};
use master_of_coin_backend::schema::{accounts, users};
use master_of_coin_backend::types::{AccountType, CurrencyCode};
use serial_test::serial;

#[test]
#[serial]
fn test_user_has_many_accounts() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    let user = common::create_test_user(&mut conn, "has_accounts").expect("Failed to create user");

    // Create multiple accounts for the user
    let account1 = NewAccount {
        user_id: user.id,
        name: "Checking Account".to_string(),
        account_type: AccountType::Checking,
        currency: CurrencyCode::Usd,
        notes: None,
    };

    let account2 = NewAccount {
        user_id: user.id,
        name: "Savings Account".to_string(),
        account_type: AccountType::Savings,
        currency: CurrencyCode::Usd,
        notes: None,
    };

    diesel::insert_into(accounts::table)
        .values(&account1)
        .execute(&mut conn)
        .expect("Failed to create account1");

    diesel::insert_into(accounts::table)
        .values(&account2)
        .execute(&mut conn)
        .expect("Failed to create account2");

    // Query all accounts for the user
    let user_accounts: Vec<Account> = accounts::table
        .filter(accounts::user_id.eq(user.id))
        .load(&mut conn)
        .expect("Failed to load user accounts");

    assert_eq!(user_accounts.len(), 2);
    assert!(user_accounts.iter().any(|a| a.name == "Checking Account"));
    assert!(user_accounts.iter().any(|a| a.name == "Savings Account"));

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_multiple_users_with_accounts() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    // Create two users
    let created_user1 =
        common::create_test_user(&mut conn, "multi_user1").expect("Failed to create user1");

    let created_user2 =
        common::create_test_user(&mut conn, "multi_user2").expect("Failed to create user2");

    // Create accounts for each user
    let account1 = NewAccount {
        user_id: created_user1.id,
        name: "User1 Checking".to_string(),
        account_type: AccountType::Checking,
        currency: CurrencyCode::Usd,
        notes: None,
    };

    let account2 = NewAccount {
        user_id: created_user2.id,
        name: "User2 Savings".to_string(),
        account_type: AccountType::Savings,
        currency: CurrencyCode::Eur,
        notes: None,
    };

    diesel::insert_into(accounts::table)
        .values(&account1)
        .execute(&mut conn)
        .expect("Failed to create account1");

    diesel::insert_into(accounts::table)
        .values(&account2)
        .execute(&mut conn)
        .expect("Failed to create account2");

    // Query accounts for user1
    let user1_accounts: Vec<Account> = accounts::table
        .filter(accounts::user_id.eq(created_user1.id))
        .load(&mut conn)
        .expect("Failed to load user1 accounts");

    assert_eq!(user1_accounts.len(), 1);
    assert_eq!(user1_accounts[0].name, "User1 Checking");
    assert_eq!(user1_accounts[0].account_type, AccountType::Checking);

    // Query accounts for user2
    let user2_accounts: Vec<Account> = accounts::table
        .filter(accounts::user_id.eq(created_user2.id))
        .load(&mut conn)
        .expect("Failed to load user2 accounts");

    assert_eq!(user2_accounts.len(), 1);
    assert_eq!(user2_accounts[0].name, "User2 Savings");
    assert_eq!(user2_accounts[0].account_type, AccountType::Savings);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_account_belongs_to_user() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");

    let user = common::create_test_user(&mut conn, "belongs_to").expect("Failed to create user");

    let new_account = NewAccount {
        user_id: user.id,
        name: "Test Account".to_string(),
        account_type: AccountType::Checking,
        currency: CurrencyCode::Usd,
        notes: None,
    };

    let account: Account = diesel::insert_into(accounts::table)
        .values(&new_account)
        .get_result(&mut conn)
        .expect("Failed to create account");

    // Query the user through the account
    let found_user: User = users::table
        .filter(users::id.eq(account.user_id))
        .first(&mut conn)
        .expect("Failed to find user");

    assert_eq!(found_user.id, user.id);
    assert_eq!(found_user.username, user.username);

    common::cleanup_test_data(&mut conn);
}
