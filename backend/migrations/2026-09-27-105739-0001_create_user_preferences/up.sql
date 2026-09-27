-- Per-user display and calculation preferences. A missing row means defaults.
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_currency currency_code NOT NULL DEFAULT 'EUR',
    date_format VARCHAR(16) NOT NULL DEFAULT 'DD/MM/YYYY'
        CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
    number_locale VARCHAR(16) NOT NULL DEFAULT 'en-US'
        CHECK (number_locale IN ('en-US', 'de-DE', 'fr-FR', 'en-IN')),
    week_start SMALLINT NOT NULL DEFAULT 1 CHECK (week_start IN (1, 7)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
