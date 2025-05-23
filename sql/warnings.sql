-- Warnings Table for Discord Bot Admin System
-- This table stores user warnings issued by moderators

CREATE TABLE IF NOT EXISTS warnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;

-- Add a policy for authenticated users (adjust as needed based on your security requirements)
CREATE POLICY "Enable read access for service role" ON warnings
    FOR ALL
    TO service_role
    USING (true);

-- Comments for documentation
COMMENT ON TABLE warnings IS 'Stores moderation warnings issued to users in Discord guilds';
COMMENT ON COLUMN warnings.id IS 'Unique identifier for the warning';
COMMENT ON COLUMN warnings.guild_id IS 'Discord guild (server) ID where the warning was issued';
COMMENT ON COLUMN warnings.user_id IS 'Discord user ID of the warned user';
COMMENT ON COLUMN warnings.moderator_id IS 'Discord user ID of the moderator who issued the warning';
COMMENT ON COLUMN warnings.reason IS 'Reason for the warning';
COMMENT ON COLUMN warnings.created_at IS 'Timestamp when the warning was created';
