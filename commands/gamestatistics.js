const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// プレイ時間を保存するためのMap
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

    // ゲーム開始時の処理
    trackGameStart(userId, gameName, startTime) {
        if (!userGameSessions.has(userId)) {
            userGameSessions.set(userId, new Map());
        }
        
        const userSessions = userGameSessions.get(userId);
        if (!userSessions.has(gameName)) {
            userSessions.set(gameName, {
                totalTime: 0,
                dailyTime: new Map(),
                currentSession: startTime
            });
        } else {
            userSessions.get(gameName).currentSession = startTime;
        }
    },

    // ゲーム終了時の処理
    trackGameEnd(userId, gameName, endTime) {
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
    },

    // プレイ時間のフォーマット
    formatPlaytime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}時間${minutes}分`;
    },

    async execute(interaction) {
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
                    todayStats.push({
                        game,
                        time: todayTime
                    });
                }
            }

            if (todayStats.length === 0) {
                embed.setDescription('今日はまだゲームをプレイしていません。');
            } else {
                todayStats.sort((a, b) => b.time - a.time);
                todayStats.forEach(stat => {
                    embed.addFields({
                        name: stat.game,
                        value: this.formatPlaytime(stat.time),
                        inline: true
                    });
                });
            }

        } else if (subcommand === 'total') {
            embed.setTitle('🎮 総プレイ時間');

            const totalStats = [];
            for (const [game, data] of userSessions) {
                if (data.totalTime > 0) {
                    totalStats.push({
                        game,
                        time: data.totalTime
                    });
                }
            }

            if (totalStats.length === 0) {
                embed.setDescription('プレイ時間の記録がありません。');
            } else {
                totalStats.sort((a, b) => b.time - a.time);
                totalStats.forEach(stat => {
                    embed.addFields({
                        name: stat.game,
                        value: this.formatPlaytime(stat.time),
                        inline: true
                    });
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};