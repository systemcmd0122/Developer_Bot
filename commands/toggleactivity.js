// commands/toggleactivity.js
const { SlashCommandBuilder } = require('discord.js');
const { loadSettings, saveSettings } = require('../utils/settings');

module.exports = {
    category: 'ボット管理',
    data: new SlashCommandBuilder()
        .setName('toggleactivity')
        .setDescription('ゲームアクティビティの通知設定を切り替えます'),
    
    async execute(interaction) {
        try {
            const settings = await loadSettings();
            const userId = interaction.user.id;
            const currentSetting = settings[userId] ?? true; // デフォルトは通知オン
            settings[userId] = !currentSetting;
            
            await saveSettings(settings);

            const status = settings[userId] ? 'オン' : 'オフ';
            await interaction.reply({
                content: `ゲームアクティビティの通知を${status}に設定しました。`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in toggleactivity command:', error);
            await interaction.reply({
                content: '設定の変更中にエラーが発生しました。',
                ephemeral: true
            });
        }
    }
};