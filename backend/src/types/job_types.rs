use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use serde::{Deserialize, Serialize};
use std::io::Write;

/// PostgreSQL ENUM: job_type
/// Maps to: CREATE TYPE job_type AS ENUM ('DRIFT_DETECTION', 'BULK_SYNC', 'PORTFOLIO_SYNC', 'BANK_SYNC')
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
#[diesel(sql_type = crate::schema::sql_types::JobType)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobType {
    DriftDetection,
    BulkSync,
    PortfolioSync,
    BankSync,
}

impl ToSql<crate::schema::sql_types::JobType, Pg> for JobType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            JobType::DriftDetection => out.write_all(b"DRIFT_DETECTION")?,
            JobType::BulkSync => out.write_all(b"BULK_SYNC")?,
            JobType::PortfolioSync => out.write_all(b"PORTFOLIO_SYNC")?,
            JobType::BankSync => out.write_all(b"BANK_SYNC")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::JobType, Pg> for JobType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"DRIFT_DETECTION" => Ok(JobType::DriftDetection),
            b"BULK_SYNC" => Ok(JobType::BulkSync),
            b"PORTFOLIO_SYNC" => Ok(JobType::PortfolioSync),
            b"BANK_SYNC" => Ok(JobType::BankSync),
            _ => Err("Unrecognized enum variant for JobType".into()),
        }
    }
}

/// PostgreSQL ENUM: job_status
/// Maps to: CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
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
#[diesel(sql_type = crate::schema::sql_types::JobStatus)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl JobStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(self, JobStatus::Completed | JobStatus::Failed)
    }
}

impl ToSql<crate::schema::sql_types::JobStatus, Pg> for JobStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            JobStatus::Pending => out.write_all(b"PENDING")?,
            JobStatus::Running => out.write_all(b"RUNNING")?,
            JobStatus::Completed => out.write_all(b"COMPLETED")?,
            JobStatus::Failed => out.write_all(b"FAILED")?,
        }
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<crate::schema::sql_types::JobStatus, Pg> for JobStatus {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"PENDING" => Ok(JobStatus::Pending),
            b"RUNNING" => Ok(JobStatus::Running),
            b"COMPLETED" => Ok(JobStatus::Completed),
            b"FAILED" => Ok(JobStatus::Failed),
            _ => Err("Unrecognized enum variant for JobStatus".into()),
        }
    }
}
