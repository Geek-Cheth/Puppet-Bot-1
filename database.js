const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Database schema information:
 * 
 * Table: users
 * - id: UUID (primary key)
 * - discord_id: String (unique)
 * - username: String
 * - nickname: String (nullable)
 * - preferences: JSON
 * - message_count: Integer
 * - last_active: Timestamp
 * - created_at: Timestamp
 * 
 * Table: conversations
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users.id)
 * - channel_id: String
 * - messages: JSON Array (stores conversation history)
 * - created_at: Timestamp
 * - last_message_at: Timestamp
 * 
 * Table: custom_commands
 * - id: UUID (primary key)
 * - guild_id: String (nullable, if null then global)
 * - command: String
 * - response: String
 * - created_by: UUID (foreign key to users.id)
 * - usage_count: Integer
 * - created_at: Timestamp
 * 
 * Table: guild_settings
 * - id: UUID (primary key)
 * - guild_id: String (unique)
 * - settings: JSON
 * - created_at: Timestamp
 * - updated_at: Timestamp
 * 
 * Table: shortened_urls
 *  - id: UUID (primary key)
 *  - user_id: UUID (foreign key to users.id)
 *  - original_url: TEXT
 *  - short_code: TEXT (the unique path segment of the shortened URL, e.g., pEqXje)
 *  - short_url: TEXT (full shortened URL, e.g., https://cleanuri.com/pEqXje)
 *  - created_at: Timestamp
 * 
 * Table: warnings
 *  - id: UUID (primary key)
 *  - guild_id: String
 *  - user_id: String (discord_id)
 *  - moderator_id: String (discord_id)
 *  - reason: TEXT
 *  - created_at: Timestamp
 */

// User management functions
async function getUser(discordId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is the "not found" error code
        console.error('Error fetching user:', error);
        return null;
    }
    
    return data;
}

async function createOrUpdateUser(userData) {
    const { discord_id, username, nickname } = userData;
    
    // Try to get existing user
    const existingUser = await getUser(discord_id);
    
    if (existingUser) {
        // Update user
        const { data, error } = await supabase
            .from('users')
            .update({
                username,
                nickname: nickname || existingUser.nickname,
                last_active: new Date(),
                message_count: existingUser.message_count + 1
            })
            .eq('discord_id', discord_id)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating user:', error);
            return existingUser; // Return existing user as fallback
        }
        
        return data;
    } else {
        // Create new user
        const { data, error } = await supabase
            .from('users')
            .insert({
                discord_id,
                username,
                nickname,
                preferences: {},
                message_count: 1,
                last_active: new Date(),
                created_at: new Date()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating user:', error);
            return null;
        }
        
        return data;
    }
}

async function updateUserPreference(discordId, key, value) {
    const user = await getUser(discordId);
    if (!user) return null;
    
    // Get current preferences or initialize empty object
    const preferences = user.preferences || {};
    
    // Update the specific preference
    preferences[key] = value;
    
    const { data, error } = await supabase
        .from('users')
        .update({ preferences })
        .eq('discord_id', discordId)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating user preferences:', error);
        return null;
    }
    
    return data;
}

// Conversation management functions
async function saveConversation(discordId, channelId, messages) {
    // First get or create the user
    const user = await getUser(discordId);
    if (!user) return null;
    
    // Check if conversation exists
    const { data: existingConvo, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_id', channelId)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching conversation:', fetchError);
        return null;
    }
    
    if (existingConvo) {
        // Update existing conversation
        const { data, error } = await supabase
            .from('conversations')
            .update({
                messages,
                last_message_at: new Date()
            })
            .eq('id', existingConvo.id)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating conversation:', error);
            return null;
        }
        
        return data;
    } else {
        // Create new conversation
        const { data, error } = await supabase
            .from('conversations')
            .insert({
                user_id: user.id,
                channel_id: channelId,
                messages,
                created_at: new Date(),
                last_message_at: new Date()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
        
        return data;
    }
}

async function getConversation(discordId, channelId) {
    // First get the user
    const user = await getUser(discordId);
    if (!user) return null;
    
    // Fetch conversation
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_id', channelId)
        .single();
    
    if (error) {
        if (error.code !== 'PGRST116') { // Not found error
            console.error('Error fetching conversation:', error);
        }
        return null;
    }
    
    return data;
}

// Custom commands functions
async function createCustomCommand(guildId, command, response, creatorDiscordId) {
    // Get creator user
    const creator = await getUser(creatorDiscordId);
    if (!creator) return null;
    
    // Check if command already exists
    const { data: existingCmd, error: fetchError } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', guildId)
        .eq('command', command)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing command:', fetchError);
        return null;
    }
    
    if (existingCmd) {
        return { error: 'Command already exists' };
    }
    
    // Create new command
    const { data, error } = await supabase
        .from('custom_commands')
        .insert({
            guild_id: guildId,
            command,
            response,
            created_by: creator.id,
            usage_count: 0,
            created_at: new Date()
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating custom command:', error);
        return null;
    }
    
    return data;
}

async function getCustomCommand(guildId, command) {
    // First try guild-specific command
    let { data, error } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', guildId)
        .eq('command', command)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching custom command:', error);
    }
    
    if (data) {
        // Increment usage count
        await supabase
            .from('custom_commands')
            .update({ usage_count: data.usage_count + 1 })
            .eq('id', data.id);
        
        return data;
    }
    
    // If no guild-specific command found, try global command (guild_id is null)
    ({ data, error } = await supabase
        .from('custom_commands')
        .select('*')
        .is('guild_id', null)
        .eq('command', command)
        .single());
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching global custom command:', error);
        return null;
    }
    
    if (data) {
        // Increment usage count
        await supabase
            .from('custom_commands')
            .update({ usage_count: data.usage_count + 1 })
            .eq('id', data.id);
    }
    
    return data;
}

