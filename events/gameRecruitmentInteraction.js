const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;
        
        // ボタンのカスタムIDをチェック
        const [action, roleId] = interaction.customId.split('_');
        if (action !== 'join') return;

        try {
            // InteractionManagerから募集情報を取得
            const recruitData = interaction.client.interactionManager.getButtonInteraction(interaction.message.id);
            if (!recruitData) {
                await interaction.reply({ content: 'この募集は見つかりませんでした。', ephemeral: true });
                return;
            }

            const { participants, gameConfig } = recruitData;
            const participantSet = new Set(participants);

            // 既に参加している場合
            if (participantSet.has(interaction.user.id)) {
                await interaction.reply({ content: '既に参加しています。', ephemeral: true });
                return;
            }

            // 参加者を追加
            participantSet.add(interaction.user.id);

            // Embedの更新
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '募集者', value: interaction.message.embeds[0].fields[0].value },
                    { name: '参加者', value: Array.from(participantSet).map(id => `<@${id}>`).join('\n') }
                );

            // メッセージを更新
            await interaction.update({
                embeds: [updatedEmbed]
            });

            // InteractionManagerの情報を更新
            recruitData.participants = Array.from(participantSet);
            interaction.client.interactionManager.saveButtonInteraction(interaction.message.id, recruitData);

            console.log(chalk.green(`User ${interaction.user.tag} joined the game recruitment`));

        } catch (error) {
            console.error(chalk.red('Error handling game recruitment interaction:'), error);
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
        }
    }
};