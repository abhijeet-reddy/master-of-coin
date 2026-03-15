//! Background Job Worker Binary
//!
//! A separate long-running process that polls the `background_jobs` table for PENDING jobs,
//! executes them, and updates their status. Shares `lib.rs` with the API server — zero code
//! duplication for models, services, repositories, and types.
//!
//! ## Features
//!
//! - **Startup recovery**: Marks stale RUNNING jobs as FAILED
//! - **Poll loop**: Checks for PENDING jobs every N seconds (configurable via `WORKER_POLL_INTERVAL_SECS`)
//! - **One-per-type concurrency**: Multiple job types can run simultaneously, but only one job per type
//! - **Daily cleanup**: Deletes terminal jobs older than 1 year at 00:00 UTC
//! - **Job dispatch**: Routes jobs to the appropriate service by `job_type`
//! - **Schedule checking**: Triggers due schedules by creating background jobs
//! - **Health endpoint**: Lightweight HTTP server on `WORKER_HEALTH_PORT` (default 13154) for container health checks

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::Arc;

use axum::{Router, extract::State, routing::get};
use chrono::{Duration, Utc};
use diesel::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use tokio::sync::RwLock;
use tracing_subscriber::EnvFilter;

use master_of_coin_backend::DbPool;
use master_of_coin_backend::models::background_job::NewBackgroundJob;
use master_of_coin_backend::models::bulk_sync::BulkSyncRequest;
use master_of_coin_backend::models::drift_detection::DriftDetectionRequest;
use master_of_coin_backend::repositories;
use master_of_coin_backend::repositories::background_job::BackgroundJobRepository;
use master_of_coin_backend::repositories::schedule::ScheduleRepository;
use master_of_coin_backend::services::investment_provider::{
    InvestmentProvider, Trading212Provider,
};
use master_of_coin_backend::services::split_provider::{SplitProvider, all_providers};
use master_of_coin_backend::services::split_sync_service::SplitSyncService;
use master_of_coin_backend::services::{
    bulk_sync_service, drift_detection_service, portfolio_sync_service,
};
use master_of_coin_backend::types::{
    InvestmentProviderType, JobStatus, JobType, SplitProviderType,
};
use master_of_coin_backend::utils::cron::compute_next_run_after;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Default poll interval in seconds
const DEFAULT_POLL_INTERVAL_SECS: u64 = 30;

/// Default health check server port
const DEFAULT_HEALTH_PORT: u16 = 13154;

#[tokio::main]
async fn main() {
    // Load environment variables from .env file if present
    dotenvy::dotenv().ok();

    // 1. Initialize logging with environment filter
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tracing::info!("⚙️  Worker starting...");

    // 2. Load configuration from environment
    let config = master_of_coin_backend::Config::from_env().expect("Failed to load configuration");

    tracing::info!("Configuration loaded for worker");

    // 3. Create database connection pool
    let database_url = &config.database.url;
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .max_size(config.database.max_connections)
        .build(manager)
        .expect("Failed to create database pool");

    tracing::info!(
        "Database pool created with max {} connections",
        config.database.max_connections
    );

    // 4. Run pending migrations
    {
        let mut conn = pool.get().expect("Failed to get database connection");
        conn.run_pending_migrations(MIGRATIONS)
            .expect("Failed to run database migrations");
        tracing::info!("✅ Database migrations completed successfully");
    }

    // 5. Initialize split providers (same pattern as SplitSyncService::new)
    let split_providers = init_split_providers();
    tracing::info!("Initialized {} split provider(s)", split_providers.len());

    // 6. Initialize investment providers
    let investment_providers = init_investment_providers();
    tracing::info!(
        "Initialized {} investment provider(s)",
        investment_providers.len()
    );

    // 7. Initialize SplitSyncService for bulk sync jobs
    let sync_service = SplitSyncService::new(pool.clone());
    tracing::info!("SplitSyncService initialized for bulk sync jobs");

    // 8. Read poll interval from environment
    let poll_interval_secs: u64 = std::env::var("WORKER_POLL_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);

    tracing::info!("Poll interval: {} seconds", poll_interval_secs);

    // 9. Startup recovery: mark stale RUNNING jobs as FAILED
    startup_recovery(&pool);

    // 10. Startup cleanup: delete terminal jobs older than 1 year
    run_cleanup(&pool);

    // 11. Start health check server and poll loop concurrently
    let health_pool = pool.clone();
    tokio::select! {
        _ = run_health_server(health_pool) => {
            tracing::error!("Health check server exited unexpectedly");
        }
        _ = run_poll_loop(pool, split_providers, investment_providers, sync_service, poll_interval_secs) => {
            tracing::error!("Poll loop exited unexpectedly");
        }
    }
}

/// Lightweight HTTP health check server for container health monitoring.
///
/// Exposes `GET /health` which verifies the worker process is alive and can
/// reach the database. Listens on `WORKER_HEALTH_PORT` (default: 13154).
async fn run_health_server(pool: DbPool) {
    let health_port: u16 = std::env::var("WORKER_HEALTH_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_HEALTH_PORT);

    let app = Router::new()
        .route("/health", get(health_handler))
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], health_port));
    tracing::info!("🩺 Health check server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind health check port");

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("Health check server error: {}", e);
    }
}

