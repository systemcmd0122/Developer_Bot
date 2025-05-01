const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // "エージェント"というメッセージかどうかをチェック
        if (message.content !== 'エージェント') return;

        // メッセージが送信されたチャンネルのカテゴリーを取得
        const category = message.channel.parent;
        
        if (!category) {
            await message.reply({
                content: 'このチャンネルはカテゴリーに属していません。'
            });
            return;
        }

        // カテゴリー内のボイスチャンネルを取得
        const voiceChannels = category.children.cache.filter(channel => channel.type === 2); // 2 はVoiceChannelを表す

        if (voiceChannels.size === 0) {
            await message.reply({
                content: 'このカテゴリーにはボイスチャンネルがありません。'
            });
            return;
        }

        // すべてのボイスチャンネルからユーザーを収集
        let voiceUsers = [];
        voiceChannels.forEach(channel => {
            channel.members.forEach(member => {
                voiceUsers.push(member);
            });
        });

        // VCにユーザーがいない場合
        if (voiceUsers.length === 0) {
            await message.reply({
                content: 'カテゴリー内のVCにユーザーがいません。'
            });
            return;
        }

        // ランダムでユーザーを1人選択
        const selectedUser = voiceUsers[Math.floor(Math.random() * voiceUsers.length)];

        const embed = new EmbedBuilder()
            .setTitle('🎯 エージェント選択')
            .setDescription(`選ばれたのは ${selectedUser} さんです！`)
            .setColor('#FFA500')
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};