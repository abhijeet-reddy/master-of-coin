use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use serde::{Deserialize, Serialize};
use std::io::Write;

/// PostgreSQL ENUM: split_provider_type
/// Maps to: CREATE TYPE split_provider_type AS ENUM ('splitwise', 'splitpro')
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
#[diesel(sql_type = crate::schema::sql_types::SplitProviderType)]
pub enum SplitProviderType {
    #[serde(rename = "splitwise")]
    Splitwise,
    #[serde(rename = "splitpro")]
    SplitPro,
}

impl ToSql<crate::schema::sql_types::SplitProviderType, Pg> for SplitProviderType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            SplitProviderType::Splitwise => out.write_all(b"splitwise")?,
            SplitProviderType::SplitPro => out.write_all(b"splitpro")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::SplitProviderType, Pg> for SplitProviderType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"splitwise" => Ok(SplitProviderType::Splitwise),
            b"splitpro" => Ok(SplitProviderType::SplitPro),
            _ => Err("Unrecognized enum variant for SplitProviderType".into()),
        }
    }
}

impl Default for SplitProviderType {
    fn default() -> Self {
        SplitProviderType::Splitwise
    }
}

impl std::fmt::Display for SplitProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SplitProviderType::Splitwise => write!(f, "splitwise"),
            SplitProviderType::SplitPro => write!(f, "splitpro"),
        }
    }
}
