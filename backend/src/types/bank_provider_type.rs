use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use serde::{Deserialize, Serialize};
use std::io::Write;

/// PostgreSQL ENUM: bank_provider_type
/// Maps to: CREATE TYPE bank_provider_type AS ENUM ('TRUELAYER')
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
#[diesel(sql_type = crate::schema::sql_types::BankProviderType)]
pub enum BankProviderType {
    #[serde(rename = "TRUELAYER")]
    TrueLayer,
}

impl ToSql<crate::schema::sql_types::BankProviderType, Pg> for BankProviderType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            BankProviderType::TrueLayer => out.write_all(b"TRUELAYER")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::BankProviderType, Pg> for BankProviderType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"TRUELAYER" => Ok(BankProviderType::TrueLayer),
            _ => Err("Unrecognized enum variant for BankProviderType".into()),
        }
    }
}

impl std::fmt::Display for BankProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BankProviderType::TrueLayer => write!(f, "TRUELAYER"),
        }
    }
}
