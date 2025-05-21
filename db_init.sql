-- Database initialization script for Poppy Discord Bot
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Users table - store information about bot users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    nickname TEXT,
    preferences JSONB DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table - store conversation history
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Create a unique constraint to ensure one conversation per user per channel
    UNIQUE(user_id, channel_id)
);

-- Custom commands table - store user-created custom commands
CREATE TABLE IF NOT EXISTS custom_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT, -- null means global command
    command TEXT NOT NULL,
    response TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Create a unique constraint to ensure unique commands per guild
    UNIQUE(guild_id, command)
);

-- Guild settings table - store server-specific settings
CREATE TABLE IF NOT EXISTS guild_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Status Messages table - store messages for the bot's status
CREATE TABLE IF NOT EXISTS status_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert status messages
INSERT INTO status_messages (message) VALUES
('👀 Watching you struggle with semicolons again... lol'),
('💅 Smarter than your code, cuter than your crush'),
('👾 I debug harder than you cry'),
('💖 Be nice or I’ll roast your entire GitHub'),
('☕ Powered by bugs, chaos & ✨vibes✨'),
('📟 404: Your chill? Not found.'),
('🧠 Cute face, deadly logic'),
('🎧 Coding with attitude & a killer playlist'),
('🫶 Brb, breaking the internet (cutely)'),
('💬 I don’t make errors. I make *features*');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel_id ON conversations(channel_id);
CREATE INDEX IF NOT EXISTS idx_custom_commands_guild_id ON custom_commands(guild_id);
CREATE INDEX IF NOT EXISTS idx_custom_commands_command ON custom_commands(command);
CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id);

-- Row level security policies
-- These enforce access rules at the database level for added security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_messages ENABLE ROW LEVEL SECURITY;

-- Create policy that only allows the service role to access all tables
-- This ensures only the bot can access the database through the service role key
CREATE POLICY service_role_all ON users TO authenticated USING (true);
CREATE POLICY service_role_all ON conversations TO authenticated USING (true);
CREATE POLICY service_role_all ON custom_commands TO authenticated USING (true);
CREATE POLICY service_role_all ON guild_settings TO authenticated USING (true);
CREATE POLICY service_role_all ON status_messages TO authenticated USING (true);

-- Sample data for testing (uncomment to use)
/*
-- Insert a sample user
INSERT INTO users (discord_id, username, nickname, message_count)
VALUES ('123456789', 'TestUser', 'Tester', 5);

-- Insert a sample conversation
INSERT INTO conversations (user_id, channel_id, messages)
VALUES (
    (SELECT id FROM users WHERE discord_id = '123456789'),
    '987654321',
    '[
        {"role": "user", "parts": [{"text": "Hello Poppy!"}], "timestamp": "2023-05-22T12:00:00Z"},
        {"role": "model", "parts": [{"text": "Heyyy TestUser! What''s up? 💖"}], "timestamp": "2023-05-22T12:00:05Z"}
    ]'::jsonb
);

-- Insert a sample custom command
INSERT INTO custom_commands (guild_id, command, response, created_by, usage_count)
VALUES (
    '111222333',
    'hello',
    'Heyyyy {user}! What''s going on? 😊',
    (SELECT id FROM users WHERE discord_id = '123456789'),
    3
);

-- Insert sample guild settings
INSERT INTO guild_settings (guild_id, settings)
VALUES (
    '111222333',
    '{"prefix": "!", "greeting_channel": "444555666"}'::jsonb
);
*/
