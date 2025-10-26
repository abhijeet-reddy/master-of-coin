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
#[diesel(sql_type = crate::schema::sql_types::AccountType)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}

impl ToSql<crate::schema::sql_types::AccountType, Pg> for AccountType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            AccountType::Checking => out.write_all(b"CHECKING")?,
            AccountType::Savings => out.write_all(b"SAVINGS")?,
            AccountType::CreditCard => out.write_all(b"CREDIT_CARD")?,
            AccountType::Investment => out.write_all(b"INVESTMENT")?,
            AccountType::Cash => out.write_all(b"CASH")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::AccountType, Pg> for AccountType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"CHECKING" => Ok(AccountType::Checking),
            b"SAVINGS" => Ok(AccountType::Savings),
            b"CREDIT_CARD" => Ok(AccountType::CreditCard),
            b"INVESTMENT" => Ok(AccountType::Investment),
            b"CASH" => Ok(AccountType::Cash),
            _ => Err("Unrecognized enum variant for AccountType".into()),
        }
    }
}
