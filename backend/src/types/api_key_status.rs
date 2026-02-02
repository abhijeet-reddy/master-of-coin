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
#[diesel(sql_type = crate::schema::sql_types::ApiKeyStatus)]
#[serde(rename_all = "lowercase")]
pub enum ApiKeyStatus {
    Active,
    Revoked,
    Expired,
}

impl ToSql<crate::schema::sql_types::ApiKeyStatus, Pg> for ApiKeyStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            ApiKeyStatus::Active => out.write_all(b"active")?,
            ApiKeyStatus::Revoked => out.write_all(b"revoked")?,
            ApiKeyStatus::Expired => out.write_all(b"expired")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::ApiKeyStatus, Pg> for ApiKeyStatus {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"active" => Ok(ApiKeyStatus::Active),
            b"revoked" => Ok(ApiKeyStatus::Revoked),
            b"expired" => Ok(ApiKeyStatus::Expired),
            _ => Err("Unrecognized enum variant for ApiKeyStatus".into()),
        }
    }
}

impl Default for ApiKeyStatus {
    fn default() -> Self {
        ApiKeyStatus::Active
    }
}
