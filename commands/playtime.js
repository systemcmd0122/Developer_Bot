// commands/playtime.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const GAME_DATA_FILE = path.join(__dirname, '..', 'data', 'game.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playtime')
        .setDescription('ゲームのプレイ時間を表示します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('プレイ時間を表示します')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('確認したいユーザー（指定しない場合は自分）')
                        .setRequired(false)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('最も遊んだゲームを表示します')
                .addIntegerOption(option =>
                    option
                        .setName('count')
                        .setDescription('表示する数（1-10）')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false))),

    async loadGameData() {
        try {
            const data = await fs.readFile(GAME_DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    },

    async saveGameData(data) {
        await fs.mkdir(path.dirname(GAME_DATA_FILE), { recursive: true });
        await fs.writeFile(GAME_DATA_FILE, JSON.stringify(data, null, 2));
    },

    async trackGameStart(userId, gameName, timestamp) {
        const gameData = await this.loadGameData();
        if (!gameData[userId]) {
            gameData[userId] = {};
        }
        if (!gameData[userId][gameName]) {
            gameData[userId][gameName] = {
                totalTime: 0,
                sessions: []
            };
        }
        gameData[userId][gameName].sessions.push({
            start: timestamp,
            end: null
        });
        await this.saveGameData(gameData);
    },

    async trackGameEnd(userId, gameName, timestamp) {
        const gameData = await this.loadGameData();
        if (!gameData[userId]?.[gameName]?.sessions) return;

        const sessions = gameData[userId][gameName].sessions;
        const lastSession = sessions[sessions.length - 1];
        
        if (lastSession && !lastSession.end) {
            lastSession.end = timestamp;
            const sessionDuration = timestamp - lastSession.start;
            gameData[userId][gameName].totalTime += sessionDuration;
            await this.saveGameData(gameData);
        }
    },

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const parts = [];
        if (days > 0) parts.push(`${days}日`);
        if (hours % 24 > 0) parts.push(`${hours % 24}時間`);
        if (minutes % 60 > 0) parts.push(`${minutes % 60}分`);
        
        return parts.join(' ') || '1分未満';
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const gameData = await this.loadGameData();
            const userGames = gameData[targetUser.id] || {};

            const gameList = Object.entries(userGames)
                .sort(([, a], [, b]) => b.totalTime - a.totalTime)
                .map(([game, data]) => ({
                    name: game,
                    time: this.formatDuration(data.totalTime)
                }));

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`🎮 ${targetUser.username} のプレイ時間`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            if (gameList.length > 0) {
                gameList.forEach((game, index) => {
                    embed.addFields({
                        name: `${index + 1}. ${game.name}`,
                        value: game.time,
                        inline: false
                    });
                });
            } else {
                embed.setDescription('まだプレイ時間が記録されていません');
            }

            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'top') {
            const count = interaction.options.getInteger('count') || 5;
            const gameData = await this.loadGameData();
            
            // 全ユーザーの全ゲームのプレイ時間を集計
            const totalGameTimes = {};
            Object.values(gameData).forEach(userGames => {
                Object.entries(userGames).forEach(([game, data]) => {
                    if (!totalGameTimes[game]) {
                        totalGameTimes[game] = 0;
                    }
                    totalGameTimes[game] += data.totalTime;
                });
            });

            const topGames = Object.entries(totalGameTimes)
                .sort(([, a], [, b]) => b - a)
                .slice(0, count)
                .map(([game, time], index) => ({
                    name: `${index + 1}. ${game}`,
                    value: this.formatDuration(time),
                    inline: false
                }));

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏆 サーバー全体でよく遊ばれているゲーム')
                .addFields(topGames)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    },
};