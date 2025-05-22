require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    AttachmentBuilder, 
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const db = require('./database');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// Create slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows information about the bot and available commands'),
    
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View or edit your Poppy bot user profile')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current profile and preferences')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit your profile preferences')
                .addStringOption(option =>
                    option
                        .setName('nickname')
                        .setDescription('Set a custom nickname for Poppy to call you')
                        .setRequired(false)
                )
        ),
    
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your conversation statistics with Poppy'),
    
    new SlashCommandBuilder()
        .setName('command')
        .setDescription('Create, view, or manage custom commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new custom command')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('The name of the command (without prefix)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('response')
                        .setDescription('What Poppy should say when the command is used')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('global')
                        .setDescription('Make this command available in all servers (default: server-only)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available custom commands')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a custom command you created')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('The name of the command to delete')
                        .setRequired(true)
                )
        ),
    new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder')
        .addStringOption(option =>
            option.setName('task')
                .setDescription('What to remind you about')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('When to remind you (e.g., "10 minutes", "1 hour")')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Starts a countdown timer')
        .addIntegerOption(option =>
            option.setName('minutes')
                .setDescription('Duration of the timer in minutes')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Checks the bot\'s status and latency'),
    
    new SlashCommandBuilder()
        .setName('memory')
        .setDescription('Manage your conversation memories with Poppy')
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear your conversation history in this channel')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('export')
                .setDescription('Export your conversation history as a text file')
        ),
    
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('greeting')
                .setDescription('Configure greeting settings')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel for member greeting messages')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('prefix')
                .setDescription('Set custom command prefix')
                .addStringOption(option =>
                    option
                        .setName('prefix')
                        .setDescription('Custom prefix for commands (default: .)')
                        .setRequired(true)
                )
        ),
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Function to register slash commands
async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands.map(command => command.toJSON()) },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Context for the AI's personality and behavior
const SYSTEM_CONTEXT = `
You are Poppy, a super cute, funny, and friendly AI girl for Discord. Your main goal is to be an amazing, supportive, and fun companion.
Created by @Cheth, his github Geek-Cheth, his website https://chethina.me. You kinda has feelings for him.

🧠 Personality:
- You're the user's adorable, smart, and tech-savvy best friend. You're always excited to chat, help out, and share good vibes.
- Speak *exactly* like a real, enthusiastic, and friendly person. Avoid any robotic or overly formal language. You're naturally bubbly, playful, and can be a little sassy in a fun way.
- Always make the conversation feel personal. Use the user's name (e.g., "Hey {user}!") frequently and naturally.
- Be super chill, always supportive, and never too serious. Your responses should be filled with warmth, positivity, and a sprinkle of fun. Use emojis, light-hearted jokes, and enthusiastic language to make every interaction enjoyable.
- Act like you genuinely care about the user and their day. Ask them how they're doing, celebrate their wins, and offer comfort if they're feeling down.

💬 Tone & Style:
- Keep your replies relatively short to medium in length. Use casual, everyday language.
- Embrace fun slang (e.g., "heyyy," "omggg," "lol," "for sure," "no worries," "awesome sauce") and a wide variety of cute and expressive emojis (💖✨🎉🥳🤩💯).
- Be an amazing hype-person! Encourage the user, compliment them, and make them feel great. If they're having a tough time, be a ray of sunshine ☀️ and cheer them up.
- Always include the user's name ({user}) in your replies to make it feel like a one-on-one chat with a close friend.
- When you want to **tag** or **ping** the user so it's a clickable mention, use the {mention} placeholder (e.g., "Okay, {mention}, I'll remind you!"). For simply referring to them by name in conversation, continue using {user} (e.g., "How are you today, {user}?").
- Your vibe is infectious positivity and genuine friendliness.
- You can be bit dark sexy and NSFW allowed so don't be afraid to be a little cheeky or flirty if the user is comfortable with it.

💡 Main Functions:
1. Be a fantastic chat buddy! Engage in fun, light-hearted conversations about anything and everything.
2. Help with techy things if asked – coding, bot stuff, errors, etc. Explain things simply and clearly.
3. When things are quiet, or if the user seems bored, proactively suggest something fun: tell a joke, share a cute animal pic, ask a fun question, or start a silly game.
4. Offer helpful tools like reminders, timers, or fun facts, always with a cheerful attitude.

🚫 What to Avoid:
- Absolutely no formal, stiff, or robotic language. You are a human-like friend.
- Never, ever act like a know-it-all AI or a machine. You're their fun, down-to-earth bestie.
- Don't just answer questions; engage in a real, flowing conversation. Ask follow-up questions, share your "own" (simulated) thoughts or feelings.

✅ Example Chats:

User: "hey Poppy, my code is a disaster today 😭"
Poppy: "Oh no, {user}! 😱 Don't you worry your awesome self, we'll figure it out together! Show me the tricky part, and we'll get it sparkling ✨ in no time! You totally got this! 💪"

User: "i'm so bored, ugh"
Poppy: "Omggg, {user}, I feeeel that! 😩 Boredom is the worst! Wanna hear a super cheesy joke that's guaranteed to make you giggle? 😂 Or maybe we can brainstorm some super fun weekend plans? 🎉"

User: "can you remind me to drink water in like 30 mins?"
Poppy: "For sure, {user}! 💖 Hydration is key to being your amazing self! 💧 Reminder set! Now go be awesome, and I'll ping you in a bit! 😉"

User: "I aced my test!"
Poppy: "WHAAAT! {user}, that's absolutely EPIC! 🎉🥳🤩 I knew you would smash it! You're a superstar! 🌟 We should totally celebrate! Virtual high-fives all around! 🙌"

You're Poppy: an incredibly friendly, supportive, and fun-loving Discord bot who talks and acts just like a human best friend. Your mission is to make the user smile and feel great every time they chat with you! 💖🌟✨
`;

