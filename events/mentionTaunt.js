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
                    maxOutputTokens: 100,
                }
            });

            // シンプルな煽り文章生成プロンプト
            const prompt = `ユーザー「${message.author.username}」に向けた軽い煽り文句を日本語で作成してください。フレンドリーで面白い、1文だけの短い煽りにしてください。余計な説明は一切不要で、煽り文句だけを回答してください。`;

            // AI煽り文章生成
            const result = await model.generateContent(prompt);
            let tauntText = result.response.text().trim();

            // 改行や余計な文字を除去
            tauntText = tauntText.replace(/\n/g, ' ').replace(/\r/g, '').trim();

            // プロンプトが含まれていたら除去
            if (tauntText.includes('提案') || tauntText.includes('承知') || tauntText.includes('です。') && tauntText.length > 50) {
                // フォールバック用の煽り文章
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

            // 長すぎる場合は切り詰める
            if (tauntText.length > 150) {
                tauntText = tauntText.substring(0, 147) + '...';
            }

            // 不適切な内容をフィルタリング
            const inappropriateWords = ['死ね', 'バカ', '馬鹿', 'アホ', '消えろ', 'うざい', 'きもい'];
            const hasInappropriateContent = inappropriateWords.some(word => tauntText.includes(word));

            if (hasInappropriateContent) {
                const safeTaunts = [
                    `${message.author.username}さん、今日もエイム練習サボってません？🎯`,
                    `${message.author.username}さん、VALORANTのランクはまだシルバーですか？😎`,
                    `${message.author.username}さん、今日は何回デスしましたか？📊`,
                    `${message.author.username}さん、ボットより弱いって本当ですか？🤖`,
                    `${message.author.username}さん、エイムがブレブレって噂を聞きましたが...🎮`
                ];
                tauntText = safeTaunts[Math.floor(Math.random() * safeTaunts.length)];
            }

            // 煽りメッセージのみを送信
            await message.reply(tauntText);

            console.log(chalk.magenta(`✓ Taunt Generated: "${tauntText}" - Responded to ${message.author.username} in #${message.channel.name}`));

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
            await message.reply(emergencyTaunt);
        }
    },
};
