# Exchange Rate Test Mocking & Service Singleton — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: N/A

---

## Backend Implementation

### Phase 1: Define ExchangeRateProvider Trait & Rename Existing Service

#### 1.1 Add trait definition to exchange_rate_service.rs

- [x] Add `use async_trait::async_trait;` import
- [x] Define `ExchangeRateProvider` trait with three methods:
  - `get_exchange_rates(&self, base_currency: CurrencyCode) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError>`
  - `convert_currency(&self, amount: &BigDecimal, from: CurrencyCode, to: CurrencyCode) -> Result<BigDecimal, ApiError>` (with default impl)
  - `convert_to_primary_currency(&self, amount: &BigDecimal, from: CurrencyCode) -> Result<BigDecimal, ApiError>` (with default impl)

#### 1.2 Rename ExchangeRateService to LiveExchangeRateProvider

- [x] Rename `ExchangeRateService` struct to `LiveExchangeRateProvider`
- [x] Implement `ExchangeRateProvider` trait for `LiveExchangeRateProvider`
- [x] Move `convert_currency` and `convert_to_primary_currency` logic into the trait default implementations
- [x] Keep `fetch_rates` as a private method on `LiveExchangeRateProvider`
- [x] Remove the `Default` impl (or update it for the new name)
- [x] Add a type alias for backward compatibility if needed: `pub type ExchangeRateService = LiveExchangeRateProvider;`

#### 1.3 Create MockExchangeRateProvider

- [x] Add `MockExchangeRateProvider` struct with `rates: HashMap<CurrencyCode, HashMap<CurrencyCode, BigDecimal>>`
- [x] Implement `MockExchangeRateProvider::new()` with default fixed rates (see design.md Section 6)
- [x] Implement `MockExchangeRateProvider::with_rates()` for custom rate injection
- [x] Implement `ExchangeRateProvider` trait for `MockExchangeRateProvider`
- [x] Build mathematically consistent rate tables for all 7 supported currencies as base
- [x] Verify: `cargo check` passes

### Phase 2: Add ExchangeRateProvider to AppState

#### 2.1 Update AppState in lib.rs

- [x] Add `use std::sync::Arc;` and `use services::exchange_rate_service::ExchangeRateProvider;`
- [x] Add `exchange_rate_provider: Arc<dyn ExchangeRateProvider>` field to `AppState`
- [x] Update `AppState::new()` to create a `LiveExchangeRateProvider` and wrap in `Arc`
- [x] Add `AppState::with_exchange_provider()` constructor that accepts a custom `Arc<dyn ExchangeRateProvider>`
- [x] Verify: `cargo check` passes

### Phase 3: Update Handlers to Use AppState Provider

#### 3.1 Update exchange_rates handler

- [x] In `backend/src/handlers/exchange_rates.rs`:
  - Remove `ExchangeRateService::new()` call
  - Use `state.exchange_rate_provider.get_exchange_rates(base_currency).await?`
  - Add `State(state): State<AppState>` parameter (if not already present)

#### 3.2 Update dashboard handler

- [x] In `backend/src/handlers/dashboard.rs`:
  - Pass `&*state.exchange_rate_provider` to `analytics_service::get_dashboard_summary()`

#### 3.3 Update budgets handler

- [x] In `backend/src/handlers/budgets.rs`:
  - Pass `&*state.exchange_rate_provider` to `budget_service::get_budget()`
  - Other budget_service functions (`list_budgets`, `create_budget`, `update_budget`, `delete_budget`, `add_range`) do NOT use exchange rates — no changes needed

### Phase 4: Update Service Functions to Accept Provider Reference

#### 4.1 Update analytics_service.rs

- [x] Change import from `ExchangeRateService` to `ExchangeRateProvider`
- [x] Update `calculate_net_worth()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Remove `ExchangeRateService::new()` call (line 62)
  - Use `exchange_provider.convert_to_primary_currency()` instead
- [x] Update `get_category_breakdown()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Remove `ExchangeRateService::new()` call (line 178)
  - Use `exchange_provider.convert_to_primary_currency()` instead