/// Health check handler — verifies the worker can obtain a DB connection.
///
/// Returns 200 OK with `{"status": "healthy"}` if the DB pool is reachable,
/// or 503 Service Unavailable with `{"status": "unhealthy", "error": "..."}` otherwise.
async fn health_handler(
    State(pool): State<DbPool>,
) -> (axum::http::StatusCode, axum::Json<serde_json::Value>) {
    match pool.get() {
        Ok(_conn) => (
            axum::http::StatusCode::OK,
            axum::Json(serde_json::json!({
                "status": "healthy",
                "service": "worker"
            })),
        ),
        Err(e) => (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(serde_json::json!({
                "status": "unhealthy",
                "service": "worker",
                "error": e.to_string()
            })),
        ),
    }
}

/// Initialize split providers from the canonical registry in `split_provider::all_providers()`.
///
/// All provider registrations live in one place (`split_provider/mod.rs`), so
/// adding a new provider never requires touching the worker binary.
fn init_split_providers() -> HashMap<SplitProviderType, Arc<dyn SplitProvider>> {
    all_providers()
}

/// Initialize investment providers for portfolio sync jobs
fn init_investment_providers() -> HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>> {
    let mut providers: HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>> =
        HashMap::new();

    // Register Trading 212 provider
    let trading212 = Arc::new(Trading212Provider::new());
    providers.insert(InvestmentProviderType::Trading212, trading212);

    // Future investment providers can be added here

    providers
}

