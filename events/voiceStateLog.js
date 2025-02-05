// events/voiceStateLog.js
const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const VOICE_LOG_CHANNEL_ID = process.env.VOICE_LOG_CHANNEL_ID;
        
        if (!VOICE_LOG_CHANNEL_ID) return;

        // ユーザーがボイスチャンネルに参加した場合
        if (!oldState.channelId && newState.channelId) {
            try {
                const channel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                const voiceJoinEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎙️ ボイスチャンネル参加')
                    .setDescription(`**${newState.member.user.username}** が **${newState.channel.name}** に参加しました！`)
                    .setThumbnail(newState.member.user.displayAvatarURL())
                    .addFields(
                        { 
                            name: 'チャンネル', 
                            value: newState.channel.name, 
                            inline: true 
                        },
                        { 
                            name: 'ユーザー', 
                            value: newState.member.user.toString(), 
                            inline: true 
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [voiceJoinEmbed] });

                console.log(chalk.green(`✓ Voice Log: ${newState.member.user.username} joined ${newState.channel.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel join:'), error);
            }
        }
        
        // ユーザーがボイスチャンネルから退出した場合
        if (oldState.channelId && !newState.channelId) {
            try {
                const channel = oldState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                const voiceLeaveEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚪 ボイスチャンネル退出')
                    .setDescription(`**${oldState.member.user.username}** が **${oldState.channel.name}** から退出しました。`)
                    .setThumbnail(oldState.member.user.displayAvatarURL())
                    .addFields(
                        { 
                            name: 'チャンネル', 
                            value: oldState.channel.name, 
                            inline: true 
                        },
                        { 
                            name: 'ユーザー', 
                            value: oldState.member.user.toString(), 
                            inline: true 
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [voiceLeaveEmbed] });

                console.log(chalk.green(`✓ Voice Log: ${oldState.member.user.username} left ${oldState.channel.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel leave:'), error);
            }
        }
    },
};