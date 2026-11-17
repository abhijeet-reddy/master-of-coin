#!/usr/bin/env bash
# Apply every Diesel migration to the database in DATABASE_URL, without diesel_cli.
#
# The integration tests do not run migrations themselves (create_test_server only builds
# a pool), so the schema has to exist before the suite starts. Installing diesel_cli in
# CI costs a few minutes of compile time, so this applies each migrations/*/up.sql in
# directory order with psql instead.
#
# It also records every migration in Diesel's ledger. Diesel creates
# __diesel_schema_migrations at runtime rather than in a migration, and the handful of
# tests that DO call run_migrations (test_duplicate_detection, test_connection) would
# otherwise try to replay migration 1 and fail with "type account_type already exists".
# Diesel's version string is the digits of the directory-name prefix.
#
# Usage: DATABASE_URL=postgres://user:pass@host:port/db backend/scripts/ci-apply-migrations.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/migrations"
[ -d "$MIGRATIONS_DIR" ] || { echo "no migrations dir at $MIGRATIONS_DIR"; exit 1; }

SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT

cat >> "$SQL" <<'DDL'
CREATE TABLE IF NOT EXISTS __diesel_schema_migrations (
  version VARCHAR(50) PRIMARY KEY NOT NULL,
  run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DDL

count=0
for dir in "$MIGRATIONS_DIR"/*/; do
  [ -f "$dir/up.sql" ] || continue
  name="$(basename "$dir")"
  version="$(printf '%s' "${name%%_*}" | tr -cd '0-9')"
  [ -n "$version" ] || continue

  printf '\n-- ===== %s =====\n' "$name" >> "$SQL"
  cat "$dir/up.sql" >> "$SQL"
  printf "\nINSERT INTO __diesel_schema_migrations (version) VALUES ('%s') ON CONFLICT DO NOTHING;\n" \
    "$version" >> "$SQL"
  count=$((count + 1))
done

psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$SQL"
echo "applied $count migrations"
