use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Query parameters for exchange rates endpoint
#[derive(Debug, Deserialize)]
pub struct ExchangeRateQuery {
    /// Base currency code (defaults to user's primary currency or EUR)
    pub base: Option<crate::types::CurrencyCode>,
}

/// Response structure for exchange rates API
#[derive(Debug, Serialize, Deserialize)]
pub struct ExchangeRateResponse {
    /// Result status (always "success" for successful responses)
    pub result: String,
    /// Base currency code
    pub base_code: String,
    /// Map of currency codes to their exchange rates
    pub conversion_rates: HashMap<String, String>,
}
