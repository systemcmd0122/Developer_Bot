// commands/toggleactivity.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadSettings, saveSettings } = require('../utils/settings');

module.exports = {
    category: 'ボット管理',
    data: new SlashCommandBuilder()
        .setName('toggleactivity')
        .setDescription('ゲームアクティビティの通知設定を切り替えます')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('設定を変更するユーザー（管理者のみ）')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const settings = await loadSettings();
            const targetUser = interaction.options.getUser('user');
            const hasAdminRole = interaction.member.roles.cache.has('1331169550728957982');

            // 他のユーザーの設定を変更しようとする場合の権限チェック
            if (targetUser && !hasAdminRole) {
                return await interaction.reply({
                    content: '他のユーザーの設定を変更する権限がありません。',
                    ephemeral: true
                });
            }

            const userId = targetUser ? targetUser.id : interaction.user.id;
            const currentSetting = settings[userId] ?? true; // デフォルトは通知オン
            settings[userId] = !currentSetting;
            
            await saveSettings(settings);

            const status = settings[userId] ? 'オン' : 'オフ';
            const userText = targetUser ? `${targetUser.username}のゲームアクティビティの通知` : 'ゲームアクティビティの通知';
            
            await interaction.reply({
                content: `${userText}を${status}に設定しました。`,
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