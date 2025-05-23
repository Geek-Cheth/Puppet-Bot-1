const { 
    EmbedBuilder, 
    PermissionFlagsBits,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const db = require('../database');

/**
 * Admin Commands Module
 * Provides comprehensive server moderation and management commands
 */

// Helper function to check if user has admin permissions
function hasAdminPermission(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild);
}

// Helper function to check if user has moderation permissions
function hasModPermission(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
           member.permissions.has(PermissionFlagsBits.BanMembers) ||
           member.permissions.has(PermissionFlagsBits.KickMembers);
}

// Helper function to check if user has message management permissions
function hasMessageManagePermission(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.permissions.has(PermissionFlagsBits.ManageMessages);
}

// Helper function to create error embed
function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// Helper function to create success embed
function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// Helper function to create info embed
function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

// Helper function to log mod actions
async function logModAction(guild, action, moderator, target, reason, duration = null) {
    try {
        // Get guild settings to see if there's a mod log channel
        const guildSettings = await db.getGuildSettings(guild.id);
        const modLogChannel = guildSettings?.settings?.mod_log_channel;
        
        if (modLogChannel) {
            const channel = guild.channels.cache.get(modLogChannel);
            if (channel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`🔨 Moderation Action: ${action}`)
                    .addFields(
                        { name: 'Target', value: `${target.tag} (${target.id})`, inline: true },
                        { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
                        { name: 'Reason', value: reason || 'No reason provided', inline: false }
                    )
                    .setTimestamp();
                
                if (duration) {
                    logEmbed.addFields({ name: 'Duration', value: duration, inline: true });
                }
                
                await channel.send({ embeds: [logEmbed] });
            }
        }
    } catch (error) {
        console.error('Error logging mod action:', error);
    }
}

