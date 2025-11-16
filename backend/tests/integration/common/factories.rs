//! Test data factories for creating test entities.
//!
//! This module provides factory functions to create test data for users, accounts,
//! transactions, categories, and other entities. These factories help create
//! consistent test data with sensible defaults while allowing customization.

use bigdecimal::BigDecimal;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::{
        account::{Account, NewAccount},
        category::{Category, NewCategory},
        person::{NewPerson, Person},
        transaction::{NewTransaction, Transaction},
        user::{NewUser, User},
    },
    schema::{accounts, categories, people, transactions, users},
    types::{AccountType, CurrencyCode},
};
use std::str::FromStr;
use uuid::Uuid;

/// Factory for creating test users with customizable fields.
pub struct UserFactory {
    username: String,
    email: String,
    password_hash: String,
    name: String,
}

impl UserFactory {
    /// Creates a new user factory with default values.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use integration::common::factories::UserFactory;
    ///
    /// let user = UserFactory::new()
    ///     .username("testuser")
    ///     .email("test@example.com")
    ///     .build(&mut conn);
    /// ```
    pub fn new() -> Self {
        Self {
            username: format!("testuser_{}", Uuid::new_v4()),
            email: format!("test_{}@example.com", Uuid::new_v4()),
            password_hash: "hashed_password_for_testing".to_string(),
            name: "Test User".to_string(),
        }
    }

    /// Sets the username.
    pub fn username(mut self, username: &str) -> Self {
        self.username = username.to_string();
        self
    }

    /// Sets the email.
    pub fn email(mut self, email: &str) -> Self {
        self.email = email.to_string();
        self
    }

    /// Sets the password hash.
    pub fn password_hash(mut self, password_hash: &str) -> Self {
        self.password_hash = password_hash.to_string();
        self
    }

    /// Sets the name.
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    /// Builds and inserts the user into the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - Database connection
    ///
    /// # Returns
    ///
    /// The created [`User`] instance
    pub fn build(self, conn: &mut PgConnection) -> User {
        let new_user = NewUser {
            username: self.username,
            email: self.email,
            password_hash: self.password_hash,
            name: self.name,
        };

        diesel::insert_into(users::table)
            .values(&new_user)
            .get_result(conn)
            .expect("Failed to create test user")
    }
}

impl Default for UserFactory {
    fn default() -> Self {
        Self::new()
    }
}

/// Factory for creating test accounts with customizable fields.
pub struct AccountFactory {
    user_id: Uuid,
    name: String,
    account_type: AccountType,
    currency: CurrencyCode,
    notes: Option<String>,
}

impl AccountFactory {
    /// Creates a new account factory for the given user.
    ///
    /// # Arguments
    ///
    /// * `user_id` - The ID of the user who owns this account
    ///
    /// # Example
    ///
    /// ```no_run
    /// use integration::common::factories::AccountFactory;
    ///
    /// let account = AccountFactory::new(user.id)
    ///     .name("Savings Account")
    ///     .account_type(AccountType::Savings)
    ///     .build(&mut conn);
    /// ```
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            name: format!("Test Account {}", Uuid::new_v4()),
            account_type: AccountType::Checking,
            currency: CurrencyCode::Usd,
            notes: None,
        }
    }

    /// Sets the account name.
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    /// Sets the account type.
    pub fn account_type(mut self, account_type: AccountType) -> Self {
        self.account_type = account_type;
        self
    }

    /// Sets the currency.
    pub fn currency(mut self, currency: CurrencyCode) -> Self {
        self.currency = currency;
        self
    }

    /// Sets the notes.
    pub fn notes(mut self, notes: &str) -> Self {
        self.notes = Some(notes.to_string());
        self
    }

    /// Builds and inserts the account into the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - Database connection
    ///
    /// # Returns
    ///
    /// The created [`Account`] instance
    pub fn build(self, conn: &mut PgConnection) -> Account {
        let new_account = NewAccount {
            user_id: self.user_id,
            name: self.name,
            account_type: self.account_type,
            currency: self.currency,
            notes: self.notes,
        };

        diesel::insert_into(accounts::table)
            .values(&new_account)
            .get_result(conn)
            .expect("Failed to create test account")
    }
}

