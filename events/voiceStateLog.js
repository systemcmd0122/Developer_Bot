const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const VOICE_LOG_CHANNEL_ID = process.env.VOICE_LOG_CHANNEL_ID;
        const DELETE_DELAY = 60000; // 1分 = 60000ミリ秒
        
        if (!VOICE_LOG_CHANNEL_ID || newState.member.user.bot) return;

        // ユーザーがボイスチャンネルに参加した場合
        if (!oldState.channelId && newState.channelId) {
            try {
                const channel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                const message = await channel.send(`🎤 **${newState.member.displayName}** が ${newState.channel.name} に参加しました`);
                console.log(chalk.green(`✓ Voice Log: ${newState.member.user.username} joined ${newState.channel.name}`));
                
                setTimeout(() => {
                    message.delete().catch(error => {
                        console.error(chalk.red('✗ Error deleting join message:'), error);
                    });
                }, DELETE_DELAY);
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel join:'), error);
            }
        }
        
        // ユーザーがボイスチャンネルから退出した場合
        if (oldState.channelId && !newState.channelId) {
            try {
                const channel = oldState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                const message = await channel.send(`👋 **${oldState.member.displayName}** が ${oldState.channel.name} から退出しました`);
                console.log(chalk.green(`✓ Voice Log: ${oldState.member.user.username} left ${oldState.channel.name}`));
                
                setTimeout(() => {
                    message.delete().catch(error => {
                        console.error(chalk.red('✗ Error deleting leave message:'), error);
                    });
                }, DELETE_DELAY);
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel leave:'), error);
            }
        }
        
        // ユーザーがボイスチャンネルを移動した場合
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            try {
                const channel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
                if (!channel) return;

                const message = await channel.send(`↪️ **${newState.member.displayName}** が ${oldState.channel.name} から ${newState.channel.name} に移動しました`);
                console.log(chalk.green(`✓ Voice Log: ${newState.member.user.username} moved from ${oldState.channel.name} to ${newState.channel.name}`));
                
                setTimeout(() => {
                    message.delete().catch(error => {
                        console.error(chalk.red('✗ Error deleting move message:'), error);
                    });
                }, DELETE_DELAY);
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel move:'), error);
            }
        }
    },
};