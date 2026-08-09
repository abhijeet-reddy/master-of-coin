//! Build version handler (issue #83).
//!
//! Reports the deployed build's release tag and commit sha. This route is
//! AUTHENTICATED (mounted inside `/api/v1`, behind `require_auth`) rather than
//! on the public `/health`, because the repo is public: exposing the commit sha
//! unauthenticated would point anyone at the exact deployed source. The values
//! are baked into the image at build time; see `crate::version`.

use axum::Json;
use serde_json::{Value, json};

/// GET /api/v1/version
///
/// Returns `{ "version": "0.21.0", "commit": "a232171" }` for a release build,
/// or `{ "version": "dev", "commit": "unknown" }` for a local build with no
/// build args supplied.
pub async fn get() -> Json<Value> {
    Json(json!({
        "version": crate::version::APP_VERSION.as_str(),
        "commit": crate::version::GIT_SHA.as_str(),
    }))
}
