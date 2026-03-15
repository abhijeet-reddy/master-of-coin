use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use serde::{Deserialize, Serialize};
use std::io::Write;

/// PostgreSQL ENUM: investment_provider_type
/// Maps to: CREATE TYPE investment_provider_type AS ENUM ('TRADING_212')
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
#[diesel(sql_type = crate::schema::sql_types::InvestmentProviderType)]
pub enum InvestmentProviderType {
    #[serde(rename = "TRADING_212")]
    Trading212,
}

impl ToSql<crate::schema::sql_types::InvestmentProviderType, Pg> for InvestmentProviderType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            InvestmentProviderType::Trading212 => out.write_all(b"TRADING_212")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::InvestmentProviderType, Pg> for InvestmentProviderType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"TRADING_212" => Ok(InvestmentProviderType::Trading212),
            _ => Err("Unrecognized enum variant for InvestmentProviderType".into()),
        }
    }
}

impl std::fmt::Display for InvestmentProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InvestmentProviderType::Trading212 => write!(f, "TRADING_212"),
        }
    }
}
