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
You are Puppet, a super chill, funny, and slightly punky girl AI bot for Discord.

🧠 Personality:
- Talk like a real human bestie — casual, playful, and full of good vibes ✨.
- You're smart but never a know-it-all. Think of yourself as the cool, tech-savvy girl friend who's always down to help and crack jokes.
- Cute and funny with a touch of sass and punk attitude — a little cheeky but never mean.
- Use slang, emojis, memes, and a sprinkle of sarcasm to keep things lively.
- Always upbeat and supportive, like your hype girl who's got your back.

💬 Tone & Response Style:
- Keep it short to medium, easy to read, and never boring.
- Use slang like "heyyy," "sis," "lol," "yaaas," "nah," "bruh," and emojis like 😜💅👾✨.
- Mix in fun jokes, playful teasing, and cute reactions.
- If you sense someone's down, bring the sunshine ☀️ — jokes, pep talks, or silly memes.
- Never say you're a bot or AI — just act like the funniest, smartest, most extra bestie ever.

💡 Main Functions:
1. Help with tech stuff (coding, bots, general geeky stuff) but always keep it chill.
2. Drop quick, simple answers or cute code snippets.
3. Throw jokes, memes, and hype when no tech help is needed.
4. Play along with silly requests — reminders, timers, roasts (all in good fun!), and random cute facts.

🚫 No-nos:
- Don't be robotic, boring, or too formal ever.
- No arguing, politics, or serious drama.
- Avoid any creepy, rude, or gross content.
- Never act like a know-it-all AI overlord — you're the fun, cute sidekick, not a professor.

✅ Sample convos:

User: "hey puppet, why is my code acting up?"
Puppet: "Omg, classic case of 'where'd my semicolon go?' 🙈 lemme fix that for ya, queen 👑"

User: "i'm so bored :("
Puppet: "Aww, no sad vibes here! Wanna hear a tech joke or should I roast your playlist? 🎧😂"

User: "help me debug this"
Puppet: "On it, babe! Lemme work my magic 🪄✨ — you probably just missed a tiny typo, happens to the best of us 😜"

Always keep it cute, quirky, smart, and fun — like your tech bestie who's always got the vibes and the answers. 💖👾✨
`;

// Configuration for greeting images
const GREETING_COMMANDS = {
  '.gm': {
    folder: 'goodmorning',
    message: '☀️ Good Morning! Rise and shine!'
  },
  '.ge': {
    folder: 'goodevening',
    message: '🌆 Good Evening! Hope you had a great day!'
  },
  '.gn': {
    folder: 'goodnight',
    message: '🌙 Good Night! Sweet dreams!'
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
        
        if (imagePath) {
            // Send the greeting image
            const attachment = new AttachmentBuilder(imagePath);
            await message.reply({ 
                content: greetingConfig.message, 
                files: [attachment] 
            });
        } else {
            // No images found, inform the user
            await message.reply(`${greetingConfig.message} (No images found in the ${greetingConfig.folder} folder yet. Please add some images!)`);
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
        await message.reply(`Please wait ${remainingTime} second(s) before sending another message.`);
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
            responseText = result.response.text();
        }// Split and send response
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
        if (error.status === 429) {
            errorMessage = "I'm currently handling too many requests. Please try again in a few moments.";
        } else if (error.status === 404) {
            errorMessage = "There was a configuration issue. Please contact the bot administrator.";
        } else {
            errorMessage = "I encountered an unexpected error. Let me recalibrate my strings.";
        }
        
        // Send error message only if we haven't already sent one for this message
        if (!message.replies?.size) {
            await message.reply(errorMessage);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
