# Business Logic

## Overview

This document defines the core business rules and logic for Master of Coin's financial tracking features.

## Transaction Management

### Transaction Creation Rules

1. **Basic Transaction**
   - Must have: title, amount, date, account_id, user_id
   - Amount can be positive (income) or negative (expense)
   - Date cannot be in the future (configurable)
   - Must belong to an existing account owned by the user

2. **Split Payment Transactions**
   - Total splits cannot exceed transaction amount
   - Each split must reference a valid person
   - User's share = transaction amount - sum of all splits
   - Splits create debt records automatically

### Split Payment Calculation

```rust
// services/transaction_service.rs
pub struct SplitCalculation {
    pub transaction_amount: Decimal,
    pub splits: Vec<Split>,
    pub user_share: Decimal,
}

impl SplitCalculation {
    pub fn calculate(transaction_amount: Decimal, splits: Vec<Split>) -> Result<Self> {
        let total_splits: Decimal = splits.iter().map(|s| s.amount).sum();
        
        // Validation
        if total_splits > transaction_amount {
            return Err(BusinessError::SplitsExceedTotal);
        }
        
        let user_share = transaction_amount - total_splits;
        
        Ok(Self {
            transaction_amount,
            splits,
            user_share,
        })
    }
}
```

### Transaction Categories

- User-defined categories (no predefined list)
- Each transaction can have ONE category
- Categories can be hierarchical (optional: parent_category_id)
- Deleting a category does NOT delete transactions (set to null or "Uncategorized")

## Account Management

### Account Types

```rust
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
    Loan,
    Other,
}
```

### Account Balance Calculation

```rust
pub async fn calculate_balance(account_id: Uuid) -> Result<Decimal> {
    // Sum all transactions for this account
    let balance = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(amount), 0) as balance
        FROM transactions
        WHERE account_id = $1
        "#,
        account_id
    )
    .fetch_one(&pool)

### Budget Model - Ranges with Periods

**IMPORTANT: Budgets have multiple ranges, each with a period type**

```rust
pub enum BudgetPeriod {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,              // e.g., "Food Budget"
    pub filters: BudgetFilters,    // What transactions to track
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct BudgetRange {
    pub id: Uuid,
    pub budget_id: Uuid,           // Links to parent budget
    pub limit_amount: Decimal,     // Maximum spending per period
    pub period: BudgetPeriod,      // How often the limit applies
    pub start_date: Date,          // When this range starts
    pub end_date: Date,            // When this range ends
    pub created_at: DateTime<Utc>,
}
```

**Example: Food Budget evolving over time**
```
Budget: "Food Budget" (filters: category = "Food")
  Range 1: 
    - Applicable: Jan 2025 - Dec 2025
    - Limit: €100 per MONTH
    - Period: Monthly
  
  Range 2:
    - Applicable: Jan 2026 - Dec 2026  
    - Limit: €150 per MONTH (increased for inflation)
    - Period: Monthly
  