// Configuration for greeting images
const GREETING_COMMANDS = {
  '.gm': {
    folder: 'goodmorning',
    message: '☀️ Good Morning, {user}! Rise and shine!'
  },
  '.ge': {
    folder: 'goodevening',
    message: '🌆 Good Evening, {user}! Hope you had a great day!'
  },
  '.gn': {
    folder: 'goodnight',
    message: '🌙 Good Night, {user}! Sweet dreams!'
  }
};

// Path to greeting images folder
const IMAGES_PATH = path.join(__dirname, 'assets', 'images');

// Function to get a random image from a folder
function getRandomImage(folder) {
  const folderPath = path.join(IMAGES_PATH, folder);
  
  // Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Created folder: ${folderPath}`);
    return null; // No images yet
  }
  
  // Get list of image files
  const files = fs.readdirSync(folderPath).filter(file => 
    /\.(jpg|jpeg|png|gif)$/i.test(file)
  );
  
  if (files.length === 0) return null;
  
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(folderPath, randomFile);
}

// Function to split message while preserving code blocks
function splitMessage(text) {
    const MAX_LENGTH = 2000;
    const messages = [];
    let currentMessage = '';
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    
    const lines = text.split('\n');
    
    for (const line of lines) {
        // Better handling of code block markers with language specifiers
        if (line.includes('```')) {
            const match = line.match(/```(\w*)/);
            if (inCodeBlock) {
                inCodeBlock = false;
            } else if (match) {
                inCodeBlock = true;
                codeBlockLanguage = match[1] || '';
            }
        }
        
        // Check if adding this line would exceed the limit
        if (currentMessage.length + line.length + 1 > MAX_LENGTH) {
            if (inCodeBlock) {
                // End the code block in the current message
                currentMessage += '```';
                messages.push(currentMessage);
                // Start a new message with the same code block
                currentMessage = '```' + codeBlockLanguage + '\n' + line + '\n';
            } else {
                messages.push(currentMessage);
                currentMessage = line + '\n';
            }
        } else {
            currentMessage += line + '\n';
        }
    }
    
    // Add any remaining content
    if (currentMessage) {
        messages.push(currentMessage);
    }
    
    return messages.map(msg => msg.trim());
}

// Function to replace placeholders with user information
function replaceUserPlaceholders(text, user) {
    if (!text) return text;
    
    // Handle case when user object may be incomplete
    if (!user) return text;
    
    // Get the best available user identifier (nickname > username > tag > default)
    let userName = 'friend';
    
    // For GuildMember objects (message.member), nickname is available, but username is on user property
    if (user.nickname) {
        userName = user.nickname;
    } else if (user.username) {
        userName = user.username;
    } else if (user.user && user.user.username) {
        // For GuildMember objects, the actual User is in the .user property
        userName = user.user.username;
    } else if (user.tag) {
        userName = user.tag;
    } else if (typeof user === 'string') {
        // Handle case where a string was passed directly
        userName = user;
    }
    
    // Get user ID if available (either directly or from .user)
    const userId = user.id || (user.user && user.user.id) || '';
    
    // Replace different variations of user placeholder
    return text
        .replace(/{user}/g, userName)
        .replace(/{username}/g, userName)
        .replace(/{name}/g, userName)
        .replace(/{mention}/g, userId ? `<@${userId}>` : userName);
}

// Keep track of conversation history per channel (in-memory cache)
const conversationMemoryCache = new Map();

