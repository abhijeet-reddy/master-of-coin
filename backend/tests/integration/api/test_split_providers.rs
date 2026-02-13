//! Integration tests for split provider and person split config API endpoints.

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::{NewSplitProvider, PersonSplitConfigResponse, SplitProvider, SplitProviderResponse},
    schema::split_providers,
};
use serde_json::json;
use uuid::Uuid;

// ============================================================================
// Helpers
// ============================================================================

fn create_test_split_provider(
    pool: &master_of_coin_backend::DbPool,
    user_id: Uuid,
    provider_type: &str,
) -> SplitProvider {
    let mut conn = pool.get().expect("Failed to get DB connection");
    let new_provider = NewSplitProvider {
        user_id,
        provider_type: provider_type.to_string(),
        credentials: json!({"encrypted": "test_encrypted_credentials"}),
        is_active: true,
    };
    diesel::insert_into(split_providers::table)
        .values(&new_provider)
        .get_result::<SplitProvider>(&mut conn)
        .expect("Failed to create test split provider")
}

fn get_test_db_pool() -> master_of_coin_backend::DbPool {
    use diesel::PgConnection;
    use diesel::r2d2::{self, ConnectionManager};
    dotenvy::from_filename("../.env").ok();
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to create test database pool")
}

// ============================================================================
// List Providers
// ============================================================================

#[tokio::test]
async fn test_list_providers_empty() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sp_empty_{}", ts),
        &format!("sp_empty_{}@example.com", ts),
        "SecurePass123!",
        "SP Empty",
    )
    .await;

    let response = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&response, 200);
    let providers: Vec<SplitProviderResponse> = extract_json(response);
    assert_eq!(providers.len(), 0);
}

#[tokio::test]
async fn test_list_providers_with_data() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sp_list_{}", ts),
        &format!("sp_list_{}@example.com", ts),
        "SecurePass123!",
        "SP List",
    )
    .await;

    create_test_split_provider(&pool, auth.user.id, "splitwise");

    let response = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&response, 200);
    let providers: Vec<SplitProviderResponse> = extract_json(response);
    assert_eq!(providers.len(), 1);
    assert_eq!(providers[0].provider_type, "splitwise");
    assert!(providers[0].is_active);
    assert_eq!(providers[0].user_id, auth.user.id);
}

#[tokio::test]
async fn test_list_providers_unauthorized() {
    let server = create_test_server().await;
    let response = get_unauthenticated(&server, "/api/v1/integrations/providers").await;
    assert_status(&response, 401);
}

#[tokio::test]
async fn test_list_providers_isolation() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sp_isoa_{}", ts),
        &format!("sp_isoa_{}@example.com", ts),
        "SecurePass123!",
        "SP Iso A",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sp_isob_{}", ts),
        &format!("sp_isob_{}@example.com", ts),
        "SecurePass123!",
        "SP Iso B",
    )
    .await;

    create_test_split_provider(&pool, auth_a.user.id, "splitwise");

    let ra = get_authenticated(&server, "/api/v1/integrations/providers", &auth_a.token).await;
    assert_status(&ra, 200);
    let pa: Vec<SplitProviderResponse> = extract_json(ra);
    assert_eq!(pa.len(), 1);

    let rb = get_authenticated(&server, "/api/v1/integrations/providers", &auth_b.token).await;
    assert_status(&rb, 200);
    let pb: Vec<SplitProviderResponse> = extract_json(rb);
    assert_eq!(pb.len(), 0);
}

// ============================================================================
// Disconnect Provider
// ============================================================================

#[tokio::test]
async fn test_disconnect_provider_success() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sp_disc_{}", ts),
        &format!("sp_disc_{}@example.com", ts),
        "SecurePass123!",
        "SP Disc",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let resp = delete_authenticated(
        &server,
        &format!("/api/v1/integrations/providers/{}", provider.id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 204);

    let list = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&list, 200);
    let providers: Vec<SplitProviderResponse> = extract_json(list);
    assert_eq!(providers.len(), 0);
}

#[tokio::test]
async fn test_disconnect_provider_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sp_dnf_{}", ts),
        &format!("sp_dnf_{}@example.com", ts),
        "SecurePass123!",
        "SP DNF",
    )
    .await;

    let resp = delete_authenticated(
        &server,
        &format!("/api/v1/integrations/providers/{}", Uuid::new_v4()),
        &auth.token,
    )
    .await;
    assert_status(&resp, 404);
}

