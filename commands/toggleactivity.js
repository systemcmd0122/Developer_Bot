// commands/toggleactivity.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'activitySettings.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toggleactivity')
        .setDescription('ゲームアクティビティの通知設定を切り替えます'),
    
    async execute(interaction) {
        try {
            // 設定ファイルの読み込み
            let settings = {};
            try {
                const data = await fs.readFile(SETTINGS_FILE, 'utf8');
                settings = JSON.parse(data);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            const userId = interaction.user.id;
            const currentSetting = settings[userId] || true; // デフォルトは通知オン
            settings[userId] = !currentSetting;

            // data ディレクトリが存在しない場合は作成
            await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
            
            // 設定の保存
            await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));

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