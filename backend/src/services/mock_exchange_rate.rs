//! Mock exchange rate provider for testing.
//!
//! Returns fixed, deterministic rates that never change and require no external API calls.
//! This eliminates API quota consumption during test runs and makes tests deterministic.
//!
//! Default rates are approximate real-world values (EUR-based):
//! - EUR/USD = 1.08
//! - EUR/GBP = 0.85
//! - EUR/JPY = 162.0
//! - EUR/CAD = 1.47
//! - EUR/AUD = 1.65
//! - EUR/INR = 90.0

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use std::collections::HashMap;
use std::str::FromStr;

use crate::errors::ApiError;
use crate::types::CurrencyCode;

use super::exchange_rate_service::ExchangeRateProvider;

/// Mock exchange rate provider for testing.
///
/// Returns fixed, deterministic rates that never change and require no external API calls.
/// Use `MockExchangeRateProvider::new()` for default rates or
/// `MockExchangeRateProvider::with_rates()` for custom rates.
pub struct MockExchangeRateProvider {
    rates: HashMap<CurrencyCode, HashMap<CurrencyCode, BigDecimal>>,
}

impl MockExchangeRateProvider {
    /// Create a mock provider with default fixed rates.
    pub fn new() -> Self {
        Self {
            rates: Self::default_rates(),
        }
    }

    /// Create a mock provider with custom rates.
    pub fn with_rates(rates: HashMap<CurrencyCode, HashMap<CurrencyCode, BigDecimal>>) -> Self {
        Self { rates }
    }

    /// Build mathematically consistent rate tables for all supported base currencies.
    ///
    /// EUR base rates are defined first, then all other base currency tables
    /// are derived by dividing each EUR rate by the EUR→base rate.
    /// This ensures cross-rates are consistent (no arbitrage).
    fn default_rates() -> HashMap<CurrencyCode, HashMap<CurrencyCode, BigDecimal>> {
        // EUR base rates (the "source of truth")
        let eur_usd = 1.08_f64;
        let eur_gbp = 0.85_f64;
        let eur_jpy = 162.0_f64;
        let eur_cad = 1.47_f64;
        let eur_aud = 1.65_f64;
        let eur_inr = 90.0_f64;

        // Helper to build a rate map for a given base currency.
        // Given the EUR rates for each currency, and the EUR rate for the base,
        // the rate from base→target = eur_target / eur_base.
        let build_rates = |eur_to_base: f64| -> HashMap<CurrencyCode, BigDecimal> {
            let mut map = HashMap::new();
            let pairs: [(CurrencyCode, f64); 7] = [
                (CurrencyCode::Eur, 1.0),
                (CurrencyCode::Usd, eur_usd),
                (CurrencyCode::Gbp, eur_gbp),
                (CurrencyCode::Jpy, eur_jpy),
                (CurrencyCode::Cad, eur_cad),
                (CurrencyCode::Aud, eur_aud),
                (CurrencyCode::Inr, eur_inr),
            ];
            for (currency, eur_to_target) in pairs {
                let rate = eur_to_target / eur_to_base;
                // Use string conversion to get clean BigDecimal values
                let rate_str = format!("{:.6}", rate);
                map.insert(
                    currency,
                    BigDecimal::from_str(&rate_str).unwrap_or_else(|_| BigDecimal::from(0)),
                );
            }
            map
        };

        let mut all_rates = HashMap::new();

        // EUR base (eur_to_base = 1.0)
        all_rates.insert(CurrencyCode::Eur, build_rates(1.0));
        // USD base (eur_to_base = eur_usd)
        all_rates.insert(CurrencyCode::Usd, build_rates(eur_usd));
        // GBP base (eur_to_base = eur_gbp)
        all_rates.insert(CurrencyCode::Gbp, build_rates(eur_gbp));
        // JPY base (eur_to_base = eur_jpy)
        all_rates.insert(CurrencyCode::Jpy, build_rates(eur_jpy));
        // CAD base (eur_to_base = eur_cad)
        all_rates.insert(CurrencyCode::Cad, build_rates(eur_cad));
        // AUD base (eur_to_base = eur_aud)
        all_rates.insert(CurrencyCode::Aud, build_rates(eur_aud));
        // INR base (eur_to_base = eur_inr)
        all_rates.insert(CurrencyCode::Inr, build_rates(eur_inr));

        all_rates
    }
}

impl Default for MockExchangeRateProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ExchangeRateProvider for MockExchangeRateProvider {
    async fn get_exchange_rates(
        &self,
        base_currency: CurrencyCode,
    ) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError> {
        self.rates.get(&base_currency).cloned().ok_or_else(|| {
            tracing::error!(
                "MockExchangeRateProvider: no rates for base {}",
                base_currency.as_str()
            );
            ApiError::Internal
        })
    }
}
