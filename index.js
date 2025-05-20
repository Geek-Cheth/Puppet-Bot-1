require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const openai = new OpenAI({
    apiKey: process.env.SHAPES_API_KEY,
    baseURL: "https://api.shapes.inc/v1"
});

// Function to split message while preserving code blocks
function splitMessage(text) {
    const MAX_LENGTH = 1900;
    const messages = [];
    let currentMessage = '';
    let inCodeBlock = false;
    
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (line.includes('```')) {
            inCodeBlock = !inCodeBlock;
        }
        
        if (currentMessage.length + line.length + 1 > MAX_LENGTH) {
            if (inCodeBlock) {
                currentMessage += '```';
                messages.push(currentMessage);
                currentMessage = '```' + line + '\n';
            } else {
                messages.push(currentMessage);
                currentMessage = line + '\n';
            }
        } else {
            currentMessage += line + '\n';
        }
    }
    
    if (currentMessage) {
        messages.push(currentMessage);
    }
    
    return messages.map(msg => msg.trim());
}

client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        const response = await openai.chat.completions.create({
            model: "shapesinc/aura-zwl3",
            messages: [{ 
                role: "user", 
                content: message.content 
            }]
        });

        if (response.choices?.[0]?.message?.content) {
            const chunks = splitMessage(response.choices[0].message.content);
            
            for (const chunk of chunks) {
                if (chunk.trim()) {
                    await message.channel.send(chunk);
                }
            }
        }
    } catch (error) {
        // Silent error handling
        console.error('API Error:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
