#!/usr/bin/env bash
#
# Seed the BETA preview instance with throwaway demo data.
#
# This talks to a running MOC beta instance over its HTTP API (register →
# create accounts/categories/budgets/transactions) using the real code paths,
# so the seed can never drift from the schema and needs no hand-crafted hashes.
#
# SAFETY: this is for the BETA slot ONLY. It creates a fresh demo user with
# fake data. Never point BETA_URL at production — the beta stack uses its own
# throwaway database (see the deploy repo's docker-compose.beta.yml).
#
# Usage:
#   BETA_URL=https://moc.beta.abhijeetreddy.in ./scripts/seed-beta-demo.sh
# Optional overrides:
#   DEMO_EMAIL, DEMO_USERNAME, DEMO_PASSWORD, DEMO_NAME
#
# The script is idempotent-ish: if the demo user already exists, registration
# fails and it logs in instead, then skips creating duplicate accounts by name.

set -euo pipefail

BETA_URL="${BETA_URL:-http://localhost:13253}"
API="${BETA_URL%/}/api/v1"
DEMO_EMAIL="${DEMO_EMAIL:-demo@moc.local}"
DEMO_USERNAME="${DEMO_USERNAME:-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo@password}"
DEMO_NAME="${DEMO_NAME:-Demo User}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

echo "Seeding beta demo data at ${API}"

# --- Guard: refuse anything that looks like production ------------------------
case "${BETA_URL}" in
  *beta*|*localhost*|*127.0.0.1*) : ;;
  *)
    echo "Refusing to seed: BETA_URL '${BETA_URL}' does not look like a beta/local host." >&2
    echo "This script must never run against production." >&2
    exit 1
    ;;
esac

# --- Register (or log in if the demo user already exists) ---------------------
register_body=$(jq -n \
  --arg u "$DEMO_USERNAME" --arg e "$DEMO_EMAIL" --arg p "$DEMO_PASSWORD" --arg n "$DEMO_NAME" \
  '{username:$u, email:$e, password:$p, name:$n}')

reg_resp=$(curl -s -o /tmp/seed_reg.json -w "%{http_code}" \
  -X POST "${API}/auth/register" -H 'Content-Type: application/json' -d "$register_body")

if [ "$reg_resp" = "201" ] || [ "$reg_resp" = "200" ]; then
  TOKEN=$(jq -r '.token' /tmp/seed_reg.json)
  echo "Registered demo user."
else
  echo "Register returned HTTP ${reg_resp}; attempting login (user may already exist)."
  login_body=$(jq -n --arg e "$DEMO_EMAIL" --arg p "$DEMO_PASSWORD" '{email:$e, password:$p}')
  curl -s -o /tmp/seed_login.json -X POST "${API}/auth/login" \
    -H 'Content-Type: application/json' -d "$login_body"
  TOKEN=$(jq -r '.token' /tmp/seed_login.json)
fi

if [ -z "${TOKEN:-}" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to obtain auth token; aborting." >&2
  exit 1
fi
AUTH=(-H "Authorization: Bearer ${TOKEN}")

# --- Helpers ------------------------------------------------------------------
post() { curl -s "${AUTH[@]}" -H 'Content-Type: application/json' -X POST "${API}$1" -d "$2"; }

existing_accounts=$(curl -s "${AUTH[@]}" "${API}/accounts")
account_exists() { echo "$existing_accounts" | jq -e --arg n "$1" 'any(.[]; .name == $n)' >/dev/null 2>&1; }

create_account() { # name type currency initial_balance
  if account_exists "$1"; then echo "  account '$1' exists, skipping"; return; fi
  local body
  body=$(jq -n --arg n "$1" --arg t "$2" --arg c "$3" --argjson b "$4" \
    '{name:$n, account_type:$t, currency:$c, initial_balance:$b}')
  post "/accounts" "$body" | jq -r '"  account: " + .name + " (" + .id + ")"'
}

create_category() { # name
  post "/categories" "$(jq -n --arg n "$1" '{name:$n}')" | jq -r '"  category: " + .name + " (" + .id + ")"'
}

# --- Seed accounts ------------------------------------------------------------
echo "Creating demo accounts..."
create_account "Demo Checking" "CHECKING" "EUR" 2500
create_account "Demo Savings" "SAVINGS" "EUR" 8000
create_account "Demo Brokerage" "INVESTMENT" "EUR" 15000
create_account "Demo Credit Card" "CREDIT_CARD" "EUR" -420

# Re-fetch accounts to get ids for transactions
accounts=$(curl -s "${AUTH[@]}" "${API}/accounts")
checking_id=$(echo "$accounts" | jq -r '.[] | select(.name=="Demo Checking") | .id')

# --- Seed categories ----------------------------------------------------------
echo "Creating demo categories..."
create_category "Groceries" >/dev/null || true
create_category "Salary" >/dev/null || true
create_category "Dining" >/dev/null || true
create_category "Transport" >/dev/null || true
cats=$(curl -s "${AUTH[@]}" "${API}/categories")
groceries_id=$(echo "$cats" | jq -r '.[] | select(.name=="Groceries") | .id')
salary_id=$(echo "$cats" | jq -r '.[] | select(.name=="Salary") | .id')

# --- Seed transactions --------------------------------------------------------
echo "Creating demo transactions..."
mk_txn() { # account_id title amount category_id
  local body
  body=$(jq -n --arg a "$1" --arg t "$2" --argjson amt "$3" --arg c "$4" --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{account_id:$a, title:$t, amount:$amt, date:$d} + (if $c != "" then {category_id:$c} else {} end)')
  post "/transactions" "$body" >/dev/null
}

if [ -n "$checking_id" ]; then
  mk_txn "$checking_id" "Monthly salary" 3200 "$salary_id"
  mk_txn "$checking_id" "Supermarket" -76.40 "$groceries_id"
  mk_txn "$checking_id" "Coffee" -4.20 ""
  mk_txn "$checking_id" "Train ticket" -12.00 ""
fi

echo "Beta demo seed complete."
echo "Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}"
