//! Tests for `BudgetPeriod::current_window` — the calendar-aligned period
//! helper used by the budget service to decide which transactions fall into
//! the *current* period (vs. the range's full lifetime).

use chrono::NaiveDate;
use master_of_coin_backend::types::BudgetPeriod;

fn ymd(y: i32, m: u32, d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, d).unwrap()
}

#[test]
fn daily_window_is_single_day() {
    let today = ymd(2026, 5, 9);
    assert_eq!(BudgetPeriod::Daily.current_window(today), (today, today));
}

#[test]
fn weekly_window_runs_monday_to_sunday() {
    // 2026-05-09 is a Saturday
    let (start, end) = BudgetPeriod::Weekly.current_window(ymd(2026, 5, 9));
    assert_eq!(start, ymd(2026, 5, 4)); // Monday
    assert_eq!(end, ymd(2026, 5, 10)); // Sunday
}

#[test]
fn weekly_window_on_monday_starts_today() {
    // 2026-05-04 is a Monday
    let (start, end) = BudgetPeriod::Weekly.current_window(ymd(2026, 5, 4));
    assert_eq!(start, ymd(2026, 5, 4));
    assert_eq!(end, ymd(2026, 5, 10));
}

#[test]
fn monthly_window_is_first_to_last_of_month() {
    // The original bug: a May date should yield the May window, not an
    // April-anchored one, regardless of when the budget was created.
    let (start, end) = BudgetPeriod::Monthly.current_window(ymd(2026, 5, 9));
    assert_eq!(start, ymd(2026, 5, 1));
    assert_eq!(end, ymd(2026, 5, 31));
}

#[test]
fn monthly_window_handles_february_and_leap_years() {
    // Non-leap February (2026)
    let (start, end) = BudgetPeriod::Monthly.current_window(ymd(2026, 2, 15));
    assert_eq!(start, ymd(2026, 2, 1));
    assert_eq!(end, ymd(2026, 2, 28));

    // Leap February (2028)
    let (start, end) = BudgetPeriod::Monthly.current_window(ymd(2028, 2, 15));
    assert_eq!(start, ymd(2028, 2, 1));
    assert_eq!(end, ymd(2028, 2, 29));
}

#[test]
fn monthly_window_handles_december_rollover() {
    let (start, end) = BudgetPeriod::Monthly.current_window(ymd(2026, 12, 20));
    assert_eq!(start, ymd(2026, 12, 1));
    assert_eq!(end, ymd(2026, 12, 31));
}

#[test]
fn quarterly_window_buckets_into_calendar_quarters() {
    // Q1: Jan–Mar
    let (start, end) = BudgetPeriod::Quarterly.current_window(ymd(2026, 2, 10));
    assert_eq!(start, ymd(2026, 1, 1));
    assert_eq!(end, ymd(2026, 3, 31));

    // Q2: Apr–Jun
    let (start, end) = BudgetPeriod::Quarterly.current_window(ymd(2026, 5, 9));
    assert_eq!(start, ymd(2026, 4, 1));
    assert_eq!(end, ymd(2026, 6, 30));

    // Q4: Oct–Dec
    let (start, end) = BudgetPeriod::Quarterly.current_window(ymd(2026, 11, 1));
    assert_eq!(start, ymd(2026, 10, 1));
    assert_eq!(end, ymd(2026, 12, 31));
}

#[test]
fn yearly_window_is_whole_calendar_year() {
    let (start, end) = BudgetPeriod::Yearly.current_window(ymd(2026, 5, 9));
    assert_eq!(start, ymd(2026, 1, 1));
    assert_eq!(end, ymd(2026, 12, 31));
}