/// Factory for creating test categories with customizable fields.
pub struct CategoryFactory {
    user_id: Uuid,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    parent_id: Option<Uuid>,
}

impl CategoryFactory {
    /// Creates a new category factory for the given user.
    ///
    /// # Arguments
    ///
    /// * `user_id` - The ID of the user who owns this category
    ///
    /// # Example
    ///
    /// ```no_run
    /// use integration::common::factories::CategoryFactory;
    ///
    /// let category = CategoryFactory::new(user.id)
    ///     .name("Groceries")
    ///     .category_type("expense")
    ///     .build(&mut conn);
    /// ```
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            name: format!("Test Category {}", Uuid::new_v4()),
            icon: None,
            color: None,
            parent_id: None,
        }
    }

    /// Sets the category name.
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    /// Sets the category icon.
    pub fn icon(mut self, icon: &str) -> Self {
        self.icon = Some(icon.to_string());
        self
    }

    /// Sets the category color.
    pub fn color(mut self, color: &str) -> Self {
        self.color = Some(color.to_string());
        self
    }

    /// Sets the parent category ID.
    pub fn parent_id(mut self, parent_id: Uuid) -> Self {
        self.parent_id = Some(parent_id);
        self
    }

    /// Builds and inserts the category into the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - Database connection
    ///
    /// # Returns
    ///
    /// The created [`Category`] instance
    pub fn build(self, conn: &mut PgConnection) -> Category {
        let new_category = NewCategory {
            user_id: self.user_id,
            name: self.name,
            icon: self.icon,
            color: self.color,
            parent_id: self.parent_id,
        };

        diesel::insert_into(categories::table)
            .values(&new_category)
            .get_result(conn)
            .expect("Failed to create test category")
    }
}

/// Factory for creating test people with customizable fields.
pub struct PersonFactory {
    user_id: Uuid,
    name: String,
    email: Option<String>,
    phone: Option<String>,
    notes: Option<String>,
}

impl PersonFactory {
    /// Creates a new person factory for the given user.
    ///
    /// # Arguments
    ///
    /// * `user_id` - The ID of the user who owns this person record
    ///
    /// # Example
    ///
    /// ```no_run
    /// use integration::common::factories::PersonFactory;
    ///
    /// let person = PersonFactory::new(user.id)
    ///     .name("John Doe")
    ///     .email("john@example.com")
    ///     .build(&mut conn);
    /// ```
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            name: format!("Test Person {}", Uuid::new_v4()),
            email: None,
            phone: None,
            notes: None,
        }
    }

    /// Sets the person's name.
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    /// Sets the person's email.
    pub fn email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }

    /// Sets the person's phone.
    pub fn phone(mut self, phone: &str) -> Self {
        self.phone = Some(phone.to_string());
        self
    }

    /// Sets the person's notes.
    pub fn notes(mut self, notes: &str) -> Self {
        self.notes = Some(notes.to_string());
        self
    }

    /// Builds and inserts the person into the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - Database connection
    ///
    /// # Returns
    ///
    /// The created [`Person`] instance
    pub fn build(self, conn: &mut PgConnection) -> Person {
        let new_person = NewPerson {
            user_id: self.user_id,
            name: self.name,
            email: self.email,
            phone: self.phone,
            notes: self.notes,
        };

        diesel::insert_into(people::table)
            .values(&new_person)
            .get_result(conn)
            .expect("Failed to create test person")
    }
}

/// Factory for creating test transactions with customizable fields.
pub struct TransactionFactory {
    user_id: Uuid,
    account_id: Uuid,
    amount: BigDecimal,
    title: String,
    date: chrono::DateTime<Utc>,
    category_id: Option<Uuid>,
    notes: Option<String>,
}

