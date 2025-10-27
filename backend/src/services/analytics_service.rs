use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{TransactionFilter, TransactionResponse},
    repositories,
};

/// Net worth calculation result
#[derive(Debug, serde::Serialize)]
pub struct NetWorth {
    pub total: String,
    pub accounts: Vec<AccountBalance>,
}

#[derive(Debug, serde::Serialize)]
pub struct AccountBalance {
    pub account_id: Uuid,
    pub account_name: String,
    pub balance: String,
}

/// Spending trend data point
#[derive(Debug, serde::Serialize)]
pub struct SpendingTrendPoint {
    pub date: String,
    pub amount: String,
}

/// Category breakdown item
#[derive(Debug, Clone, serde::Serialize)]
pub struct CategoryBreakdown {
    pub category_id: Option<Uuid>,
    pub category_name: Option<String>,
    pub total: String,
    pub percentage: f64,
}

/// Dashboard summary with all key metrics
#[derive(Debug, serde::Serialize)]
pub struct DashboardSummary {
    pub net_worth: String,
    pub recent_transactions: Vec<TransactionResponse>,
    pub budget_statuses: Vec<super::budget_service::BudgetStatus>,
    pub category_breakdown: Vec<CategoryBreakdown>,
    pub top_spending_categories: Vec<CategoryBreakdown>,
}

/// Calculate net worth (sum of all account balances)
pub async fn calculate_net_worth(pool: &DbPool, user_id: Uuid) -> Result<NetWorth, ApiError> {
    // Get all user accounts
    let accounts = repositories::account::list_by_user(pool, user_id).await?;

    let mut account_balances = Vec::new();
    let mut total = BigDecimal::from(0);

    for account in accounts {
        let balance = repositories::account::calculate_balance(pool, account.id).await?;
        total += balance.clone();

        account_balances.push(AccountBalance {
            account_id: account.id,
            account_name: account.name,
            balance: balance.to_string(),
        });
    }

    Ok(NetWorth {
        total: total.to_string(),
        accounts: account_balances,
    })
}

