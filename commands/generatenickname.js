const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

module.exports = {
    category: 'ユーティリティ',
    data: new SlashCommandBuilder()
        .setName('generatenickname')
        .setDescription('AIがニックネームを生成します')
        .addStringOption(option =>
            option
                .setName('genre')
                .setDescription('ニックネームのジャンル')
                .setRequired(true)
                .addChoices(
                    { name: 'ゲーミング', value: 'gaming' },
                    { name: 'アニメ・漫画', value: 'anime' },
                    { name: 'ファンタジー', value: 'fantasy' },
                    { name: 'サイバーパンク', value: 'cyberpunk' },
                    { name: '和風', value: 'japanese' },
                    { name: 'かわいい', value: 'cute' },
                    { name: 'クール', value: 'cool' },
                    { name: 'ミステリアス', value: 'mysterious' }
                ))
        .addStringOption(option =>
            option
                .setName('language')
                .setDescription('ニックネームの言語')
                .setRequired(true)
                .addChoices(
                    { name: '日本語', value: 'japanese' },
                    { name: '英語', value: 'english' },
                    { name: '日本語と英語のミックス', value: 'mixed' }
                ))
        .addNumberOption(option =>
            option
                .setName('length')
                .setDescription('希望する文字数（1-15文字）')
                .setMinValue(1)
                .setMaxValue(15)
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('keywords')
                .setDescription('含めたいキーワード（オプション）')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const genre = interaction.options.getString('genre');
            const language = interaction.options.getString('language');
            const length = interaction.options.getNumber('length');
            const keywords = interaction.options.getString('keywords');

            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.9,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 256,
                }
            });

            // プロンプトを構築
            let prompt = `あなたはクリエイティブなニックネームジェネレーターです。以下の条件に基づいて、ユニークで魅力的なニックネームを3つ生成してください。

ジャンル: ${getGenreDescription(genre)}
言語: ${getLanguageDescription(language)}
${length ? `文字数: ${length}文字以内` : ''}
${keywords ? `キーワード: ${keywords}` : ''}

- 各ニックネームは独創的で記憶に残るものにしてください
- ジャンルの雰囲気や特徴を反映させてください
- 返答は必ず「案1: [ニックネーム]」のような形式で、3つのニックネームを提案してください
- ニックネームの説明や理由は不要です
- 3つのニックネームだけを返してください`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // 応答を整形してEmbedを作成
            const embed = new EmbedBuilder()
                .setTitle('🎯 ニックネームの提案')
                .setDescription(responseText)
                .addFields(
                    { name: 'ジャンル', value: getGenreDescription(genre), inline: true },
                    { name: '言語', value: getLanguageDescription(language), inline: true }
                )
                .setColor(getGenreColor(genre))
                .setFooter({ text: 'Powered by Gemini AI' })
                .setTimestamp();

            if (keywords) {
                embed.addFields({ name: 'キーワード', value: keywords, inline: true });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error generating nickname:', error);
            await interaction.editReply('ニックネームの生成中にエラーが発生しました。後でもう一度お試しください。');
        }
    }
};

// ジャンルの説明を取得
function getGenreDescription(genre) {
    const descriptions = {
        gaming: 'ゲーミング',
        anime: 'アニメ・漫画',
        fantasy: 'ファンタジー',
        cyberpunk: 'サイバーパンク',
        japanese: '和風',
        cute: 'かわいい',
        cool: 'クール',
        mysterious: 'ミステリアス'
    };
    return descriptions[genre] || genre;
}

// 言語の説明を取得
function getLanguageDescription(language) {
    const descriptions = {
        japanese: '日本語',
        english: '英語',
        mixed: '日本語と英語のミックス'
    };
    return descriptions[language] || language;
}

// ジャンルに応じた色を取得
function getGenreColor(genre) {
    const colors = {
        gaming: '#FF6B6B',     // 赤系
        anime: '#FFB5E8',      // ピンク系
        fantasy: '#B5EAEA',    // 水色系
        cyberpunk: '#7209B7',  // 紫系
        japanese: '#B5EAD7',   // 和風緑
        cute: '#FFC6FF',       // パステルピンク
        cool: '#4361EE',       // クールブルー
        mysterious: '#2D3142'  // ダークグレー
    };
    return colors[genre] || '#FF6B6B';
}