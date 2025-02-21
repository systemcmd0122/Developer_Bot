// commands/viewactivity.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadSettings } = require('../utils/settings');

module.exports = {
    category: 'ボット管理',
    data: new SlashCommandBuilder()
        .setName('viewactivity')
        .setDescription('現在のゲームアクティビティ通知設定を確認します')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('設定を確認するユーザー（管理者のみ）')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const settings = await loadSettings();
            const targetUser = interaction.options.getUser('user');
            const hasAdminRole = interaction.member.roles.cache.has('1331169550728957982');

            // 他のユーザーの設定を確認しようとする場合の権限チェック
            if (targetUser && !hasAdminRole) {
                return await interaction.reply({
                    content: '他のユーザーの設定を確認する権限がありません。',
                    ephemeral: true
                });
            }

            const userId = targetUser ? targetUser.id : interaction.user.id;
            const userSetting = settings[userId];
            
            // undefined の場合はデフォルトでオン
            const status = userSetting === false ? 'オフ' : 'オン';
            
            const userText = targetUser ? `${targetUser.username}のゲームアクティビティ通知` : 'あなたのゲームアクティビティ通知';
            const commandHelp = targetUser && hasAdminRole 
                ? `\n設定を変更するには \`/toggleactivity user:${targetUser.username}\` コマンドを使用してください。`
                : '\n設定を変更するには `/toggleactivity` コマンドを使用してください。';

            await interaction.reply({
                content: `${userText}は現在${status}に設定されています。${commandHelp}`,
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