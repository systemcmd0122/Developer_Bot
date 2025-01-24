// commands/addresponse.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addresponse')
        .setDescription('カスタムレスポンスを追加します')
        .addStringOption(option =>
            option.setName('trigger')
                .setDescription('反応するメッセージ')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('response')
                .setDescription('返信するメッセージ')
                .setRequired(true)),
    async execute(interaction) {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        const response = interaction.options.getString('response');
        
        interaction.client.customResponses.set(trigger, response);
        saveCustomResponses();
        
        await interaction.reply({
            content: `トリガー: "${trigger}" に対するレスポンス: "${response}" を追加しました。`,
            ephemeral: true
        });
    },
};