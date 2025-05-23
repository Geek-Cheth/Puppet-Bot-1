const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Admin Slash Command Definitions
 * All admin/moderation slash commands are defined here
 */

const adminSlashCommands = [
    // BAN COMMAND
    new SlashCommandBuilder()
        .setName('admin-ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('delete_messages')
                .setDescription('Days of messages to delete (0-7)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(7)
        ),

    // KICK COMMAND
    new SlashCommandBuilder()
        .setName('admin-kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)
        ),

    // UNBAN COMMAND
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option
                .setName('user_id')
                .setDescription('The Discord ID of the user to unban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false)
        ),

    // TIMEOUT/MUTE COMMAND
    new SlashCommandBuilder()
        .setName('admin-timeout')
        .setDescription('Timeout a user (temporary mute)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to timeout')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the timeout')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320) // 28 days in minutes
        )
        .addStringOption(option =>
            option
                .setName('unit')
                .setDescription('Time unit')
                .setRequired(true)
                .addChoices(
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' },
                    { name: 'Days', value: 'days' }
                )
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(false)
        ),

    // UNTIMEOUT/UNMUTE COMMAND
    new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to remove timeout from')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for removing the timeout')
                .setRequired(false)
        ),

    // PURGE/CLEAR MESSAGES COMMAND
    new SlashCommandBuilder()
        .setName('admin-clear')
        .setDescription('Delete multiple messages at once')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false)
        ),

    // WARN COMMAND
    new SlashCommandBuilder()
        .setName('admin-warn')
        .setDescription('Warn a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(false)
        ),

    // WARNINGS COMMAND - View user warnings
    new SlashCommandBuilder()
        .setName('admin-warnings')
        .setDescription('View warnings for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View warnings for a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to view warnings for')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all warnings for a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to clear warnings for')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for clearing warnings')
                        .setRequired(false)
                )
        ),

    // SLOWMODE COMMAND
    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName('seconds')
                .setDescription('Slowmode duration in seconds (0 to disable, max 21600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        ),

    // LOCK CHANNEL COMMAND
    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for locking the channel')
                .setRequired(false)
        ),

    // UNLOCK CHANNEL COMMAND
    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for unlocking the channel')
                .setRequired(false)
        ),

    // MOD LOG CHANNEL SETTING
    new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('Set the moderation log channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to use for moderation logs')
                .setRequired(false)
        ),

    // SERVER INFO COMMAND
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display server information')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    // USER INFO COMMAND
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display information about a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)
        )
];

module.exports = {
    adminSlashCommands
};