#[tokio::test]
async fn test_disconnect_provider_wrong_user() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sp_dwa_{}", ts),
        &format!("sp_dwa_{}@example.com", ts),
        "SecurePass123!",
        "SP DW A",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sp_dwb_{}", ts),
        &format!("sp_dwb_{}@example.com", ts),
        "SecurePass123!",
        "SP DW B",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth_a.user.id, "splitwise");
    let resp = delete_authenticated(
        &server,
        &format!("/api/v1/integrations/providers/{}", provider.id),
        &auth_b.token,
    )
    .await;
    assert_status(&resp, 404);

    // Still exists for user A
    let list = get_authenticated(&server, "/api/v1/integrations/providers", &auth_a.token).await;
    let providers: Vec<SplitProviderResponse> = extract_json(list);
    assert_eq!(providers.len(), 1);
}

#[tokio::test]
async fn test_disconnect_provider_unauthorized() {
    let server = create_test_server().await;
    let resp = server
        .delete(&format!(
            "/api/v1/integrations/providers/{}",
            Uuid::new_v4()
        ))
        .await;
    assert_status(&resp, 401);
}

#[tokio::test]
async fn test_disconnect_provider_cascades_to_configs() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sp_casc_{}", ts),
        &format!("sp_casc_{}@example.com", ts),
        "SecurePass123!",
        "SP Cascade",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "Cascade Person").await;

    // Set split config
    let req = json!({"split_provider_id": provider.id, "external_user_id": "12345"});
    let set = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
        &req,
    )
    .await;
    assert_status(&set, 200);

    // Disconnect provider
    let disc = delete_authenticated(
        &server,
        &format!("/api/v1/integrations/providers/{}", provider.id),
        &auth.token,
    )
    .await;
    assert_status(&disc, 204);

    // Config should be gone (cascade)
    let get = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
    )
    .await;
    assert_status(&get, 404);
}

// ============================================================================
// Set Split Config
// ============================================================================

#[tokio::test]
async fn test_set_split_config_success() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_set_{}", ts),
        &format!("sc_set_{}@example.com", ts),
        "SecurePass123!",
        "SC Set",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "Config Person").await;

    let req = json!({"split_provider_id": provider.id, "external_user_id": "67890"});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
        &req,
    )
    .await;
    assert_status(&resp, 200);

    let config: PersonSplitConfigResponse = extract_json(resp);
    assert_eq!(config.person_id, person.id);
    assert_eq!(config.split_provider_id, provider.id);
    assert_eq!(config.external_user_id, "67890");
    assert_eq!(config.provider_type, "splitwise");
}

#[tokio::test]
async fn test_set_split_config_upsert() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_ups_{}", ts),
        &format!("sc_ups_{}@example.com", ts),
        "SecurePass123!",
        "SC Ups",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "Upsert Person").await;
    let path = format!("/api/v1/people/{}/split-config", person.id);

    let r1 = json!({"split_provider_id": provider.id, "external_user_id": "11111"});
    let resp1 = put_authenticated(&server, &path, &auth.token, &r1).await;
    assert_status(&resp1, 200);
    let c1: PersonSplitConfigResponse = extract_json(resp1);
    assert_eq!(c1.external_user_id, "11111");

    let r2 = json!({"split_provider_id": provider.id, "external_user_id": "22222"});
    let resp2 = put_authenticated(&server, &path, &auth.token, &r2).await;
    assert_status(&resp2, 200);
    let c2: PersonSplitConfigResponse = extract_json(resp2);
    assert_eq!(c2.external_user_id, "22222");
}

#[tokio::test]
async fn test_set_split_config_provider_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_npv_{}", ts),
        &format!("sc_npv_{}@example.com", ts),
        "SecurePass123!",
        "SC NPV",
    )
    .await;

    let person = create_test_person(&server, &auth.token, "NP Person").await;
    let req = json!({"split_provider_id": Uuid::new_v4(), "external_user_id": "12345"});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
        &req,
    )
    .await;
    assert_status(&resp, 404);
}

#[tokio::test]
async fn test_set_split_config_person_not_found() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_npe_{}", ts),
        &format!("sc_npe_{}@example.com", ts),
        "SecurePass123!",
        "SC NPE",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let req = json!({"split_provider_id": provider.id, "external_user_id": "12345"});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", Uuid::new_v4()),
        &auth.token,
        &req,
    )
    .await;
    assert_status(&resp, 404);
}

#[tokio::test]
async fn test_set_split_config_wrong_user_person() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sc_wpa_{}", ts),
        &format!("sc_wpa_{}@example.com", ts),
        "SecurePass123!",
        "SC WPA",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sc_wpb_{}", ts),
        &format!("sc_wpb_{}@example.com", ts),
        "SecurePass123!",
        "SC WPB",
    )
    .await;

    let person_a = create_test_person(&server, &auth_a.token, "A Person").await;
    let provider_b = create_test_split_provider(&pool, auth_b.user.id, "splitwise");

    let req = json!({"split_provider_id": provider_b.id, "external_user_id": "12345"});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person_a.id),
        &auth_b.token,
        &req,
    )
    .await;
    assert_status(&resp, 403);
}

