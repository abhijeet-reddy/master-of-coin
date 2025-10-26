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