- [x] Update `get_dashboard_summary()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Pass `exchange_provider` to `calculate_net_worth()`, `get_all_budget_statuses()`, `get_category_breakdown()`
- [x] Update `get_all_budget_statuses()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Pass `exchange_provider` to `budget_service::calculate_budget_status()`

#### 4.2 Update budget_service.rs

- [x] Change import from `ExchangeRateService` to `ExchangeRateProvider`
- [x] Update `get_budget()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Remove `ExchangeRateService::new()` call (line 112)
  - Use `exchange_provider.convert_to_primary_currency()` instead
- [x] Update `calculate_budget_status()` signature: add `exchange_provider: &dyn ExchangeRateProvider` parameter
  - Remove `ExchangeRateService::new()` call (line 327)
  - Use `exchange_provider.convert_to_primary_currency()` instead

#### 4.3 Verify compilation

- [x] Run `cargo check` — all production code compiles
- [x] Run `cargo build` — full build succeeds

### Phase 5: Update Test Server & Test Assertions

#### 5.1 Update test server to use MockExchangeRateProvider

- [x] In `backend/tests/integration/common/test_server.rs`:
  - Import `MockExchangeRateProvider` and `ExchangeRateProvider`
  - Create `Arc::new(MockExchangeRateProvider::new())`
  - Use `AppState::with_exchange_provider()` instead of `AppState::new()`
  - Remove any dependency on `EXCHANGE_RATE_API_KEY` env var for tests

#### 5.2 Update test_exchange_rates.rs assertions

- [x] Update `test_get_exchange_rates_default_base` — assert exact mock rate values for EUR base
- [x] Update `test_get_exchange_rates_custom_base` — assert USD rate is exactly "1" when USD is base
- [x] Update `test_get_exchange_rates_different_bases` — assert exact mock values for EUR and GBP bases
- [x] Keep `test_get_exchange_rates_unauthorized` unchanged (no exchange rate logic)
- [x] Keep `test_get_exchange_rates_invalid_token` unchanged (no exchange rate logic)
- [x] Update `test_exchange_rates_response_format` — assertions should still pass with mock data
- [x] Update `test_all_supported_currencies_as_base` — verify all 7 currencies work with mock
- [x] Update `test_exchange_rates_sanity_check` — tighten bounds to match mock rates exactly

#### 5.3 Update test_currency_conversion.rs assertions

- [x] Update `test_multi_currency_net_worth` — replace ±10% range with exact expected value based on mock rates
- [x] Update `test_multi_currency_budget_tracking` — replace ±10% range with exact expected value
- [x] Update `test_multi_currency_category_breakdown` — replace ±10% range with exact expected value
- [x] Update `test_comprehensive_multi_currency_scenario` — replace all ±10% ranges with exact values
- [x] Keep `test_same_currency_no_conversion` unchanged (no conversion involved)

#### 5.4 Add live API smoke test

- [x] Add `#[tokio::test] #[ignore] async fn test_live_exchange_rate_api()` to test_exchange_rates.rs
  - Load `.env` for `EXCHANGE_RATE_API_KEY`
  - Create `LiveExchangeRateProvider::new()` directly
  - Fetch rates for EUR base
  - Assert basic sanity: USD rate between 0.5 and 2.0, all 7 currencies present
  - This test runs only with `cargo test -- --ignored`

### Phase 6: Verify & Clean Up

- [x] Run full test suite: `cargo test` — all 366 tests pass, 1 ignored (live API smoke test)
- [x] Remove any leftover `ExchangeRateService::new()` calls (search codebase — 0 found)
- [x] Verify no direct `reqwest::get` calls to exchangerate-api.com remain outside `LiveExchangeRateProvider`
- [x] Clean up unused imports
