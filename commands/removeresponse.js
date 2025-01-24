// commands/removeresponse.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeresponse')
        .setDescription('カスタムレスポンスを削除します')
        .addStringOption(option =>
            option.setName('trigger')
                .setDescription('削除するトリガーワード')
                .setRequired(true)),
    async execute(interaction) {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        
        if (!interaction.client.customResponses.has(trigger)) {
            await interaction.reply({
                content: 'そのトリガーワードは存在しません。',
                ephemeral: true
            });
            return;
        }
        
        interaction.client.customResponses.delete(trigger);
        saveCustomResponses();
        
        await interaction.reply({
            content: `トリガー: "${trigger}" を削除しました。`,
            ephemeral: true
        });
    },
};