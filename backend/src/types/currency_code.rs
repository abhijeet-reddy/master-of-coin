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
    Hash,
    Serialize,
    Deserialize,
    diesel::AsExpression,
    diesel::FromSqlRow,
)]
#[diesel(sql_type = crate::schema::sql_types::CurrencyCode)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CurrencyCode {
    Usd,
    Eur,
    Gbp,
    Inr,
    Jpy,
    Aud,
    Cad,
}

impl CurrencyCode {
    /// Convert currency code to string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            CurrencyCode::Usd => "USD",
            CurrencyCode::Eur => "EUR",
            CurrencyCode::Gbp => "GBP",
            CurrencyCode::Inr => "INR",
            CurrencyCode::Jpy => "JPY",
            CurrencyCode::Aud => "AUD",
            CurrencyCode::Cad => "CAD",
        }
    }
}

impl ToSql<crate::schema::sql_types::CurrencyCode, Pg> for CurrencyCode {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            CurrencyCode::Usd => out.write_all(b"USD")?,
            CurrencyCode::Eur => out.write_all(b"EUR")?,
            CurrencyCode::Gbp => out.write_all(b"GBP")?,
            CurrencyCode::Inr => out.write_all(b"INR")?,
            CurrencyCode::Jpy => out.write_all(b"JPY")?,
            CurrencyCode::Aud => out.write_all(b"AUD")?,
            CurrencyCode::Cad => out.write_all(b"CAD")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::CurrencyCode, Pg> for CurrencyCode {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"USD" => Ok(CurrencyCode::Usd),
            b"EUR" => Ok(CurrencyCode::Eur),
            b"GBP" => Ok(CurrencyCode::Gbp),
            b"INR" => Ok(CurrencyCode::Inr),
            b"JPY" => Ok(CurrencyCode::Jpy),
            b"AUD" => Ok(CurrencyCode::Aud),
            b"CAD" => Ok(CurrencyCode::Cad),
            _ => Err("Unrecognized enum variant for CurrencyCode".into()),
        }
    }
}
