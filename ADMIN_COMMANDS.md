# Discord Bot Admin Commands System

A comprehensive moderation and administration system for Discord bots with slash commands, database integration, and logging capabilities.

## 🚀 Features

- **Full Moderation Suite**: Ban, kick, timeout, warn, and manage users
- **Message Management**: Purge messages, set slowmode, lock/unlock channels
- **Warning System**: Track user warnings with database persistence
- **Moderation Logging**: Automatic logging of all moderation actions
- **Permission Checks**: Role hierarchy and permission validation
- **Server Management**: Server info, user info, and configuration
- **Database Integration**: Persistent storage using Supabase

## 📋 Available Commands

### 🔨 Moderation Commands

| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/ban` | Ban a user from the server | Ban Members |
| `/kick` | Kick a user from the server | Kick Members |
| `/unban` | Unban a user using their ID | Ban Members |
| `/timeout` | Temporarily mute a user | Moderate Members |
| `/untimeout` | Remove timeout from a user | Moderate Members |
| `/warn` | Issue a warning to a user | Moderate Members |

### 📝 Message Management

| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/purge` | Delete multiple messages at once | Manage Messages |
| `/slowmode` | Set channel slowmode (0-21600 seconds) | Manage Messages |
| `/lock` | Lock a channel (prevent @everyone from sending) | Manage Channels |
| `/unlock` | Unlock a channel | Manage Channels |

### ⚠️ Warning System

| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/warnings view` | View all warnings for a user | Moderate Members |
| `/warnings clear` | Clear all warnings for a user | Moderate Members |

### ⚙️ Server Management

| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/modlog` | Set/view moderation log channel | Manage Guild |
| `/serverinfo` | Display server information | Manage Guild |
| `/userinfo` | Display user information and warnings | Moderate Members |

## 🛠️ Installation & Setup

### 1. Database Setup

First, create the warnings table in your Supabase database:

```sql
-- Run this in your Supabase SQL editor
-- File: sql/warnings.sql
```

### 2. Deploy Admin Commands

Deploy the slash commands to Discord:

```bash
# Deploy globally (takes up to 1 hour to appear)
node deployAdminCommands.js

# Or deploy to a specific guild for testing (appears immediately)
node deployAdminCommands.js YOUR_GUILD_ID
```

### 3. Integration with Main Bot

Add this to your main `index.js` file:

```javascript
const { adminCommands } = require('./commands/admin');

// Add to your interaction handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Admin command handling
    if (adminCommands[commandName]) {
        try {
            await adminCommands[commandName](interaction);
        } catch (error) {
            console.error(`Error executing admin command ${commandName}:`, error);
            const errorMessage = 'There was an error executing this command!';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
        return;
    }

    // Your existing command handling...
});
```

### 4. Required Permissions

Ensure your bot has the following permissions in Discord:

- **Administrator** (recommended) OR specific permissions:
  - Ban Members
  - Kick Members
  - Moderate Members (for timeouts)
  - Manage Messages
  - Manage Channels
  - View Audit Log
  - Send Messages
  - Use Slash Commands

## 📊 Command Examples

### Basic Moderation

```
/ban @user reason:Spam delete_messages:1
/kick @user reason:Breaking rules
/timeout @user duration:30 unit:minutes reason:Inappropriate behavior
/warn @user reason:First warning for spam
```

### Message Management

```
/purge amount:50
/purge amount:20 user:@spammer
/slowmode seconds:30
/lock reason:Heated discussion
```

### Information Commands

```
/warnings view user:@user
/warnings clear user:@user reason:Good behavior
/userinfo user:@user
/serverinfo
```

## 🔧 Configuration

### Setting Up Moderation Logging

```
/modlog channel:#mod-logs
```

This will log all moderation actions to the specified channel with detailed information including:
- Action taken
- Target user
- Moderator
- Reason
- Timestamp
- Duration (for timeouts)

### Permission Hierarchy

The system respects Discord's role hierarchy:
- Users cannot moderate others with equal or higher roles
- The bot cannot moderate users with roles higher than its own
- Administrators can bypass role hierarchy checks

## 📁 File Structure

```
├── commands/
│   ├── admin.js           # Admin command implementations
│   └── adminCommands.js   # Slash command definitions
├── sql/
│   └── warnings.sql       # Database schema for warnings
├── database.js            # Updated with warning functions
├── deployAdminCommands.js # Command deployment script
└── ADMIN_COMMANDS.md      # This documentation
```

## 🔍 Database Schema

### Warnings Table

```sql
CREATE TABLE warnings (
    id UUID PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Guild Settings (existing, extended)

The `guild_settings` table now supports:
- `mod_log_channel`: Channel ID for moderation logs

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Permission Checks**: Validates user permissions before executing commands
- **Role Hierarchy**: Prevents privilege escalation
- **Discord Limitations**: Respects Discord's API limits (e.g., 14-day message deletion limit)
- **Database Errors**: Graceful handling of database connectivity issues
- **User Feedback**: Clear error messages for users

## 🔐 Security Features

- **Role Hierarchy Validation**: Users cannot moderate higher-ranked members
- **Permission Verification**: Commands check for appropriate Discord permissions
- **Audit Logging**: All actions are logged for accountability
- **Input Validation**: All user inputs are validated and sanitized

## 📈 Advanced Usage

### Bulk Operations

```javascript
// Example: Mass warn users (would need custom implementation)
// The foundation is there in the database functions
```

### Custom Moderation Workflows

```javascript
// Example: Auto-timeout users with 3+ warnings
// Can be implemented using the existing warning system
```

### Integration with Existing Commands

The admin system is designed to work alongside existing bot commands without conflicts.

## 🐛 Troubleshooting

### Commands Not Appearing
- Ensure you've run the deployment script
- Global commands take up to 1 hour to appear
- Use guild-specific deployment for testing

### Permission Errors
- Check bot permissions in server settings
- Verify role hierarchy (bot role should be high enough)
- Ensure user has required permissions

### Database Errors
- Verify Supabase connection
- Check if warnings table exists
- Verify RLS policies if using Row Level Security

## 🤝 Contributing

When adding new admin commands:

1. Add the slash command definition to `commands/adminCommands.js`
2. Implement the command logic in `commands/admin.js`
3. Update the deployment script if needed
4. Test thoroughly with different permission levels
5. Update this documentation

## 📝 License

This admin system follows the same license as the main bot project.
