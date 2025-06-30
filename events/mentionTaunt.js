const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chalk = require('chalk');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// 最近使用した煽りを記録（重複防止）
const recentTaunts = new Set();
const MAX_RECENT_TAUNTS = 15;

// 煽りのカテゴリ別配列
const tauntCategories = {
    gaming: [
        `さん、スキルよりプライドの方が高そうですね🎮💸`,
        `さんのプレイ見てると、チュートリアルからやり直した方がいいかも😂`,
        `さん、敵にキルされるのと同じ速度でランク下がってません？📉`,
        `さんのエイム、ストームトルーパーより酷くない？⭐`,
        `さん、「プロゲーマー」じゃなくて「プロ死にゲーマー」の間違いでは？💀`,
        `さん、チームキルの記録でも狙ってるんですか？🔫`,
        `さんのゲームスキル、AIより下って新記録では？🤖⬇️`,
        `さん、負け続けてるのにまだ「運が悪い」って言います？🎲`,
        `さんの戦績、見てるこっちが恥ずかしくなります😬`,
        `さん、リスポーンの回数だけは誰にも負けませんね💀🔄`
    ],
    
    general: [
        `さん、AIにまで見下されるって相当ですよ？🤖👎`,
        `さんの実力、期待値を大幅に下回ってますね📊`,
        `さん、努力してその結果なら才能の問題かも...💔`,
        `さんって、失敗例として教科書に載りそう📚`,
        `さん、自信だけは一人前ですね〜根拠がないけど😏`,
        `さんの存在自体がコメディショーになってません？🎭`,
        `さん、謙虚になれる材料は山ほどあるのに...🏔️`,
        `さんの自己評価、現実との乖離が激しすぎます🌍✨`,
        `さん、反面教師としては超優秀ですね👨‍🏫❌`,
        `さんを見てると、普通って素晴らしいなって思います✨`
    ],
    
    tech: [
        `さん、PCのスペックのせいにするのもう飽きました💻`,
        `さんのPC、性能よりユーザーに問題がありそう🔧`,
        `さん、デバイスを変える前に腕を変えては？🖱️`,
        `さんの設定、プロ仕様なのに結果は初心者レベル⚙️`,
        `さん、高級デバイス使って初心者プレイって贅沢ですね💰`,
        `さんのゲーミングチェア、泣いてそう🪑😭`,
        `さん、MODを入れる前に基本を身につけては？📦`,
        `さんのセットアップ、見た目だけは完璧ですね✨👀`
    ],
    
    savage: [
        `さん、存在がデバフみたいになってません？🔻`,
        `さんを見てると、才能って大事だなって思います✨`,
        `さん、チームの足を引っ張る天才ですね🦶⬇️`,
        `さんの自信、どこから湧いてくるんですか？🌊❓`,
        `さん、期待を裏切る安定感だけは抜群ですね💯`,
        `さんって、失敗のサンプルケースに最適🧪`,
        `さんの実力、評判を下回るって逆にすごい📉🎯`,
        `さん、謙虚になる理由が多すぎて選べませんね🤲`,
        `さんの成長曲線、マイナス成長してません？📈❌`,
        `さん、努力の方向性が完璧に間違ってませんか？🧭💥`
    ]
};

// 重複しない煽りを取得
function getUniqueTaunt(username) {
    try {
        const allCategories = Object.values(tauntCategories);
        const allTaunts = allCategories.flat();
        
        // ユーザー名を含む完成形の煽りリストを作成
        const completeTaunts = allTaunts.map(taunt => `${username}${taunt}`);
        
        // 最近使用していない煽りでフィルタリング
        const availableTaunts = completeTaunts.filter(taunt => !recentTaunts.has(taunt));
        
        let selectedTaunt;
        if (availableTaunts.length === 0) {
            // 全部使い切った場合はリセットしてランダム選択
            recentTaunts.clear();
            selectedTaunt = completeTaunts[Math.floor(Math.random() * completeTaunts.length)];
        } else {
            selectedTaunt = availableTaunts[Math.floor(Math.random() * availableTaunts.length)];
        }
        
        return selectedTaunt;
    } catch (error) {
        console.error('Error in getUniqueTaunt:', error);
        return `${username}さん、AIをバグらせるなんて...やりますね😅`;
    }
}

