const { Events } = require('discord.js');
const chalk = require('chalk');

// チャンネルマッピングの定義
const CHANNEL_MAPPINGS = {
    // 第1グループ
    '1355799058995740672': '1355798997255848048',
    '1355799123940343849': '1355798997255848048',
    '1355799169285095474': '1355798997255848048',
    '1355799331252342835': '1355798997255848048',
    '1355799375636332704': '1355798997255848048',
    '1365652755582287892': '1355798997255848048',
    
    // 第2グループ
    '1331169471368400920': '1331172461579862047',
    '1347022971750977546': '1331172461579862047',
    
    // 第3グループ
    '1361969199991492741': '1361969256257945661'

    // 第4グループ
    '1373576149497806958': '1373576120838131826',
    '1380749455246233650': '1373576120838131826'
};

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const DELETE_DELAY = 60000; // 1分 = 60000ミリ秒
        
        if (newState.member.user.bot) return;

        // ログを送信するチャンネルIDを取得
        const getLogChannelId = (channelId) => {
            return CHANNEL_MAPPINGS[channelId] || process.env.VOICE_LOG_CHANNEL_ID;
        };

        // ユーザーがボイスチャンネルに参加した場合
        if (!oldState.channelId && newState.channelId) {
            try {
                const logChannelId = getLogChannelId(newState.channelId);
                const channel = newState.guild.channels.cache.get(logChannelId);
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
                const logChannelId = getLogChannelId(oldState.channelId);
                const channel = oldState.guild.channels.cache.get(logChannelId);
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
                const newLogChannelId = getLogChannelId(newState.channelId);
                const oldLogChannelId = getLogChannelId(oldState.channelId);
                
                // 移動元と移動先のログチャンネルが異なる場合、両方にメッセージを送信
                if (oldLogChannelId !== newLogChannelId) {
                    const oldChannel = oldState.guild.channels.cache.get(oldLogChannelId);
                    const newChannel = newState.guild.channels.cache.get(newLogChannelId);

                    if (oldChannel) {
                        const leaveMessage = await oldChannel.send(`👋 **${oldState.member.displayName}** が ${oldState.channel.name} から退出しました`);
                        setTimeout(() => leaveMessage.delete().catch(error => {
                            console.error(chalk.red('✗ Error deleting leave message:'), error);
                        }), DELETE_DELAY);
                    }

                    if (newChannel) {
                        const joinMessage = await newChannel.send(`🎤 **${newState.member.displayName}** が ${newState.channel.name} に参加しました`);
                        setTimeout(() => joinMessage.delete().catch(error => {
                            console.error(chalk.red('✗ Error deleting join message:'), error);
                        }), DELETE_DELAY);
                    }
                } else {
                    // 同じログチャンネルの場合は移動メッセージを送信
                    const channel = newState.guild.channels.cache.get(newLogChannelId);
                    if (!channel) return;

                    const message = await channel.send(`↪️ **${newState.member.displayName}** が ${oldState.channel.name} から ${newState.channel.name} に移動しました`);
                    console.log(chalk.green(`✓ Voice Log: ${newState.member.user.username} moved from ${oldState.channel.name} to ${newState.channel.name}`));
                    
                    setTimeout(() => {
                        message.delete().catch(error => {
                            console.error(chalk.red('✗ Error deleting move message:'), error);
                        });
                    }, DELETE_DELAY);
                }
            } catch (error) {
                console.error(chalk.red('✗ Error logging voice channel move:'), error);
            }
        }
    },
};
