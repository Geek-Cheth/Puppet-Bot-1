const { REST, Routes } = require('discord.js');
const { adminSlashCommands } = require('./commands/adminCommands');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Convert slash command builders to JSON
const commands = adminSlashCommands.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

async function deployCommands() {
    try {
        console.log('Started refreshing admin application (/) commands.');

        // For global commands
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded admin application (/) commands.');
        console.log(`Deployed ${commands.length} admin commands:`);
        commands.forEach(cmd => console.log(`- /${cmd.name}: ${cmd.description}`));
        
    } catch (error) {
        console.error('Error deploying admin commands:', error);
    }
}

// Deploy for specific guild (for testing)
async function deployGuildCommands(guildId) {
    try {
        console.log(`Started refreshing admin application (/) commands for guild ${guildId}.`);

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`Successfully reloaded admin application (/) commands for guild ${guildId}.`);
        console.log(`Deployed ${commands.length} admin commands:`);
        commands.forEach(cmd => console.log(`- /${cmd.name}: ${cmd.description}`));
        
    } catch (error) {
        console.error('Error deploying admin guild commands:', error);
    }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
    const guildId = args[0];
    console.log(`Deploying admin commands to guild: ${guildId}`);
    deployGuildCommands(guildId);
} else {
    console.log('Deploying admin commands globally...');
    deployCommands();
}