impl TransactionFactory {
    /// Creates a new transaction factory for the given user and account.
    ///
    /// # Arguments
    ///
    /// * `user_id` - The ID of the user who owns this transaction
    /// * `account_id` - The ID of the account for this transaction
    ///
    /// # Example
    ///
    /// ```no_run
    /// use integration::common::factories::TransactionFactory;
    ///
    /// let transaction = TransactionFactory::new(user.id, account.id)
    ///     .transaction_type("expense")
    ///     .amount("50.00")
    ///     .description("Groceries")
    ///     .build(&mut conn);
    /// ```
    pub fn new(user_id: Uuid, account_id: Uuid) -> Self {
        Self {
            user_id,
            account_id,
            amount: BigDecimal::from_str("100.00").unwrap(),
            title: "Test Transaction".to_string(),
            date: Utc::now(),
            category_id: None,
            notes: None,
        }
    }

    /// Sets the amount.
    pub fn amount(mut self, amount: &str) -> Self {
        self.amount = BigDecimal::from_str(amount).unwrap();
        self
    }

    /// Sets the title.
    pub fn title(mut self, title: &str) -> Self {
        self.title = title.to_string();
        self
    }

    /// Sets the transaction date.
    pub fn date(mut self, date: chrono::DateTime<Utc>) -> Self {
        self.date = date;
        self
    }

    /// Sets the notes.
    pub fn notes(mut self, notes: &str) -> Self {
        self.notes = Some(notes.to_string());
        self
    }

    /// Sets the category ID.
    pub fn category_id(mut self, category_id: Uuid) -> Self {
        self.category_id = Some(category_id);
        self
    }

    /// Builds and inserts the transaction into the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - Database connection
    ///
    /// # Returns
    ///
    /// The created [`Transaction`] instance
    pub fn build(self, conn: &mut PgConnection) -> Transaction {
        let new_transaction = NewTransaction {
            user_id: self.user_id,
            account_id: self.account_id,
            category_id: self.category_id,
            title: self.title,
            amount: self.amount,
            date: self.date,
            notes: self.notes,
        };

        diesel::insert_into(transactions::table)
            .values(&new_transaction)
            .get_result(conn)
            .expect("Failed to create test transaction")
    }
}

/// Creates a complete test scenario with a user, accounts, categories, and transactions.
///
/// This is useful for quickly setting up a realistic test environment.
///
/// # Arguments
///
/// * `conn` - Database connection
///
/// # Returns
///
/// A tuple containing (user, checking_account, savings_account, expense_category, income_category)
///
/// # Example
///
/// ```no_run
/// use integration::common::factories::create_test_scenario;
///
/// let (user, checking, savings, expense_cat, income_cat) = create_test_scenario(&mut conn);
/// // Now you have a complete test setup ready to use
/// ```
pub fn create_test_scenario(
    conn: &mut PgConnection,
) -> (User, Account, Account, Category, Category) {
    // Create user
    let user = UserFactory::new()
        .username("scenario_user")
        .email("scenario@example.com")
        .name("Scenario Test User")
        .build(conn);

    // Create accounts
    let checking = AccountFactory::new(user.id)
        .name("Checking Account")
        .account_type(AccountType::Checking)
        .build(conn);

    let savings = AccountFactory::new(user.id)
        .name("Savings Account")
        .account_type(AccountType::Savings)
        .currency(CurrencyCode::Usd)
        .build(conn);

    // Create categories
    let expense_category = CategoryFactory::new(user.id).name("Groceries").build(conn);

    let income_category = CategoryFactory::new(user.id).name("Salary").build(conn);

    (user, checking, savings, expense_category, income_category)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_factory_defaults() {
        let factory = UserFactory::new();
        assert!(!factory.username.is_empty());
        assert!(!factory.email.is_empty());
        assert_eq!(factory.password_hash, "hashed_password_for_testing");
    }

    #[test]
    fn test_user_factory_customization() {
        let factory = UserFactory::new()
            .username("custom_user")
            .email("custom@example.com")
            .name("Custom Name");

        assert_eq!(factory.username, "custom_user");
        assert_eq!(factory.email, "custom@example.com");
        assert_eq!(factory.name, "Custom Name");
    }

    #[test]
    fn test_account_factory_defaults() {
        let user_id = Uuid::new_v4();
        let factory = AccountFactory::new(user_id);

        assert_eq!(factory.user_id, user_id);
        assert!(!factory.name.is_empty());
        assert_eq!(factory.account_type, AccountType::Checking);
        assert_eq!(factory.currency, CurrencyCode::Usd);
    }
}