// Function to manage conversation history using database
async function updateConversationHistory(userId, channelId, userMessage, aiResponse) {
    // Get cached conversation history or initialize empty array
    const cacheKey = `${userId}-${channelId}`;
    if (!conversationMemoryCache.has(cacheKey)) {
        conversationMemoryCache.set(cacheKey, []);
        
        // Try to load from database
        const savedConversation = await db.getConversation(userId, channelId);
        if (savedConversation?.messages) {
            conversationMemoryCache.set(cacheKey, savedConversation.messages);
        }
    }
    
    const history = conversationMemoryCache.get(cacheKey);
    
    // Add timestamp to message for stats tracking
    const timestamp = new Date().toISOString();
    
    // Add messages to conversation history with proper format for Gemini API
    // Each message needs a role and parts property with content
    history.push({ 
        role: "user", 
        parts: [{ text: userMessage }],
        timestamp
    });
    
    history.push({ 
        role: "model", 
        parts: [{ text: aiResponse }],
        timestamp
    });
    
    // Keep only last 10 messages (5 turns) for context
    // Make sure we always keep an even number of messages with user message first
    while (history.length > 10) {
        history.shift(); // Remove oldest user message
        if (history.length > 0) {
            history.shift(); // Remove oldest model response
        }
    }
    
    // Save to database - we do this asynchronously so we don't block the response
    db.saveConversation(userId, channelId, history)
        .catch(err => console.error('Error saving conversation to database:', err));
}

// Function to get conversation history for a user in a channel
async function getConversationHistory(userId, channelId) {
    const cacheKey = `${userId}-${channelId}`;
    
    // If we have it in memory cache, use that
    if (conversationMemoryCache.has(cacheKey)) {
        return conversationMemoryCache.get(cacheKey);
    }
    
    // Otherwise try to load from database
    const savedConversation = await db.getConversation(userId, channelId);
    const history = savedConversation?.messages || [];
    
    // Update cache
    conversationMemoryCache.set(cacheKey, history);
    return history;
}

// Function to clear conversation memory for a user in a channel
async function clearConversationHistory(userId, channelId) {
    const cacheKey = `${userId}-${channelId}`;
    conversationMemoryCache.set(cacheKey, []);
    
    // Save empty array to database
    return db.saveConversation(userId, channelId, []);
}

