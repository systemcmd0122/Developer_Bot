// commands/listresponses.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listresponses')
        .setDescription('設定されているカスタムレスポンスの一覧を表示します'),
    async execute(interaction) {
        const responses = interaction.client.customResponses;
        
        if (responses.size === 0) {
            await interaction.reply({
                content: 'カスタムレスポンスが設定されていません。',
                ephemeral: true
            });
            return;
        }
        
        const responseList = Array.from(responses)
            .map(([trigger, response]) => `・"${trigger}" → "${response}"`)
            .join('\n');
        
        await interaction.reply({
            content: `現在のカスタムレスポンス一覧:\n${responseList}`,
            ephemeral: true
        });
    },
};