#[tokio::test]
async fn test_set_split_config_wrong_user_provider() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sc_wva_{}", ts),
        &format!("sc_wva_{}@example.com", ts),
        "SecurePass123!",
        "SC WVA",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sc_wvb_{}", ts),
        &format!("sc_wvb_{}@example.com", ts),
        "SecurePass123!",
        "SC WVB",
    )
    .await;

    let provider_a = create_test_split_provider(&pool, auth_a.user.id, "splitwise");
    let person_b = create_test_person(&server, &auth_b.token, "B Person").await;

    let req = json!({"split_provider_id": provider_a.id, "external_user_id": "12345"});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person_b.id),
        &auth_b.token,
        &req,
    )
    .await;
    assert_status(&resp, 403);
}

#[tokio::test]
async fn test_set_split_config_empty_external_id() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_eid_{}", ts),
        &format!("sc_eid_{}@example.com", ts),
        "SecurePass123!",
        "SC EID",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "EID Person").await;

    let req = json!({"split_provider_id": provider.id, "external_user_id": ""});
    let resp = put_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
        &req,
    )
    .await;
    assert_status(&resp, 422);
}

#[tokio::test]
async fn test_set_split_config_unauthorized() {
    let server = create_test_server().await;
    let req = json!({"split_provider_id": Uuid::new_v4(), "external_user_id": "12345"});
    let resp = server
        .put(&format!("/api/v1/people/{}/split-config", Uuid::new_v4()))
        .json(&req)
        .await;
    assert_status(&resp, 401);
}

// ============================================================================
// Get Split Config
// ============================================================================

#[tokio::test]
async fn test_get_split_config_success() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_get_{}", ts),
        &format!("sc_get_{}@example.com", ts),
        "SecurePass123!",
        "SC Get",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "Get Config Person").await;
    let path = format!("/api/v1/people/{}/split-config", person.id);

    let set_req = json!({"split_provider_id": provider.id, "external_user_id": "99999"});
    let set_resp = put_authenticated(&server, &path, &auth.token, &set_req).await;
    assert_status(&set_resp, 200);

    let get_resp = get_authenticated(&server, &path, &auth.token).await;
    assert_status(&get_resp, 200);
    let config: PersonSplitConfigResponse = extract_json(get_resp);
    assert_eq!(config.person_id, person.id);
    assert_eq!(config.external_user_id, "99999");
    assert_eq!(config.provider_type, "splitwise");
}

#[tokio::test]
async fn test_get_split_config_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_gnf_{}", ts),
        &format!("sc_gnf_{}@example.com", ts),
        "SecurePass123!",
        "SC GNF",
    )
    .await;

    let person = create_test_person(&server, &auth.token, "No Config").await;
    let resp = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 404);
}

#[tokio::test]
async fn test_get_split_config_wrong_user() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sc_gwa_{}", ts),
        &format!("sc_gwa_{}@example.com", ts),
        "SecurePass123!",
        "SC GWA",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sc_gwb_{}", ts),
        &format!("sc_gwb_{}@example.com", ts),
        "SecurePass123!",
        "SC GWB",
    )
    .await;

    let provider_a = create_test_split_provider(&pool, auth_a.user.id, "splitwise");
    let person_a = create_test_person(&server, &auth_a.token, "A Person").await;
    let path = format!("/api/v1/people/{}/split-config", person_a.id);

    let req = json!({"split_provider_id": provider_a.id, "external_user_id": "12345"});
    let set = put_authenticated(&server, &path, &auth_a.token, &req).await;
    assert_status(&set, 200);

    let resp = get_authenticated(&server, &path, &auth_b.token).await;
    assert_status(&resp, 403);
}

#[tokio::test]
async fn test_get_split_config_unauthorized() {
    let server = create_test_server().await;
    let resp = get_unauthenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", Uuid::new_v4()),
    )
    .await;
    assert_status(&resp, 401);
}

// ============================================================================
// Delete Split Config
// ============================================================================

#[tokio::test]
async fn test_delete_split_config_success() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_del_{}", ts),
        &format!("sc_del_{}@example.com", ts),
        "SecurePass123!",
        "SC Del",
    )
    .await;

    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");
    let person = create_test_person(&server, &auth.token, "Del Config Person").await;
    let path = format!("/api/v1/people/{}/split-config", person.id);

    let req = json!({"split_provider_id": provider.id, "external_user_id": "55555"});
    let set = put_authenticated(&server, &path, &auth.token, &req).await;
    assert_status(&set, 200);

    let del = delete_authenticated(&server, &path, &auth.token).await;
    assert_status(&del, 204);

    let get = get_authenticated(&server, &path, &auth.token).await;
    assert_status(&get, 404);
}

