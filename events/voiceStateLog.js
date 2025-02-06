const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const VOICE_LOG_CHANNEL_ID = process.env.VOICE_LOG_CHANNEL_ID;
        
        if (!VOICE_LOG_CHANNEL_ID || newState.member.user.bot) return;

        // ユーザーがボイスチャンネルに参加した場合
        if (!oldState.channelId && newState.channelId) {
            try {
                const channel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                await channel.send(`🎤 **${newState.member.displayName}** が ${newState.channel.name} に参加`);
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

                await channel.send(`👋 **${oldState.member.displayName}** が ${oldState.channel.name} から退出`);
                console.log(chalk.green(`✓ Voice Log: ${oldState.member.user.username} left ${oldState.channel.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel leave:'), error);
            }
        }
    },
};