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

        // ランダムでエージェントを選択
        const selectedAgent = agentPool[Math.floor(Math.random() * agentPool.length)];

        const embed = new EmbedBuilder()
            .setTitle(`🎯 ランダム${roleTitle}選択`)
            .setDescription(`**${selectedAgent}** が選択されました！`)
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
        }, 15000); // 15000ミリ秒 = 15秒
    },
};