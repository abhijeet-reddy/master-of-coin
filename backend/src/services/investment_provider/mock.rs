//! Mock investment provider for testing.
//!
//! Returns configurable portfolio values without making real API calls.

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use chrono::Utc;
use std::str::FromStr;

use crate::types::InvestmentProviderType;

use super::InvestmentProvider;
use super::types::{InvestmentProviderError, PortfolioSnapshot};

/// Mock investment provider that returns a fixed portfolio value.
/// Used in integration tests to avoid real API calls.
pub struct MockInvestmentProvider {
    /// The stock value to return
    pub stock_value: f64,
    /// The invested amount to return
    pub invested_amount: f64,
    /// Whether to simulate an error
    pub should_error: bool,
}

impl MockInvestmentProvider {
    pub fn new(stock_value: f64, invested_amount: f64) -> Self {
        Self {
            stock_value,
            invested_amount,
            should_error: false,
        }
    }

    pub fn with_error() -> Self {
        Self {
            stock_value: 0.0,
            invested_amount: 0.0,
            should_error: true,
        }
    }
}

#[async_trait]
impl InvestmentProvider for MockInvestmentProvider {
    fn provider_type(&self) -> InvestmentProviderType {
        InvestmentProviderType::Trading212
    }

    async fn get_portfolio_value(
        &self,
        _credentials: &serde_json::Value,
    ) -> Result<PortfolioSnapshot, InvestmentProviderError> {
        if self.should_error {
            return Err(InvestmentProviderError::ApiError(
                "Mock provider error".to_string(),
            ));
        }

        Ok(PortfolioSnapshot {
            stock_value: BigDecimal::from_str(&format!("{:.2}", self.stock_value)).unwrap(),
            invested_amount: BigDecimal::from_str(&format!("{:.2}", self.invested_amount)).unwrap(),
            currency: "EUR".to_string(),
            timestamp: Utc::now(),
        })
    }
}
