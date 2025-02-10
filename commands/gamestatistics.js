const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ゲームセッションを保存するためのグローバルMap
const userGameSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playtime')
        .setDescription('ゲームのプレイ時間を表示します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('today')
                .setDescription('今日のプレイ時間を表示します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('total')
                .setDescription('総プレイ時間を表示します')),

    // ゲームセッションMapへのアクセスを提供
    getUserGameSessions() {
        return userGameSessions;
    },

    // ゲーム開始時の処理
    trackGameStart(userId, gameName, startTime) {
        try {
            if (!userGameSessions.has(userId)) {
                userGameSessions.set(userId, new Map());
            }
            
            const userSessions = userGameSessions.get(userId);
            const gameData = userSessions.get(gameName) || {
                totalTime: 0,
                dailyTime: new Map(),
                currentSession: null
            };
            
            // 既存のセッションがある場合は終了処理
            if (gameData.currentSession) {
                this.trackGameEnd(userId, gameName, startTime);
            }
            
            gameData.currentSession = startTime;
            userSessions.set(gameName, gameData);

            console.log(`Started tracking game session for user ${userId} playing ${gameName}`);
        } catch (error) {
            console.error('Error in trackGameStart:', error);
        }
    },

    // ゲーム終了時の処理
    trackGameEnd(userId, gameName, endTime) {
        try {
            const userSessions = userGameSessions.get(userId);
            if (!userSessions || !userSessions.has(gameName)) return;

            const gameData = userSessions.get(gameName);
            if (!gameData.currentSession) return;

            const sessionDuration = endTime - gameData.currentSession;
            const today = new Date().toDateString();

            // 本日の時間を更新
            const dailyTime = gameData.dailyTime.get(today) || 0;
            gameData.dailyTime.set(today, dailyTime + sessionDuration);

            // 総時間を更新
            gameData.totalTime += sessionDuration;
            gameData.currentSession = null;
            
            userSessions.set(gameName, gameData);

            console.log(`Ended tracking game session for user ${userId} playing ${gameName}`);
        } catch (error) {
            console.error('Error in trackGameEnd:', error);
        }
    },

    // プレイ時間のフォーマット
    formatPlaytime(ms) {
        try {
            const hours = Math.floor(ms / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            if (hours === 0) {
                return `${minutes}分`;
            }
            return `${hours}時間${minutes}分`;
        } catch (error) {
            console.error('Error in formatPlaytime:', error);
            return '計算エラー';
        }
    },

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const userId = interaction.user.id;
            const subcommand = interaction.options.getSubcommand();
            const userSessions = userGameSessions.get(userId);

            if (!userSessions || userSessions.size === 0) {
                return await interaction.editReply('プレイ時間の記録がありません。');
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            if (subcommand === 'today') {
                const today = new Date().toDateString();
                embed.setTitle('🎮 今日のプレイ時間');

                const todayStats = [];
                for (const [game, data] of userSessions) {
                    const todayTime = data.dailyTime.get(today) || 0;
                    if (todayTime > 0) {
                        todayStats.push({ game, time: todayTime });
                    }
                }

                if (todayStats.length === 0) {
                    embed.setDescription('今日はまだゲームをプレイしていません。');
                } else {
                    todayStats.sort((a, b) => b.time - a.time);
                    embed.setDescription(
                        todayStats.map(stat => 
                            `**${stat.game}**: ${this.formatPlaytime(stat.time)}`
                        ).join('\n')
                    );
                }

            } else if (subcommand === 'total') {
                embed.setTitle('🎮 総プレイ時間');

                const totalStats = [];
                for (const [game, data] of userSessions) {
                    if (data.totalTime > 0) {
                        totalStats.push({ game, time: data.totalTime });
                    }
                }

                if (totalStats.length === 0) {
                    embed.setDescription('プレイ時間の記録がありません。');
                } else {
                    totalStats.sort((a, b) => b.time - a.time);
                    embed.setDescription(
                        totalStats.map(stat => 
                            `**${stat.game}**: ${this.formatPlaytime(stat.time)}`
                        ).join('\n')
                    );
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in execute:', error);
            await interaction.editReply('コマンドの実行中にエラーが発生しました。');
        }
    },
};