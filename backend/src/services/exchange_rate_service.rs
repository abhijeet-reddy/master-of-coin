//! Exchange rate provider trait and primary currency constant.
//!
//! This module defines the `ExchangeRateProvider` trait that abstracts exchange rate
//! fetching. Implementations live in separate modules:
//! - [`LiveExchangeRateProvider`](super::live_exchange_rate::LiveExchangeRateProvider) — production (calls exchangerate-api.com)
//! - [`MockExchangeRateProvider`](super::mock_exchange_rate::MockExchangeRateProvider) — testing (fixed deterministic rates)

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use std::collections::HashMap;

use crate::errors::ApiError;
use crate::types::CurrencyCode;

/// Primary currency for the application.
/// TODO: Fetch from user settings in database
pub const PRIMARY_CURRENCY: CurrencyCode = CurrencyCode::Eur;

/// Trait for exchange rate providers.
///
/// This abstraction allows swapping between a live API provider (production)
/// and a mock provider (testing) without changing business logic.
///
/// Only `get_exchange_rates` must be implemented; `convert_currency` and
/// `convert_to_primary_currency` have default implementations built on top of it.
#[async_trait]
pub trait ExchangeRateProvider: Send + Sync {
    /// Get exchange rates for a given base currency.
    /// Returns a map of currency codes to their exchange rates relative to the base.
    async fn get_exchange_rates(
        &self,
        base_currency: CurrencyCode,
    ) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError>;

    /// Convert an amount from one currency to another.
    /// Fetches exchange rates with the source currency as base for direct conversion.
    /// This eliminates compounding errors from intermediate conversions.
    async fn convert_currency(
        &self,
        amount: &BigDecimal,
        from_currency: CurrencyCode,
        to_currency: CurrencyCode,
    ) -> Result<BigDecimal, ApiError> {
        // If currencies are the same, return the amount as-is
        if from_currency == to_currency {
            return Ok(amount.clone());
        }

        // Fetch rates with source currency as base for direct conversion
        let rates = self.get_exchange_rates(from_currency).await?;

        // Get the direct conversion rate from source to target
        let to_rate = rates.get(&to_currency).ok_or_else(|| {
            tracing::error!(
                "No exchange rate found for {} to {}",
                from_currency.as_str(),
                to_currency.as_str()
            );
            ApiError::Internal
        })?;

        // Direct conversion: amount_in_from * rate_to_target
        let converted_amount = amount * to_rate;

        tracing::debug!(
            "Converted {} {} to {} {} (rate: {})",
            amount,
            from_currency.as_str(),
            converted_amount,
            to_currency.as_str(),
            to_rate
        );

        Ok(converted_amount)
    }

    /// Convert an amount to the primary currency.
    async fn convert_to_primary_currency(
        &self,
        amount: &BigDecimal,
        from_currency: CurrencyCode,
    ) -> Result<BigDecimal, ApiError> {
        self.convert_currency(amount, from_currency, PRIMARY_CURRENCY)
            .await
    }
}

// Re-export implementations for convenience
pub use super::live_exchange_rate::LiveExchangeRateProvider;
pub use super::mock_exchange_rate::MockExchangeRateProvider;

/// Type alias for backward compatibility during migration.
/// New code should use `LiveExchangeRateProvider` directly.
pub type ExchangeRateService = LiveExchangeRateProvider;
