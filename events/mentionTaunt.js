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
        `${username}さん、スキルよりプライドの方が高そうですね🎮💸`,
        `${username}さんのプレイ見てると、チュートリアルからやり直した方がいいかも😂`,
        `${username}さん、敵にキルされるのと同じ速度でランク下がってません？📉`,
        `${username}さんのエイム、ストームトルーパーより酷くない？⭐`,
        `${username}さん、「プロゲーマー」じゃなくて「プロ死にゲーマー」の間違いでは？💀`,
        `${username}さん、チームキルの記録でも狙ってるんですか？🔫`,
        `${username}さんのゲームスキル、AIより下って新記録では？🤖⬇️`,
        `${username}さん、負け続けてるのにまだ「運が悪い」って言います？🎲`,
        `${username}さんの戦績、見てるこっちが恥ずかしくなります😬`
    ],
    
    general: [
        `${username}さん、AIにまで見下されるって相当ですよ？🤖👎`,
        `${username}さんの実力、期待値を大幅に下回ってますね📊`,
        `${username}さん、努力してその結果なら才能の問題かも...💔`,
        `${username}さんって、失敗例として教科書に載りそう📚`,
        `${username}さん、自信だけは一人前ですね〜根拠がないけど😏`,
        `${username}さんの存在自体がコメディショーになってません？🎭`,
        `${username}さん、謙虚になれる材料は山ほどあるのに...🏔️`,
        `${username}さんの自己評価、現実との乖離が激しすぎます🌍✨`,
        `${username}さん、反面教師としては超優秀ですね👨‍🏫❌`
    ],
    
    tech: [
        `${username}さん、PCのスペックのせいにするのもう飽きました💻`,
        `${username}さんのPC、性能よりユーザーに問題がありそう🔧`,
        `${username}さん、デバイスを変える前に腕を変えては？🖱️`,
        `${username}さんの設定、プロ仕様なのに結果は初心者レベル⚙️`,
        `${username}さん、高級デバイス使って初心者プレイって贅沢ですね💰`,
        `${username}さんのゲーミングチェア、泣いてそう🪑😭`,
        `${username}さん、MODを入れる前に基本を身につけては？📦`,
        `${username}さんのセットアップ、見た目だけは完璧ですね✨👀`
    ],
    
    time: [
        `${username}さん、その時間を勉強に使った方が...📚⏰`,
        `${username}さん、上達しない時間の使い方のプロですね🕐`,
        `${username}さん、効率よく時間を無駄にしてますね👏`,
        `${username}さんの努力、方向性が完全に間違ってません？🧭`,
        `${username}さん、練習時間と実力が反比例してます📈📉`,
        `${username}さん、同じ時間で別のこと覚えた方が有益では？💡`,
        `${username}さんの継続力、別の分野で活かした方が...🔄`
    ],
    
    savage: [
        `${username}さん、存在がデバフみたいになってません？🔻`,
        `${username}さんを見てると、才能って大事だなって思います✨`,
        `${username}さん、チームの足を引っ張る天才ですね🦶⬇️`,
        `${username}さんの自信、どこから湧いてくるんですか？🌊❓`,
        `${username}さん、期待を裏切る安定感だけは抜群ですね💯`,
        `${username}さんって、失敗のサンプルケースに最適🧪`,
        `${username}さんの実力、評判を下回るって逆にすごい📉🎯`,
        `${username}さん、謙虚になる理由が多すぎて選べませんね🤲`,
        `${username}さんの成長曲線、マイナス成長してません？📈❌`
    ]
};

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botのメッセージは無視
        if (message.author.bot) return;

        // ボットがメンションされているかチェック
        if (!message.mentions.has(message.client.user)) return;

        try {
            // タイピング開始
            await message.channel.sendTyping();

            // Gemini AIモデルの設定（より創造的に）
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 1.2,  // より創造的に
                    topK: 60,
                    topP: 0.98,
                    maxOutputTokens: 120,
                }
            });

            // より詳細で強力な煽りプロンプト
            const prompt = `「${message.author.username}」というユーザーに向けた、かなり辛辣で鋭い煽り文句を日本語で1文作成してください。

要求:
- かなり毒舌で、でも面白みのある煽り
- ゲーム、技術、努力、才能、時間の無駄などを題材に
- 相手のプライドを的確に刺すような内容
- ユーモアを交えつつも、しっかりと煽る
- 説明不要、煽り文句のみ回答
- 絵文字も適度に使用

避けるべき要素:
- 直接的な暴言や差別的表現
- 同じパターンの繰り返し
- 長すぎる説明

ただの煽り文句だけを返してください。`;

            // AI煽り文章生成
            const result = await model.generateContent(prompt);
            let tauntText = result.response.text().trim();

            // 改行や余計な文字を除去
            tauntText = tauntText.replace(/\n/g, ' ').replace(/\r/g, '').trim();
            tauntText = tauntText.replace(/「|」|『|』/g, '');

            // ユーザー名を含むように調整
            if (!tauntText.includes(message.author.username)) {
                tauntText = tauntText.replace(/あなた|君|貴方/g, `${message.author.username}さん`);
                if (!tauntText.includes(message.author.username)) {
                    tauntText = `${message.author.username}さん、${tauntText}`;
                }
            }

            // AIが適切な煽りを生成しなかった場合のフォールバック
            if (tauntText.includes('申し訳') || tauntText.includes('すみません') || 
                tauntText.includes('提案') || tauntText.includes('いかがでしょうか') ||
                tauntText.length > 200 || tauntText.length < 10) {
                
                // カテゴリからランダム選択（重複チェック付き）
                tauntText = getUniqueTaunt(message.author.username);
            }

            // 重複チェック（類似度も考慮）
            if (isSimilarToRecent(tauntText)) {
                tauntText = getUniqueTaunt(message.author.username);
            }

            // 長すぎる場合は切り詰める
            if (tauntText.length > 180) {
                tauntText = tauntText.substring(0, 177) + '...';
            }

            // 不適切な内容をフィルタリング
            const inappropriateWords = ['死ね', 'バカ', '馬鹿', 'アホ', '消えろ', 'うざい', 'きもい', 'ブス', '殺す'];
            const hasInappropriateContent = inappropriateWords.some(word => 
                tauntText.toLowerCase().includes(word.toLowerCase()));

            if (hasInappropriateContent) {
                tauntText = getUniqueTaunt(message.author.username);
            }

            // 使用した煽りを記録
            addToRecentTaunts(tauntText);

            // 煽りメッセージのみを送信
            await message.reply(tauntText);

            console.log(chalk.magenta(`✓ Enhanced Taunt Generated: "${tauntText}" - Responded to ${message.author.username} in #${message.channel.name}`));

        } catch (error) {
            console.error(chalk.red('✗ Error generating taunt:'), error);
            
            // エラー時のフォールバック煽り文章（これも強力に）
            const emergencyTaunts = [
                `${message.author.username}さん、AIすらバグらせるって逆に才能？🤖💥`,
                `${message.author.username}さんの存在、システムにまで負荷をかけるんですね💻⚡`,
                `${message.author.username}さん、AIを困らせる専門家？技術的にすごいかも😏🔧`,
                `${message.author.username}さんのせいでメモリ不足...重い存在ですね💾😅`,
                `${message.author.username}さん、ボットいじめのプロってバイオに書けますね📝💼`,
                `${message.author.username}さんがアクセスするとサーバーが悲鳴を...🖥️😱`
            ];
            
            const emergencyTaunt = emergencyTaunts[Math.floor(Math.random() * emergencyTaunts.length)];
            await message.reply(emergencyTaunt);
        }
    },
};

