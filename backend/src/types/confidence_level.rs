use serde::{Deserialize, Serialize};

/// Confidence level for duplicate matching
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ConfidenceLevel {
    /// Exact match: date + time + amount all match
    High,
    /// High match: date + amount match, time differs
    Medium,
    /// No significant match
    Low,
}

impl ConfidenceLevel {
    /// Parse from string (case-insensitive)
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.to_uppercase().as_str() {
            "HIGH" => Ok(ConfidenceLevel::High),
            "MEDIUM" => Ok(ConfidenceLevel::Medium),
            "LOW" => Ok(ConfidenceLevel::Low),
            _ => Err(format!(
                "Invalid confidence level: {}. Must be HIGH, MEDIUM, or LOW",
                s
            )),
        }
    }

    /// Get the minimum confidence level to flag as duplicate
    pub fn min_duplicate_threshold() -> Self {
        ConfidenceLevel::Medium
    }

    /// Check if this confidence level should be flagged as duplicate
    pub fn is_duplicate(&self) -> bool {
        matches!(self, ConfidenceLevel::High | ConfidenceLevel::Medium)
    }
}