async function listCustomCommands(guildId) {
    // Get guild-specific and global commands
    const { data: guildCommands, error: guildError } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', guildId);
    
    if (guildError) {
        console.error('Error fetching guild commands:', guildError);
        return [];
    }
    
    const { data: globalCommands, error: globalError } = await supabase
        .from('custom_commands')
        .select('*')
        .is('guild_id', null);
    
    if (globalError) {
        console.error('Error fetching global commands:', globalError);
        return guildCommands || [];
    }
    
    // Combine and return both sets
    return [...(guildCommands || []), ...(globalCommands || [])];
}

async function deleteCustomCommand(commandId, discordId) {
    // Get the user to verify ownership
    const user = await getUser(discordId);
    if (!user) return { error: 'User not found' };
    
    // Get the command
    const { data: command, error: fetchError } = await supabase
        .from('custom_commands')
        .select('*')
        .eq('id', commandId)
        .single();
    
    if (fetchError) {
        console.error('Error fetching command:', fetchError);
        return { error: 'Command not found' };
    }
    
    // Check if user is the creator
    if (command.created_by !== user.id) {
        return { error: 'You can only delete commands you created' };
    }
    
    // Delete the command
    const { error } = await supabase
        .from('custom_commands')
        .delete()
        .eq('id', commandId);
    
    if (error) {
        console.error('Error deleting command:', error);
        return { error: 'Failed to delete command' };
    }
    
    return { success: true, message: 'Command deleted successfully' };
}

async function incrementCommandUsage(commandId) {
    const { data, error } = await supabase
        .rpc('increment_command_usage', { cmd_id: commandId }); // Using a stored procedure for atomicity

    if (error) {
        console.error('Error incrementing command usage:', error);
        return { error: 'Database error while incrementing command usage.' };
    }
    return { success: true, data };
}

// Guild settings functions
async function getGuildSettings(guildId) {
    const { data, error } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .single();
    
    if (error) {
        if (error.code !== 'PGRST116') { // Not found
            console.error('Error fetching guild settings:', error);
        }
        return null;
    }
    
    return data;
}

async function updateGuildSetting(guildId, key, value) {
    // Get existing settings or create new
    let settings = await getGuildSettings(guildId);
    
    if (settings) {
        // Update existing setting
        const updatedSettings = {
            ...settings.settings,
            [key]: value
        };
        
        const { data, error } = await supabase
            .from('guild_settings')
            .update({
                settings: updatedSettings,
                updated_at: new Date()
            })
            .eq('guild_id', guildId)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating guild settings:', error);
            return null;
        }
        
        return data;
    } else {
        // Create new settings object
        const { data, error } = await supabase
            .from('guild_settings')
            .insert({
                guild_id: guildId,
                settings: { [key]: value },
                created_at: new Date(),
                updated_at: new Date()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating guild settings:', error);
            return null;
        }
        
        return data;
    }
}

// Statistics functions
async function getUserStats(discordId) {
    const user = await getUser(discordId);
    if (!user) return null;
    
    const { data: conversations, error: convoError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id);
    
    if (convoError) {
        console.error('Error fetching user conversations:', convoError);
        return null;
    }
    
    // Calculate message count from conversation history
    let totalMessages = 0;
    let messagesByDay = {};
    
    conversations?.forEach(convo => {
        if (Array.isArray(convo.messages)) {
            totalMessages += convo.messages.length;
            
            // Group messages by day
            convo.messages.forEach(msg => {
                if (msg.timestamp) {
                    const date = new Date(msg.timestamp).toISOString().split('T')[0];
                    messagesByDay[date] = (messagesByDay[date] || 0) + 1;
                }
            });
        }
    });
    
    return {
        user: {
            discord_id: user.discord_id,
            username: user.username,
            nickname: user.nickname,
        },
        stats: {
            message_count: user.message_count,
            conversation_count: conversations?.length || 0,
            total_ai_messages: totalMessages,
            first_interaction: user.created_at,
            last_active: user.last_active,
            messagesByDay
        }
    };
}

// Function to get a random status message
async function getRandomStatusMessage() {
    const { data, error } = await supabase
        .from('status_messages')
        .select('message');

    if (error) {
        console.error('Error fetching status messages:', error);
        return null;
    }

    if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length);
        return data[randomIndex];
    }

    return null; // No messages found
}

// --- Warning System Functions ---