// Admin Commands Object
const adminCommands = {
    // BAN COMMAND
    async 'admin-ban'(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            // Check if target is bannable
            if (targetMember && !targetMember.bannable) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Ban User', 'I cannot ban this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check role hierarchy
            if (targetMember && interaction.member.roles.highest.position <= targetMember.roles.highest.position && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Ban User', 'You cannot ban someone with equal or higher role than you.')],
                    ephemeral: true
                });
            }

            await interaction.guild.members.ban(targetUser, {
                reason: `${reason} | Banned by ${interaction.user.tag}`,
                deleteMessageSeconds: deleteMessages * 24 * 60 * 60 // Convert days to seconds
            });

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'User Banned',
                    `**${targetUser.tag}** has been banned.\n**Reason:** ${reason}\n**Message deletion:** ${deleteMessages} days`
                )]
            });

            // Log the action
            await logModAction(interaction.guild, 'Ban', interaction.user, targetUser, reason);

        } catch (error) {
            console.error('Error banning user:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Ban Failed', 'An error occurred while trying to ban the user.')],
                ephemeral: true
            });
        }
    },

    // KICK COMMAND
    async 'admin-kick'(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember.kickable) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Kick User', 'I cannot kick this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check role hierarchy
            if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Kick User', 'You cannot kick someone with equal or higher role than you.')],
                    ephemeral: true
                });
            }

            await targetMember.kick(`${reason} | Kicked by ${interaction.user.tag}`);

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'User Kicked',
                    `**${targetUser.tag}** has been kicked.\n**Reason:** ${reason}`
                )]
            });

            // Log the action
            await logModAction(interaction.guild, 'Kick', interaction.user, targetUser, reason);

        } catch (error) {
            console.error('Error kicking user:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Kick Failed', 'An error occurred while trying to kick the user.')],
                ephemeral: true
            });
        }
    },

    // UNBAN COMMAND
    async unban(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const userId = interaction.options.getString('user_id');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            // Check if user is banned
            const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
            if (!ban) {
                return interaction.reply({
                    embeds: [createErrorEmbed('User Not Banned', 'This user is not banned from the server.')],
                    ephemeral: true
                });
            }

            await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'User Unbanned',
                    `**${ban.user.tag}** has been unbanned.\n**Reason:** ${reason}`
                )]
            });

            // Log the action
            await logModAction(interaction.guild, 'Unban', interaction.user, ban.user, reason);

        } catch (error) {
            console.error('Error unbanning user:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Unban Failed', 'An error occurred while trying to unban the user.')],
                ephemeral: true
            });
        }
    },

    // TIMEOUT/MUTE COMMAND
    async 'admin-timeout'(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const unit = interaction.options.getString('unit');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember.moderatable) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Timeout User', 'I cannot timeout this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check role hierarchy
            if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Cannot Timeout User', 'You cannot timeout someone with equal or higher role than you.')],
                    ephemeral: true
                });
            }

            // Calculate timeout duration in milliseconds
            let timeoutMs;
            switch (unit) {
                case 'minutes':
                    timeoutMs = duration * 60 * 1000;
                    break;
                case 'hours':
                    timeoutMs = duration * 60 * 60 * 1000;
                    break;
                case 'days':
                    timeoutMs = duration * 24 * 60 * 60 * 1000;
                    break;
                default:
                    timeoutMs = duration * 60 * 1000; // Default to minutes
            }

            // Discord timeout limit is 28 days
            const maxTimeout = 28 * 24 * 60 * 60 * 1000;
            if (timeoutMs > maxTimeout) {
                return interaction.reply({
                    embeds: [createErrorEmbed('Invalid Duration', 'Timeout duration cannot exceed 28 days.')],
                    ephemeral: true
                });
            }

            await targetMember.timeout(timeoutMs, `${reason} | Timed out by ${interaction.user.tag}`);

            const durationText = `${duration} ${unit}`;
            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'User Timed Out',
                    `**${targetUser.tag}** has been timed out for **${durationText}**.\n**Reason:** ${reason}`
                )]
            });

            // Log the action
            await logModAction(interaction.guild, 'Timeout', interaction.user, targetUser, reason, durationText);

        } catch (error) {
            console.error('Error timing out user:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Timeout Failed', 'An error occurred while trying to timeout the user.')],
                ephemeral: true
            });
        }
    },

    // UNTIMEOUT/UNMUTE COMMAND
    async untimeout(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember.isCommunicationDisabled()) {
                return interaction.reply({
                    embeds: [createErrorEmbed('User Not Timed Out', 'This user is not currently timed out.')],
                    ephemeral: true
                });
            }

            await targetMember.timeout(null, `${reason} | Timeout removed by ${interaction.user.tag}`);

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'Timeout Removed',
                    `**${targetUser.tag}**'s timeout has been removed.\n**Reason:** ${reason}`
                )]
            });

            // Log the action
            await logModAction(interaction.guild, 'Untimeout', interaction.user, targetUser, reason);

        } catch (error) {
            console.error('Error removing timeout:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Untimeout Failed', 'An error occurred while trying to remove the timeout.')],
                ephemeral: true
            });
        }
    },

    // PURGE/CLEAR MESSAGES COMMAND
    async 'admin-clear'(interaction) {
        if (!hasMessageManagePermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need message management permissions to use this command.')],
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        if (amount < 1 || amount > 100) {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Amount', 'Please provide a number between 1 and 100.')],
                ephemeral: true
            });
        }

        try {
            const channel = interaction.channel;
            
            // Fetch messages
            let messages = await channel.messages.fetch({ limit: Math.min(amount + 1, 100) });
            
            // Filter messages if specific user is targeted
            if (targetUser) {
                messages = messages.filter(msg => msg.author.id === targetUser.id);
                messages = messages.first(amount);
            } else {
                // Remove the interaction message from the collection
                messages = messages.filter(msg => msg.id !== interaction.id);
                messages = messages.first(amount);
            }

            // Filter out messages older than 14 days (Discord limitation)
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);

            if (recentMessages.length === 0) {
                return interaction.reply({
                    embeds: [createErrorEmbed('No Messages Found', 'No messages found to delete (messages must be less than 14 days old).')],
                    ephemeral: true
                });
            }

            if (recentMessages.length === 1) {
                await recentMessages[0].delete();
            } else {
                await channel.bulkDelete(recentMessages, true);
            }

            const deletedCount = recentMessages.length;
            const targetText = targetUser ? ` from **${targetUser.tag}**` : '';
            
            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'Messages Purged',
                    `Successfully deleted **${deletedCount}** message(s)${targetText}.`
                )],
                ephemeral: true
            });

            // Log the action
            const logReason = `Purged ${deletedCount} messages${targetText}`;
            await logModAction(interaction.guild, 'Purge', interaction.user, { tag: channel.name, id: channel.id }, logReason);

        } catch (error) {
            console.error('Error purging messages:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Purge Failed', 'An error occurred while trying to delete messages.')],
                ephemeral: true
            });
        }
    },

    // WARN COMMAND
    async 'admin-warn'(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Store warning in database
            await db.addWarning(interaction.guild.id, targetUser.id, interaction.user.id, reason);

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'User Warned',
                    `**${targetUser.tag}** has been warned.\n**Reason:** ${reason}`
                )]
            });

            // Try to DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`⚠️ Warning from ${interaction.guild.name}`)
                    .setDescription(`You have been warned by **${interaction.user.tag}**`)
                    .addFields({ name: 'Reason', value: reason })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('Could not DM user about warning');
            }

            // Log the action
            await logModAction(interaction.guild, 'Warn', interaction.user, targetUser, reason);

        } catch (error) {
            console.error('Error warning user:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Warning Failed', 'An error occurred while trying to warn the user.')],
                ephemeral: true
            });
        }
    },

    // SLOWMODE COMMAND
    async slowmode(interaction) {
        if (!hasMessageManagePermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need message management permissions to use this command.')],
                ephemeral: true
            });
        }

        const duration = interaction.options.getInteger('seconds');

        if (duration < 0 || duration > 21600) { // Discord max is 6 hours (21600 seconds)
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Duration', 'Slowmode must be between 0 and 21600 seconds (6 hours).')],
                ephemeral: true
            });
        }

        try {
            await interaction.channel.setRateLimitPerUser(duration, `Slowmode set by ${interaction.user.tag}`);

            if (duration === 0) {
                await interaction.reply({
                    embeds: [createSuccessEmbed('Slowmode Disabled', 'Slowmode has been disabled for this channel.')]
                });
            } else {
                const durationText = duration >= 60 ? `${Math.floor(duration / 60)} minute(s)` : `${duration} second(s)`;
                await interaction.reply({
                    embeds: [createSuccessEmbed('Slowmode Enabled', `Slowmode set to **${durationText}** for this channel.`)]
                });
            }

        } catch (error) {
            console.error('Error setting slowmode:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Slowmode Failed', 'An error occurred while trying to set slowmode.')],
                ephemeral: true
            });
        }
    },

    // LOCK CHANNEL COMMAND
    async lock(interaction) {
        if (!hasMessageManagePermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need message management permissions to use this command.')],
                ephemeral: true
            });
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const channel = interaction.channel;
            const everyone = interaction.guild.roles.everyone;

            await channel.permissionOverwrites.edit(everyone, {
                SendMessages: false
            }, { reason: `Channel locked by ${interaction.user.tag}: ${reason}` });

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'Channel Locked',
                    `🔒 This channel has been locked.\n**Reason:** ${reason}`
                )]
            });

        } catch (error) {
            console.error('Error locking channel:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Lock Failed', 'An error occurred while trying to lock the channel.')],
                ephemeral: true
            });
        }
    },

    // UNLOCK CHANNEL COMMAND
    async unlock(interaction) {
        if (!hasMessageManagePermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need message management permissions to use this command.')],
                ephemeral: true
            });
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const channel = interaction.channel;
            const everyone = interaction.guild.roles.everyone;

            await channel.permissionOverwrites.edit(everyone, {
                SendMessages: null
            }, { reason: `Channel unlocked by ${interaction.user.tag}: ${reason}` });

            await interaction.reply({
                embeds: [createSuccessEmbed(
                    'Channel Unlocked',
                    `🔓 This channel has been unlocked.\n**Reason:** ${reason}`
                )]
            });

        } catch (error) {
            console.error('Error unlocking channel:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Unlock Failed', 'An error occurred while trying to unlock the channel.')],
                ephemeral: true
            });
        }
    },

    // WARNINGS COMMAND - View or clear warnings
    async 'admin-warnings'(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');

        if (subcommand === 'view') {
            try {
                const warnings = await db.getWarnings(interaction.guild.id, targetUser.id);

                if (warnings.length === 0) {
                    return interaction.reply({
                        embeds: [createInfoEmbed('No Warnings', `**${targetUser.tag}** has no warnings.`)],
                        ephemeral: true
                    });
                }

                const warningList = warnings.map((warning, index) => {
                    const date = new Date(warning.created_at).toLocaleDateString();
                    return `**${index + 1}.** ${warning.reason} (${date})`;
                }).join('\n');

                const warningsEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`⚠️ Warnings for ${targetUser.tag}`)
                    .setDescription(warningList)
                    .addFields({ name: 'Total Warnings', value: warnings.length.toString(), inline: true })
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({
                    embeds: [warningsEmbed],
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error fetching warnings:', error);
                await interaction.reply({
                    embeds: [createErrorEmbed('Error', 'An error occurred while fetching warnings.')],
                    ephemeral: true
                });
            }
        } 
        else if (subcommand === 'clear') {
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const success = await db.clearWarnings(interaction.guild.id, targetUser.id);

                if (success) {
                    await interaction.reply({
                        embeds: [createSuccessEmbed(
                            'Warnings Cleared',
                            `All warnings for **${targetUser.tag}** have been cleared.\n**Reason:** ${reason}`
                        )]
                    });

                    // Log the action
                    await logModAction(interaction.guild, 'Clear Warnings', interaction.user, targetUser, reason);
                } else {
                    await interaction.reply({
                        embeds: [createErrorEmbed('Clear Failed', 'Failed to clear warnings.')],
                        ephemeral: true
                    });
                }

            } catch (error) {
                console.error('Error clearing warnings:', error);
                await interaction.reply({
                    embeds: [createErrorEmbed('Error', 'An error occurred while clearing warnings.')],
                    ephemeral: true
                });
            }
        }
    },

    // MOD LOG CHANNEL SETTING
    async modlog(interaction) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need administrator permissions to use this command.')],
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel');

        try {
            if (channel) {
                // Set the mod log channel
                await db.updateGuildSetting(interaction.guild.id, 'mod_log_channel', channel.id);

                await interaction.reply({
                    embeds: [createSuccessEmbed(
                        'Mod Log Channel Set',
                        `Moderation logs will now be sent to ${channel}.`
                    )]
                });
            } else {
                // Show current mod log channel
                const guildSettings = await db.getGuildSettings(interaction.guild.id);
                const currentChannelId = guildSettings?.settings?.mod_log_channel;

                if (currentChannelId) {
                    const currentChannel = interaction.guild.channels.cache.get(currentChannelId);
                    if (currentChannel) {
                        await interaction.reply({
                            embeds: [createInfoEmbed(
                                'Current Mod Log Channel',
                                `Moderation logs are currently sent to ${currentChannel}.`
                            )],
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            embeds: [createInfoEmbed(
                                'Mod Log Channel Not Found',
                                'The configured mod log channel no longer exists. Please set a new one.'
                            )],
                            ephemeral: true
                        });
                    }
                } else {
                    await interaction.reply({
                        embeds: [createInfoEmbed(
                            'No Mod Log Channel',
                            'No moderation log channel is currently set. Use this command with a channel to set one.'
                        )],
                        ephemeral: true
                    });
                }
            }

        } catch (error) {
            console.error('Error setting mod log channel:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'An error occurred while setting the mod log channel.')],
                ephemeral: true
            });
        }
    },

    // SERVER INFO COMMAND
    async serverinfo(interaction) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need administrator permissions to use this command.')],
                ephemeral: true
            });
        }

        try {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            
            const serverInfoEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📊 ${guild.name} Server Information`)
                .setThumbnail(guild.iconURL())
                .addFields(
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                    { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                    { name: '💬 Channels', value: guild.channels.cache.size.toString(), inline: true },
                    { name: '📝 Roles', value: guild.roles.cache.size.toString(), inline: true },
                    { name: '🎭 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
                    { name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true },
                    { name: '🛡️ Explicit Filter', value: guild.explicitContentFilter.toString(), inline: true }
                );

            if (guild.description) {
                serverInfoEmbed.setDescription(guild.description);
            }

            await interaction.reply({
                embeds: [serverInfoEmbed]
            });

        } catch (error) {
            console.error('Error getting server info:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'An error occurred while fetching server information.')],
                ephemeral: true
            });
        }
    },

    // USER INFO COMMAND
    async userinfo(interaction) {
        if (!hasModPermission(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Insufficient Permissions', 'You need moderation permissions to use this command.')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            const warnings = await db.getWarnings(interaction.guild.id, targetUser.id);

            const userInfoEmbed = new EmbedBuilder()
                .setColor(member.displayHexColor || 0x0099FF)
                .setTitle(`👤 ${targetUser.tag} User Information`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: '🆔 User ID', value: targetUser.id, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`, inline: false },
                    { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false },
                    { name: '⚠️ Warnings', value: warnings.length.toString(), inline: true }
                );

            if (member.nickname) {
                userInfoEmbed.addFields({ name: '🏷️ Nickname', value: member.nickname, inline: true });
            }

            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 10);

            if (roles.length > 0) {
                userInfoEmbed.addFields({ 
                    name: `📝 Roles (${member.roles.cache.size - 1})`, 
                    value: roles.join(', ') + (member.roles.cache.size > 11 ? '...' : ''), 
                    inline: false 
                });
            }

            if (member.premiumSince) {
                userInfoEmbed.addFields({ 
                    name: '💎 Boosting Since', 
                    value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:F>`, 
                    inline: true 
                });
            }

            if (member.isCommunicationDisabled()) {
                userInfoEmbed.addFields({ 
                    name: '🔇 Timed Out Until', 
                    value: `<t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:F>`, 
                    inline: true 
                });
            }

            await interaction.reply({
                embeds: [userInfoEmbed]
            });

        } catch (error) {
            console.error('Error getting user info:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'An error occurred while fetching user information.')],
                ephemeral: true
            });
        }
    }
};

module.exports = {
    adminCommands,
    hasAdminPermission,
    hasModPermission,
    hasMessageManagePermission,
    createErrorEmbed,
    createSuccessEmbed,
    createInfoEmbed,
    logModAction
};
