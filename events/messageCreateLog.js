const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 転送先チャンネルのID
        const LOG_CHANNEL_ID = '1361973547035263027';

        try {
            // ボットのメッセージは無視
            if (message.author.bot) return;

            // 転送先チャンネルのメッセージは無視（ループ防止）
            if (message.channel.id === LOG_CHANNEL_ID) return;

            // 転送先チャンネルを取得
            const logChannel = message.client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) return;

            let shouldForward = false;
            let forwardContent = '';

            // 画像の確認
            const hasAttachments = message.attachments.size > 0;
            const attachmentUrls = [];
            if (hasAttachments) {
                message.attachments.forEach(attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        attachmentUrls.push(attachment.url);
                        shouldForward = true;
                    }
                });
            }

            // リンクの確認
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.content.match(urlRegex);
            if (links) {
                shouldForward = true;
                forwardContent += `リンク検出:\n${links.join('\n')}\n`;
            }

            // 転送が必要な場合
            if (shouldForward) {
                // メッセージ内容の構築
                const serverName = message.guild ? `サーバー: ${message.guild.name}` : 'DMチャンネル';
                const channelName = message.channel.name ? `チャンネル: #${message.channel.name}` : 'DMチャンネル';
                const author = `送信者: ${message.author.tag}`;
                
                let embedDescription = `${serverName}\n${channelName}\n${author}\n\n`;
                if (forwardContent) {
                    embedDescription += forwardContent;
                }

                // 元のメッセージへのジャンプリンク
                const jumpLink = `[メッセージへジャンプ](${message.url})`;
                embedDescription += `\n${jumpLink}`;

                try {
                    // 画像とリンクを含むメッセージを転送
                    await logChannel.send({
                        embeds: [{
                            color: 0x0099ff,
                            description: embedDescription,
                            timestamp: new Date(),
                            image: attachmentUrls.length > 0 ? { url: attachmentUrls[0] } : null
                        }]
                    });

                    // 追加の画像がある場合は別のメッセージとして送信
                    if (attachmentUrls.length > 1) {
                        for (let i = 1; i < attachmentUrls.length; i++) {
                            await logChannel.send({
                                embeds: [{
                                    color: 0x0099ff,
                                    image: { url: attachmentUrls[i] }
                                }]
                            });
                        }
                    }

                    console.log(chalk.green(`✓ Forwarded content from ${message.guild?.name || 'DM'} - #${message.channel.name || 'DM'}`));
                } catch (error) {
                    console.error(chalk.red('Error forwarding content:'), error);
                }
            }
        } catch (error) {
            console.error(chalk.red('Error in messageCreateLog:'), error);
        }
    },
};
