require('dotenv').config();
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

/**
 * Fetches search results from Google Custom Search API.
 * @param {string} query The search query.
 * @param {number} numResults The number of results to return (default: 3).
 * @returns {Promise<Array<{title: string, link: string, snippet: string}>>} A promise that resolves to an array of search results.
 */
async function fetchSearchResults(query, numResults = 3) {
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
        console.error('Google API Key or CSE ID is missing from .env file.');
        return [];
    }

    if (!query) {
        return [];
    }

    const url = `https://www.googleapis.com/customsearch/v1`;
    const params = {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CSE_ID,
        q: query,
        num: numResults
    };

    try {
        const response = await axios.get(url, { params });
        if (response.data && response.data.items) {
            return response.data.items.map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching Google search results:', error.response ? error.response.data : error.message);
        // Log more detailed error if available
        if (error.response && error.response.data && error.response.data.error) {
            console.error('Google API Error Details:', error.response.data.error.message);
        }
        return [];
    }
}

module.exports = {
    fetchSearchResults
};
