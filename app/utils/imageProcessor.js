const axios = require('axios');

/**
 * Downloads an image from a URL and converts it to base64
 * @param {string} imageUrl - The URL of the image to download
 * @returns {Promise<{mimeType: string, data: string}|null>} Base64 encoded image data or null if failed
 */
async function downloadAndEncodeImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000 // 10 second timeout
        });
        
        // Get the content type to determine mime type
        const contentType = response.headers['content-type'];
        
        // Convert to base64
        const base64Data = Buffer.from(response.data).toString('base64');
        
        return {
            mimeType: contentType,
            data: base64Data
        };
    } catch (error) {
        console.error('Error downloading image:', error.message);
        return null;
    }
}

/**
 * Processes Discord message attachments and returns image data for Gemini Vision
 * @param {Message} message - Discord message object
 * @returns {Promise<Array>} Array of image objects for Gemini API
 */
async function processMessageImages(message) {
    const images = [];
    
    // Check if message has attachments
    if (message.attachments.size === 0) {
        return images;
    }
    
    // Supported image types
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    for (const attachment of message.attachments.values()) {
        // Check if it's an image by file extension or content type
        const isImage = attachment.contentType && supportedTypes.includes(attachment.contentType.toLowerCase()) ||
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.name);
        
        if (isImage && attachment.size <= 20 * 1024 * 1024) { // 20MB limit
            console.log(`Processing image: ${attachment.name} (${attachment.contentType})`);
            
            const imageData = await downloadAndEncodeImage(attachment.url);
            if (imageData) {
                images.push({
                    inlineData: {
                        mimeType: imageData.mimeType,
                        data: imageData.data
                    }
                });
            }
        } else if (isImage) {
            console.log(`Image too large: ${attachment.name} (${attachment.size} bytes)`);
        }
    }
    
    return images;
}

module.exports = {
    downloadAndEncodeImage,
    processMessageImages
};
