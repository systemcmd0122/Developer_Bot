const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // "ランダムエージェント"というメッセージかどうかをチェック
        if (message.content !== 'ランダムエージェント') return;

        // エージェントのリスト
        const agents = [
            'ブリムストーン',
            'フェニックス',
            'セージ',
            'ソーヴァ',
            'ヴァイパー',
            'サイファー',
            'レイナ',
            'キルジョイ',
            'ブリーチ',
            'オーメン',
            'ジェット',
            'レイズ',
            'スカイ',
            'ヨル',
            'アストラ',
            'KAY/O',
            'チェンバー',
            'ネオン',
            'フェイド',
            'ハーバー',
            'ゲッコー',
            'デッドロック',
            'アイソ',
            'クローヴ',
            'ヴァイス',
            'テホ',
            'ウェイレイ'
        ];

        // ランダムでエージェントを1つ選択
        const selectedAgent = agents[Math.floor(Math.random() * agents.length)];

        // エージェント情報を表示するEmbed
        const embed = new EmbedBuilder()
            .setTitle('👤 ランダムエージェント選択')
            .setDescription(`選ばれたエージェントは **${selectedAgent}** です！`)
            .setColor('#FF4654') // VALORANTの赤色
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};