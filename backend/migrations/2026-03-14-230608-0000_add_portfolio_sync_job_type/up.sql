-- Add PORTFOLIO_SYNC to job_type enum for the Investment Portfolio Sync feature
-- PORTFOLIO_SYNC jobs fetch current stock values from brokerage APIs and create adjustment transactions
ALTER TYPE job_type ADD VALUE 'PORTFOLIO_SYNC';
