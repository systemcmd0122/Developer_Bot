const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const archiver = require('archiver');

// Gemini APIの設定
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const DEDICATED_CHANNEL_ID = '1346381678481768499';
const ADMIN_ROLE_ID = '1331169550728957982';

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
        .addSubcommand(subcommand =>
            subcommand
                .setName('chat')
                .setDescription('AIと会話します')
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('会話履歴を管理します')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('実行するアクション')
                        .setRequired(true)
                        .addChoices(
                            { name: '履歴を見る', value: 'view' },
                            { name: '自分の履歴をエクスポート', value: 'export' },
                            { name: '履歴をリセット', value: 'reset' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('export-all')
                .setDescription('全ユーザーの会話履歴をエクスポートします（管理者のみ）')),

    // 履歴ファイルパスを取得
    getUserHistoryPath(userId, channelId) {
        return path.join(HISTORY_DIR, `${userId}_${channelId}.json`);
    },

    // 履歴を読み込む
    loadHistory(historyPath) {
        if (fs.existsSync(historyPath)) {
            try {
                const data = fs.readFileSync(historyPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error(chalk.red('✗ Error reading conversation history:'), error);
                return [];
            }
        }
        return [];
    },

    // 履歴を保存
    saveHistory(historyPath, history) {
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    },

    // チャンネルメッセージを処理する関数
    async processMessage(message) {
        if (message.author.bot) return;
        if (message.channel.id !== DEDICATED_CHANNEL_ID) return;
        
        try {
            const userInput = message.content.trim();
            if (!userInput) return;
            
            const historyPath = this.getUserHistoryPath(message.author.id, message.channel.id);
            let history = this.loadHistory(historyPath);
            
            await message.channel.sendTyping();
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
            
            const chat = model.startChat({
                history: history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.parts[0].text }]
                }))
            });
            
            history.push({
                role: "user",
                parts: [{ text: userInput }],
                timestamp: new Date().toISOString(),
                userId: message.author.id,
                username: message.author.username
            });
            
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            history.push({
                role: "model",
                parts: [{ text: responseText }],
                timestamp: new Date().toISOString()
            });
            
            if (history.length > 40) {
                history = history.slice(history.length - 40);
            }
            
            this.saveHistory(historyPath, history);
            
            if (responseText.length <= 2000) {
                await message.reply(responseText);
            } else {
                const chunks = splitMessage(responseText);
                for (let i = 0; i < chunks.length; i++) {
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
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'chat':
                await this.handleChatCommand(interaction);
                break;
            case 'history':
                await this.handleHistoryCommand(interaction);
                break;
            case 'export-all':
                await this.handleExportAllCommand(interaction);
                break;
        }
    },

    async handleHistoryCommand(interaction) {
        const action = interaction.options.getString('action');
        const historyPath = this.getUserHistoryPath(interaction.user.id, interaction.channel.id);
        
        switch (action) {
            case 'view':
                await this.viewHistory(interaction, historyPath);
                break;
            case 'export':
                await this.exportHistory(interaction, historyPath);
                break;
            case 'reset':
                await this.resetHistory(interaction, historyPath);
                break;
        }
    },

    async handleExportAllCommand(interaction) {
        // 管理者ロールチェック
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            await interaction.reply({
                content: 'このコマンドを実行する権限がありません。',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 一時的なZIPファイルのパス
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipPath = path.join(HISTORY_DIR, `all_history_${timestamp}.zip`);
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', async () => {
                await interaction.editReply({
                    content: '全ての会話履歴をエクスポートしました。',
                    files: [{
                        attachment: zipPath,
                        name: `all_history_${timestamp}.zip`
                    }]
                });

                // クリーンアップ
                fs.unlinkSync(zipPath);
            });

            archive.on('error', (err) => {
                throw err;
            });

            archive.pipe(output);

            // conversationsディレクトリ内の全JSONファイルを追加
            const files = fs.readdirSync(HISTORY_DIR).filter(file => file.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(HISTORY_DIR, file);
                archive.file(filePath, { name: file });
            }

            await archive.finalize();

        } catch (error) {
            console.error(chalk.red('✗ Error exporting all history:'), error);
            await interaction.editReply('履歴のエクスポート中にエラーが発生しました。');
        }
    },

    async viewHistory(interaction, historyPath) {
        await interaction.deferReply({ ephemeral: true });
        const history = this.loadHistory(historyPath);
        
        if (history.length === 0) {
            await interaction.editReply('会話履歴はありません。');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('会話履歴')
            .setColor('#4285F4')
            .setFooter({ text: '最新の10件を表示しています' });

        const recentHistory = history.slice(-20);
        
        for (let i = 0; i < recentHistory.length; i += 2) {
            const userMsg = recentHistory[i];
            const aiMsg = recentHistory[i + 1];
            
            if (userMsg && aiMsg) {
                embed.addFields(
                    { name: `💬 あなた (${i/2 + 1})`, value: userMsg.parts[0].text.substring(0, 1024) },
                    { name: '🤖 AI', value: aiMsg.parts[0].text.substring(0, 1024) }
                );
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async exportHistory(interaction, historyPath) {
        await interaction.deferReply({ ephemeral: true });

        try {
            if (!fs.existsSync(historyPath)) {
                await interaction.editReply('エクスポートする会話履歴はありません。');
                return;
            }

            await interaction.editReply({
                content: '会話履歴をエクスポートしました。',
                files: [{
                    attachment: historyPath,
                    name: `history_${interaction.user.id}_${new Date().toISOString().split('T')[0]}.json`
                }]
            });
        } catch (error) {
            console.error(chalk.red('✗ Error exporting history:'), error);
            await interaction.editReply('履歴のエクスポート中にエラーが発生しました。');
        }
    },

    async resetHistory(interaction, historyPath) {
        if (fs.existsSync(historyPath)) {
            fs.unlinkSync(historyPath);
            await interaction.reply({ content: '会話履歴をリセットしました。', ephemeral: true });
        } else {
            await interaction.reply({ content: 'リセットする会話履歴はありません。', ephemeral: true });
        }
    },

    async handleChatCommand(interaction) {
        try {
            const userInput = interaction.options.getString('message');
            const isPrivate = interaction.options.getBoolean('private') || false;
            
            await interaction.deferReply({ ephemeral: isPrivate });
            
            const historyPath = this.getUserHistoryPath(interaction.user.id, interaction.channel.id);
            let history = this.loadHistory(historyPath);
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
            
            const chat = model.startChat({
                history: history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.parts[0].text }]
                }))
            });
            
            history.push({
                role: "user",
                parts: [{ text: userInput }],
                timestamp: new Date().toISOString(),
                userId: interaction.user.id,
                username: interaction.user.username
            });
            
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            history.push({
                role: "model",
                parts: [{ text: responseText }],
                timestamp: new Date().toISOString()
            });
            
            if (history.length > 40) {
                history = history.slice(history.length - 40);
            }
            
            this.saveHistory(historyPath, history);
            
            let embed;
            if (!isPrivate) {
                embed = new EmbedBuilder()
                    .setTitle('AIとの会話')
                    .addFields(
                        { name: '💬 あなたの質問', value: userInput },
                        { name: '🤖 AIの回答', value: responseText.length > 1024 ? responseText.substring(0, 1021) + '...' : responseText }
                    )
                    .setColor('#4285F4')
                    .setFooter({ text: 'Powered by Google Gemini API' })
                    .setTimestamp();
            }
            
            if (responseText.length <= 2000) {
                await interaction.editReply({
                    content: isPrivate ? responseText : null,
                    embeds: isPrivate ? [] : [embed]
                });
            } else {
                const chunks = splitMessage(responseText);
                
                if (isPrivate) {
                    await interaction.editReply(chunks[0]);
                    for (let i = 1; i < chunks.length; i++) {
                        await interaction.followUp({ content: chunks[i], ephemeral: true });
                    }
                } else {
                    await interaction.editReply({ embeds: [embed] });
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
    
    const paragraphs = text.split('\n\n');
    
    for (const paragraph of paragraphs) {
        if (paragraph.length > maxLength) {
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
            chunks.push(currentChunk);
            currentChunk = paragraph;
        } else {
            if (currentChunk) {
                currentChunk += '\n\n' + paragraph;
            } else {
                currentChunk = paragraph;
            }
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}