// 最近使用した煽りに追加
function addToRecentTaunts(taunt) {
    try {
        recentTaunts.add(taunt);
        
        // サイズ制限
        if (recentTaunts.size > MAX_RECENT_TAUNTS) {
            const firstTaunt = recentTaunts.values().next().value;
            recentTaunts.delete(firstTaunt);
        }
    } catch (error) {
        console.error('Error in addToRecentTaunts:', error);
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            // Botのメッセージは無視
            if (message.author.bot) return;

            // ボットがメンションされているかチェック
            if (!message.mentions.has(message.client.user)) return;

            console.log(chalk.blue(`📥 Mention detected from ${message.author.username} in #${message.channel.name}`));

            // タイピング開始
            await message.channel.sendTyping();

            let tauntText = '';

            try {
                // Gemini AIモデルの設定
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-2.0-flash-exp",
                    generationConfig: {
                        temperature: 1.0,
                        topK: 50,
                        topP: 0.95,
                        maxOutputTokens: 100,
                    }
                });

                // 煽りプロンプト
                const prompt = `「${message.author.username}」というユーザーに向けた、辛辣で面白い煽り文句を日本語で1文だけ作成してください。ゲームが下手、時間の無駄、努力不足などを題材にした、フレンドリーだけど毒舌な内容で。説明は不要で、煽り文句だけを返してください。`;

                // AI煽り文章生成（タイムアウト付き）
                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 8000))
                ]);

                tauntText = result.response.text().trim();

                // 改行や余計な文字を除去
                tauntText = tauntText.replace(/\n/g, ' ').replace(/\r/g, '').trim();
                tauntText = tauntText.replace(/「|」|『|』/g, '');

                // ユーザー名が含まれていない場合は追加
                if (!tauntText.includes(message.author.username)) {
                    if (tauntText.startsWith('あなた') || tauntText.startsWith('君') || tauntText.startsWith('貴方')) {
                        tauntText = tauntText.replace(/^(あなた|君|貴方)/, `${message.author.username}さん`);
                    } else {
                        tauntText = `${message.author.username}さん、${tauntText}`;
                    }
                }

                // 長すぎる場合や不適切な場合の検証
                const inappropriateWords = ['申し訳', 'すみません', '提案', 'いかがでしょうか', '死ね', 'バカ', '馬鹿', 'アホ', '消えろ', 'うざい', 'きもい'];
                const hasInappropriateContent = inappropriateWords.some(word => tauntText.includes(word));

                if (tauntText.length > 150 || tauntText.length < 10 || hasInappropriateContent) {
                    throw new Error('Inappropriate AI response');
                }

                console.log(chalk.green(`🤖 AI Generated: "${tauntText}"`));

            } catch (aiError) {
                console.log(chalk.yellow(`⚠️ AI failed, using fallback: ${aiError.message}`));
                // AIが失敗した場合はフォールバック
                tauntText = getUniqueTaunt(message.author.username);
            }

            // 重複チェック
            if (recentTaunts.has(tauntText)) {
                tauntText = getUniqueTaunt(message.author.username);
                console.log(chalk.cyan(`🔄 Used fallback due to duplicate`));
            }

            // 使用した煽りを記録
            addToRecentTaunts(tauntText);

            // 煽りメッセージを送信
            await message.reply(tauntText);

            console.log(chalk.magenta(`✅ Taunt sent: "${tauntText}" to ${message.author.username}`));

        } catch (error) {
            console.error(chalk.red('❌ Critical error in execute:'), error);
            
            try {
                // 緊急時のフォールバック
                const emergencyTaunts = [
                    `${message.author.username}さん、AIをバグらせるなんて...やりますね😅`,
                    `${message.author.username}さんの存在、システムにまで負荷をかけるんですね💻⚡`,
                    `${message.author.username}さん、AIを困らせる専門家？😏🔧`,
                    `${message.author.username}さんのせいでメモリ不足...重い存在ですね💾😅`,
                    `${message.author.username}さん、ボットいじめは程々にしてくださいよ〜😏💼`
                ];
                
                const emergencyTaunt = emergencyTaunts[Math.floor(Math.random() * emergencyTaunts.length)];
                await message.reply(emergencyTaunt);
                
                console.log(chalk.red(`🚨 Emergency taunt used: "${emergencyTaunt}"`));
            } catch (finalError) {
                console.error(chalk.red('💥 Final fallback failed:'), finalError);
            }
        }
    },
};
