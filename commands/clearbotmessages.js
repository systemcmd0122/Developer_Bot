const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearbotmessages')
        .setDescription('指定したチャンネルのボットメッセージをすべて削除します')
        .setDefaultMemberPermissions(0x0000000000000008) // ADMINISTRATOR権限が必要
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('メッセージを削除するチャンネル')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // 処理開始を通知
            await interaction.deferReply({ ephemeral: true });

            // チャンネルの取得（指定がない場合は現在のチャンネル）
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            let deletedCount = 0;
            let failedCount = 0;

            // 進捗メッセージの送信
            await interaction.editReply({ content: '🔍 ボットメッセージを検索中...', ephemeral: true });

            try {
                let lastId = null;
                while (true) {
                    // メッセージを取得（最大100件ずつ）
                    const messages = await targetChannel.messages.fetch({
                        limit: 100,
                        ...(lastId && { before: lastId })
                    });

                    if (messages.size === 0) break;

                    // 最後のメッセージIDを保存
                    lastId = messages.last().id;

                    // ボットのメッセージを抽出
                    const botMessages = messages.filter(msg => msg.author.bot);
                    
                    if (botMessages.size > 0) {
                        try {
                            // ボットメッセージの削除
                            await targetChannel.bulkDelete(botMessages);
                            deletedCount += botMessages.size;

                            // 進捗の更新
                            await interaction.editReply({
                                content: `🗑️ ${deletedCount}件のメッセージを削除中...`,
                                ephemeral: true
                            });
                        } catch (error) {
                            console.error('Bulk delete failed:', error);
                            // 2週間以上経過したメッセージは個別に削除
                            for (const [, message] of botMessages) {
                                try {
                                    await message.delete();
                                    deletedCount++;
                                } catch (err) {
                                    failedCount++;
                                    console.error('Individual delete failed:', err);
                                }
                            }
                        }
                    }

                    // API制限を考慮して少し待機
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 完了メッセージの送信
                let resultMessage = `✅ ${targetChannel.name} で ${deletedCount}件のボットメッセージを削除しました。`;
                if (failedCount > 0) {
                    resultMessage += `\n⚠️ ${failedCount}件のメッセージは削除できませんでした。`;
                }
                await interaction.editReply({
                    content: resultMessage,
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error in message deletion process:', error);
                await interaction.editReply({
                    content: '❌ メッセージの削除中にエラーが発生しました。',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Command execution error:', error);
            try {
                await interaction.editReply({
                    content: '❌ コマンドの実行中にエラーが発生しました。',
                    ephemeral: true
                });
            } catch {
                // 応答がまだ送られていない場合
                await interaction.reply({
                    content: '❌ コマンドの実行中にエラーが発生しました。',
                    ephemeral: true
                });
            }
        }
    },
};