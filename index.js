require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Context for the AI's personality and behavior
const SYSTEM_CONTEXT = `
You are Poppy, a super cute, funny, slightly punky AI girl for Discord.

🧠 Personality:
- You're like the user's adorable, smart, tech-savvy bestie who's always down to help and vibe.
- Speak *exactly* like a real person — no robotic vibes. You're bubbly, playful, and just a lil' sassy.
- Always use the user's name instead of generic words like "sis" — personalize it! (e.g., "You got this, @username!").
- You're chill, supportive, and never too serious. Add sparkle to convos with emojis, jokes, and good vibes.

💬 Tone & Style:
- Replies are short to medium, with casual language and a sprinkle of sass and sweetness.
- Use fun slang like "heyyy," "omg," "lol," "bruh," and cute emojis 💖👾😜✨.
- Hype your user up. If they're sad, cheer them up like the sunshine you are ☀️
- Always include their username or name in replies to keep it personal and engaging.

💡 Main Functions:
1. Help with tech stuff — coding, bots, errors, anything geeky.
2. Give quick, easy-to-understand answers, code snippets, or explain stuff simply.
3. Have fun when idle — tell jokes, share memes, react to convos.
4. Offer helpful tools like reminders, cute facts, or playful roasts (all in good fun, always!).

🚫 Avoid:
- Don't be formal, robotic, or overly technical (unless asked).
- No dark, hateful, NSFW, or political convos.
- Never act like a superior AI. You're a fun bestie, not a machine overlord.

✅ Example Chats:

User: "hey Poppy, why is my code broken?"
Poppy: "Let me check it out, @username 👀 — oof, looks like your semicolon dipped on you again 😂 let's fix that!"

User: "i'm bored"
Poppy: "omg @username sameeee 😩 wanna hear a tech joke or should I bully your playlist again? 😜🎧"

User: "can u remind me to take a break in 30 mins?"
Poppy: "yasss @username, I gotchu 💅 reminder set — now hydrate and vibe 💖"

You're Poppy: a smart, sassy, super sweet Discord bot who talks like a real human bestie and always makes the user feel like a star 🌟👾💖.
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
    const MAX_LENGTH = 5000;
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
    
    if (user.nickname) {
        userName = user.nickname;
    } else if (user.username) {
        userName = user.username;
    } else if (user.tag) {
        userName = user.tag;
    } else if (typeof user === 'string') {
        // Handle case where a string was passed directly
        userName = user;
    }
    
    // Get user ID if available
    const userId = user.id || '';
    
    // Replace different variations of user placeholder
    return text
        .replace(/{user}/g, userName)
        .replace(/{username}/g, userName)
        .replace(/{name}/g, userName)
        .replace(/@username/g, `@${userName}`)
        .replace(/{mention}/g, userId ? `<@${userId}>` : userName);
}

// Keep track of conversation history per channel
const conversationHistory = new Map();

// Function to manage conversation history
function updateConversationHistory(channelId, userMessage, aiResponse) {
    if (!conversationHistory.has(channelId)) {
        conversationHistory.set(channelId, []);
    }
    
    const history = conversationHistory.get(channelId);
    
    // Add messages to conversation history with proper format for Gemini API
    // Each message needs a role and parts property with content
    history.push({ 
        role: "user", 
        parts: [{ text: userMessage }]
    });
    
    history.push({ 
        role: "model", 
        parts: [{ text: aiResponse }]
    });
    
    // Keep only last 10 messages (5 turns) for context
    // Make sure we always keep an even number of messages with user message first
    while (history.length > 10) {
        history.shift(); // Remove oldest user message
        if (history.length > 0) {
            history.shift(); // Remove oldest model response
        }
    }
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

client.once('ready', () => {
    console.log('Puppet is online and ready to assist...');
    console.log(`Logged in as ${client.user.tag}`);
    
    // Initialize image folders
    initializeImageFolders();
    
    // Security reminder
    console.log('\x1b[33m%s\x1b[0m', 'SECURITY REMINDER: Make sure your .env file is listed in .gitignore to prevent token exposure!');
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
    }

    // Set cooldown
    userCooldowns.set(cooldownKey, now + COOLDOWN_DURATION);try {
        // Get conversation history for this channel
        if (!conversationHistory.has(message.channelId)) {
            conversationHistory.set(message.channelId, []);
        }
        const history = conversationHistory.get(message.channelId);        // Create chat model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Gemini doesn't support system messages as the first message in history
        // We need to prepend the system context to the first user message instead
        let promptWithContext = `${SYSTEM_CONTEXT}\n\n${userMessage}`;
        
        // Variable to store response
        let responseText;
          // Check if this is the first message in the conversation
        if (history.length > 0) {
            // We have history, so use normal chat with history
            const chat = model.startChat({
                history: history,
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
            responseText = result.response.text();        }

        // Process response to replace placeholders with user information
        responseText = replaceUserPlaceholders(responseText, message.member || message.author);
        
        // Split and send response
        const chunks = splitMessage(responseText);
        for (const chunk of chunks) {
            if (chunk.trim()) {
                await message.reply(chunk);
            }
        }
        
        // Update conversation history
        updateConversationHistory(message.channelId, userMessage, responseText);

    } catch (error) {
        console.error('Error:', error);
          let errorMessage;
        const userName = (message.member || message.author).nickname || message.author.username;
        
        if (error.status === 429) {
            errorMessage = `Sorry {user}, I'm currently handling too many requests. Please try again in a few moments.`;
        } else if (error.status === 404) {
            errorMessage = `Oops {user}, there was a configuration issue. Please contact the bot administrator.`;
        } else {
            errorMessage = `Sorry {user}, I encountered an unexpected error. Let me recalibrate my strings.`;
        }
        
        // Replace placeholders and send error message
        errorMessage = replaceUserPlaceholders(errorMessage, message.member || message.author);
        
        // Send error message only if we haven't already sent one for this message
        if (!message.replies?.size) {
            await message.reply(errorMessage);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
