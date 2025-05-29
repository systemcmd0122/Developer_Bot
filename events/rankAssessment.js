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

            // 完全ランダムでランクを選択
            const selectedRank = ranks[Math.floor(Math.random() * ranks.length)];

            // Gemini AIモデルの設定
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.9,
                    topK: 50,
                    topP: 0.95,
                    maxOutputTokens: 200,
                }
            });

            // ランクに応じた理由生成のプロンプト
            const prompt = `あなたはVALORANTの面白いランク判定システムです。
            
ユーザー「${message.author.username}」が「${selectedRank}」ランクに判定されました。

このランクに判定された理由を、以下の条件で生成してください：
- 2-3文程度の短い文章
- そのランクらしい特徴や能力について言及
- 建設的で前向きな内容
- ユーザー名から想像できる要素があれば軽く織り交ぜる
- 毎回異なる理由になるよう創造的に
- ランク名は含めない（既に表示されるため）

${selectedRank}ランクの特徴:
- アイアン: 初心者、基本操作習得中
- ブロンズ: 基礎は理解、エイムとポジショニングに課題
- シルバー: ゲーム基礎は理解、戦術的思考が未熟
- ゴールド: 中級者、基本戦術とエイムが安定
- プラチナ: 上級者入り口、チームプレイと個人技能向上
- ダイヤモンド: 高スキル、戦略的思考と実行力
- アセンダント: 非常に高スキル、プロレベル近い
- イモータル: エリート、トッププレイヤーとの差わずか
- レディアント: 最高峰、プロレベル実力

理由のみを出力してください：`;

            // AI理由生成を実行
            const result = await model.generateContent(prompt);
            const aiReason = result.response.text().trim();

            // 理由の長さ制限と清浄化
            let finalReason = aiReason;
            if (finalReason.length > 250) {
                finalReason = finalReason.substring(0, 247) + '...';
            }

            // 不適切な内容をフィルタリング
            if (finalReason.length < 10 || finalReason.includes('理由:') || finalReason.includes('判定理由')) {
                // フォールバック理由を使用
                const fallbackReasons = {
                    'アイアン': 'VALORANTの世界への第一歩を踏み出したばかりですね。基本的なゲームメカニクスを学びながら、着実にスキルアップしていきましょう。',
                    'ブロンズ': 'ゲームの基本は理解していますが、エイムの安定性と立ち回りにまだ改善の余地があります。継続的な練習で必ず上達できるでしょう。',
                    'シルバー': 'ゲーム理解は十分にありますが、プレッシャーがかかる場面での判断力をさらに向上させる必要があります。経験を積むことが重要です。',
                    'ゴールド': 'バランスの取れたスキルを持っています。エイムと戦術的思考の両方が中級レベルに達しており、チームプレイもしっかりできています。',
                    'プラチナ': '上級者として認められるレベルに到達しています。高いスキルと戦略的思考を併せ持ち、チームの中核として活躍できる実力があります。',
                    'ダイヤモンド': '非常に高いスキルレベルを持っています。戦略的思考と実行力が優れており、プレッシャーのかかる場面でも冷静に対応できる能力があります。',
                    'アセンダント': 'エリートレベルのスキルを持つプレイヤーです。プロレベルに近い技術と戦術理解を併せ持ち、他のプレイヤーを圧倒する存在感があります。',
                    'イモータル': 'トップクラスのエリートプレイヤーです。プロプレイヤーとも互角に渡り合える実力を持ち、ゲームの全ての要素で最高レベルの能力を発揮しています。',
                    'レディアント': '最高峰の実力を持つ伝説的なプレイヤーです。VALORANTにおける最高到達点として、完璧に近いパフォーマンスを発揮できる能力があります。'
                };
                finalReason = fallbackReasons[selectedRank];
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

            // 追加のフレーバーテキスト（ランダム）
            const flavorTexts = [
                '運命の導きによる判定結果です！',
                '星々の配置が示す真の実力！',
                 'AI分析による深層判定結果！',
                '宇宙の法則が導いたランクです！',
                '量子レベルの解析による判定！',
                '古代の叡智とAIの融合判定！',
                '多次元解析による真実の結果！',
                '運命の女神が選んだランク！'
            ];
            const randomFlavorText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

            // ランクに応じたアドバイス
            const adviceMap = {
                'アイアン': 'エイム練習とマップ学習に集中しましょう！The Rangeでの練習がおすすめです。',
                'ブロンズ': 'デスマッチで撃ち合いスキルを向上させ、チームプレイを意識してみましょう。',
                'シルバー': 'ポジショニングとタイミングを意識して、戦術的な思考を鍛えましょう。',
                'ゴールド': 'エージェントの役割を深く理解し、チーム戦略に貢献していきましょう。',
                'プラチナ': 'メタの研究とプロの試合観戦で、さらなる戦術理解を深めましょう。',
                'ダイヤモンド': '個人技能を維持しつつ、IGLとしてのスキルも磨いていきましょう。',
                'アセンダント': 'プロシーンの最新戦術を研究し、チームメイトとの連携を極めましょう。',
                'イモータル': 'もはやプロレベル！継続的な努力でレディアントを目指しましょう。',
                'レディアント': '最高峰の実力者として、コミュニティ全体を牽引していってください！'
            };

            // 統計情報（ランダム生成）
            const rankPercentage = Math.floor(Math.random() * 25 + 3); // 3-27%の範囲
            const matchCount = Math.floor(Math.random() * 50 + 10); // 10-59試合の範囲

            // Embed作成
            const embed = new EmbedBuilder()
                .setTitle('🎯 VALORANT 適正ランク判定')
                .setDescription(`**${message.author.username}** さんの適正ランク診断結果\n*${randomFlavorText}*`)
                .addFields(
                    { 
                        name: `${rankEmojis[selectedRank]} 適正ランク`, 
                        value: `**${selectedRank}**`, 
                        inline: true 
                    },
                    { 
                        name: '📊 推定分布', 
                        value: `全体の約${rankPercentage}%`, 
                        inline: true 
                    },
                    { 
                        name: '🎮 予想試合数', 
                        value: `約${matchCount}試合で到達`, 
                        inline: true 
                    },
                    { 
                        name: '📋 AI判定理由', 
                        value: finalReason, 
                        inline: false 
                    },
                    {
                        name: '💡 上達アドバイス',
                        value: adviceMap[selectedRank],
                        inline: false
                    }
                )
                .setColor(rankColors[selectedRank])
                .setFooter({ 
                    text: 'Powered by Gemini AI + Random Selection • 診断結果は娯楽目的です',
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // メッセージ送信
            await message.reply({ embeds: [embed] });

            console.log(chalk.green(`✓ AI Rank Assessment: ${message.author.username} assessed as ${selectedRank} in #${message.channel.name}`));

        } catch (error) {
            console.error(chalk.red('✗ Error in rank assessment:'), error);
            
            // エラー時の完全フォールバック
            const fallbackRanks = [
                'アイアン', 'ブロンズ', 'シルバー', 'ゴールド', 
                'プラチナ', 'ダイヤモンド', 'アセンダント', 'イモータル', 'レディアント'
            ];
            const fallbackRank = fallbackRanks[Math.floor(Math.random() * fallbackRanks.length)];
            
            const fallbackReasonMap = {
                'アイアン': 'システム障害により詳細な分析はできませんでしたが、基礎から着実に成長していける可能性を感じます。',
                'ブロンズ': 'AI分析システムに問題が発生しましたが、継続的な努力で確実に上達できるレベルだと推測されます。',
                'シルバー': '技術的な問題により詳細分析は不可能でしたが、バランスの取れたスキルを持っていると判断されます。',
                'ゴールド': 'システムエラーのため完全な分析はできませんでしたが、中級者として安定した実力があると見込まれます。',
                'プラチナ': 'AI解析に障害が発生しましたが、上級者レベルの潜在能力を秘めていると推定されます。',
                'ダイヤモンド': 'システム障害により詳細判定は困難でしたが、高いスキルレベルを持っていると評価されます。',
                'アセンダント': 'AI分析エラーのため詳細は不明ですが、エリートレベルの実力を持っていると推測されます。',
                'イモータル': 'システム問題により完全分析は不可能でしたが、トップクラスの能力があると判断されます。',
                'レディアント': 'AI解析システムに障害が発生しましたが、最高峰の実力を持っていると推定されます。'
            };

            const rankColors = {
                'アイアン': '#6B4E3D', 'ブロンズ': '#CD7F32', 'シルバー': '#C0C0C0',
                'ゴールド': '#FFD700', 'プラチナ': '#00FFFF', 'ダイヤモンド': '#B9F2FF',
                'アセンダント': '#00FF41', 'イモータル': '#FF4654', 'レディアント': '#FFFF9E'
            };

            const rankEmojis = {
                'アイアン': '⚫', 'ブロンズ': '🟤', 'シルバー': '⚪', 'ゴールド': '🟡', 'プラチナ': '🔵',
                'ダイヤモンド': '💎', 'アセンダント': '🟢', 'イモータル': '🔴', 'レディアント': '🌟'
            };
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🎯 VALORANT 適正ランク判定')
                .setDescription(`**${message.author.username}** さんの適正ランク診断結果\n*システム復旧中のため簡易判定を実施*`)
                .addFields(
                    { 
                        name: `${rankEmojis[fallbackRank]} 適正ランク`, 
                        value: `**${fallbackRank}**`, 
                        inline: true 
                    },
                    { 
                        name: '⚠️ 状態', 
                        value: 'システム復旧中', 
                        inline: true 
                    },
                    { 
                        name: '📋 判定理由', 
                        value: fallbackReasonMap[fallbackRank], 
                        inline: false 
                    }
                )
                .setColor(rankColors[fallbackRank])
                .setFooter({ 
                    text: 'フォールバックモード • 後でもう一度お試しください'
                })
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
        }
    },
};