/// Startup recovery: find all RUNNING jobs and mark them as FAILED.
///
/// These jobs were mid-execution when the worker died. PENDING jobs are left as-is —
/// the poll loop will pick them up naturally.
fn startup_recovery(pool: &DbPool) {
    tracing::info!("Running startup recovery...");

    match BackgroundJobRepository::find_stale_jobs(pool) {
        Ok(stale_jobs) => {
            if stale_jobs.is_empty() {
                tracing::info!("No stale RUNNING jobs found");
                return;
            }

            tracing::warn!("Found {} stale RUNNING job(s)", stale_jobs.len());

            for job in stale_jobs {
                match BackgroundJobRepository::update_failed(
                    pool,
                    job.id,
                    "Interrupted by worker restart. Please retry.",
                ) {
                    Ok(_) => {
                        tracing::info!(
                            "Marked stale job {} ({:?}) as FAILED",
                            job.id,
                            job.job_type
                        );
                    }
                    Err(e) => {
                        tracing::error!("Failed to mark stale job {} as FAILED: {}", job.id, e);
                    }
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to query stale jobs: {}", e);
        }
    }
}

/// Run cleanup: delete terminal jobs (COMPLETED/FAILED) older than 1 year.
fn run_cleanup(pool: &DbPool) {
    let one_year_ago = Utc::now() - Duration::days(365);
    tracing::info!(
        "Running cleanup of terminal jobs older than {}...",
        one_year_ago.format("%Y-%m-%d")
    );

    match BackgroundJobRepository::cleanup_old_jobs(pool, one_year_ago) {
        Ok(count) => {
            if count > 0 {
                tracing::info!("Cleaned up {} old job(s)", count);
            } else {
                tracing::info!("No old jobs to clean up");
            }
        }
        Err(e) => {
            tracing::error!("Failed to clean up old jobs: {}", e);
        }
    }
}

/// Purge soft-deleted transactions that have exceeded the retention period.
///
/// Computes a cutoff date (`now - retention_days`), finds all soft-deleted
/// transactions older than the cutoff, and permanently deletes them along
/// with their associated splits, debt metadata, and transfer records.
///
/// Transfer pairs are handled atomically — when one side of a transfer is
/// found, both transactions are deleted together, and the paired transaction
/// ID is tracked to avoid double-processing.
async fn purge_soft_deleted_transactions(pool: &DbPool, retention_days: i64) -> usize {
    let cutoff = Utc::now() - Duration::days(retention_days);
    tracing::info!(
        "Purging soft-deleted transactions older than {} (retention: {} days)",
        cutoff.format("%Y-%m-%d %H:%M:%S UTC"),
        retention_days
    );

    // Find all expired soft-deleted transactions
    let expired = match repositories::transaction::find_expired_soft_deleted(pool, cutoff).await {
        Ok(txns) => txns,
        Err(e) => {
            tracing::error!("Failed to query expired soft-deleted transactions: {}", e);
            return 0;
        }
    };

    if expired.is_empty() {
        tracing::info!("No expired soft-deleted transactions to purge");
        return 0;
    }

    tracing::info!(
        "Found {} expired soft-deleted transaction(s) to purge",
        expired.len()
    );

    let mut purged_count: usize = 0;
    let mut processed_ids: std::collections::HashSet<uuid::Uuid> = std::collections::HashSet::new();

    for txn in &expired {
        // Skip if already processed (e.g. paired transaction from a transfer)
        if processed_ids.contains(&txn.id) {
            continue;
        }

        // Check if this transaction is part of a transfer
        match repositories::transfer::find_transfer_by_transaction_id(pool, txn.id).await {
            Ok(Some(transfer)) => {
                // Mark both sides as processed to avoid double-processing
                processed_ids.insert(transfer.from_transaction_id);
                processed_ids.insert(transfer.to_transaction_id);

                // Hard-delete the transfer and both transactions atomically
                match repositories::transfer::delete_transfer_and_transactions(pool, &transfer)
                    .await
                {
                    Ok(()) => {
                        tracing::info!(
                            "Purged transfer {} (transactions: {}, {})",
                            transfer.id,
                            transfer.from_transaction_id,
                            transfer.to_transaction_id
                        );
                        purged_count += 2;
                    }
                    Err(e) => {
                        tracing::error!(
                            "Failed to purge transfer {} (transactions: {}, {}): {}",
                            transfer.id,
                            transfer.from_transaction_id,
                            transfer.to_transaction_id,
                            e
                        );
                    }
                }
            }
            Ok(None) => {
                // Standalone transaction — delete splits, debt metadata, then the transaction
                processed_ids.insert(txn.id);

                // Delete splits
                if let Err(e) =
                    repositories::transaction::delete_splits_for_transaction(pool, txn.id).await
                {
                    tracing::error!(
                        "Failed to delete splits for transaction {} during purge: {}",
                        txn.id,
                        e
                    );
                    continue;
                }

                // Delete debt metadata (if any)
                if let Err(e) =
                    repositories::debt_transaction_metadata::delete_by_transaction_id(pool, txn.id)
                        .await
                {
                    tracing::error!(
                        "Failed to delete debt metadata for transaction {} during purge: {}",
                        txn.id,
                        e
                    );
                    continue;
                }

                // Hard-delete the transaction
                match repositories::transaction::hard_delete_transaction(pool, txn.id).await {
                    Ok(()) => {
                        tracing::info!("Purged standalone transaction {}", txn.id);
                        purged_count += 1;
                    }
                    Err(e) => {
                        tracing::error!("Failed to purge standalone transaction {}: {}", txn.id, e);
                    }
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to check transfer status for transaction {} during purge: {}",
                    txn.id,
                    e
                );
            }
        }
    }

    if purged_count > 0 {
        tracing::info!("Purged {} soft-deleted transaction(s)", purged_count);
    } else {
        tracing::info!("No soft-deleted transactions were purged");
    }

    purged_count
}

/// Main poll loop: checks for PENDING jobs, dispatches them, and handles daily cleanup.
async fn run_poll_loop(
    pool: DbPool,
    split_providers: HashMap<SplitProviderType, Arc<dyn SplitProvider>>,
    investment_providers: HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>>,
    sync_service: SplitSyncService,
    poll_interval_secs: u64,
) {
    let split_providers = Arc::new(split_providers);
    let investment_providers = Arc::new(investment_providers);
    let running_types: Arc<RwLock<HashSet<JobType>>> = Arc::new(RwLock::new(HashSet::new()));
    let mut last_cleanup_date = Utc::now().date_naive();

    // Read soft-delete retention days from config (once at loop start)
    let retention_days = master_of_coin_backend::Config::from_env()
        .map(|c| c.soft_delete_retention_days)
        .unwrap_or(30);

    tracing::info!("✨ Worker poll loop started");

    loop {
        // Check for daily cleanup at 00:00 UTC
        let today = Utc::now().date_naive();
        if today != last_cleanup_date {
            tracing::info!("Date changed to {} — running daily cleanup", today);
            run_cleanup(&pool);
            purge_soft_deleted_transactions(&pool, retention_days).await;
            last_cleanup_date = today;
        }

        // Get currently running job types to exclude from polling
        let exclude_types: Vec<JobType> = {
            let running = running_types.read().await;
            running.iter().copied().collect()
        };

        // Poll for the next pending job (excluding types already running)
        match BackgroundJobRepository::find_next_pending(&pool, &exclude_types) {
            Ok(Some(job)) => {
                let job_id = job.id;
                let job_type = job.job_type;

                tracing::info!(
                    "Found pending job {} (type: {:?}, user: {})",
                    job_id,
                    job_type,
                    job.user_id
                );

                // Mark as RUNNING
                match BackgroundJobRepository::update_running(&pool, job_id) {
                    Ok(_) => {
                        tracing::info!("Job {} marked as RUNNING", job_id);
                    }
                    Err(e) => {
                        tracing::error!(
                            "Failed to mark job {} as RUNNING: {}. Skipping.",
                            job_id,
                            e
                        );
                        // Sleep briefly and retry on next iteration
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        continue;
                    }
                }

                // Track this job type as running
                {
                    let mut running = running_types.write().await;
                    running.insert(job_type);
                }

                // Spawn the job execution in a separate task for concurrency
                let pool_clone = pool.clone();
                let split_providers_clone = Arc::clone(&split_providers);
                let investment_providers_clone = Arc::clone(&investment_providers);
                let sync_service_clone = sync_service.clone();
                let running_types_clone = Arc::clone(&running_types);

                tokio::spawn(async move {
                    execute_job(
                        &pool_clone,
                        &split_providers_clone,
                        &investment_providers_clone,
                        &sync_service_clone,
                        job_id,
                        job_type,
                        job.user_id,
                        job.input,
                    )
                    .await;

                    // Remove this job type from the running set
                    let mut running = running_types_clone.write().await;
                    running.remove(&job_type);
                });
            }
            Ok(None) => {
                // No pending jobs — sleep and try again
                tracing::debug!("No pending jobs found, sleeping...");
            }
            Err(e) => {
                tracing::error!("Error polling for pending jobs: {}", e);
            }
        }

        // Check and trigger due schedules (parallel with job execution)
        let pool_for_schedules = pool.clone();
        tokio::spawn(async move {
            check_and_trigger_schedules(&pool_for_schedules).await;
        });

        // Sleep for the poll interval before checking again
        tokio::time::sleep(std::time::Duration::from_secs(poll_interval_secs)).await;
    }
}

/// Check for due schedules and trigger them by creating background jobs.
///
/// For each active schedule whose `next_run_at <= NOW()`:
/// 1. Build the job input from the schedule's `job_type` and `parameters`
/// 2. Create a `NewBackgroundJob` with the schedule's `job_type` and `user_id`
/// 3. Compute the next `next_run_at` via `compute_next_run_after(cron_expr, now)`
/// 4. Call `ScheduleRepository::trigger_schedule()` (transactional: INSERT job + UPDATE schedule)
async fn check_and_trigger_schedules(pool: &DbPool) {
    let due_schedules = match ScheduleRepository::find_due_schedules(pool) {
        Ok(schedules) => schedules,
        Err(e) => {
            tracing::error!("Failed to query due schedules: {}", e);
            return;
        }
    };

    if due_schedules.is_empty() {
        tracing::debug!("No due schedules found");
        return;
    }

    tracing::info!("Found {} due schedule(s)", due_schedules.len());

    let now = Utc::now();

    for schedule in due_schedules {
        // Build job input based on job_type and parameters
        let job_input = build_job_input(&schedule, now);

        let new_job = NewBackgroundJob {
            user_id: schedule.user_id,
            job_type: schedule.job_type,
            status: JobStatus::Pending,
            previous_job_id: None,
            input: Some(job_input),
        };

        // Compute next_run_at from the cron expression
        let next_run_at = match compute_next_run_after(&schedule.cron_expr, now) {
            Ok(next) => next,
            Err(e) => {
                tracing::error!(
                    "Failed to compute next_run_at for schedule {} (cron='{}'): {}",
                    schedule.id,
                    schedule.cron_expr,
                    e
                );
                continue;
            }
        };

        // Trigger the schedule (transactional: INSERT job + UPDATE schedule)
        match ScheduleRepository::trigger_schedule(pool, schedule.id, new_job, next_run_at) {
            Ok(_job) => {
                tracing::info!(
                    "Triggered schedule {} ({:?}) for user {}",
                    schedule.id,
                    schedule.job_type,
                    schedule.user_id
                );
            }
            Err(e) => {
                tracing::error!(
                    "Failed to trigger schedule {} ({:?}): {}",
                    schedule.id,
                    schedule.job_type,
                    e
                );
            }
        }
    }
}

/// Build the job input JSON based on the schedule's `job_type` and `parameters`.
///
/// - For `DRIFT_DETECTION`: computes `start_date = now - lookback_days` and `end_date = now`,
///   includes `schedule_id`.
/// - For `BULK_SYNC`: includes `schedule_id` and any parameters from the schedule.
/// - For `PORTFOLIO_SYNC`: includes `schedule_id` and any parameters (e.g., `account_id`).
fn build_job_input(
    schedule: &master_of_coin_backend::models::schedule::Schedule,
    now: chrono::DateTime<Utc>,
) -> serde_json::Value {
    let schedule_id = schedule.id.to_string();

    match schedule.job_type {
        JobType::DriftDetection => {
            // Extract lookback_days from parameters, default to 7
            let lookback_days = schedule
                .parameters
                .as_ref()
                .and_then(|p| p.get("lookback_days"))
                .and_then(|v| v.as_i64())
                .unwrap_or(7);

            let start_date = now - Duration::days(lookback_days);
            let end_date = now;

            serde_json::json!({
                "schedule_id": schedule_id,
                "start_date": start_date.to_rfc3339(),
                "end_date": end_date.to_rfc3339()
            })
        }
        JobType::BulkSync => {
            // Include schedule_id and merge any parameters from the schedule
            let mut input = schedule
                .parameters
                .clone()
                .unwrap_or_else(|| serde_json::json!({}));

            if let Some(obj) = input.as_object_mut() {
                obj.insert(
                    "schedule_id".to_string(),
                    serde_json::Value::String(schedule_id),
                );
            }

            input
        }
        JobType::PortfolioSync => {
            // Include schedule_id and merge any parameters from the schedule
            let mut input = schedule
                .parameters
                .clone()
                .unwrap_or_else(|| serde_json::json!({}));

            if let Some(obj) = input.as_object_mut() {
                obj.insert(
                    "schedule_id".to_string(),
                    serde_json::Value::String(schedule_id),
                );
            }

            input
        }
    }
}

/// Execute a single job by dispatching to the appropriate service based on job_type.
async fn execute_job(
    pool: &DbPool,
    split_providers: &HashMap<SplitProviderType, Arc<dyn SplitProvider>>,
    investment_providers: &HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>>,
    sync_service: &SplitSyncService,
    job_id: uuid::Uuid,
    job_type: JobType,
    user_id: uuid::Uuid,
    input: Option<serde_json::Value>,
) {
    tracing::info!("Executing job {} (type: {:?})", job_id, job_type);

    let result = match job_type {
        JobType::DriftDetection => {
            execute_drift_detection(pool, split_providers, user_id, input).await
        }
        JobType::BulkSync => execute_bulk_sync_job(sync_service, pool, user_id, input).await,
        JobType::PortfolioSync => {
            execute_portfolio_sync_job(pool, investment_providers, user_id, input).await
        }
    };

    match result {
        Ok(result_json) => {
            match BackgroundJobRepository::update_completed(pool, job_id, result_json) {
                Ok(_) => {
                    tracing::info!("Job {} completed successfully", job_id);
                }
                Err(e) => {
                    tracing::error!(
                        "Job {} succeeded but failed to update status: {}",
                        job_id,
                        e
                    );
                }
            }
        }
        Err(error_msg) => match BackgroundJobRepository::update_failed(pool, job_id, &error_msg) {
            Ok(_) => {
                tracing::warn!("Job {} failed: {}", job_id, error_msg);
            }
            Err(e) => {
                tracing::error!(
                    "Job {} failed ({}) and failed to update status: {}",
                    job_id,
                    error_msg,
                    e
                );
            }
        },
    }
}

/// Execute a drift detection job.
///
/// Parses the input as `DriftDetectionRequest`, calls `detect_drift()`,
/// and returns the serialized `DriftReport` or an error message.
async fn execute_drift_detection(
    pool: &DbPool,
    providers: &HashMap<SplitProviderType, Arc<dyn SplitProvider>>,
    user_id: uuid::Uuid,
    input: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Parse input
    let input_json = input.ok_or_else(|| "Missing input for drift detection job".to_string())?;

    let request: DriftDetectionRequest = serde_json::from_value(input_json)
        .map_err(|e| format!("Failed to parse drift detection input: {}", e))?;

    tracing::info!(
        "Running drift detection for user {} from {} to {}",
        user_id,
        request.start_date,
        request.end_date
    );

    // Call the drift detection service
    let report = drift_detection_service::detect_drift(
        pool,
        providers,
        user_id,
        request.start_date,
        request.end_date,
    )
    .await
    .map_err(|e| format!("Drift detection failed: {}", e))?;

    // Serialize the report to JSON
    let result_json = serde_json::to_value(&report)
        .map_err(|e| format!("Failed to serialize drift report: {}", e))?;

    Ok(result_json)
}

/// Execute a bulk sync job.
///
/// Parses the input as `BulkSyncRequest`, calls `execute_bulk_sync()`,
/// and returns the serialized `BulkSyncReport`. Unlike drift detection which
/// can fail (returns `ApiResult`), `execute_bulk_sync` always returns a
/// `BulkSyncReport` — individual item failures are captured in the report.
async fn execute_bulk_sync_job(
    sync_service: &SplitSyncService,
    pool: &DbPool,
    user_id: uuid::Uuid,
    input: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Parse input
    let input_json = input.ok_or_else(|| "Missing input for bulk sync job".to_string())?;

    let request: BulkSyncRequest = serde_json::from_value(input_json)
        .map_err(|e| format!("Failed to parse bulk sync input: {}", e))?;

    tracing::info!(
        "Running bulk sync for user {} with {} item(s)",
        user_id,
        request.items.len()
    );

    // Call the bulk sync service — always returns a report (never errors)
    let report =
        bulk_sync_service::execute_bulk_sync(sync_service, pool, user_id, request.items).await;

    tracing::info!(
        "Bulk sync completed: {} succeeded, {} failed out of {} total",
        report.summary.succeeded,
        report.summary.failed,
        report.summary.total
    );

    // Serialize the report to JSON
    serde_json::to_value(&report)
        .map_err(|e| format!("Failed to serialize bulk sync report: {}", e))
}

/// Execute a portfolio sync job.
///
/// Calls `portfolio_sync_service::execute_portfolio_sync()` which fetches
/// current stock values from brokerage APIs and creates adjustment transactions
/// to reconcile account balances.
async fn execute_portfolio_sync_job(
    pool: &DbPool,
    investment_providers: &HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>>,
    user_id: uuid::Uuid,
    input: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    tracing::info!("Running portfolio sync for user {}", user_id);

    portfolio_sync_service::execute_portfolio_sync(pool, investment_providers, user_id, input).await
}
