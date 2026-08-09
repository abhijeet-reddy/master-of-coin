//! Build version information for the running binary (issue #83).
//!
//! The values come from build args baked into the image by CI (see the
//! Dockerfile and docker-publish workflow), promoted to runtime env. They are
//! read ONCE at startup. When unset — for example a plain local `cargo run` or
//! a `docker build` with no args — they fall back to honest placeholders
//! (`dev` / `unknown`) rather than an invented or stale-looking number. They
//! are deliberately NOT sourced from `CARGO_PKG_VERSION`, which is a stale
//! placeholder in this repo and would display a wrong version.

use std::sync::LazyLock;

/// The release version this image was built from (e.g. `0.21.0`), or `dev` when
/// built outside CI.
pub static APP_VERSION: LazyLock<String> =
    LazyLock::new(|| non_empty_env("APP_VERSION").unwrap_or_else(|| "dev".to_string()));

/// The short git commit the image was built from (e.g. `a232171`), or `unknown`
/// when built outside CI.
pub static GIT_SHA: LazyLock<String> = LazyLock::new(|| {
    non_empty_env("GIT_SHA")
        .map(|s| s.chars().take(7).collect::<String>())
        .unwrap_or_else(|| "unknown".to_string())
});

/// Read an env var, treating an unset OR empty value as absent. Build args that
/// are declared but never supplied arrive as empty strings, which must fall
/// back rather than render blank.
fn non_empty_env(key: &str) -> Option<String> {
    match std::env::var(key) {
        Ok(v) if !v.trim().is_empty() => Some(v),
        _ => None,
    }
}
