// commands/viewactivity.js
const { SlashCommandBuilder } = require('discord.js');
const { loadSettings } = require('../utils/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewactivity')
        .setDescription('現在のゲームアクティビティ通知設定を確認します'),
    
    async execute(interaction) {
        try {
            const settings = await loadSettings();
            const userSetting = settings[interaction.user.id];
            
            // undefined の場合はデフォルトでオン
            const status = userSetting === false ? 'オフ' : 'オン';
            
            await interaction.reply({
                content: `あなたのゲームアクティビティ通知は現在${status}に設定されています。\n設定を変更するには \`/toggleactivity\` コマンドを使用してください。`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in viewactivity command:', error);
            await interaction.reply({
                content: '設定の確認中にエラーが発生しました。',
                ephemeral: true
            });
        }
    }
};