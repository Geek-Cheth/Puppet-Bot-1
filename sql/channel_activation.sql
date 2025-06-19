-- Channel activation system for controlling bot responses
-- This table stores which channels the bot is allowed to respond in

CREATE TABLE IF NOT EXISTS channel_activations (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    activated_by TEXT, -- Discord user ID who activated/deactivated
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, channel_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_channel_activations_lookup ON channel_activations(guild_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_activations_active ON channel_activations(is_active);

-- Insert default activation states for existing channels can be done via the application
-- This table will be populated when channels are first activated/deactivated
