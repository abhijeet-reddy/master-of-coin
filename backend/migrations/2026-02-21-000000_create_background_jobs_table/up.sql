-- PostgreSQL ENUMs for type safety
CREATE TYPE job_type AS ENUM ('DRIFT_DETECTION');
CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'PENDING',
    previous_job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL,
    input JSONB,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_background_jobs_user_id ON background_jobs(user_id);
CREATE INDEX idx_background_jobs_user_type ON background_jobs(user_id, job_type);
CREATE INDEX idx_background_jobs_status ON background_jobs(status);