/// Get spending trend over a date range
/// Groups transactions by date and calculates daily spending
pub async fn get_spending_trend(
    pool: &DbPool,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> Result<Vec<SpendingTrendPoint>, ApiError> {
    // Get transactions in date range
    let filter = TransactionFilter {
        account_id: None,
        category_id: None,
        start_date: Some(start_date),
        end_date: Some(end_date),
        min_amount: None,
        max_amount: None,
        search: None,
        limit: None,
        offset: None,
    };

    let transactions = repositories::transaction::list_transactions(pool, user_id, filter).await?;

    // Group by date
    let mut daily_spending: HashMap<String, BigDecimal> = HashMap::new();

    for transaction in transactions {
        // Only count expenses (negative amounts)
        if transaction.amount < BigDecimal::from(0) {
            let date_key = transaction.date.format("%Y-%m-%d").to_string();
            let spending = transaction.amount.abs();

            daily_spending
                .entry(date_key)
                .and_modify(|total| *total += spending.clone())
                .or_insert(spending);
        }
    }

    // Convert to sorted vector
    let mut trend: Vec<SpendingTrendPoint> = daily_spending
        .into_iter()
        .map(|(date, amount)| SpendingTrendPoint {
            date,
            amount: amount.to_string(),
        })
        .collect();

    trend.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(trend)
}

/// Get category breakdown for spending
pub async fn get_category_breakdown(
    pool: &DbPool,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> Result<Vec<CategoryBreakdown>, ApiError> {
    // Get transactions in date range
    let filter = TransactionFilter {
        account_id: None,
        category_id: None,
        start_date: Some(start_date),
        end_date: Some(end_date),
        min_amount: None,
        max_amount: None,
        search: None,
        limit: None,
        offset: None,
    };

    let transactions = repositories::transaction::list_transactions(pool, user_id, filter).await?;

    // Group by category
    let mut category_totals: HashMap<Option<Uuid>, BigDecimal> = HashMap::new();
    let mut total_spending = BigDecimal::from(0);

    for transaction in &transactions {
        // Only count expenses (negative amounts)
        if transaction.amount < BigDecimal::from(0) {
            let spending = transaction.amount.abs();
            total_spending += spending.clone();

            category_totals
                .entry(transaction.category_id)
                .and_modify(|total| *total += spending.clone())
                .or_insert(spending);
        }
    }

    // Get category names
    let mut breakdown = Vec::new();

    for (category_id, total) in category_totals {
        let category_name = if let Some(id) = category_id {
            match repositories::category::find_by_id(pool, id).await {
                Ok(cat) => Some(cat.name),
                Err(_) => None,
            }
        } else {
            None
        };

        let percentage = if total_spending > BigDecimal::from(0) {
            let ratio = &total / &total_spending;
            ratio.to_string().parse::<f64>().unwrap_or(0.0) * 100.0
        } else {
            0.0
        };

        breakdown.push(CategoryBreakdown {
            category_id,
            category_name,
            total: total.to_string(),
            percentage,
        });
    }

    // Sort by total (descending)
    breakdown.sort_by(|a, b| {
        let a_total = BigDecimal::from_str(&a.total).unwrap_or_default();
        let b_total = BigDecimal::from_str(&b.total).unwrap_or_default();
        b_total.cmp(&a_total)
    });

    Ok(breakdown)
}

/// Get dashboard summary with all key metrics
/// Uses tokio::join! to run queries in parallel
pub async fn get_dashboard_summary(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<DashboardSummary, ApiError> {
    // Calculate date range for last 30 days
    let end_date = Utc::now();
    let start_date = end_date - chrono::Duration::days(30);

    // Run queries in parallel using tokio::join!
    let (net_worth_result, recent_transactions_result, budgets_result, category_breakdown_result) = tokio::join!(
        calculate_net_worth(pool, user_id),
        get_recent_transactions(pool, user_id),
        get_all_budget_statuses(pool, user_id),
        get_category_breakdown(pool, user_id, start_date, end_date)
    );

    // Handle results
    let net_worth = net_worth_result?;
    let recent_transactions = recent_transactions_result?;
    let budget_statuses = budgets_result?;
    let category_breakdown = category_breakdown_result?;

    // Get top 5 spending categories
    let top_spending_categories = category_breakdown.iter().take(5).cloned().collect();

    Ok(DashboardSummary {
        net_worth: net_worth.total,
        recent_transactions,
        budget_statuses,
        category_breakdown,
        top_spending_categories,
    })
}

/// Helper: Get recent transactions (last 10)
async fn get_recent_transactions(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<TransactionResponse>, ApiError> {
    let filter = TransactionFilter {
        account_id: None,
        category_id: None,
        start_date: None,
        end_date: None,
        min_amount: None,
        max_amount: None,
        search: None,
        limit: Some(10),
        offset: None,
    };

    let transactions = repositories::transaction::list_transactions(pool, user_id, filter).await?;

    Ok(transactions
        .into_iter()
        .map(TransactionResponse::from)
        .collect())
}

/// Helper: Get all budget statuses for user
async fn get_all_budget_statuses(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<super::budget_service::BudgetStatus>, ApiError> {
    let budgets = repositories::budget::list_by_user(pool, user_id).await?;

    let mut statuses = Vec::new();

    for budget in budgets {
        // Try to calculate status, skip if no active range
        match super::budget_service::calculate_budget_status(pool, budget.id, user_id).await {
            Ok(status) => statuses.push(status),
            Err(ApiError::NotFound(_)) => continue, // Skip budgets without active ranges
            Err(e) => return Err(e),
        }
    }

    Ok(statuses)
}

// Re-export BigDecimal::from_str for use in this module
use std::str::FromStr;
