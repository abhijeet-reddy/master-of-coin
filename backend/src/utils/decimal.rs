//! BigDecimal helpers.
//!
//! Replaces the lossy `to_string().parse::<f64>().unwrap_or(0.0)` pattern, which
//! silently reported a zero balance or percentage when conversion failed.

use bigdecimal::{BigDecimal, ToPrimitive, Zero};

use crate::errors::ApiError;

/// Convert a BigDecimal to f64, failing loudly instead of returning 0.0.
pub fn to_f64(value: &BigDecimal) -> Result<f64, ApiError> {
    match value.to_f64() {
        Some(v) if v.is_finite() => Ok(v),
        _ => {
            tracing::error!("BigDecimal {} is not representable as f64", value);
            Err(ApiError::Internal)
        }
    }
}

/// Convert an f64 request value to BigDecimal via its decimal string form.
pub fn from_f64(value: f64) -> Result<BigDecimal, ApiError> {
    use std::str::FromStr;
    if !value.is_finite() {
        return Err(ApiError::Validation(
            "Amount must be a finite number".into(),
        ));
    }
    BigDecimal::from_str(&value.to_string())
        .map_err(|_| ApiError::Validation("Invalid amount".into()))
}

/// Round to 2 decimal places and format as a string (monetary display value).
/// Always two decimals, including zero ("0.00"), which bigdecimal would
/// otherwise print as "0".
pub fn money_string(value: &BigDecimal) -> String {
    let rounded = value.with_scale_round(2, bigdecimal::RoundingMode::HalfUp);
    if rounded.is_zero() {
        return "0.00".to_string();
    }
    rounded.to_string()
}
