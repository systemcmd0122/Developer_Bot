// utils/settings.js
const supabase = require('./supabase');

async function loadSettings() {
    try {
        const { data, error } = await supabase
            .from('activity_settings')
            .select('user_id, notification_enabled');

        if (error) {
            console.error('Error loading settings from Supabase:', error);
            return {};
        }

        // データを適切な形式に変換
        const settings = {};
        for (const item of data) {
            settings[item.user_id] = item.notification_enabled;
        }
        
        return settings;
    } catch (error) {
        console.error('Error in loadSettings:', error);
        return {};
    }
}

async function saveSettings(settings) {
    try {
        // 既存のデータをすべて削除（非効率だが最も単純な方法）
        const { error: deleteError } = await supabase
            .from('activity_settings')
            .delete()
            .neq('id', 0); // 全レコードを削除するためのダミー条件

        if (deleteError) {
            console.error('Error deleting existing settings:', deleteError);
            throw deleteError;
        }

        // 新しいデータをバッチで挿入
        const settingsArray = Object.entries(settings).map(([user_id, notification_enabled]) => ({
            user_id,
            notification_enabled
        }));

        if (settingsArray.length === 0) return; // 保存するデータがない場合は終了

        const { error: insertError } = await supabase
            .from('activity_settings')
            .insert(settingsArray);

        if (insertError) {
            console.error('Error saving settings to Supabase:', insertError);
            throw insertError;
        }
    } catch (error) {
        console.error('Error in saveSettings:', error);
        throw error;
    }
}

module.exports = { loadSettings, saveSettings };