const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // "ランダム武器"というメッセージかどうかをチェック
        if (message.content !== 'ランダム武器') return;

        // 武器データ
        const weapons = [
            { name: 'クラシック', type: 'サイドアーム', price: '無料' },
            { name: 'ショーティー', type: 'サイドアーム', price: '300' },
            { name: 'フレンジー', type: 'サイドアーム', price: '450' },
            { name: 'ゴースト', type: 'サイドアーム', price: '500' },
            { name: 'シェリフ', type: 'サイドアーム', price: '800' },
            { name: 'スティンガー', type: 'サブマシンガン', price: '1,100' },
            { name: 'スペクター', type: 'サブマシンガン', price: '1,600' },
            { name: 'バッキー', type: 'ショットガン', price: '850' },
            { name: 'ジャッジ', type: 'ショットガン', price: '1,850' },
            { name: 'ブルドッグ', type: 'ライフル', price: '2,050' },
            { name: 'ガーディアン', type: 'ライフル', price: '2,250' },
            { name: 'ヴァンダル', type: 'ライフル', price: '2,900' },
            { name: 'ファントム', type: 'ライフル', price: '2,900' },
            { name: 'マーシャル', type: 'スナイパー', price: '950' },
            { name: 'オペレーター', type: 'スナイパー', price: '4,700' },
            { name: 'アレス', type: 'マシンガン', price: '1,600' },
            { name: 'オーディン', type: 'マシンガン', price: '3,200' },
            { name: 'アウトロー', type: 'スナイパー', price: '2,400' }
        ];

        // ランダムで武器を1つ選択
        const selectedWeapon = weapons[Math.floor(Math.random() * weapons.length)];

        // 武器情報を表示するEmbed
        const embed = new EmbedBuilder()
            .setTitle('🔫 ランダム武器選択')
            .setDescription(`今回の武器は **${selectedWeapon.name}** です！`)
            .addFields(
                { name: '武器名', value: selectedWeapon.name, inline: true },
                { name: '武器タイプ', value: selectedWeapon.type, inline: true },
                { name: '値段', value: selectedWeapon.price, inline: true }
            )
            .setColor('#FF4654') // VALORANTの赤色
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
