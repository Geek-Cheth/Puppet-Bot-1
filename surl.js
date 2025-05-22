const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const db = require('./database');

const CLEANURI_API_ENDPOINT = 'https://cleanuri.com/api/v1/shorten';

/**
 * Shortens a given long URL using the CleanURI API.
 * @param {string} longUrl - The long URL to shorten.
 * @returns {Promise<object|null>} The API response containing the short URL, or null on error.
 */
async function shortenUrlApiCall(longUrl) {
    try {
        // CleanURI expects URL to be URL-encoded in the POST body
        const response = await axios.post(CLEANURI_API_ENDPOINT, new URLSearchParams({ url: longUrl }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data; // Expected: { "result_url": "https://cleanuri.com/pEqXje" }
    } catch (error) {
        console.error('Error calling CleanURI API:', error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.error || 'API request failed.';
        // Return a structured error that can be checked by the caller
        return {
            error: true,
            message: errorMessage,
            status: error.response?.status
        };
    }
}

/**
 * Handles the !surl command.
 * @param {import('discord.js').Message} message - The Discord message object.
 * @param {string[]} args - The arguments passed to the command.
 */
async function handleShortenUrlCommand(message, args) {
    const longUrl = args[0];

    if (!longUrl) {
        return message.reply("Hey! You need to provide a URL to shorten. Usage: `!surl <your_long_url>`");
    }

    // Basic URL validation (can be improved)
    if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
        return message.reply("Hmm, that doesn't look like a valid URL. Make sure it starts with `http://` or `https://`.");
    }

    try {
        const apiResponse = await shortenUrlApiCall(longUrl);

        if (apiResponse.error) {
            // CleanURI specific error messages might differ, adjust as needed based on API docs or testing
            let errorMessage = `Sorry, I couldn't shorten that URL. The service said: "${apiResponse.message}"`;
            if (apiResponse.message.includes("invalid") || apiResponse.message.includes("URL is not valid")) { // Example check
                 errorMessage = "It seems the URL you provided is invalid or unreachable. Please double-check it! 🤔";
            }
            return message.reply(errorMessage);
        }

        if (apiResponse && apiResponse.result_url) {
            const shortUrl = apiResponse.result_url;
            const shortCode = shortUrl.substring(shortUrl.lastIndexOf('/') + 1); // Extract code if needed by DB
            
            // Save to database
            try {
                // Assuming db.saveShortenedUrl expects (userId, originalUrl, shortCode, fullShortUrl)
                // If db.saveShortenedUrl is flexible, this might need adjustment.
                // For now, we pass the extracted code and the full URL.
                await db.saveShortenedUrl(message.author.id, longUrl, shortCode, shortUrl);
            } catch (dbError) {
                console.error('Failed to save shortened URL to database:', dbError);
                message.channel.send("I shortened your URL, but had a little hiccup saving it to your history. No worries, it should still work!");
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2) // Discord blurple
                .setTitle('🔗 Short URL Ready!')
                .setDescription(`Your shortened URL is: **${shortUrl}**`)
                .addFields(
                    { name: 'Original URL', value: `\`${longUrl}\`` }
                )
                .setFooter({ text: 'Use !myurls to see your history.' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } else {
            return message.reply("Sorry, I received an unexpected response from the URL shortening service. Please try again later. 😥");
        }
    } catch (error) {
        console.error('Error in handleShortenUrlCommand:', error);
        return message.reply("Yikes! Something went wrong on my end while trying to shorten that. Please try again in a bit. 🛠️");
    }
}

/**
 * Handles the !myurls command to display user's shortened URLs.
 * @param {import('discord.js').Message} message - The Discord message object.
 */
async function handleMyUrlsCommand(message) {
    try {
        const urls = await db.getUserShortenedUrls(message.author.id);

        if (!urls || urls.length === 0) {
            return message.reply("You haven't shortened any URLs with me yet! Use `!surl <your_long_url>` to start. 😊");
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🔗 Your Shortened URLs, ${message.author.username}`)
            .setDescription("Here's a list of URLs you've shortened with me:")
            .setTimestamp();

        let descriptionLines = [];
        urls.forEach(urlEntry => {
            descriptionLines.push(`**Short:** [${urlEntry.short_url}](${urlEntry.short_url})\n**Original:** \`${urlEntry.original_url}\`\n*Created: ${new Date(urlEntry.created_at).toLocaleDateString()}*`);
        });
        
        // Discord embed description limit is 4096. Paginate if necessary.
        // For simplicity, this example just takes the most recent ones if too long.
        // A more robust solution would use pagination with buttons.
        const fullDescription = descriptionLines.join('\n\n');
        if (fullDescription.length > 4000) {
            embed.setDescription(descriptionLines.slice(0, 5).join('\n\n') + "\n\n*Showing the 5 most recent URLs. You have more!*");
            // Footer removed as per user request
        } else {
            embed.setDescription(fullDescription);
        }

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error fetching user URLs:', error);
        return message.reply("Oops! I had trouble fetching your URL history. Please try again later. 😕");
    }
}

module.exports = {
    handleShortenUrlCommand,
    handleMyUrlsCommand,
    // Potentially export shortenUrlApiCall if needed elsewhere, though unlikely for this structure
};
