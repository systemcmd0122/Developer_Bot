const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// タイムログのデータ構造を保持するクラス
class TimeLogManager {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'timelogs.json');
        this.logs = this.loadLogs();
    }

    // ログデータを読み込む
    loadLogs() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf8');
                return JSON.parse(data);
            }
            return {
                users: {},
                teams: {},
                channels: {}
            };
        } catch (error) {
            console.error('Error loading time logs:', error);
            return {
                users: {},
                teams: {},
                channels: {}
            };
        }
    }

    // ログデータを保存する
    saveLogs() {
        try {
            const dirPath = path.dirname(this.dataPath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(this.dataPath, JSON.stringify(this.logs, null, 2));
        } catch (error) {
            console.error('Error saving time logs:', error);
        }
    }

    // ユーザーのセッションを開始
    startSession(userId, channelId, guildId, timestamp) {
        if (!this.logs.users[userId]) {
            this.logs.users[userId] = {
                sessions: [],
                totalTime: 0,
                weeklyTime: 0,
                monthlyTime: 0
            };
        }

        this.logs.users[userId].sessions.push({
            channelId,
            guildId,
            startTime: timestamp,
            endTime: null
        });

        this.saveLogs();
    }

    // ユーザーのセッションを終了
    endSession(userId, timestamp) {
        const userLogs = this.logs.users[userId];
        if (userLogs && userLogs.sessions.length > 0) {
            const lastSession = userLogs.sessions[userLogs.sessions.length - 1];
            if (lastSession && !lastSession.endTime) {
                lastSession.endTime = timestamp;
                const duration = timestamp - lastSession.startTime;
                
                // 合計時間を更新
                userLogs.totalTime += duration;
                
                // 週間・月間の時間を更新
                const now = new Date();
                const sessionDate = new Date(timestamp);
                if (this.isSameWeek(now, sessionDate)) {
                    userLogs.weeklyTime += duration;
                }
                if (this.isSameMonth(now, sessionDate)) {
                    userLogs.monthlyTime += duration;
                }

                this.saveLogs();
            }
        }
    }

    // 同じ週かどうかを判定
    isSameWeek(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        
        const weekStart1 = new Date(d1);
        weekStart1.setDate(d1.getDate() - d1.getDay());
        const weekStart2 = new Date(d2);
        weekStart2.setDate(d2.getDate() - d2.getDay());
        
        return weekStart1.getTime() === weekStart2.getTime();
    }

    // 同じ月かどうかを判定
    isSameMonth(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() && 
               date1.getMonth() === date2.getMonth();
    }

    // ユーザーの統計を取得
    getUserStats(userId) {
        const userLogs = this.logs.users[userId];
        if (!userLogs) return null;

        return {
            totalTime: this.formatDuration(userLogs.totalTime),
            weeklyTime: this.formatDuration(userLogs.weeklyTime),
            monthlyTime: this.formatDuration(userLogs.monthlyTime),
            sessionCount: userLogs.sessions.length
        };
    }

    // 時間のフォーマット
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return {
            hours: hours,
            minutes: minutes % 60,
            seconds: seconds % 60
        };
    }

    // ユーザーのログをリセット
    resetUserLogs(userId) {
        if (this.logs.users[userId]) {
            this.logs.users[userId] = {
                sessions: [],
                totalTime: 0,
                weeklyTime: 0,
                monthlyTime: 0
            };
            this.saveLogs();
        }
    }
}