  Range 3:
    - Applicable: Jun 2026 - Aug 2026
    - Limit: €50 per WEEK (tighter control during summer)
    - Period: Weekly
```

**Calculation Logic:**
- For a given date, find the active range (date falls within start_date and end_date)
- Apply the limit based on the period (daily/weekly/monthly/etc.)
- Example: If today is July 15, 2026, use Range 3 (€50/week)

    .await?;
    
    Ok(balance)
}
```

### Account Rules

- Balance is calculated, not stored (sum of all transactions)
- Credit cards: negative balance = amount owed
- Cannot delete account with transactions (must transfer or delete transactions first)
- Each account belongs to one user

## Budget Management

### Budget Types

1. **Category Budget**: Tracks spending in a specific category
2. **Custom Budget**: Tracks spending based on custom filters

### Budget Calculation

```rust
pub struct BudgetStatus {
    pub limit: Decimal,
    pub spent: Decimal,
    pub remaining: Decimal,
    pub percentage: f64,
    pub status: BudgetHealth,
}

pub enum BudgetHealth {
    Good,      // < 80%
    Warning,   // 80-100%
    Exceeded,  // > 100%
}

impl BudgetStatus {
    pub fn calculate(limit: Decimal, spent: Decimal) -> Self {
        let remaining = limit - spent;
        let percentage = (spent / limit * Decimal::from(100)).to_f64().unwrap_or(0.0);
        
        let status = match percentage {
            p if p < 80.0 => BudgetHealth::Good,
            p if p <= 100.0 => BudgetHealth::Warning,
            _ => BudgetHealth::Exceeded,
        };
        
        Self {
            limit,
            spent,
            remaining,
            percentage,
            status,
        }
    }
}
```

### Budget Rules

- Budgets are monthly by default
- Can have multiple budgets for same category (different months)
- Budget filters are stored as JSON for flexibility
- Auto-categorization: transactions matching filters count toward budget

### Budget Filters

Budgets use flexible JSON filters to match transactions. Wildcards are supported for "all accounts" scenarios.

```json
{
  "category_id": "uuid",           // Optional: specific category
  "account_ids": ["uuid1", "uuid2"], // Optional: specific accounts, or ["*"] for all
  "min_amount": 0,                 // Optional: minimum transaction amount
  "max_amount": 1000               // Optional: maximum transaction amount
}
```

**Wildcard Support:**
- `account_ids: ["*"]` - Matches ALL accounts
- `category_id: null` - Matches transactions without category
- Empty filters `{}` - Matches ALL transactions (useful for total spending budget)

## Debt Tracking

### Debt Calculation

```rust
pub struct DebtSummary {
    pub person_id: Uuid,
    pub person_name: String,
    pub total_owed_to_me: Decimal,
    pub total_i_owe: Decimal,
    pub net_balance: Decimal,
}

pub async fn calculate_debt(user_id: Uuid, person_id: Uuid) -> Result<DebtSummary> {
    // Get all splits where this person is involved
    let splits = get_splits_for_person(user_id, person_id).await?;
    
    let mut owed_to_me = Decimal::ZERO;
    let mut i_owe = Decimal::ZERO;
    
    for split in splits {
        if split.paid_by_user {
            // User paid, person owes user
            owed_to_me += split.amount;
        } else {
            // Person paid for user
            i_owe += split.amount;
        }
    }
    
    let net = owed_to_me - i_owe;
    
    Ok(DebtSummary {
        person_id,
        person_name: split.person_name,
        total_owed_to_me: owed_to_me,
        total_i_owe: i_owe,
        net_balance: net,
    })
}
```

### Debt Rules

- Debts are derived from transaction splits
- No separate "debt" entity - calculated on demand
- "Settle up" creates a new transaction that zeros out the debt
- Debt history is preserved through transaction history

### Settlement Transaction

```rust
pub async fn settle_debt(
    user_id: Uuid,
    person_id: Uuid,
    account_id: Uuid,
) -> Result<Transaction> {
    let debt = calculate_debt(user_id, person_id).await?;
    
    if debt.net_balance == Decimal::ZERO {
        return Err(BusinessError::NoDebtToSettle);
    }
    
    // Create settlement transaction
    let transaction = Transaction {
        title: format!("Debt settlement with {}", debt.person_name),
        amount: debt.net_balance,
        account_id,
        category_id: None, // Or "Debt Settlement" category
        date: Utc::now(),
        notes: Some("Automatic debt settlement".to_string()),
        ..Default::default()
    };
    
    create_transaction(user_id, transaction).await
}
```

## Net Worth Calculation

```rust
pub struct NetWorth {
    pub total_assets: Decimal,
    pub total_liabilities: Decimal,
    pub net_worth: Decimal,
    pub change_from_previous: Decimal,
    pub change_percentage: f64,
}

pub async fn calculate_net_worth(user_id: Uuid) -> Result<NetWorth> {
    let accounts = get_user_accounts(user_id).await?;
    
    let mut assets = Decimal::ZERO;
    let mut liabilities = Decimal::ZERO;
    
    for account in accounts {
        let balance = calculate_balance(account.id).await?;
        
        match account.account_type {
            AccountType::CreditCard | AccountType::Loan => {
                // Negative balance = liability
                if balance < Decimal::ZERO {
                    liabilities += balance.abs();
                } else {
                    assets += balance;
                }
            }
            _ => {
                if balance > Decimal::ZERO {
                    assets += balance;
                } else {
                    liabilities += balance.abs();
                }
            }
        }
    }
    
    let net_worth = assets - liabilities;
    
    // Calculate change from previous month
    let previous_net_worth = get_net_worth_for_date(
        user_id,
        Utc::now() - Duration::days(30)
    ).await?;
    
    let change = net_worth - previous_net_worth;
    let change_pct = if previous_net_worth != Decimal::ZERO {
        (change / previous_net_worth * Decimal::from(100))
            .to_f64()
            .unwrap_or(0.0)
    } else {
        0.0
    };
    
    Ok(NetWorth {
        total_assets: assets,
        total_liabilities: liabilities,
        net_worth,
        change_from_previous: change,
        change_percentage: change_pct,
    })
}
```

## Dashboard Analytics

### Dashboard Summary

```rust
pub struct DashboardSummary {
    pub net_worth: NetWorth,
    pub accounts: Vec<AccountSummary>,
    pub budgets: Vec<BudgetStatus>,
    pub recent_transactions: Vec<Transaction>,
    pub spending_trend: Vec<SpendingDataPoint>,
    pub category_breakdown: Vec<CategorySpending>,
}

pub async fn get_dashboard_summary(user_id: Uuid) -> Result<DashboardSummary> {
    // Fetch all data in parallel
    let (net_worth, accounts, budgets, transactions, spending, categories) = tokio::try_join!(
        calculate_net_worth(user_id),
        get_account_summaries(user_id),
        get_current_budgets(user_id),
        get_recent_transactions(user_id, 10),
        get_spending_trend(user_id, 6), // Last 6 months
        get_category_breakdown(user_id, current_month()),
    )?;
    
    Ok(DashboardSummary {
        net_worth,
        accounts,
        budgets,
        recent_transactions: transactions,
        spending_trend: spending,
        category_breakdown: categories,
    })
}
```

## Validation Rules

### Transaction Validation

```rust
impl Validator for CreateTransactionRequest {
    fn validate(&self) -> Result<(), ValidationError> {
        // Title
        if self.title.trim().is_empty() {
            return Err(ValidationError::field("title", "Title cannot be empty"));
        }
        if self.title.len() > 255 {
            return Err(ValidationError::field("title", "Title too long"));
        }
        
        // Amount
        if self.amount == Decimal::ZERO {
            return Err(ValidationError::field("amount", "Amount cannot be zero"));
        }
        
        // Date
        if self.date > Utc::now() {
            return Err(ValidationError::field("date", "Date cannot be in the future"));
        }
        
        // Splits
        if let Some(splits) = &self.splits {
            let total: Decimal = splits.iter().map(|s| s.amount).sum();
            if total > self.amount.abs() {
                return Err(ValidationError::field(
                    "splits",
                    "Split total exceeds transaction amount"
                ));
            }
        }
        
        Ok(())
    }
}
```

### Budget Validation

```rust
impl Validator for CreateBudgetRequest {
    fn validate(&self) -> Result<(), ValidationError> {
        // Limit must be positive
        if self.limit <= Decimal::ZERO {
            return Err(ValidationError::field("limit", "Limit must be positive"));
        }
        
        // Must have filters (which includes category)
        if self.filters.is_none() {
            return Err(ValidationError::field(
                "filters",
                "Must specify budget filters"
            ));
        }
        
        // Month must be valid
        if self.month < 1 || self.month > 12 {
            return Err(ValidationError::field("month", "Invalid month"));
        }
        
        // Year must be reasonable
        let current_year = Utc::now().year();
        if self.year < 2000 || self.year > current_year + 10 {
            return Err(ValidationError::field("year", "Invalid year"));
        }
        
        Ok(())
    }
}
```

## Business Rules Summary

### Transactions
- ✅ Support income and expenses
- ✅ Split payments with automatic debt tracking
- ✅ User-defined categories
- ✅ Cannot be in the future
- ✅ Must belong to an account

### Accounts
- ✅ Multiple account types
- ✅ Calculated balances
- ✅ Cannot delete with transactions
- ✅ Support for assets and liabilities

### Budgets
- ✅ Monthly tracking
- ✅ Category or filter-based
- ✅ Auto-categorization
- ✅ Health status (good/warning/exceeded)
- ✅ Multiple budgets per category

### Debts
- ✅ Derived from splits
- ✅ Bidirectional tracking
- ✅ Settlement transactions
- ✅ Historical preservation

### Analytics
- ✅ Net worth calculation
- ✅ Spending trends
- ✅ Category breakdowns
- ✅ Dashboard summaries
- ✅ Parallel data fetching
