const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const archiver = require('archiver');
const supabase = require('../utils/supabase');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const DEDICATED_CHANNEL_ID = '1346381678481768499';
const ADMIN_ROLE_ID = '1331169550728957982';

// 一時的なファイル保存用ディレクトリ
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
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

    // Supabaseから会話履歴を読み込む
    async loadHistory(userId, channelId) {
        try {
            const { data, error } = await supabase
                .from('conversation_history')
                .select('role, content, timestamp, username')
                .eq('user_id', userId)
                .eq('channel_id', channelId)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error(chalk.red('✗ Error loading conversation history from Supabase:'), error);
                return [];
            }

            // Supabaseから取得したデータを適切な形式に変換
            return data.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }],
                timestamp: msg.timestamp,
                userId: msg.role === 'user' ? userId : undefined,
                username: msg.username
            }));
        } catch (error) {
            console.error(chalk.red('✗ Error in loadHistory:'), error);
            return [];
        }
    },

    // Supabaseに会話履歴を保存
    async saveHistory(userId, channelId, role, content, username = null) {
        try {
            const { error } = await supabase
                .from('conversation_history')
                .insert({
                    user_id: userId,
                    channel_id: channelId,
                    role: role,
                    content: content,
                    username: username
                });

            if (error) {
                console.error(chalk.red('✗ Error saving conversation to Supabase:'), error);
                throw error;
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in saveHistory:'), error);
            throw error;
        }
    },

    // チャンネルメッセージを処理する関数
    async processMessage(message) {
        if (message.author.bot) return;
        if (message.channel.id !== DEDICATED_CHANNEL_ID) return;
        
        try {
            const userInput = message.content.trim();
            if (!userInput) return;
            
            // 履歴を読み込む
            const history = await this.loadHistory(message.author.id, message.channel.id);
            
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
            
            // ユーザーのメッセージを保存
            await this.saveHistory(
                message.author.id,
                message.channel.id,
                'user',
                userInput,
                message.author.username
            );
            
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            // AIの応答を保存
            await this.saveHistory(message.author.id, message.channel.id, 'model', responseText);
            
            // 履歴が長すぎる場合は古いものを削除
            await this.trimHistory(message.author.id, message.channel.id, 40);
            
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

    // 古い履歴を削除
    async trimHistory(userId, channelId, maxEntries) {
        try {
            // 現在の履歴エントリ数を確認
            const { count, error: countError } = await supabase
                .from('conversation_history')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('channel_id', channelId);

            if (countError) {
                console.error(chalk.red('✗ Error counting conversation history:'), countError);
                return;
            }

            // エントリ数が最大値を超えている場合、古いものから削除
            if (count > maxEntries) {
                const toDelete = count - maxEntries;
                
                // 最も古いレコードのIDを取得
                const { data: oldestData, error: selectError } = await supabase
                    .from('conversation_history')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('channel_id', channelId)
                    .order('timestamp', { ascending: true })
                    .limit(toDelete);

                if (selectError) {
                    console.error(chalk.red('✗ Error selecting oldest messages:'), selectError);
                    return;
                }

                const oldestIds = oldestData.map(item => item.id);
                
                if (oldestIds.length > 0) {
                    const { error: deleteError } = await supabase
                        .from('conversation_history')
                        .delete()
                        .in('id', oldestIds);

                    if (deleteError) {
                        console.error(chalk.red('✗ Error deleting old messages:'), deleteError);
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in trimHistory:'), error);
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
        
        switch (action) {
            case 'view':
                await this.viewHistory(interaction);
                break;
            case 'export':
                await this.exportHistory(interaction);
                break;
            case 'reset':
                await this.resetHistory(interaction);
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
            // 全ての会話履歴をSupabaseから取得
            const { data, error } = await supabase
                .from('conversation_history')
                .select('*')
                .order('timestamp', { ascending: true });

            if (error) {
                throw error;
            }

            // ユーザーごとにデータを整理
            const userChannelData = {};
            for (const entry of data) {
                const key = `${entry.user_id}_${entry.channel_id}`;
                if (!userChannelData[key]) {
                    userChannelData[key] = [];
                }
                userChannelData[key].push(entry);
            }

            // 一時的なZIPファイルのパス
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipPath = path.join(TEMP_DIR, `all_history_${timestamp}.zip`);
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

            // ユーザー/チャンネルごとのJSONファイルを作成してZIPに追加
            for (const [key, conversations] of Object.entries(userChannelData)) {
                const [userId, channelId] = key.split('_');
                const jsonContent = JSON.stringify(conversations, null, 2);
                const fileName = `${userId}_${channelId}.json`;

                archive.append(jsonContent, { name: fileName });
            }

            await archive.finalize();

        } catch (error) {
            console.error(chalk.red('✗ Error exporting all history:'), error);
            await interaction.editReply('履歴のエクスポート中にエラーが発生しました。');
        }
    },

    async viewHistory(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const history = await this.loadHistory(interaction.user.id, interaction.channel.id);
            
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
        } catch (error) {
            console.error(chalk.red('✗ Error viewing history:'), error);
            await interaction.editReply('履歴の表示中にエラーが発生しました。');
        }
    },

    async exportHistory(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Supabaseから履歴を取得
            const { data, error } = await supabase
                .from('conversation_history')
                .select('*')
                .eq('user_id', interaction.user.id)
                .eq('channel_id', interaction.channel.id)
                .order('timestamp', { ascending: true });

            if (error) {
                throw error;
            }
            
            if (!data || data.length === 0) {
                await interaction.editReply('エクスポートする会話履歴はありません。');
                return;
            }

            // 一時ファイルに保存
            const fileName = `history_${interaction.user.id}_${new Date().toISOString().split('T')[0]}.json`;
            const filePath = path.join(TEMP_DIR, fileName);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

            await interaction.editReply({
                content: '会話履歴をエクスポートしました。',
                files: [{
                    attachment: filePath,
                    name: fileName
                }]
            });

            // 一時ファイルを削除
            setTimeout(() => {
                fs.unlinkSync(filePath);
            }, 5000);
        } catch (error) {
            console.error(chalk.red('✗ Error exporting history:'), error);
            await interaction.editReply('履歴のエクスポート中にエラーが発生しました。');
        }
    },

    async resetHistory(interaction) {
        try {
            // Supabaseから履歴を削除
            const { error } = await supabase
                .from('conversation_history')
                .delete()
                .eq('user_id', interaction.user.id)
                .eq('channel_id', interaction.channel.id);

            if (error) {
                throw error;
            }
            
            await interaction.reply({ content: '会話履歴をリセットしました。', ephemeral: true });
        } catch (error) {
            console.error(chalk.red('✗ Error resetting history:'), error);
            await interaction.reply({ content: '履歴のリセット中にエラーが発生しました。', ephemeral: true });
        }
    },

    async handleChatCommand(interaction) {
        try {
            const userInput = interaction.options.getString('message');
            const isPrivate = interaction.options.getBoolean('private') || false;
            
            await interaction.deferReply({ ephemeral: isPrivate });
            
            // 履歴を読み込む
            const history = await this.loadHistory(interaction.user.id, interaction.channel.id);
            
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
            
            // ユーザーのメッセージを保存
            await this.saveHistory(
                interaction.user.id,
                interaction.channel.id,
                'user',
                userInput,
                interaction.user.username
            );
            
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            // AIの応答を保存
            await this.saveHistory(
                interaction.user.id,
                interaction.channel.id,
                'model',
                responseText
            );
            
            // 履歴が長すぎる場合は古いものを削除
            await this.trimHistory(interaction.user.id, interaction.channel.id, 40);
            
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