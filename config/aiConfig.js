const fs = require('fs');
const path = require('path');

// Load the personality data from the JSON file
const personalityData = JSON.parse(fs.readFileSync(path.join(__dirname, 'aiPersonality.json'), 'utf-8'));

// Function to format a list of items into a string
function formatList(items) {
  return items.map(item => `- ${item}`).join('\\n');
}

// Function to format example chats
function formatExampleChats(chats) {
  return chats.map(chat => `User: "${chat.user}"\\nPoppy: "${chat.poppy}"`).join('\\n\\n');
}

// Construct the SYSTEM_CONTEXT string
const SYSTEM_CONTEXT = `
${personalityData.introduction}
${personalityData.creatorInfo}

🧠 Personality:
${formatList(personalityData.personality)}

💬 Tone & Style:
${formatList(personalityData.toneAndStyle)}

💡 Main Functions:
${formatList(personalityData.mainFunctions)}

🚫 What to Avoid:
${formatList(personalityData.whatToAvoid)}

✅ Example Chats:
${formatExampleChats(personalityData.exampleChats)}

${personalityData.conclusion}
`;

module.exports = {
  SYSTEM_CONTEXT
};
