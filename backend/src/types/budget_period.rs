use chrono::{Datelike, Days, Months, NaiveDate, Weekday};
use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use serde::{Deserialize, Serialize};
use std::io::Write;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Serialize,
    Deserialize,
    diesel::AsExpression,
    diesel::FromSqlRow,
)]
#[diesel(sql_type = crate::schema::sql_types::BudgetPeriod)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BudgetPeriod {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

impl BudgetPeriod {
    /// Compute the calendar-aligned window containing `today`.
    ///
    /// Returns `(start, end)` for the period that `today` falls into:
    /// - Daily: (today, today)
    /// - Weekly: Monday → Sunday of the current ISO week
    /// - Monthly: 1st → last day of the current month
    /// - Quarterly: first day of the current quarter → last day of the current quarter
    /// - Yearly: Jan 1 → Dec 31 of the current year
    pub fn current_window(&self, today: NaiveDate) -> (NaiveDate, NaiveDate) {
        match self {
            BudgetPeriod::Daily => (today, today),
            BudgetPeriod::Weekly => {
                // ISO week: Monday = 0 .. Sunday = 6
                let days_from_monday = today.weekday().num_days_from_monday() as u64;
                let start = today.checked_sub_days(Days::new(days_from_monday)).unwrap();
                let end = start.checked_add_days(Days::new(6)).unwrap();
                debug_assert_eq!(start.weekday(), Weekday::Mon);
                (start, end)
            }
            BudgetPeriod::Monthly => {
                let start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
                let end = start
                    .checked_add_months(Months::new(1))
                    .unwrap()
                    .checked_sub_days(Days::new(1))
                    .unwrap();
                (start, end)
            }
            BudgetPeriod::Quarterly => {
                let quarter_start_month = ((today.month() - 1) / 3) * 3 + 1;
                let start = NaiveDate::from_ymd_opt(today.year(), quarter_start_month, 1).unwrap();
                let end = start
                    .checked_add_months(Months::new(3))
                    .unwrap()
                    .checked_sub_days(Days::new(1))
                    .unwrap();
                (start, end)
            }
            BudgetPeriod::Yearly => {
                let start = NaiveDate::from_ymd_opt(today.year(), 1, 1).unwrap();
                let end = NaiveDate::from_ymd_opt(today.year(), 12, 31).unwrap();
                (start, end)
            }
        }
    }
}

impl ToSql<crate::schema::sql_types::BudgetPeriod, Pg> for BudgetPeriod {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            BudgetPeriod::Daily => out.write_all(b"DAILY")?,
            BudgetPeriod::Weekly => out.write_all(b"WEEKLY")?,
            BudgetPeriod::Monthly => out.write_all(b"MONTHLY")?,
            BudgetPeriod::Quarterly => out.write_all(b"QUARTERLY")?,
            BudgetPeriod::Yearly => out.write_all(b"YEARLY")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::BudgetPeriod, Pg> for BudgetPeriod {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"DAILY" => Ok(BudgetPeriod::Daily),
            b"WEEKLY" => Ok(BudgetPeriod::Weekly),
            b"MONTHLY" => Ok(BudgetPeriod::Monthly),
            b"QUARTERLY" => Ok(BudgetPeriod::Quarterly),
            b"YEARLY" => Ok(BudgetPeriod::Yearly),
            _ => Err("Unrecognized enum variant for BudgetPeriod".into()),
        }
    }
}
