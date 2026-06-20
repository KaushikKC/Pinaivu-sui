//! HTTP API routes.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{archive::WalrusClient, db};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub walrus: Arc<WalrusClient>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/r/{request_id}", get(get_request))
        .route("/api/nodes/{peer_id}", get(get_node))
        .route("/api/recent", get(recent))
        .route("/api/ingest", post(ingest_receipt))
}

// ── /health ──────────────────────────────────────────────────────────────────

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

// ── GET /api/r/:request_id ────────────────────────────────────────────────────

async fn get_request(
    State(state): State<AppState>,
    Path(request_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let receipt = db::get_receipt(&state.pool, request_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let payments = db::get_payments(&state.pool, request_id).await?;
    Ok(Json(db::RequestRecord { receipt, payments }))
}

// ── GET /api/nodes/:peer_id ───────────────────────────────────────────────────

#[derive(Serialize)]
struct NodeProfile {
    peer_id: String,
    jobs_served: usize,
    recent_receipts: Vec<db::ReceiptRow>,
}

async fn get_node(
    State(state): State<AppState>,
    Path(peer_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let receipts = db::receipts_for_node(&state.pool, &peer_id, 50).await?;
    let jobs_served = receipts.len();
    Ok(Json(NodeProfile {
        peer_id,
        jobs_served,
        recent_receipts: receipts,
    }))
}

// ── GET /api/recent ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct Pagination {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    20
}

async fn recent(
    State(state): State<AppState>,
    Query(p): Query<Pagination>,
) -> Result<impl IntoResponse, ApiError> {
    let limit = p.limit.clamp(1, 100);
    let rows = db::recent_receipts(&state.pool, limit, p.offset).await?;
    Ok(Json(rows))
}

// ── POST /api/ingest (local dev — insert receipt + payment) ──────────────────

#[derive(Deserialize)]
struct IngestPayload {
    request_id: Uuid,
    #[serde(default)]
    receipt_json: Option<serde_json::Value>,
    #[serde(default)]
    primary_peer_id: String,
    #[serde(default)]
    payout_address: String,
    #[serde(default)]
    amount_nanox: i64,
    #[serde(default)]
    input_tokens: u32,
    #[serde(default)]
    output_tokens: u32,
    #[serde(default)]
    latency_ms: u32,
}

async fn ingest_receipt(
    State(state): State<AppState>,
    Json(payload): Json<IngestPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let receipt_json = payload.receipt_json.unwrap_or_else(|| {
        serde_json::json!({
            "request_id": payload.request_id,
            "primary_peer_id": payload.primary_peer_id,
            "helper_peer_ids": [],
            "client_id": "",
            "payouts": [],
            "timestamp_ms": chrono::Utc::now().timestamp_millis(),
        })
    });

    sqlx::query(
        "INSERT INTO routing_receipts (request_id, receipt_json, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (request_id) DO UPDATE SET receipt_json = $2",
    )
    .bind(payload.request_id)
    .bind(&receipt_json)
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    if !payload.payout_address.is_empty() && payload.amount_nanox > 0 {
        sqlx::query(
            "INSERT INTO payments (request_id, payee_peer_id, payee_sui_address, amount_nanox, status, created_at)
             VALUES ($1, $2, $3, $4, 'submitted', NOW())
             ON CONFLICT DO NOTHING",
        )
        .bind(payload.request_id)
        .bind(&payload.primary_peer_id)
        .bind(&payload.payout_address)
        .bind(payload.amount_nanox)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Error type ────────────────────────────────────────────────────────────────

enum ApiError {
    NotFound,
    Internal(anyhow::Error),
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        Self::Internal(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        match self {
            Self::NotFound => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "not found" }))).into_response(),
            Self::Internal(e) => {
                tracing::error!(err = %e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "internal error" }))).into_response()
            }
        }
    }
}