#[tokio::test]
async fn test_delete_split_config_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_dnf_{}", ts),
        &format!("sc_dnf_{}@example.com", ts),
        "SecurePass123!",
        "SC DNF",
    )
    .await;

    let person = create_test_person(&server, &auth.token, "DNF Person").await;
    let resp = delete_authenticated(
        &server,
        &format!("/api/v1/people/{}/split-config", person.id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 404);
}

#[tokio::test]
async fn test_delete_split_config_wrong_user() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth_a = register_test_user(
        &server,
        &format!("sc_dwa_{}", ts),
        &format!("sc_dwa_{}@example.com", ts),
        "SecurePass123!",
        "SC DWA",
    )
    .await;
    let auth_b = register_test_user(
        &server,
        &format!("sc_dwb_{}", ts),
        &format!("sc_dwb_{}@example.com", ts),
        "SecurePass123!",
        "SC DWB",
    )
    .await;

    let provider_a = create_test_split_provider(&pool, auth_a.user.id, "splitwise");
    let person_a = create_test_person(&server, &auth_a.token, "A Person").await;
    let path = format!("/api/v1/people/{}/split-config", person_a.id);

    let req = json!({"split_provider_id": provider_a.id, "external_user_id": "12345"});
    let set = put_authenticated(&server, &path, &auth_a.token, &req).await;
    assert_status(&set, 200);

    let resp = delete_authenticated(&server, &path, &auth_b.token).await;
    assert_status(&resp, 403);

    // Config still exists for user A
    let get = get_authenticated(&server, &path, &auth_a.token).await;
    assert_status(&get, 200);
}

#[tokio::test]
async fn test_delete_split_config_unauthorized() {
    let server = create_test_server().await;
    let resp = server
        .delete(&format!("/api/v1/people/{}/split-config", Uuid::new_v4()))
        .await;
    assert_status(&resp, 401);
}

// ============================================================================
// Full CRUD Flow
// ============================================================================

#[tokio::test]
async fn test_full_split_config_flow() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sc_flow_{}", ts),
        &format!("sc_flow_{}@example.com", ts),
        "SecurePass123!",
        "SC Flow",
    )
    .await;

    // 1. List providers (empty)
    let list0 = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&list0, 200);
    let p0: Vec<SplitProviderResponse> = extract_json(list0);
    assert_eq!(p0.len(), 0);

    // 2. Create provider (via DB - simulating OAuth)
    let provider = create_test_split_provider(&pool, auth.user.id, "splitwise");

    // 3. List providers (1 provider)
    let list1 = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&list1, 200);
    let p1: Vec<SplitProviderResponse> = extract_json(list1);
    assert_eq!(p1.len(), 1);
    assert_eq!(p1[0].provider_type, "splitwise");

    // 4. Create person
    let person = create_test_person(&server, &auth.token, "Flow Person").await;

    // 5. Set split config
    let path = format!("/api/v1/people/{}/split-config", person.id);
    let req = json!({"split_provider_id": provider.id, "external_user_id": "44444"});
    let set = put_authenticated(&server, &path, &auth.token, &req).await;
    assert_status(&set, 200);
    let cfg: PersonSplitConfigResponse = extract_json(set);
    assert_eq!(cfg.external_user_id, "44444");

    // 6. Get split config
    let get = get_authenticated(&server, &path, &auth.token).await;
    assert_status(&get, 200);
    let cfg2: PersonSplitConfigResponse = extract_json(get);
    assert_eq!(cfg2.external_user_id, "44444");

    // 7. Update split config (upsert)
    let req2 = json!({"split_provider_id": provider.id, "external_user_id": "55555"});
    let upd = put_authenticated(&server, &path, &auth.token, &req2).await;
    assert_status(&upd, 200);
    let cfg3: PersonSplitConfigResponse = extract_json(upd);
    assert_eq!(cfg3.external_user_id, "55555");

    // 8. Delete split config
    let del = delete_authenticated(&server, &path, &auth.token).await;
    assert_status(&del, 204);

    // 9. Verify config is gone
    let get2 = get_authenticated(&server, &path, &auth.token).await;
    assert_status(&get2, 404);

    // 10. Disconnect provider
    let disc = delete_authenticated(
        &server,
        &format!("/api/v1/integrations/providers/{}", provider.id),
        &auth.token,
    )
    .await;
    assert_status(&disc, 204);

    // 11. Verify provider is gone
    let list2 = get_authenticated(&server, "/api/v1/integrations/providers", &auth.token).await;
    assert_status(&list2, 200);
    let p2: Vec<SplitProviderResponse> = extract_json(list2);
    assert_eq!(p2.len(), 0);
}
