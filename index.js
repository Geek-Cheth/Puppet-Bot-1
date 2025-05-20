require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async message => {
    // Ignore messages from bots to prevent loops
    if (message.author.bot) return;

    try {
        // Show typing indicator while processing
        message.channel.sendTyping();

        const response = await axios.post('https://api.shapes.ai/v1/chat/completions', {
            messages: [{ role: 'user', content: message.content }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.SHAPES_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const answer = response.data.choices[0].message.content;
        await message.reply(answer);

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        await message.reply('Sorry, I encountered an error while processing your message. Please try again later.');
    }
});

client.login(process.env.DISCORD_TOKEN);
