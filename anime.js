const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

const NEKOSIA_API_BASE_URL = 'https://api.nekosia.cat/api/v1';

async function fetchAnimeImage(args, userId) {
    let category = 'random'; // Default category
    let count = 1;
    const additionalTags = [];
    const blacklistedTags = [];

    // Basic argument parsing - can be improved
    if (args.length > 0) {
        category = args[0]; // First argument as category
        args.slice(1).forEach(arg => {
            if (arg.startsWith('count:')) {
                const num = parseInt(arg.split(':')[1], 10);
                if (!isNaN(num) && num > 0 && num <= 48) {
                    count = num;
                }
            } else if (arg.startsWith('+')) {
                additionalTags.push(arg.substring(1));
            } else if (arg.startsWith('-')) {
                blacklistedTags.push(arg.substring(1));
            }
        });
    }

    const params = new URLSearchParams({
        count: count,
        session: 'id',
        id: userId,
    });

    if (additionalTags.length > 0) {
        params.append('additionalTags', additionalTags.join(','));
    }
    if (blacklistedTags.length > 0) {
        params.append('blacklistedTags', blacklistedTags.join(','));
    }

    const apiUrl = `${NEKOSIA_API_BASE_URL}/images/${category}?${params.toString()}`;

    try {
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data && data.success === true) {
            // Handle case for count > 1 (returns data.images as an array)
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                return data.images;
            }
            // Handle case for count = 1 (returns a single image object directly, not in an array)
            else if (data.image && typeof data.image === 'object') {
                return [data]; // Wrap the single image data object in an array
            }
            // No images found or unexpected structure even if success is true
            else {
                console.warn('Nekosia API success, but no images found or unexpected structure:', data);
                return { error: 'No images found for your criteria.' };
            }
        } else {
            // success is false, or data/data.success is missing
            console.error('Nekosia API Error:', data);
            // Check for specific API messages that might indicate bad input vs. server issues
            if (data && data.error && typeof data.error.message === 'string' && (data.error.message.includes('category') || data.error.message.includes('tag'))) {
                return { error: "Hmm, I couldn't find anything with those search terms. Maybe try different ones?" };
            }
            return { error: "Oops! The anime image service seems to be having a hiccup. Please try again in a bit! 😵" };
        }
    } catch (error) {
        console.error('Error fetching anime image from Nekosia API:', error.message);
        // Differentiate between connection errors and other issues
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || (error.response && error.response.status >= 500)) {
            return { error: "Sorry, I'm having trouble connecting to the anime image service right now. Please try again later! 📡" };
        }
        return { error: "An unexpected glitch happened while fetching your image. Please try again! ✨" };
    }
}

module.exports = {
    name: 'anime',
    description: 'Fetches a random anime image from Nekosia API. Usage: !anime [category] [count:N] [+tag1] [-tag2]',
    async execute(message, args) {
        const userId = message.author.id;
        const images = await fetchAnimeImage(args, userId);

        if (images.error) {
            return message.channel.send(images.error);
        }

        if (!images || images.length === 0) {
            return message.channel.send('No images found for your criteria.');
        }

        for (const imageData of images) {
            if (imageData.image && imageData.image.original && imageData.image.original.url) {
                try {
                    const embed = new EmbedBuilder()
                        .setImage(imageData.image.original.url);
                    
                    await message.channel.send({ embeds: [embed] });

                } catch (error) {
                    console.error('Error sending image embed:', error.message);
                    await message.channel.send("Oops! Had a little trouble displaying that image. Maybe try again? 🤔");
                }
            } else {
                console.error('Image data missing original URL:', imageData);
                // This error should ideally not be hit if fetchAnimeImage is robust
                await message.channel.send("Sorry, something went wrong and I couldn't get the image URL. 😥");
            }
        }
    },
};
