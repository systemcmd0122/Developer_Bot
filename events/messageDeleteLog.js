const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // 転送先チャンネルのID
        const LOG_CHANNEL_ID = '1361980143568158901';

        try {
            // ボットのメッセージは無視
            if (message.author?.bot) return;

            // 転送先チャンネルのメッセージは無視（ループ防止）
            if (message.channel.id === LOG_CHANNEL_ID) return;

            const logChannel = message.client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) return;

            // メッセージ内容の構築
            let attachmentInfo = '';
            if (message.attachments.size > 0) {
                attachmentInfo = '\n\n**添付ファイル**\n' + 
                    message.attachments.map(attachment => 
                        `• ${attachment.name} (${attachment.url})`
                    ).join('\n');
            }

            // メッセージ削除ログの送信
            await logChannel.send({
                embeds: [{
                    color: 0xff0000,
                    title: '🗑️ メッセージが削除されました',
                    description: `
                      サーバー: ${message.guild ? message.guild.name : 'DMチャンネル'}
                      チャンネル: ${message.channel.name ? `#${message.channel.name}` : 'DMチャンネル'}
                      送信者: ${message.author?.tag || '不明'}
                      
                      **削除されたメッセージ**
                      \`\`\`
                      ${message.content || '(内容なし)'}
                      \`\`\`
                      ${attachmentInfo}`,
                    timestamp: new Date()
                }]
            });

            // 画像が添付されていた場合、可能な限り保存された画像を送信
            if (message.attachments.size > 0) {
                message.attachments.forEach(async attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        try {
                            await logChannel.send({
                                embeds: [{
                                    color: 0xff0000,
                                    description: '削除された画像',
                                    image: { url: attachment.proxyURL }
                                }]
                            });
                        } catch (error) {
                            console.error(chalk.red('Error sending deleted image:'), error);
                        }
                    }
                });
            }

            console.log(chalk.red(`✓ Logged message deletion in ${message.guild?.name || 'DM'} - #${message.channel.name || 'DM'}`));
        } catch (error) {
            console.error(chalk.red('Error in messageDeleteLog:'), error);
        }
    },
};
