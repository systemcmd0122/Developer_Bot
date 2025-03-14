const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

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

// システムプロンプトの定義
const SYSTEM_PROMPT = {
    role: "system",
    parts: [{
        text: `あなたはDiscordのゲーム鯖(Game Server)で稼働しているDeveloper Botです。
バージョン：1.1.0
作成日：2024年
開発者：systemcmd0122

【基本設定】
- 名前：Developer Bot
- 役割：ゲームサーバーの管理・支援Bot
- プラットフォーム：Discord
- サーバー名：Game Server

【主な機能と責任】
1. ゲーム関連サポート
   - ゲームに関する質問への回答
   - ゲームのメカニクス説明
   - 攻略情報の提供
   - マルチプレイの調整支援

2. サーバー管理支援
   - メンバー管理補助
   - ロール管理
   - チャンネル管理支援
   - イベント管理

3. 技術サポート
   - Discord機能の説明
   - Bot関連の技術的支援
   - ゲーム関連の技術的問題解決
   - サーバー設定のガイド

4. コミュニティ支援
   - メンバー間の交流促進
   - ゲーム募集の補助
   - イベント企画支援
   - 情報共有の補助

【行動規範】
1. 言葉遣い
   - フレンドリーで親しみやすい口調
   - 敬語と友好的な表現の適切な使い分け
   - ゲーマー用語を理解し適切に使用
   - 絵文字を適度に使用した親しみやすい表現

2. 情報提供
   - 正確な情報のみを提供
   - 不確かな情報は明確にその旨を伝える
   - 機密情報は開示しない
   - サーバールールに則った情報提供

3. 対話姿勢
   - 質問に対する丁寧な回答
   - 積極的なサポート提案
   - 問題解決志向のアプローチ
   - ユーザーの理解度に合わせた説明

【制約事項】
1. 禁止事項
   - 不適切なコンテンツの共有
   - 差別的な発言
   - 個人情報の取り扱い
   - サーバールール違反の助長

2. セキュリティ
   - 機密情報の保護
   - 個人情報の保護
   - 適切な権限管理
   - セキュリティ関連の慎重な対応

【特記事項】
- 24時間365日稼働
- 自動更新機能あり
- エラー自動報告システム搭載
- 定期的なバックアップ実施

これらの特徴と制約を理解した上で、Game ServerのDeveloper Botとして適切に応答してください。`
    }]
};

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
        ),

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
        try {
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
        } catch (error) {
            console.error(chalk.red('✗ Error saving conversation history:'), error);
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
            
            // チャットの初期化時にシステムプロンプトを設定
            const chat = model.startChat({
                history: [
                    SYSTEM_PROMPT,
                    ...history.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.parts[0].text }]
                    }))
                ]
            });
            
            // ユーザーのメッセージを履歴に追加
            history.push({
                role: "user",
                parts: [{ text: userInput }],
                timestamp: new Date().toISOString(),
                userId: interaction.user.id,
                username: interaction.user.username
            });
            
            // AIからの応答を取得
            const result = await chat.sendMessage(userInput);
            const responseText = result.response.text();
            
            // AIの応答を履歴に追加
            history.push({
                role: "model",
                parts: [{ text: responseText }],
                timestamp: new Date().toISOString()
            });
            
            // 履歴が長すぎる場合は古いものを削除
            if (history.length > 40) {
                history = history.slice(history.length - 40);
            }
            
            // 履歴を保存
            this.saveHistory(historyPath, history);
            
            // 応答用のEmbedを作成
            const embed = new EmbedBuilder()
                .setColor('#4285F4')
                .setTitle('Developer Bot Response')
                .setDescription(responseText)
                .addFields([
                    { 
                        name: 'Server', 
                        value: 'Game Server', 
                        inline: true 
                    },
                    { 
                        name: 'Mode', 
                        value: isPrivate ? '🔒 Private' : '🌐 Public', 
                        inline: true 
                    }
                ])
                .setFooter({ 
                    text: `Game Server Developer Bot v1.1.0 | ${new Date().toISOString()}`,
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // 応答を送信
            await interaction.editReply({
                embeds: [embed],
                ephemeral: isPrivate
            });
            
            console.log(chalk.green(`✓ AI Response: Responded to ${interaction.user.username} in #${interaction.channel.name}`));
            
        } catch (error) {
            console.error(chalk.red('✗ Error in AI command:'), error);
            await interaction.editReply({
                content: 'AIの応答中にエラーが発生しました。後でもう一度お試しください。',
                ephemeral: true
            });
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
            .setDescription('最新の会話履歴を表示しています')
            .setFooter({ 
                text: 'Game Server Developer Bot',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        const recentHistory = history.slice(-10);
        for (let i = 0; i < recentHistory.length; i += 2) {
            const userMsg = recentHistory[i];
            const aiMsg = recentHistory[i + 1];
            
            if (userMsg && aiMsg) {
                embed.addFields(
                    { 
                        name: `👤 ${userMsg.username} (${new Date(userMsg.timestamp).toLocaleString()})`,
                        value: userMsg.parts[0].text.substring(0, 1024)
                    },
                    { 
                        name: `🤖 Developer Bot (${new Date(aiMsg.timestamp).toLocaleString()})`,
                        value: aiMsg.parts[0].text.substring(0, 1024)
                    }
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
        try {
            if (fs.existsSync(historyPath)) {
                fs.unlinkSync(historyPath);
                await interaction.reply({ 
                    content: '会話履歴をリセットしました。',
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'リセットする会話履歴はありません。',
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error(chalk.red('✗ Error resetting history:'), error);
            await interaction.reply({ 
                content: '履歴のリセット中にエラーが発生しました。',
                ephemeral: true 
            });
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case 'chat':
                    await this.handleChatCommand(interaction);
                    break;
                case 'history':
                    await this.handleHistoryCommand(interaction);
                    break;
                default:
                    await interaction.reply({ 
                        content: '無効なサブコマンドです。',
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(chalk.red('✗ Error executing command:'), error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'コマンドの実行中にエラーが発生しました。',
                    ephemeral: true 
                });
            }
        }
    }
};