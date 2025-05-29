const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chalk = require('chalk');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

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

            // Gemini AIモデルの設定
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.9,
                    topK: 50,
                    topP: 0.95,
                    maxOutputTokens: 512,
                }
            });

            // 煽り文章生成用プロンプト
            const tauntPrompts = [
                `ユーザー「${message.author.username}」にDiscord上で軽い煽り文句を日本語で1つ作成してください。フレンドリーで面白く、攻撃的すぎない程度の軽いからかいにしてください。ゲーム関連の煽りでも構いません。1-2文で簡潔に。`,
                
                `「${message.author.username}」に対してVALORANTやゲーム関連の軽いツッコミや煽り文句を日本語で作成してください。面白くて親しみやすい感じで、本気で怒らせない程度の軽いジョークにしてください。`,
                
                `ユーザー「${message.author.username}」をDiscordで軽くいじる面白い一言を日本語で作成してください。友達同士の軽いからかい程度で、笑えるような内容にしてください。ゲームが下手そうとか、そういう軽い感じで。`,
                
                `「${message.author.username}」に向けた軽い煽り文句を日本語で1つ考えてください。Discord上での友達同士のやり取りのような、親しみやすく面白い感じの軽いディスにしてください。攻撃的ではなく、笑いを誘うような内容で。`,
                
                `ユーザー「${message.author.username}」に対する軽いからかいやツッコミを日本語で作成してください。VALORANTやゲーム関連でも日常的な内容でも構いません。フレンドリーで面白い、軽い煽り文句を1-2文で。`,
                
                `「${message.author.username}」を軽くいじる面白い一言を日本語で考えてください。Discord botらしく、ちょっと生意気だけど愛嬌のある感じの軽い煽りにしてください。友達をからかう程度の優しい感じで。`,
                
                `ユーザー「${message.author.username}」に向けた軽いジョークや煽り文句を日本語で1つ作成してください。ゲームスキルや日常的なことを軽くからかう感じで、笑えるような親しみやすい内容にしてください。`,
                
                `「${message.author.username}」に対する軽いツッコミを日本語で考えてください。Discord上での楽しいやり取りの一環として、面白くて軽い煽り文句を作成してください。本格的に怒らせない程度の軽いからかいで。`
            ];

            // ランダムでプロンプトを選択
            const selectedPrompt = tauntPrompts[Math.floor(Math.random() * tauntPrompts.length)];

            // AI煽り文章生成
            const result = await model.generateContent(selectedPrompt);
            let tauntText = result.response.text().trim();

            // 長すぎる場合は切り詰める
            if (tauntText.length > 200) {
                tauntText = tauntText.substring(0, 197) + '...';
            }

            // 不適切な内容をフィルタリング（基本的なチェック）
            const inappropriateWords = ['死ね', 'バカ', '馬鹿', 'アホ', '消えろ', 'うざい', 'きもい'];
            const hasInappropriateContent = inappropriateWords.some(word => tauntText.includes(word));

            if (hasInappropriateContent) {
                // フォールバック用の軽い煽り文章
                const fallbackTaunts = [
                    `${message.author.username}さん、今日もエイム練習サボってません？🎯`,
                    `おや？${message.author.username}さんがボットを呼んでますね～何かお困りですか？😏`,
                    `${message.author.username}さん、VALORANTのランクはまだシルバーですか？😎`,
                    `${message.author.username}さん、今日は何回デスしましたか？📊`,
                    `あら、${message.author.username}さんお疲れ様です！今日も頑張って負けてきましたか？🤔`,
                    `${message.author.username}さん、ボットより弱いって本当ですか？🤖`,
                    `${message.author.username}さん、エイムがブレブレって噂を聞きましたが...🎮`,
                    `おっと、${message.author.username}さんからお呼びがかかりましたね！何か教えて欲しいことでも？😊`
                ];
                tauntText = fallbackTaunts[Math.floor(Math.random() * fallbackTaunts.length)];
            }

            // メンション付きで通常メッセージとして返信
            await message.reply(`<@${message.author.id}> ${tauntText}`);

            console.log(chalk.magenta(`✓ Taunt Generated: Responded to ${message.author.username} in #${message.channel.name}`));

        } catch (error) {
            console.error(chalk.red('✗ Error generating taunt:'), error);
            
            // エラー時のフォールバック煽り文章
            const emergencyTaunts = [
                `${message.author.username}さん、ボットにバグを起こさせるなんて...やりますね😅`,
                `あら、${message.author.username}さんのせいでシステムエラーが...💻`,
                `${message.author.username}さん、AIを困らせるの得意ですね〜🤖`,
                `おっと、${message.author.username}さんが強すぎてAIがフリーズしました❄️`,
                `${message.author.username}さん、ボットいじめは程々にしてくださいよ〜😏`
            ];
            
            const emergencyTaunt = emergencyTaunts[Math.floor(Math.random() * emergencyTaunts.length)];
            
            await message.reply(`<@${message.author.id}> ${emergencyTaunt}`);
        }
    },
};
