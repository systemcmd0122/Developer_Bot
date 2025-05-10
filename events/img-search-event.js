const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // リプライかつ「画像検索」というメッセージかどうかをチェック
        if (!message.reference || message.content.trim().toLowerCase() !== '画像検索') return;

        try {
            // リプライ元のメッセージを取得
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            
            // リプライ元に画像が添付されているかチェック
            const attachment = repliedMessage.attachments.first();
            if (!attachment) {
                if (repliedMessage.embeds.length > 0 && repliedMessage.embeds[0].image) {
                    // 埋め込み画像のURLを取得
                    await processImageSearch(message, repliedMessage.embeds[0].image.url);
                } else {
                    await message.reply({
                        content: '返信元のメッセージに画像が添付されていません。'
                    });
                }
                return;
            }

            // 添付ファイルが画像かどうかチェック
            const isImage = attachment.contentType && attachment.contentType.startsWith('image/');
            if (!isImage) {
                await message.reply({
                    content: '返信元のメッセージに添付されているファイルは画像ではありません。'
                });
                return;
            }

            // 画像のURLを取得して画像検索を実行
            await processImageSearch(message, attachment.url);

        } catch (error) {
            console.error('画像検索処理中にエラーが発生しました:', error);
            await message.reply({
                content: '画像検索処理中にエラーが発生しました。'
            });
        }
    },
};

/**
 * 画像検索を実行し結果を送信する関数
 * @param {Object} message - リプライメッセージオブジェクト
 * @param {string} imageUrl - 検索対象の画像URL
 */
async function processImageSearch(message, imageUrl) {
    try {
        // Google画像検索のURL生成（エンコードして安全なURLにする）
        const googleSearchUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`;
        
        // 検索結果を埋め込みとして作成
        const embed = new EmbedBuilder()
            .setTitle('🔍 画像検索結果')
            .setDescription(`[Google画像検索で見る](${googleSearchUrl})`)
            .setThumbnail(imageUrl)
            .setColor('#4285F4') // Googleのブルー
            .setFooter({ text: '元の画像のサムネイルを表示しています' })
            .setTimestamp();

        // ボタンを追加したメッセージを送信
        await message.reply({ 
            embeds: [embed]
        });
    } catch (error) {
        console.error('画像検索結果の生成中にエラーが発生しました:', error);
        await message.reply({
            content: '画像検索結果の生成中にエラーが発生しました。'
        });
    }
}