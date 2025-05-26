const { Events, EmbedBuilder } = require('discord.js');

// エージェントのリスト
const DUELISTS = ['フェニックス', 'ジェット', 'レイナ', 'レイズ', 'ヨル', 'ネオン', 'アイソ', 'ウェイレイ'];
const INITIATORS = ['ソーヴァ', 'ブリーチ', 'スカイ', 'KAY/O', 'フェイド', 'ゲッコー', 'テホ'];
const SENTINELS = ['セージ', 'キルジョイ', 'サイファー', 'チェンバー', 'デッドロック', 'ヴァイス'];
const CONTROLLERS = ['ブリムストーン', 'ヴァイパー', 'オーメン', 'アストラ', 'ハーバー', 'クローヴ'];
const ALL_AGENTS = [...DUELISTS, ...INITIATORS, ...SENTINELS, ...CONTROLLERS];

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // メッセージの内容をチェック
        let agentPool;
        let roleTitle = '';
        
        switch (message.content) {
            case 'ランダムデュエ':
                agentPool = DUELISTS;
                roleTitle = 'デュエリスト';
                break;
            case 'ランダムイニシ':
                agentPool = INITIATORS;
                roleTitle = 'イニシエーター';
                break;
            case 'ランダムコントローラー':
                agentPool = CONTROLLERS;
                roleTitle = 'コントローラー';
                break;
            case 'ランダムセンチ':
                agentPool = SENTINELS;
                roleTitle = 'センチネル';
                break;
            case 'エージェント':
                agentPool = ALL_AGENTS;
                roleTitle = 'エージェント';
                break;
            default:
                return;
        }

        // メッセージが送信されたチャンネルのカテゴリーを取得
        const category = message.channel.parent;
        
        if (!category) {
            await message.reply({
                content: 'このチャンネルはカテゴリーに属していません。'
            });
            return;
        }

        // カテゴリー内のボイスチャンネルを取得
        const voiceChannels = category.children.cache.filter(channel => channel.type === 2);

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

        // ランダムでユーザーとエージェントを選択
        const selectedUser = voiceUsers[Math.floor(Math.random() * voiceUsers.length)];
        const selectedAgent = agentPool[Math.floor(Math.random() * agentPool.length)];

        const embed = new EmbedBuilder()
            .setTitle(`🎯 ランダム${roleTitle}選択`)
            .setDescription(`${selectedUser} さんは **${selectedAgent}** で戦います！`)
            .setColor('#FFA500')
            .setTimestamp();

        // メッセージを送信し、1分後に削除
        const reply = await message.reply({ embeds: [embed] });
        
        // 元のメッセージと返信を1分後に削除
        setTimeout(async () => {
            try {
                await message.delete();
                await reply.delete();
            } catch (error) {
                console.error('メッセージの削除に失敗しました:', error);
            }
        }, 60000); // 60000ミリ秒 = 1分
    },
};