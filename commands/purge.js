const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('指定したユーザーのメッセージを削除します')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('メッセージを削除するユーザー')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('削除するメッセージ数 (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('削除理由（オプション）'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        try {
            // 管理者権限の確認
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ 
                    content: '❌ このコマンドは管理者のみ使用できます。', 
                    ephemeral: true 
                });
            }

            await interaction.deferReply({ ephemeral: true });
            
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason') || '理由なし';
            const channel = interaction.channel;
            
            // 最新の100メッセージを取得
            const messages = await channel.messages.fetch({ limit: 100 });
            
            // 指定したユーザーのメッセージをフィルタリング
            const userMessages = messages.filter(msg => msg.author.id === targetUser.id);
            
            // 指定数のメッセージを選択
            const messagesToDelete = userMessages.first(amount);
            
            if (messagesToDelete.length === 0) {
                return interaction.editReply({
                    content: `❌ ${targetUser.username} の最近のメッセージが見つかりませんでした。`,
                    ephemeral: true
                });
            }
            
            // メッセージをバルク削除（14日以内のメッセージのみ）
            const recentMessages = messagesToDelete.filter(msg => {
                const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                return msg.createdTimestamp > twoWeeksAgo;
            });
            
            if (recentMessages.length > 0) {
                await channel.bulkDelete(recentMessages)
                    .catch(error => {
                        console.error('メッセージのバルク削除中にエラーが発生しました:', error);
                        throw error;
                    });
            }
            
            // 14日以上前のメッセージを個別に削除
            const oldMessages = messagesToDelete.filter(msg => {
                const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                return msg.createdTimestamp <= twoWeeksAgo;
            });
            
            for (const message of oldMessages) {
                await message.delete().catch(error => {
                    console.error('古いメッセージの削除中にエラーが発生しました:', error);
                });
            }
            
            // 実行結果を通知
            await interaction.editReply({
                content: `✅ ${targetUser.username} のメッセージを ${messagesToDelete.length} 件削除しました。\n理由: ${reason}`,
                ephemeral: true
            });
            
            // 監査ログ用のメッセージをコンソールに出力
            console.log(`[PURGE] ${interaction.user.tag} が ${targetUser.tag} のメッセージを ${messagesToDelete.length} 件削除しました。理由: ${reason}`);
            
        } catch (error) {
            console.error('purgeコマンド実行中にエラーが発生しました:', error);
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ メッセージの削除中にエラーが発生しました。',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ メッセージの削除中にエラーが発生しました。',
                    ephemeral: true
                });
            }
        }
    }
};