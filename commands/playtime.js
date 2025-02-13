// commands/playtime.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const PLAYTIME_FILE = path.join(__dirname, '..', 'data', 'playtime.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playtime')
        .setDescription('ゲームのプレイ時間を表示します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('すべてのゲームのプレイ時間を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('game')
                .setDescription('特定のゲームのプレイ時間を表示')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('ゲーム名')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const playtimeData = await this.loadPlaytimeData();
            const userId = interaction.user.id;
            const userPlaytime = playtimeData[userId] || {};

            if (subcommand === 'all') {
                await this.showAllPlaytime(interaction, userPlaytime);
            } else if (subcommand === 'game') {
                const gameName = interaction.options.getString('name');
                await this.showGamePlaytime(interaction, userPlaytime, gameName);
            }
        } catch (error) {
            console.error('Error in playtime command:', error);
            await interaction.reply({
                content: 'プレイ時間の取得中にエラーが発生しました。',
                ephemeral: true
            });
        }
    },

    async showAllPlaytime(interaction, userPlaytime) {
        const games = Object.entries(userPlaytime)
            .filter(([gameName, data]) => data.totalTime > 0)
            .sort(([nameA, dataA], [nameB, dataB]) => dataB.totalTime - dataA.totalTime);

        if (games.length === 0) {
            await interaction.reply({
                content: 'まだプレイ時間の記録がありません。',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 ゲームプレイ時間統計')
            .setDescription(`${interaction.user.username} のプレイ時間統計`)
            .setTimestamp();

        let totalPlaytime = 0;
        const fields = games.slice(0, 25).map(([game, data]) => {
            totalPlaytime += data.totalTime;
            return {
                name: game,
                value: this.formatPlaytime(data.totalTime),
                inline: true
            };
        });

        embed.addFields(fields);
        embed.addFields({
            name: '合計プレイ時間',
            value: this.formatPlaytime(totalPlaytime),
            inline: false
        });

        if (games.length > 25) {
            embed.setFooter({ text: '※ 上位25件のみ表示しています' });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async showGamePlaytime(interaction, userPlaytime, gameName) {
        const gameData = userPlaytime[gameName];

        if (!gameData || gameData.totalTime === 0) {
            await interaction.reply({
                content: `${gameName} のプレイ時間記録が見つかりません。`,
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🎮 ${gameName} のプレイ時間統計`)
            .setDescription(`${interaction.user.username} の統計情報`)
            .addFields(
                {
                    name: '合計プレイ時間',
                    value: this.formatPlaytime(gameData.totalTime),
                    inline: true
                },
                {
                    name: '最終プレイ',
                    value: gameData.lastPlayed ? new Date(gameData.lastPlayed).toLocaleString() : '記録なし',
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    formatPlaytime(minutes) {
        if (minutes < 60) {
            return `${minutes}分`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (hours < 24) {
            return `${hours}時間${remainingMinutes}分`;
        }
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}日${remainingHours}時間${remainingMinutes}分`;
    },

    async loadPlaytimeData() {
        try {
            const data = await fs.readFile(PLAYTIME_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    },

    async savePlaytimeData(data) {
        await fs.mkdir(path.dirname(PLAYTIME_FILE), { recursive: true });
        await fs.writeFile(PLAYTIME_FILE, JSON.stringify(data, null, 2));
    },

    async trackGameStart(userId, gameName, timestamp) {
        const data = await this.loadPlaytimeData();
        if (!data[userId]) {
            data[userId] = {};
        }
        if (!data[userId][gameName]) {
            data[userId][gameName] = {
                totalTime: 0,
                lastPlayed: timestamp,
                sessionStart: timestamp
            };
        } else {
            data[userId][gameName].sessionStart = timestamp;
        }
        await this.savePlaytimeData(data);
    },

    async trackGameEnd(userId, gameName, timestamp) {
        const data = await this.loadPlaytimeData();
        if (!data[userId]?.[gameName]?.sessionStart) return;

        const playtime = Math.floor((timestamp - data[userId][gameName].sessionStart) / 1000 / 60);
        data[userId][gameName].totalTime = (data[userId][gameName].totalTime || 0) + playtime;
        data[userId][gameName].lastPlayed = timestamp;
        delete data[userId][gameName].sessionStart;

        await this.savePlaytimeData(data);
    }
};