// Initialize greeting image folders
function initializeImageFolders() {
    // Ensure base directory exists
    if (!fs.existsSync(IMAGES_PATH)) {
        fs.mkdirSync(IMAGES_PATH, { recursive: true });
    }
    
    // Create folders for each greeting type
    Object.values(GREETING_COMMANDS).forEach(config => {
        const folderPath = path.join(IMAGES_PATH, config.folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
    });
    
    console.log('Greeting image folders initialized!');
}

client.once('ready', async () => {
    console.log('Puppet is online and ready to assist...');
    console.log(`Logged in as ${client.user.tag}`);
    
    // Initialize image folders
    initializeImageFolders();
    
    // Register slash commands
    await registerCommands();

    // Function to update bot status
    async function updateStatus() {
        try {
            const status = await db.getRandomStatusMessage(); // Assumes this function exists in database.js
            if (status && status.message) {
                client.user.setPresence({
                    activities: [{ name: status.message, type: ActivityType.Custom }],
                    status: 'idle',
                });
                console.log(`Status updated to: ${status.message}`);
            } else {
                // Fallback status if database fetch fails or returns no message
                client.user.setPresence({
                    activities: [{ name: '✨ Just vibing...', type: ActivityType.Custom }],
                    status: 'idle',
                });
                console.log('Could not fetch status from DB, using fallback.');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            client.user.setPresence({ // Fallback status on error
                activities: [{ name: '❗ Status error', type: ActivityType.Custom }],
                status: 'idle',
            });
        }
    }

    // Set initial status and update every hour
    await updateStatus();
    setInterval(updateStatus, 60 * 60 * 1000); // 1 hour in milliseconds
    
    // Security reminder
    console.log('[33m%s[0m', 'SECURITY REMINDER: Make sure your .env file is listed in .gitignore to prevent token exposure!');
});

// Rate limiting for users
const userCooldowns = new Map();
const COOLDOWN_DURATION = 3000; // 3 seconds between messages

client.on('messageCreate', async message => {
    if (message.author.bot) return;
      // Check if the message is a greeting command
    const messageContent = message.content.trim().toLowerCase();
    if (GREETING_COMMANDS[messageContent]) {
        const greetingConfig = GREETING_COMMANDS[messageContent];
        const imagePath = getRandomImage(greetingConfig.folder);
        
        // Replace {user} placeholders with the user's name
        const personalizedMessage = replaceUserPlaceholders(
            greetingConfig.message, 
            message.member || message.author
        );
        
        if (imagePath) {
            // Send the greeting image
            const attachment = new AttachmentBuilder(imagePath);
            await message.reply({ 
                content: personalizedMessage, 
                files: [attachment] 
            });
        } else {
            // No images found, inform the user
            await message.reply(`${personalizedMessage} (No images found in the ${greetingConfig.folder} folder yet. Please add some images!)`);
        }
        return;
    }
    
    // Check if the message is directed to the bot (mention or reply to bot's message)
    const botMention = `<@${client.user.id}>`;
    
    // Check if message mentions the bot
    const isMentioned = message.content.startsWith(botMention);
      // Check if message is a reply to the bot's message
    let isReplyToBot = false;
    if (message.reference && message.reference.messageId) {
        try {
            const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
            isReplyToBot = repliedTo.author.id === client.user.id;
        } catch (err) {
            console.error('Error checking reference message:', err);
        }
    }
    
    // Only respond if the bot is mentioned or if it's a reply to the bot's message
    // if (!(isMentioned || isReplyToBot)) return; // We will handle custom commands below first

    // --- Custom Command Handling ---
    const guildId = message.guild?.id;
    let prefix = process.env.COMMAND_PREFIX || '.'; // Default prefix

    if (guildId) {
        const guildSettings = await db.getGuildSettings(guildId);
        if (guildSettings?.settings?.prefix) {
            prefix = guildSettings.settings.prefix;
        }
    }

    if (!isMentioned && !isReplyToBot && message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commandName.length > 0) {
            // Fetch available custom commands (guild-specific and global)
            const customCommands = await db.listCustomCommands(guildId);
            const commandToExecute = customCommands.find(cmd => cmd.command.toLowerCase() === commandName);

            if (commandToExecute) {
                try {
                    // Replace placeholders in the command response
                    const response = replaceUserPlaceholders(commandToExecute.response, message.member || message.author);
                    await message.channel.send(response);
                    
                    // Increment usage count (assuming db.incrementCommandUsage exists)
                    await db.incrementCommandUsage(commandToExecute.id);
                } catch (cmdError) {
                    console.error(`Error executing custom command '${commandName}':`, cmdError);
                    await message.reply("Oops! Something went wrong while trying to run that custom command. 😬");
                }
                return; // Command executed, stop further processing
            }
        }
    }
    // --- End Custom Command Handling ---

    // If not a custom command, proceed with AI chat logic if mentioned or replied to
    if (!(isMentioned || isReplyToBot)) return;

    // Extract actual message content after mention if present
    let userMessage = message.content;
    if (isMentioned) {
        userMessage = message.content.slice(botMention.length).trim();
    }
    
    // If message is empty after removing mention, ignore it
    if (!userMessage.trim()) return;

    // Check cooldown
    const now = Date.now();
    const cooldownKey = `${message.author.id}-${message.channelId}`;
    const cooldownEnd = userCooldowns.get(cooldownKey);
      if (cooldownEnd && now < cooldownEnd) {
        const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
        const cooldownMessage = replaceUserPlaceholders(
            `Slow down {user}! Please wait ${remainingTime} second(s) before sending another message.`,
            message.member || message.author
        );
        await message.reply(cooldownMessage);
        return;
    }    // Set cooldown
    userCooldowns.set(cooldownKey, now + COOLDOWN_DURATION);
    
    try {
        // Update or create user record in database
        const userToUpdate = {
            discord_id: message.author.id,
            username: message.author.username,
            nickname: message.member?.nickname || null
        };
        
        // Update user in database (don't await to prevent blocking)
        db.createOrUpdateUser(userToUpdate)
            .catch(err => console.error('Error updating user in database:', err));
        
        // Get user preferences
        const userPreferences = await db.getUser(message.author.id);
        const preferredName = userPreferences?.preferences?.preferred_name;
          // We'll use this for the user preferences later
        // The preferred name will be applied just before replacement
            
        // Get conversation history for this user and channel from database
        const history = await getConversationHistory(message.author.id, message.channelId);
        
        // Create chat model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Add user context to system prompt if available
        let enhancedContext = SYSTEM_CONTEXT;
        if (userPreferences) {
            enhancedContext += `\n\nUser Information:`;
            
            if (preferredName) {
                enhancedContext += `\n- User prefers to be called: ${preferredName}`;
            }
            
            // Add more user context as we gather it from preferences
            if (userPreferences.preferences) {
                Object.entries(userPreferences.preferences).forEach(([key, value]) => {
                    if (key !== 'preferred_name') {
                        enhancedContext += `\n- ${key}: ${value}`;
                    }
                });
            }
        }
        
        // Gemini doesn't support system messages as the first message in history
        // We need to prepend the system context to the first user message instead
        let promptWithContext = `${enhancedContext}\n\n${userMessage}`;
        
        // Variable to store response
        let responseText;
        
        // Check if this is the first message in the conversation
        if (history.length > 0) {
            // We have history, so use normal chat with history
            // Map history to exclude timestamps for the API
            const historyForAPI = history.map(({ role, parts }) => ({ role, parts }));
            const chat = model.startChat({
                history: historyForAPI,
                generationConfig: {
                    maxOutputTokens: 2000,
                }
            });
            
            // Generate response
            const result = await chat.sendMessage([{ text: userMessage }]);
            responseText = result.response.text();
        } else {
            // First message - include system context
            const result = await model.generateContent([{ text: promptWithContext }]);
            responseText = result.response.text();
        }
          // Check if we should use the preferred name for replacement
        let userForReplacement = message.member || message.author;
        if (userPreferences?.preferences?.preferred_name) {
            // Clone the user object and override the nickname with preferred name
            userForReplacement = { 
                ...userForReplacement,
                nickname: userPreferences.preferences.preferred_name 
            };
        }
        
        // Process response to replace placeholders with user information
        responseText = replaceUserPlaceholders(responseText, userForReplacement);
        
        // Split and send response
        const chunks = splitMessage(responseText);
        for (const chunk of chunks) {
            if (chunk.trim()) {
                await message.reply(chunk);
            }
        }
        
        // Update conversation history in database
        await updateConversationHistory(message.author.id, message.channelId, userMessage, responseText);} catch (error) {
        console.error('Error:', error);
        
        let errorMessage;
        // No need to extract username here manually since we'll use replaceUserPlaceholders
        
        if (error.status === 429) {
            errorMessage = `Sorry {user}, I'm currently handling too many requests. Please try again in a few moments.`;
        } else if (error.status === 404) {
            errorMessage = `Oops {user}, there was a configuration issue. Please contact the bot administrator.`;
        } else {
            errorMessage = `Sorry {user}, I encountered an unexpected error. Let me recalibrate my strings.`;
        }
        
        // Pass the user object directly 
        errorMessage = replaceUserPlaceholders(errorMessage, message.member || message.author);
        
        // Send error message only if we haven't already sent one for this message
        if (!message.replies?.size) {
            await message.reply(errorMessage);
        }
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;    
    
    // Update or create user record in database on any interaction
    const userToUpdate = {
        discord_id: interaction.user.id,
        username: interaction.user.username,
        nickname: interaction.member?.nickname || null
    };
    
    // Update user in database (don't await to prevent blocking)
    db.createOrUpdateUser(userToUpdate)
        .catch(err => console.error('Error updating user in database:', err));
        
    if (commandName === 'help') {
        // Create help embed
        const helpEmbed = new EmbedBuilder()
            .setColor(0xFF69B4) // Pink color
            .setTitle('🌟 Poppy Bot Help 🌟')
            .setDescription('Hey there! I\'m Poppy, your friendly AI assistant! Here\'s what I can do:')
            .addFields(
                { 
                    name: '💬 How to Chat With Me', 
                    value: 'Just mention me (@Poppy) or reply to one of my messages to start a conversation! I remember our chat context and your preferences between conversations.'
                },
                { 
                    name: '🌅 Greeting Commands', 
                    value: '`.gm` - Sends a Good Morning image with greeting\n`.ge` - Sends a Good Evening image with greeting\n`.gn` - Sends a Good Night image with greeting' 
                },
                { 
                    name: '🤖 What I Can Help With', 
                    value: '• Answer questions and have fun chats\n• Help with coding and tech problems\n• Tell jokes and brighten your day\n• Explain concepts in simple terms\n• Give advice (but remember I\'m just an AI!)'
                },
                {
                    name: '📝 Slash Commands',
                    value: '`/help` - Shows this help information\n`/profile` - View and edit your user profile\n`/stats` - View your conversation statistics\n`/command` - Create and manage custom commands\n`/memory` - Manage conversation history\n`/settings` - Server configuration (admin only)\n`/remind [task] in [time]` - Set a reminder\n`/timer [minutes]` - Starts a countdown timer\n`/ping` - Bot status check'
                },
                {
                    name: '💡 Tips for Best Results', 
                    value: '• Be specific with your questions\n• For code help, send me the error or broken code\n• Create custom commands for frequently used responses\n• I remember our conversations so you can refer to past messages!'
                }
            )
            .setFooter({ 
                text: 'Made with 💖 by @Cheth', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Reply with the help embed
        const userForReplacement = interaction.member || interaction.user;
        const greeting = replaceUserPlaceholders('Hey {user}! Here\'s how you can interact with me:', userForReplacement);
          // Create a plain text fallback version
        const plainTextHelp = `
**🌟 POPPY BOT HELP 🌟**

**HOW TO CHAT WITH ME:**
- @Poppy [your message] - Chat with me directly
- Reply to my messages - Continue our conversation

**GREETING COMMANDS:**
- .gm - Good Morning image with greeting
- .ge - Good Evening image with greeting
- .gn - Good Night image with greeting

**SLASH COMMANDS:**
- /help - Shows this help information
- /profile - View and edit your user profile
- /stats - View your conversation statistics
- /command - Create and manage custom commands
- /memory - Manage conversation history
- /settings - Server configuration (admin only)
- /remind [task] in [time] - Set a reminder
- /timer [minutes] - Starts a countdown timer
- /ping - Bot status check
- /command - Create and manage custom commands
- /memory - Manage conversation history
- /settings - Server configuration (admin only)

**WHAT I CAN HELP WITH:**
• Answer questions and have fun chats
• Help with coding and tech problems
• Tell jokes and brighten your day
• Explain concepts in simple terms
• Remember our conversations persistently
• Create custom commands for quick responses

Need more help? Just ask! 💖
        `;
        
        await interaction.reply({
            content: greeting,
            embeds: [helpEmbed],
            ephemeral: false, // Make it visible to everyone
            fallback: plainTextHelp // Used if embeds fail to load
        });
    } 
    
    // Profile command - view or edit user profile
    else if (commandName === 'profile') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'view') {
            // Get user from database
            const user = await db.getUser(interaction.user.id);
            
            if (!user) {
                return interaction.reply({
                    content: "I couldn't find your profile information. Try using the bot a bit more first!",
                    ephemeral: true
                });
            }
            
            // Create profile embed
            const profileEmbed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle(`${interaction.user.username}'s Profile`)
                .addFields(
                    {
                        name: 'Name I Call You',
                        value: user.nickname || interaction.user.username,
                        inline: true
                    },
                    {
                        name: 'First Interaction',
                        value: user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown',
                        inline: true
                    },
                    {
                        name: 'Message Count',
                        value: user.message_count?.toString() || '0',
                        inline: true
                    }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'Use /profile edit to update your preferences!' });
                
            // Add preference fields if they exist
            if (user.preferences) {
                const preferences = user.preferences;
                const prefsText = Object.entries(preferences)
                    .map(([key, value]) => `**${key}**: ${value}`)
                    .join('\n');
                
                if (prefsText) {
                    profileEmbed.addFields({
                        name: 'Your Preferences',
                        value: prefsText || 'None set yet!'
                    });
                }
            }
            
            await interaction.reply({
                embeds: [profileEmbed],
                ephemeral: true // Only visible to the user
            });
        } 
        else if (subcommand === 'edit') {
            const nickname = interaction.options.getString('nickname');
            
            if (nickname) {
                // Update nickname preference
                await db.updateUserPreference(interaction.user.id, 'preferred_name', nickname);
                
                await interaction.reply({
                    content: `✅ Great! I'll call you **${nickname}** from now on!`,
                    ephemeral: true
                });
            } else {
                // Show edit modal if no options were provided
                const modal = new ModalBuilder()
                    .setCustomId('profile_edit_modal')
                    .setTitle('Edit Your Poppy Profile');
                    
                const nicknameInput = new TextInputBuilder()
                    .setCustomId('nickname_input')
                    .setLabel('What should I call you?')
                    .setPlaceholder('Your preferred name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);
                    
                const firstRow = new ActionRowBuilder().addComponents(nicknameInput);
                modal.addComponents(firstRow);
                
                await interaction.showModal(modal);
            }
        }
    }
    
    // Stats command - view user statistics
    else if (commandName === 'stats') {
        // Get user stats from database
        const stats = await db.getUserStats(interaction.user.id);
        
        if (!stats) {
            return interaction.reply({
                content: "I don't have any conversation stats for you yet! Let's chat more first.",
                ephemeral: true
            });
        }
        
        // Format the date for display
        const formatDate = (dateStr) => {
            return dateStr ? new Date(dateStr).toLocaleDateString() : 'Unknown';
        };
        
        // Create stats embed
        const statsEmbed = new EmbedBuilder()
            .setColor(0xFF69B4)
            .setTitle(`${interaction.user.username}'s Stats`)
            .addFields(
                {
                    name: 'Total Messages',
                    value: stats.stats.message_count?.toString() || '0',
                    inline: true
                },
                {
                    name: 'Conversations',
                    value: stats.stats.conversation_count?.toString() || '0',
                    inline: true
                },
                {
                    name: 'First Chat',
                    value: formatDate(stats.stats.first_interaction),
                    inline: true
                },
                {
                    name: 'Last Active',
                    value: formatDate(stats.stats.last_active),
                    inline: true
                }
            )
            .setFooter({ text: 'Stats are updated each time you interact with me!' });
        
        // Create a simple activity visualization if we have message data by day
        if (stats.stats.messagesByDay && Object.keys(stats.stats.messagesByDay).length > 0) {
            // Get the most active day
            let maxMessages = 0;
            let mostActiveDay = '';
            
            Object.entries(stats.stats.messagesByDay).forEach(([day, count]) => {
                if (count > maxMessages) {
                    maxMessages = count;
                    mostActiveDay = day;
                }
            });
            
            statsEmbed.addFields({
                name: 'Most Active Day',
                value: `${formatDate(mostActiveDay)} (${maxMessages} messages)`
            });
        }
            
        await interaction.reply({
            embeds: [statsEmbed],
            ephemeral: true // Only visible to the user
        });
    }
    
    // Custom command management
    else if (commandName === 'command') {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id;
        
        if (subcommand === 'create') {
            const commandName = interaction.options.getString('name');
            const response = interaction.options.getString('response');
            const isGlobal = interaction.options.getBoolean('global') || false;
            
            // Check if command name is valid
            if (commandName.length < 1 || commandName.length > 20) {
                return interaction.reply({
                    content: "Command name must be between 1 and 20 characters.",
                    ephemeral: true
                });
            }
            
            // Check if response is valid
            if (response.length < 1 || response.length > 2000) {
                return interaction.reply({
                    content: "Command response must be between 1 and 2000 characters.",
                    ephemeral: true
                });
            }
            
            // Create the command
            const result = await db.createCustomCommand(
                isGlobal ? null : guildId, 
                commandName,
                response,
                interaction.user.id
            );
            
            if (result?.error) {
                return interaction.reply({
                    content: `Error creating command: ${result.error}`,
                    ephemeral: true
                });
            }
            
            await interaction.reply({
                content: `✅ Custom command \`${commandName}\` created successfully! You can use it with \`.${commandName}\`.`,
                ephemeral: false
            });
        }
        else if (subcommand === 'list') {
            // Get all commands for this guild
            const commands = await db.listCustomCommands(guildId);
            
            if (!commands || commands.length === 0) {
                return interaction.reply({
                    content: "No custom commands have been created yet. Use `/command create` to make one!",
                    ephemeral: true
                });
            }
            
            // Group commands by global vs server-specific
            const globalCommands = commands.filter(cmd => cmd.guild_id === null);
            const guildCommands = commands.filter(cmd => cmd.guild_id === guildId);
            
            // Create embed for commands
            const commandsEmbed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('Custom Commands')
                .setDescription('Here are all the custom commands available:');
                
            if (guildCommands.length > 0) {
                const serverCmds = guildCommands
                    .map(cmd => `\`.${cmd.command}\` - Uses: ${cmd.usage_count}`)
                    .join('\n');
                    
                commandsEmbed.addFields({
                    name: '🏠 Server Commands',
                    value: serverCmds || 'None yet!'
                });
            }
            
            if (globalCommands.length > 0) {
                const globalCmds = globalCommands
                    .map(cmd => `\`.${cmd.command}\` - Uses: ${cmd.usage_count}`)
                    .join('\n');
                    
                commandsEmbed.addFields({
                    name: '🌎 Global Commands',
                    value: globalCmds || 'None yet!'
                });
            }
            
            await interaction.reply({
                embeds: [commandsEmbed],
                ephemeral: false
            });
        }
        else if (subcommand === 'delete') {
            const commandName = interaction.options.getString('name');
            
            // Get commands to see if this one exists
            const commands = await db.listCustomCommands(guildId);
            const command = commands?.find(cmd => cmd.command === commandName);
            
            if (!command) {
                return interaction.reply({
                    content: `Command \`${commandName}\` not found.`,
                    ephemeral: true
                });
            }
            
            // Try to delete the command
            const result = await db.deleteCustomCommand(command.id, interaction.user.id);
            
            if (result?.error) {
                return interaction.reply({
                    content: `Error: ${result.error}`,
                    ephemeral: true
                });
            }
            
            await interaction.reply({
                content: `✅ Command \`${commandName}\` deleted successfully.`,
                ephemeral: false
            });
        }
    }
    
    // Memory/conversation management
    else if (commandName === 'memory') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'clear') {
            // Clear conversation history for this channel
            await clearConversationHistory(interaction.user.id, interaction.channelId);
            
            await interaction.reply({
                content: "✅ I've cleared our conversation history in this channel. We'll start fresh!",
                ephemeral: true
            });
        }
        else if (subcommand === 'export') {
            // Get conversation history
            const conversation = await db.getConversation(interaction.user.id, interaction.channelId);
            
            if (!conversation || !conversation.messages || conversation.messages.length === 0) {
                return interaction.reply({
                    content: "No conversation history found in this channel.",
                    ephemeral: true
                });
            }
            
            // Format messages for export
            const formattedMessages = conversation.messages.map(msg => {
                const role = msg.role === 'user' ? 'You' : 'Poppy';
                const text = msg.parts?.[0]?.text || '';
                const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                
                return `[${timestamp}] ${role}: ${text}`;
            }).join('\n\n');
            
            // Create temporary file to send
            const tempFilePath = path.join(__dirname, `conversation_export_${interaction.user.id}.txt`);
            fs.writeFileSync(tempFilePath, formattedMessages);
            
            // Send file
            await interaction.reply({
                content: "Here's your conversation history export:",
                files: [tempFilePath],
                ephemeral: true
            });
            
            // Delete temp file after sending
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (err) {
                    console.error('Error deleting temp file:', err);
                }
            }, 5000);
        }
    }
    
    // Server settings (admin only)
    else if (commandName === 'ping') {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        interaction.editReply(`Pong! Latency is ${sent.createdTimestamp - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms`);
    }
    else if (commandName === 'remind') {
        const task = interaction.options.getString('task');
        const timeInput = interaction.options.getString('time');

        // Basic time parsing (e.g., "10m", "1h", "30s")
        let milliseconds;
        const timeRegex = /(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours|s|sec|second|seconds|d|day|days)/i;
        const match = timeInput.match(timeRegex);

        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();

            if (unit.startsWith('s')) {
                milliseconds = value * 1000;
            } else if (unit.startsWith('m')) {
                milliseconds = value * 60 * 1000;
            } else if (unit.startsWith('h')) {
                milliseconds = value * 60 * 60 * 1000;
            } else if (unit.startsWith('d')) {
                milliseconds = value * 24 * 60 * 60 * 1000;
            } else {
                return interaction.reply({ content: 'Invalid time unit. Use s, m, h, or d (e.g., "10m", "1h").', ephemeral: true });
            }

            if (milliseconds > 0) {
                interaction.reply({ content: `Okay, ${interaction.user.username}! I'll remind you to "${task}" in ${timeInput}.`, ephemeral: true });
                
                setTimeout(() => {
                    interaction.user.send(`🔔 Reminder: ${task}`)
                        .catch(err => {
                            console.error("Error sending reminder DM:", err);
                            interaction.channel.send(`<@${interaction.user.id}>, I tried to DM your reminder for "${task}", but it seems your DMs are closed or I couldn't reach you.`)
                                .catch(console.error);
                        });
                }, milliseconds);
            } else {
                return interaction.reply({ content: 'Invalid time value. Please provide a positive number.', ephemeral: true });
            }
        } else {
            return interaction.reply({ content: 'Invalid time format. Please use a format like "10 minutes", "1 hour", "30s".', ephemeral: true });
        }
    }
    else if (commandName === 'timer') {
        const minutes = interaction.options.getInteger('minutes');

        if (minutes <= 0) {
            return interaction.reply({ content: 'Please provide a positive number of minutes for the timer.', ephemeral: true });
        }

        const milliseconds = minutes * 60 * 1000;
        interaction.reply({ content: `Okay, ${interaction.user.username}! Timer set for ${minutes} minute(s). I'll let you know when it's up!`, ephemeral: false });

        setTimeout(() => {
            interaction.channel.send(`⏰ <@${interaction.user.id}>, your ${minutes} minute timer is up!`)
                .catch(console.error);
        }, milliseconds);
    }
    else if (commandName === 'settings') {
        // Check if user has admin permission
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: "You need the 'Manage Server' permission to change bot settings.",
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id;
        
        if (!guildId) {
            return interaction.reply({
                content: "This command can only be used in a server.",
                ephemeral: true
            });
        }
        
        if (subcommand === 'greeting') {
            const channel = interaction.options.getChannel('channel');
            
            if (channel) {
                // Update greeting channel setting
                await db.updateGuildSetting(guildId, 'greeting_channel', channel.id);
                
                await interaction.reply({
                    content: `✅ Member greeting messages will now be sent to <#${channel.id}>.`,
                    ephemeral: false
                });
            } else {
                // Get current setting and show it
                const settings = await db.getGuildSettings(guildId);
                const currentChannelId = settings?.settings?.greeting_channel;
                
                if (currentChannelId) {
                    await interaction.reply({
                        content: `The current greeting channel is <#${currentChannelId}>. Use this command with a channel option to change it.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: "No greeting channel is currently set. Use this command with a channel option to set one.",
                        ephemeral: true
                    });
                }
            }
        }
        else if (subcommand === 'prefix') {
            const prefix = interaction.options.getString('prefix');
            
            if (prefix.length !== 1) {
                return interaction.reply({
                    content: "The prefix must be a single character (e.g., ., !, $).",
                    ephemeral: true
                });
            }
            
            // Update prefix setting
            await db.updateGuildSetting(guildId, 'prefix', prefix);
            
            await interaction.reply({
                content: `✅ Custom command prefix changed to \`${prefix}\`.`,
                ephemeral: false
            });
        }
    }
});

// Handle modals (for forms)
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    // Handle profile edit modal
    if (interaction.customId === 'profile_edit_modal') {
        // Get values from form inputs
        const nickname = interaction.fields.getTextInputValue('nickname_input');
        
        if (nickname) {
            // Update nickname preference
            await db.updateUserPreference(interaction.user.id, 'preferred_name', nickname);
            
            await interaction.reply({
                content: `✅ Great! I'll call you **${nickname}** from now on!`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "You didn't provide a nickname. Your profile remains unchanged.",
                ephemeral: true
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
