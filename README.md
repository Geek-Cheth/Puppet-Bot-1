# Poppy Discord Bot

A super cute, funny, slightly punky AI assistant Discord bot with persistent memory and personalization using Supabase.

## Features

- **AI Chat Assistant**: Have natural conversations powered by Google's Gemini AI
- **Persistent Memory**: Remembers conversations even after bot restarts
- **User Profiles**: Customizable user profiles with preferences
- **Custom Commands**: Create custom commands that respond with personalized messages
- **Statistics Tracking**: View your chat statistics and interaction history
- **Server Settings**: Customize the bot's behavior for each server
- **Greeting Images**: Send cute greeting messages with images

## Setup Instructions

### Prerequisites

1. Node.js v16.6.0 or higher
2. A Discord bot token (from [Discord Developer Portal](https://discord.com/developers/applications))
3. A Google Gemini API key (from [Google AI Studio](https://ai.google.dev/))
4. A Supabase project (create one at [Supabase.com](https://supabase.com/))

### Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Set up your Supabase database using the `db_init.sql` script
4. Configure the `.env` file with your tokens and credentials
5. Run `node index.js` to start the bot

### Environment Variables

Create a `.env` file with the following:

```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
```

## Database Setup

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Copy the contents of `db_init.sql` and execute it
4. This will create all the necessary tables with proper relationships and indexes

## Commands

- **Chat**: Mention @Poppy or reply to her messages to chat
- **/help**: Shows information about the bot and available commands
- **/profile**: View and edit your user profile
- **/stats**: View your conversation statistics
- **/command**: Create and manage custom commands
- **/memory**: Manage conversation history and export chats
- **/settings**: Server configuration (admin only)
- **/remind [task] in [time]**: Set a reminder (e.g., `/remind "take a break" in "10 minutes"`)
- **/timer [minutes]**: Starts a countdown timer (e.g., `/timer 5`)
- **/ping**: Checks the bot's status and latency

### Greeting Commands

- `.gm`: Sends a Good Morning image with greeting
- `.ge`: Sends a Good Evening image with greeting
- `.gn`: Sends a Good Night image with greeting

## Custom Commands

Create your own custom responses using:
```
/command create name:command_name response:This is what Poppy will say!
```

You can include user placeholders like `{user}` to personalize responses.

## Adding Greeting Images

Place your greeting images in these folders:
- `assets/images/goodmorning/` - For .gm command
- `assets/images/goodevening/` - For .ge command
- `assets/images/goodnight/` - For .gn command

## License

This project is licensed under the ISC License.