/**
 * Add a warning to a user
 * @param {string} guildId The guild ID where the warning was issued
 * @param {string} userId The Discord ID of the warned user
 * @param {string} moderatorId The Discord ID of the moderator
 * @param {string} reason The reason for the warning
 * @returns {Promise<object|null>} The created warning record or null on error
 */
async function addWarning(guildId, userId, moderatorId, reason) {
    const { data, error } = await supabase
        .from('warnings')
        .insert({
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            reason: reason,
            created_at: new Date()
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding warning:', error);
        return null;
    }
    return data;
}

/**
 * Get all warnings for a user in a guild
 * @param {string} guildId The guild ID
 * @param {string} userId The Discord ID of the user
 * @returns {Promise<Array>} Array of warnings or empty array on error
 */
async function getWarnings(guildId, userId) {
    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching warnings:', error);
        return [];
    }
    return data || [];
}

/**
 * Clear all warnings for a user in a guild
 * @param {string} guildId The guild ID
 * @param {string} userId The Discord ID of the user
 * @returns {Promise<boolean>} True if successful, false on error
 */
async function clearWarnings(guildId, userId) {
    const { error } = await supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error clearing warnings:', error);
        return false;
    }
    return true;
}

/**
 * Remove a specific warning by ID
 * @param {string} warningId The warning ID to remove
 * @returns {Promise<boolean>} True if successful, false on error
 */
async function removeWarning(warningId) {
    const { error } = await supabase
        .from('warnings')
        .delete()
        .eq('id', warningId);

    if (error) {
        console.error('Error removing warning:', error);
        return false;
    }
    return true;
}

// --- Scanned URL Cache Functions ---

/**
 * Retrieves a cached scan result for a URL.
 * @param {string} url The URL to look up.
 * @returns {Promise<object|null>} The cached scan result or null if not found or error.
 */
async function getScannedUrl(url) {
    const { data, error } = await supabase
        .from('scanned_urls')
        .select('*')
        .eq('url', url)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching scanned URL from DB:', error);
        return null;
    }
    return data;
}

/**
 * Saves a new URL scan result to the database.
 * @param {string} url The scanned URL.
 * @param {string} status The scan status ('safe', 'malicious', 'unknown', 'error').
 * @param {string|null} analysisId The VirusTotal analysis ID.
 * @param {object|null} rawResponse The raw response from VirusTotal.
 * @returns {Promise<object|null>} The saved record or null on error.
 */
async function saveScannedUrl(url, status, analysisId, rawResponse) {
    const { data, error } = await supabase
        .from('scanned_urls')
        .insert({
            url: url,
            status: status,
            virustotal_analysis_id: analysisId,
            raw_response: rawResponse,
            last_scanned_at: new Date() // Ensure this is set on creation
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving scanned URL to DB:', error);
        return null;
    }
    return data;
}

/**
 * Updates an existing URL scan result in the database.
 * @param {string} url The URL to update.
 * @param {string} status The new scan status.
 * @param {string|null} analysisId The new VirusTotal analysis ID.
 * @param {object|null} rawResponse The new raw response from VirusTotal.
 * @returns {Promise<object|null>} The updated record or null on error.
 */
async function updateScannedUrl(url, status, analysisId, rawResponse) {
    const { data, error } = await supabase
        .from('scanned_urls')
        .update({
            status: status,
            virustotal_analysis_id: analysisId,
            raw_response: rawResponse,
            last_scanned_at: new Date() // Update scan time
        })
        .eq('url', url)
        .select()
        .single();

    if (error) {
        console.error('Error updating scanned URL in DB:', error);
        return null;
    }
    return data;
}

// --- URL Shortener functions ---
async function saveShortenedUrl(discordId, originalUrl, shortCode, shortUrl) {
    const user = await getUser(discordId);
    if (!user) {
        console.error('User not found for saving shortened URL, Discord ID:', discordId);
        // Optionally, you could create the user here if that's desired behavior
        return null; 
    }

    const { data, error } = await supabase
        .from('shortened_urls')
        .insert({
            user_id: user.id,
            original_url: originalUrl,
            short_code: shortCode,
            short_url: shortUrl,
            created_at: new Date()
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving shortened URL:', error);
        return null;
    }
    return data;
}

async function getUserShortenedUrls(discordId, limit = 10, offset = 0) {
    const user = await getUser(discordId);
    if (!user) return [];

    const { data, error } = await supabase
        .from('shortened_urls')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching user shortened URLs:', error);
        return [];
    }
    return data;
}

module.exports = {
    getUser,
    createOrUpdateUser,
    updateUserPreference,
    saveConversation,
    getConversation,
    createCustomCommand,
    getCustomCommand,
    listCustomCommands,
    deleteCustomCommand,
    incrementCommandUsage,
    getGuildSettings,
    updateGuildSetting,
    getUserStats,
    getRandomStatusMessage,
    saveShortenedUrl,
    getUserShortenedUrls,
    getScannedUrl,
    saveScannedUrl,
    updateScannedUrl,
    addWarning,
    getWarnings,
    clearWarnings,
    removeWarning
};
