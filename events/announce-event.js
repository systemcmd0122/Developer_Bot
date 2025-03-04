const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;
        
        // お知らせボタンのイベント処理
        if (interaction.customId.startsWith('announce-')) {
            const announceCommand = interaction.client.commands.get('announce');
            if (announceCommand && announceCommand.handleReaction) {
                try {
                    await announceCommand.handleReaction(interaction);
                } catch (error) {
                    console.error('お知らせボタン処理エラー:', error);
                    try {
                        const replyMethod = interaction.replied ? 'followUp' : 'reply';
                        await interaction[replyMethod]({
                            content: 'ボタン処理中にエラーが発生しました。',
                            ephemeral: true
                        });
                    } catch (e) {
                        console.error('エラー返信失敗:', e);
                    }
                }
            }
        }
    },
};