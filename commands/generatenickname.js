const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// 権限を持つロールのID
const ADMIN_ROLE_ID = '1336993137406771272';

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
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('target')
                .setDescription('ニックネームを生成する対象')
                .setRequired(true)
                .addChoices(
                    { name: '自分のみ', value: 'self' },
                    { name: 'サーバー全員（要管理者権限）', value: 'all' }
                ))
        .addBooleanOption(option =>
            option
                .setName('apply')
                .setDescription('生成したニックネームを自動で適用するかどうか')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const genre = interaction.options.getString('genre');
            const language = interaction.options.getString('language');
            const length = interaction.options.getNumber('length');
            const keywords = interaction.options.getString('keywords');
            const target = interaction.options.getString('target');
            const shouldApply = interaction.options.getBoolean('apply') || false;

            // 全員対象の場合は管理者権限をチェック
            if (target === 'all' && !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
                await interaction.editReply({
                    content: 'サーバー全員のニックネームを生成するには管理者権限が必要です。',
                    ephemeral: true
                });
                return;
            }

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
            let prompt = `あなたはクリエイティブなニックネームジェネレーターです。以下の条件に基づいて、ユニークで魅力的なニックネームを${target === 'all' ? '10' : '3'}つ生成してください。

ジャンル: ${getGenreDescription(genre)}
言語: ${getLanguageDescription(language)}
${length ? `文字数: ${length}文字以内` : ''}
${keywords ? `キーワード: ${keywords}` : ''}

- 各ニックネームは独創的で記憶に残るものにしてください
- ジャンルの雰囲気や特徴を反映させてください
- 返答は必ず「案1: [ニックネーム]」のような形式で提案してください
- ニックネームの説明や理由は不要です
- ${target === 'all' ? '10' : '3'}つのニックネームだけを返してください`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const nicknames = responseText.split('\n').filter(line => line.trim() !== '');

            if (target === 'self') {
                // 自分用の生成結果を表示
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

                // 自動適用が有効な場合、最初のニックネームを設定
                if (shouldApply && interaction.member.manageable) {
                    const firstNickname = nicknames[0].split(': ')[1];
                    try {
                        await interaction.member.setNickname(firstNickname);
                        embed.addFields({ 
                            name: '自動適用', 
                            value: `✅ ニックネームを「${firstNickname}」に変更しました`,
                            inline: false 
                        });
                    } catch (error) {
                        console.error('Error setting nickname:', error);
                        embed.addFields({ 
                            name: 'エラー', 
                            value: '❌ ニックネームの変更に失敗しました',
                            inline: false 
                        });
                    }
                }

                await interaction.editReply({ embeds: [embed] });

            } else {
                // サーバー全員用の生成結果を表示
                const members = await interaction.guild.members.fetch();
                const realMembers = members.filter(member => !member.user.bot);

                const embed = new EmbedBuilder()
                    .setTitle('🎯 サーバー全体のニックネーム候補')
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

                // 自動適用が有効な場合、ランダムに割り当て
                if (shouldApply) {
                    let successCount = 0;
                    let errorCount = 0;
                    let index = 0;

                    for (const [, member] of realMembers) {
                        if (member.manageable && index < nicknames.length) {
                            const nickname = nicknames[index].split(': ')[1];
                            try {
                                await member.setNickname(nickname);
                                successCount++;
                            } catch (error) {
                                console.error(`Error setting nickname for ${member.user.tag}:`, error);
                                errorCount++;
                            }
                            index = (index + 1) % nicknames.length;
                        }
                    }

                    embed.addFields({ 
                        name: '自動適用結果', 
                        value: `✅ 成功: ${successCount}人\n❌ 失敗: ${errorCount}人`,
                        inline: false 
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

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