// commands/talk.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Gemini APIの設定
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const DEDICATED_CHANNEL_ID = '1346381678481768499';

// 会話履歴を保存するためのファイルパス
const HISTORY_DIR = path.join(__dirname, '..', 'data', 'conversations');

// 会話履歴を保存するディレクトリが存在しない場合は作成
if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

module.exports = {
    category: 'ユーティリティ',
    data: new SlashCommandBuilder()
        .setName('talk')
        .setDescription('GeminiAIと会話します')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('AIに送るメッセージ')
                .setRequired(true))
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('返答を自分だけに表示する')
                .setRequired(false))
        .addBooleanOption(option =>
            option
                .setName('reset')
                .setDescription('会話履歴をリセットする')
                .setRequired(false)),

    // チャンネルメッセージを処理する関数
    async processMessage(message) {
        // ボットのメッセージは無視
        if (message.author.bot) return;
        
        // 専用チャンネル以外は無視
        if (message.channel.id !== DEDICATED_CHANNEL_ID) return;
        
        try {
            // 入力メッセージの検証
            const userInput = message.content.trim();
            if (!userInput) return;
            
            // 会話履歴を取得
            const historyPath = path.join(HISTORY_DIR, `${message.channel.id}.json`);
            let history = [];
            
            if (fs.existsSync(historyPath)) {
                try {
                    const data = fs.readFileSync(historyPath, 'utf8');
                    history = JSON.parse(data);
                } catch (error) {
                    console.error(chalk.red('✗ Error reading conversation history:'), error);
                }
            }
            
            // タイピングインジケーターを表示
            await message.channel.sendTyping();
            
            // モデルの設定
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
            
            // 会話履歴からチャットを初期化
            const chat = model.startChat({
                history: history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.parts[0].text }]
                }))
            });
            
            // 会話履歴に新しいユーザーメッセージを追加
            history.push({ role: "user", parts: [{ text: userInput }] });
            
            // AIからの応答を取得
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            // 会話履歴に応答を追加
            history.push({ role: "model", parts: [{ text: responseText }] });
            
            // 履歴の長さを制限（過去20往復まで保存）
            if (history.length > 40) {
                history = history.slice(history.length - 40);
            }
            
            // 会話履歴をファイルに保存
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
            
            // メッセージが2000文字を超える場合は分割して送信
            if (responseText.length <= 2000) {
                await message.reply(responseText);
            } else {
                // 長いメッセージを分割して送信
                const chunks = splitMessage(responseText);
                for (let i = 0; i < chunks.length; i++) {
                    // 最初のチャンクのみreplyとして送信し、残りはフォローアップとして送信
                    if (i === 0) {
                        await message.reply(chunks[i]);
                    } else {
                        await message.channel.send(chunks[i]);
                    }
                }
            }
            
            console.log(chalk.green(`✓ AI Response: Responded to ${message.author.username} in #${message.channel.name}`));
            
        } catch (error) {
            console.error(chalk.red('✗ Error in AI response:'), error);
            await message.reply('申し訳ありません、AIの応答中にエラーが発生しました。後でもう一度お試しください。');
        }
    },

    async execute(interaction) {
        try {
            const userInput = interaction.options.getString('message');
            const isPrivate = interaction.options.getBoolean('private') || false;
            const shouldReset = interaction.options.getBoolean('reset') || false;
            
            // 会話履歴の保存パス
            const historyPath = path.join(HISTORY_DIR, `${interaction.channelId}.json`);
            
            // 会話履歴のリセット
            if (shouldReset) {
                if (fs.existsSync(historyPath)) {
                    fs.unlinkSync(historyPath);
                }
                return interaction.reply({ content: '会話履歴をリセットしました。', ephemeral: true });
            }
            
            // 応答中であることを示す
            await interaction.deferReply({ ephemeral: isPrivate });
            
            // 会話履歴を取得
            let history = [];
            if (fs.existsSync(historyPath)) {
                try {
                    const data = fs.readFileSync(historyPath, 'utf8');
                    history = JSON.parse(data);
                } catch (error) {
                    console.error(chalk.red('✗ Error reading conversation history:'), error);
                }
            }
            
            // モデルの設定
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
            
            // 会話履歴からチャットを初期化
            const chat = model.startChat({
                history: history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.parts[0].text }]
                }))
            });
            
            // 会話履歴に新しいユーザーメッセージを追加
            history.push({ role: "user", parts: [{ text: userInput }] });
            
            // AIからの応答を取得
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            // 会話履歴に応答を追加
            history.push({ role: "model", parts: [{ text: responseText }] });
            
            // 履歴の長さを制限（過去20往復まで保存）
            if (history.length > 40) {
                history = history.slice(history.length - 40);
            }
            
            // 会話履歴をファイルに保存
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
            
            // レスポンスの作成
            let embed;
            if (!isPrivate) {
                embed = new EmbedBuilder()
                    .setTitle('AIとの会話')
                    .addFields(
                        { name: '💬 あなたの質問', value: userInput },
                        { name: '🤖 AIの回答', value: responseText.length > 1024 ? responseText.substring(0, 1021) + '...' : responseText }
                    )
                    .setColor('#4285F4') // Googleカラー
                    .setFooter({ text: 'Powered by Google Gemini API' })
                    .setTimestamp();
            }
            
            // メッセージが長い場合の処理
            if (responseText.length <= 2000) {
                await interaction.editReply({
                    content: isPrivate ? responseText : null,
                    embeds: isPrivate ? [] : [embed]
                });
            } else {
                // 長いメッセージは分割して送信
                const chunks = splitMessage(responseText);
                
                // 最初のチャンクまたはエンベッドで返信
                if (isPrivate) {
                    await interaction.editReply(chunks[0]);
                    // 残りのチャンクをフォローアップとして送信
                    for (let i = 1; i < chunks.length; i++) {
                        await interaction.followUp({ content: chunks[i], ephemeral: true });
                    }
                } else {
                    // 埋め込みを使用する場合は、最初に埋め込みを送信
                    await interaction.editReply({ embeds: [embed] });
                    // 長い回答の全文を追加のメッセージとして送信
                    for (const chunk of chunks) {
                        await interaction.followUp({ content: chunk, ephemeral: isPrivate });
                    }
                }
            }
            
            console.log(chalk.green(`✓ AI Command: Responded to ${interaction.user.username} in #${interaction.channel.name}`));
            
        } catch (error) {
            console.error(chalk.red('✗ Error in AI command:'), error);
            if (interaction.deferred) {
                await interaction.editReply('申し訳ありません、AIの応答中にエラーが発生しました。後でもう一度お試しください。');
            } else {
                await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
            }
        }
    }
};

// メッセージを分割する関数
function splitMessage(text, maxLength = 2000) {
    const chunks = [];
    let currentChunk = '';
    
    // 段落ごとに分割
    const paragraphs = text.split('\n\n');
    
    for (const paragraph of paragraphs) {
        // 段落自体が長すぎる場合はさらに分割
        if (paragraph.length > maxLength) {
            // 文単位で分割
            const sentences = paragraph.split(/(?<=\. )/);
            
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length + 1 > maxLength) {
                    chunks.push(currentChunk);
                    currentChunk = sentence;
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                }
            }
        } else if (currentChunk.length + paragraph.length + 2 > maxLength) {
            // 現在のチャンクに段落を追加すると長すぎる場合
            chunks.push(currentChunk);
            currentChunk = paragraph;
        } else {
            // 現在のチャンクに段落を追加
            if (currentChunk) {
                currentChunk += '\n\n' + paragraph;
            } else {
                currentChunk = paragraph;
            }
        }
    }
    
    // 最後のチャンクを追加
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}