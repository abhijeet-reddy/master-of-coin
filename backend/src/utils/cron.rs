use chrono::{DateTime, Utc};
use cron::Schedule;
use std::str::FromStr;

/// Converts a 5-field cron expression (minute hour day_of_month month day_of_week)
/// into the 7-field format expected by the `cron` crate (sec min hour dom month dow year).
fn to_seven_field(cron_expr: &str) -> String {
    format!("0 {} *", cron_expr)
}

/// Parses a 5-field cron expression into a [`Schedule`].
///
/// # Errors
///
/// Returns an error string if the expression is not a valid cron expression.
fn parse_cron(cron_expr: &str) -> Result<Schedule, String> {
    let seven_field = to_seven_field(cron_expr);
    Schedule::from_str(&seven_field)
        .map_err(|e| format!("Invalid cron expression '{}': {}", cron_expr, e))
}

/// Parses a 5-field cron expression and returns the next occurrence after `Utc::now()`.
///
/// # Errors
///
/// Returns an error string if the expression is invalid or no upcoming occurrence exists.
pub fn compute_next_run(cron_expr: &str) -> Result<DateTime<Utc>, String> {
    compute_next_run_after(cron_expr, Utc::now())
}

/// Parses a 5-field cron expression and returns the next occurrence after `after`.
///
/// # Errors
///
/// Returns an error string if the expression is invalid or no upcoming occurrence exists.
pub fn compute_next_run_after(
    cron_expr: &str,
    after: DateTime<Utc>,
) -> Result<DateTime<Utc>, String> {
    let schedule = parse_cron(cron_expr)?;
    schedule
        .after(&after)
        .next()
        .ok_or_else(|| format!("No upcoming occurrence for cron expression '{}'", cron_expr))
}

/// Parses a 5-field cron expression and returns the next `count` occurrences after `Utc::now()`.
///
/// # Errors
///
/// Returns an error string if the expression is invalid.
pub fn compute_upcoming_runs(cron_expr: &str, count: usize) -> Result<Vec<DateTime<Utc>>, String> {
    let schedule = parse_cron(cron_expr)?;
    Ok(schedule.upcoming(Utc).take(count).collect())
}

/// Returns a human-readable description for common cron presets.
/// Falls back to the raw expression for non-standard patterns.
pub fn describe_cron(cron_expr: &str) -> String {
    match cron_expr.trim() {
        "0 * * * *" => "Every hour".to_string(),
        "0 0 * * *" => "Daily at 00:00".to_string(),
        "0 0 * * 1" => "Every Sunday at 00:00".to_string(),
        "0 0 * * 2" => "Every Monday at 00:00".to_string(),
        "0 0 1 * *" => "Monthly on the 1st at 00:00".to_string(),
        other => other.to_string(),
    }
}

/// Validates a 5-field cron expression without computing any occurrences.
///
/// # Errors
///
/// Returns an error string if the expression is not valid.
pub fn validate_cron(cron_expr: &str) -> Result<(), String> {
    parse_cron(cron_expr).map(|_| ())
}

/// Validates that a cron expression produces occurrences at least 60 minutes apart.
///
/// Computes the next 2 occurrences and checks that the gap is >= 60 minutes.
///
/// # Errors
///
/// Returns an error string if the expression is invalid or the frequency is too high.
pub fn validate_min_frequency(cron_expr: &str) -> Result<(), String> {
    let runs = compute_upcoming_runs(cron_expr, 2)?;
    if runs.len() < 2 {
        return Err(format!(
            "Cannot determine frequency for cron expression '{}'",
            cron_expr
        ));
    }
    let gap = runs[1].signed_duration_since(runs[0]);
    if gap.num_minutes() < 60 {
        return Err(format!(
            "Schedule frequency too high: occurrences are {} minutes apart (minimum 60)",
            gap.num_minutes()
        ));
    }
    Ok(())
}
