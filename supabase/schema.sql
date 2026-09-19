-- ==============================================================================
-- SCHEMA: TRAFFIC CHECK MVP
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- Create table traffic_checks if it does not exist
CREATE TABLE IF NOT EXISTS traffic_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE,
    monthly_traffic BIGINT NOT NULL DEFAULT 0,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_starred BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on domain for rapid cache lookup
CREATE INDEX IF NOT EXISTS idx_traffic_checks_domain ON traffic_checks (domain);

-- Create index on monthly_traffic & is_starred for fast filtering & sorting
CREATE INDEX IF NOT EXISTS idx_traffic_checks_monthly_traffic ON traffic_checks (monthly_traffic);
CREATE INDEX IF NOT EXISTS idx_traffic_checks_is_starred ON traffic_checks (is_starred);
CREATE INDEX IF NOT EXISTS idx_traffic_checks_checked_at ON traffic_checks (checked_at DESC);

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on modification
DROP TRIGGER IF EXISTS trigger_update_traffic_checks_modtime ON traffic_checks;
CREATE TRIGGER trigger_update_traffic_checks_modtime
    BEFORE UPDATE ON traffic_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Row Level Security (RLS) Policy for MVP
-- MVP does not have user authentication, so we allow public read/write access via Supabase API
ALTER TABLE traffic_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for anon and service role" ON traffic_checks;
CREATE POLICY "Allow all operations for anon and service role"
    ON traffic_checks
    FOR ALL
    TO anon, service_role
    USING (true)
    WITH CHECK (true);