// 重複しない煽りを取得
function getUniqueTaunt(username) {
    const allCategories = Object.values(tauntCategories).flat();
    const availableTaunts = allCategories.filter(taunt => 
        !isSimilarToRecent(taunt.replace('${username}', username))
    );
    
    if (availableTaunts.length === 0) {
        // 全部使い切った場合はリセット
        recentTaunts.clear();
        return allCategories[Math.floor(Math.random() * allCategories.length)]
            .replace('${username}', username);
    }
    
    const selectedTaunt = availableTaunts[Math.floor(Math.random() * availableTaunts.length)];
    return selectedTaunt.replace('${username}', username);
}

// 最近の煽りと類似しているかチェック
function isSimilarToRecent(newTaunt) {
    const cleanNewTaunt = newTaunt.replace(/[^\w\s]/gi, '').toLowerCase();
    
    for (const recentTaunt of recentTaunts) {
        const cleanRecentTaunt = recentTaunt.replace(/[^\w\s]/gi, '').toLowerCase();
        
        // 簡単な類似度チェック（共通単語数）
        const newWords = cleanNewTaunt.split(/\s+/);
        const recentWords = cleanRecentTaunt.split(/\s+/);
        const commonWords = newWords.filter(word => 
            recentWords.includes(word) && word.length > 2
        );
        
        // 30%以上の単語が共通している場合は類似とみなす
        if (commonWords.length / Math.max(newWords.length, recentWords.length) > 0.3) {
            return true;
        }
    }
    
    return false;
}

// 最近使用した煽りに追加
function addToRecentTaunts(taunt) {
    recentTaunts.add(taunt);
    
    // サイズ制限
    if (recentTaunts.size > MAX_RECENT_TAUNTS) {
        const firstTaunt = recentTaunts.values().next().value;
        recentTaunts.delete(firstTaunt);
    }
}