// TimeLogManagerのインスタンスを作成
const timeLogManager = new TimeLogManager();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timelog')
        .setDescription('活動時間の記録と管理')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('活動時間の統計を表示')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('統計を表示するユーザー（省略時は自分）')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('活動時間の記録をリセット'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('team')
                .setDescription('チームの活動時間を表示')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('表示するチームのロール')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'stats':
                await this.handleStats(interaction);
                break;
            case 'reset':
                await this.handleReset(interaction);
                break;
            case 'team':
                await this.handleTeam(interaction);
                break;
        }
    },

    // stats サブコマンドの処理
    async handleStats(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const stats = timeLogManager.getUserStats(targetUser.id);

        if (!stats) {
            await interaction.reply({
                content: `${targetUser.username} の活動記録が見つかりません。`,
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`${targetUser.username} の活動時間統計`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                {
                    name: '📊 合計活動時間',
                    value: `${stats.totalTime.hours}時間 ${stats.totalTime.minutes}分 ${stats.totalTime.seconds}秒`,
                    inline: false
                },
                {
                    name: '📈 今週の活動時間',
                    value: `${stats.weeklyTime.hours}時間 ${stats.weeklyTime.minutes}分`,
                    inline: true
                },
                {
                    name: '📅 今月の活動時間',
                    value: `${stats.monthlyTime.hours}時間 ${stats.monthlyTime.minutes}分`,
                    inline: true
                },
                {
                    name: '🔢 総セッション数',
                    value: `${stats.sessionCount}回`,
                    inline: true
                }
            )
            .setFooter({ text: '最終更新' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    // reset サブコマンドの処理
    async handleReset(interaction) {
        const confirmButton = new ButtonBuilder()
            .setCustomId('timelog-reset-confirm')
            .setLabel('リセット確認')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('timelog-reset-cancel')
            .setLabel('キャンセル')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);

        const response = await interaction.reply({
            content: '⚠️ 活動時間の記録をリセットしますか？この操作は取り消せません。',
            components: [row],
            ephemeral: true
        });

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 30000
            });

            if (confirmation.customId === 'timelog-reset-confirm') {
                timeLogManager.resetUserLogs(interaction.user.id);
                await confirmation.update({
                    content: '✅ 活動時間の記録をリセットしました。',
                    components: []
                });
            } else {
                await confirmation.update({
                    content: 'リセットをキャンセルしました。',
                    components: []
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: '❌ タイムアウトしました。もう一度お試しください。',
                components: []
            });
        }
    },

    // team サブコマンドの処理
    async handleTeam(interaction) {
        const role = interaction.options.getRole('role');
        const members = role.members;
        
        if (members.size === 0) {
            await interaction.reply({
                content: 'このロールのメンバーが見つかりません。',
                ephemeral: true
            });
            return;
        }

        const teamStats = {
            totalTime: 0,
            weeklyTime: 0,
            monthlyTime: 0,
            memberCount: members.size,
            activeMemberCount: 0
        };

        members.forEach(member => {
            const stats = timeLogManager.getUserStats(member.id);
            if (stats) {
                teamStats.activeMemberCount++;
                const total = stats.totalTime.hours * 3600000 + 
                            stats.totalTime.minutes * 60000 + 
                            stats.totalTime.seconds * 1000;
                const weekly = stats.weeklyTime.hours * 3600000 + 
                             stats.weeklyTime.minutes * 60000;
                const monthly = stats.monthlyTime.hours * 3600000 + 
                              stats.monthlyTime.minutes * 60000;

                teamStats.totalTime += total;
                teamStats.weeklyTime += weekly;
                teamStats.monthlyTime += monthly;
            }
        });

        const formattedTotal = timeLogManager.formatDuration(teamStats.totalTime);
        const formattedWeekly = timeLogManager.formatDuration(teamStats.weeklyTime);
        const formattedMonthly = timeLogManager.formatDuration(teamStats.monthlyTime);

        const embed = new EmbedBuilder()
            .setColor(role.color || '#0099ff')
            .setTitle(`${role.name} チームの活動時間統計`)
            .addFields(
                {
                    name: '👥 チーム情報',
                    value: `メンバー数: ${teamStats.memberCount}\nアクティブメンバー: ${teamStats.activeMemberCount}`,
                    inline: false
                },
                {
                    name: '📊 チーム合計時間',
                    value: `${formattedTotal.hours}時間 ${formattedTotal.minutes}分`,
                    inline: false
                },
                {
                    name: '📈 今週の合計時間',
                    value: `${formattedWeekly.hours}時間 ${formattedWeekly.minutes}分`,
                    inline: true
                },
                {
                    name: '📅 今月の合計時間',
                    value: `${formattedMonthly.hours}時間 ${formattedMonthly.minutes}分`,
                    inline: true
                }
            )
            .setFooter({ text: '最終更新' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    // ボイスチャンネル参加時のイベントハンドラ
    handleVoiceStateUpdate(oldState, newState) {
        const userId = newState.member.user.id;
        
        // チャンネル参加時
        if (!oldState.channelId && newState.channelId) {
            timeLogManager.startSession(
                userId,
                newState.channelId,
                newState.guild.id,
                Date.now()
            );
        }
        // チャンネル退出時
        else if (oldState.channelId && !newState.channelId) {
            timeLogManager.endSession(userId, Date.now());
        }
        // チャンネル移動時
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            timeLogManager.endSession(userId, Date.now());
            timeLogManager.startSession(
                userId,
                newState.channelId,
                newState.guild.id,
                Date.now()
            );
        }
    }
};