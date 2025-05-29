const { Events, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chalk = require('chalk');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // "適正ランク"というメッセージかどうかをチェック
        if (message.content !== '適正ランク') return;

        try {
            // タイピング開始
            await message.channel.sendTyping();

            // VALORANTランクシステム
            const ranks = [
                'アイアン',
                'ブロンズ', 
                'シルバー',
                'ゴールド',
                'プラチナ',
                'ダイヤモンド',
                'アセンダント',
                'イモータル',
                'レディアント'
            ];

            // Gemini AIモデルの設定
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.9,
                    maxOutputTokens: 1024,
                }
            });

            // 厳格な審査基準を含むプロンプト
            const prompt = `あなたはVALORANTの厳格なランク審査官です。以下のランクシステムに基づいて、ユーザー「${message.author.username}」の適正ランクを1つだけ選んで判定してください。

VALORANTランク一覧（低い順）:
1. アイアン - 初心者、基本操作を覚えている段階
2. ブロンズ - 基本的なゲーム理解はあるが、エイムやポジショニングに課題
3. シルバー - ゲームの基礎は理解しているが、戦術的思考が未熟
4. ゴールド - 中級者、基本的な戦術とエイムが安定している
5. プラチナ - 上級者の入り口、チームプレイと個人技能が向上
6. ダイヤモンド - 高いスキルレベル、戦略的思考と実行力がある
7. アセンダント - 非常に高いスキル、プロレベルに近い能力
8. イモータル - エリートプレイヤー、トッププレイヤーとの差はわずか
9. レディアント - 最高峰、プロプレイヤーレベルの実力

厳格な審査基準:
- ユーザー名やDiscordでの発言から一切の情報は得られないため、完全にランダムで判定
- 統計的に現実的な分布を考慮（アイアン～ゴールド: 70%, プラチナ～ダイヤモンド: 25%, アセンダント以上: 5%）
- 各ランクの特徴を踏まえた厳しい評価
- 過度に高いランクを安易に付与しない
- 現実的で建設的な理由を提示

以下の形式で回答してください:
適正ランク: [選択したランク名]
理由: [そのランクに判定した具体的で現実的な理由を2-3文で説明]

※必ずランク名は上記リストから1つだけ選択し、理由は建設的で現実的な内容にしてください。`;

            // AI判定を実行
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            // レスポンスから適正ランクと理由を抽出
            const rankMatch = response.match(/適正ランク[：:]\s*([^\n]+)/);
            const reasonMatch = response.match(/理由[：:]\s*([^]*)/);

            let assessedRank = 'シルバー'; // デフォルト値
            let reason = 'AI判定により、標準的なスキルレベルと評価されました。';

            if (rankMatch && rankMatch[1]) {
                const extractedRank = rankMatch[1].trim();
                // 有効なランクかチェック
                const validRank = ranks.find(rank => extractedRank.includes(rank));
                if (validRank) {
                    assessedRank = validRank;
                }
            }

            if (reasonMatch && reasonMatch[1]) {
                reason = reasonMatch[1].trim();
                // 理由の長さ制限
                if (reason.length > 300) {
                    reason = reason.substring(0, 297) + '...';
                }
            }

            // ランクに応じた色設定
            const rankColors = {
                'アイアン': '#6B4E3D',
                'ブロンズ': '#CD7F32', 
                'シルバー': '#C0C0C0',
                'ゴールド': '#FFD700',
                'プラチナ': '#00FFFF',
                'ダイヤモンド': '#B9F2FF',
                'アセンダント': '#00FF41',
                'イモータル': '#FF4654',
                'レディアント': '#FFFF9E'
            };

            // ランクに応じた絵文字
            const rankEmojis = {
                'アイアン': '⚫',
                'ブロンズ': '🟤',
                'シルバー': '⚪',
                'ゴールド': '🟡',
                'プラチナ': '🔵',
                'ダイヤモンド': '💎',
                'アセンダント': '🟢',
                'イモータル': '🔴',
                'レディアント': '🌟'
            };

            // Embed作成
            const embed = new EmbedBuilder()
                .setTitle('🎯 VALORANT 適正ランク判定')
                .setDescription(`**${message.author.username}** さんの適正ランク診断結果`)
                .addFields(
                    { 
                        name: `${rankEmojis[assessedRank]} 適正ランク`, 
                        value: `**${assessedRank}**`, 
                        inline: true 
                    },
                    { 
                        name: '📋 判定理由', 
                        value: reason, 
                        inline: false 
                    }
                )
                .setColor(rankColors[assessedRank])
                .setFooter({ 
                    text: 'Powered by Gemini AI • 診断結果は参考程度にお考えください',
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // メッセージ送信
            await message.reply({ embeds: [embed] });

            console.log(chalk.green(`✓ Rank Assessment: ${message.author.username} assessed as ${assessedRank} in #${message.channel.name}`));

        } catch (error) {
            console.error(chalk.red('✗ Error in rank assessment:'), error);
            
            // エラー時のフォールバック
            const fallbackRanks = ['アイアン', 'ブロンズ', 'シルバー', 'ゴールド'];
            const fallbackRank = fallbackRanks[Math.floor(Math.random() * fallbackRanks.length)];
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🎯 VALORANT 適正ランク判定')
                .setDescription(`**${message.author.username}** さんの適正ランク診断結果`)
                .addFields(
                    { 
                        name: `適正ランク`, 
                        value: `**${fallbackRank}**`, 
                        inline: true 
                    },
                    { 
                        name: '📋 判定理由', 
                        value: 'AI判定システムに一時的な問題が発生したため、ランダムで判定されました。後でもう一度お試しください。', 
                        inline: false 
                    }
                )
                .setColor('#FF4654')
                .setFooter({ 
                    text: 'システムエラー • 後でもう一度お試しください'
                })
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
        }
    },
};