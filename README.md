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
- **URL Malware Scanning**: Automatically scans URLs shared in chat for malware. It first checks against urlscan.io (if API key is provided) and then uses VirusTotal as a fallback if urlscan.io fails or the result is inconclusive. Results are cached in the database to minimize API calls.

## Setup Instructions

### Prerequisites

1. Node.js v16.6.0 or higher
2. A Discord bot token (from [Discord Developer Portal](https://discord.com/developers/applications))
3. A Google Gemini API key (from [Google AI Studio](https://ai.google.dev/))
4. A Supabase project (create one at [Supabase.com](https://supabase.com/))
5. A VirusTotal API Key (from [virustotal.com](https://www.virustotal.com/gui/my-apikey))
6. (Optional but Recommended) A urlscan.io API Key (from [urlscan.io](https://urlscan.io/user/signup/)) for primary URL scanning.

### Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Set up your Supabase database using the `db_init.sql` and `virus.sql` scripts.
4. Configure the `.env` file with your tokens and credentials, including `VIRUSTOTAL_KEY`.
5. Run `node index.js` to start the bot

### Environment Variables

Create a `.env` file with the following:

```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
VIRUSTOTAL_KEY=your_virustotal_api_key
URLSCAN_API_KEY=your_urlscan_io_api_key
```
Note: If `URLSCAN_API_KEY` is not provided, the bot will primarily use VirusTotal for URL scanning (urlscan.io functionality will be skipped or limited if the hardcoded key is removed in future updates).

## Database Setup

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Copy the contents of `db_init.sql` and execute it.
4. Then, copy the contents of `virus.sql` and execute it.
5. This will create all the necessary tables, including `users`, `conversations`, `custom_commands`, `guild_settings`, `shortened_urls`, and `scanned_urls`.

The `scanned_urls` table is used to cache the results of URL scans from urlscan.io and VirusTotal. This helps to:
- Reduce redundant API calls to these services.
- Speed up responses for previously scanned URLs.
- Store the status (`safe`, `malicious`, `unknown`, `error`), the relevant scan ID (from urlscan.io or VirusTotal), and the raw API responses from both services.
- Cached entries are considered valid for a configurable duration (default 24 hours).

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

### Utility Commands

- `!surl <url_to_shorten>`: Shortens a long URL using the CleanURI service. Example: `!surl https://very.long.url/goes/here`
- `!anime [category] [count:N] [+tag] [-tag]`: Fetches and displays random anime images from the Nekosia API (shows image only).
  - `[category]`: (Optional) Specify a category like `catgirl`, `foxgirl`, `cute`. Defaults to `random`.
  - `[count:N]`: (Optional) Number of images to fetch (1-48). Defaults to 1. Example: `count:3`.
  - `[+tag]`: (Optional) Add tags to include in the search. Example: `+white-hair`.
  - `[-tag]`: (Optional) Add tags to exclude from the search. Example: `-sad`.
  - Example: `!anime cute count:2 +uniform -short-hair`

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
