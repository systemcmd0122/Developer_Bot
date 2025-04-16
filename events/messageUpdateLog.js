const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // 転送先チャンネルのID
        const LOG_CHANNEL_ID = '1361980143568158901';

        try {
            // ボットのメッセージは無視
            if (oldMessage.author?.bot) return;

            // 転送先チャンネルのメッセージは無視（ループ防止）
            if (oldMessage.channel.id === LOG_CHANNEL_ID) return;

            // 内容が同じ場合は無視（埋め込みの自動展開などによる更新）
            if (oldMessage.content === newMessage.content) return;

            const logChannel = oldMessage.client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) return;

            // メッセージ編集ログの送信
            await logChannel.send({
                embeds: [{
                    color: 0xffaa00,
                    title: '🔄 メッセージが編集されました',
                    description: `
                      サーバー: ${oldMessage.guild ? oldMessage.guild.name : 'DMチャンネル'}
                      チャンネル: ${oldMessage.channel.name ? `#${oldMessage.channel.name}` : 'DMチャンネル'}
                      送信者: ${oldMessage.author?.tag || '不明'}
                      
                      **編集前**
                      \`\`\`
                      ${oldMessage.content || '(内容なし)'}
                      \`\`\`
                      **編集後**
                      \`\`\`
                      ${newMessage.content || '(内容なし)'}
                      \`\`\`
                      
                      [メッセージへジャンプ](${newMessage.url})`,
                    timestamp: new Date()
                }]
            });

            console.log(chalk.yellow(`✓ Logged message edit in ${oldMessage.guild?.name || 'DM'} - #${oldMessage.channel.name || 'DM'}`));
        } catch (error) {
            console.error(chalk.red('Error in messageUpdateLog:'), error);
        }
    },
};
