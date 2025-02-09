const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicestats')
        .setDescription('ボイスチャンネルの活動統計を表示します')
        .addStringOption(option =>
            option.setName('view')
                .setDescription('表示する統計の種類')
                .setRequired(true)
                .addChoices(
                    { name: '現在のアクティビティ', value: 'current' },
                    { name: 'チャンネル人気度', value: 'popularity' }
                )),
    async execute(interaction) {
        await interaction.deferReply();
        const view = interaction.options.getString('view');
        const guild = interaction.guild;

        // 全ボイスチャンネルの情報を取得
        const voiceChannels = guild.channels.cache.filter(channel => 
            channel.type === 2  // GUILD_VOICE
        );

        let embed = new EmbedBuilder(); // Create embed here so it's available in both conditions

        if (view === 'current') {
            // 現在のアクティビティ表示
            const activeChannels = [];
            let totalUsers = 0;

            voiceChannels.forEach(channel => {
                const memberCount = channel.members.size;
                if (memberCount > 0) {
                    activeChannels.push({
                        name: channel.name,
                        count: memberCount,
                        members: Array.from(channel.members.values())
                            .map(m => m.displayName)
                    });
                    totalUsers += memberCount;
                }
            });

            embed
                .setTitle('🎤 ボイスチャンネルアクティビティ')
                .setColor('#4CAF50')
                .setDescription(`現在の通話参加者: ${totalUsers}人`)
                .setTimestamp();

            // アクティブなチャンネルの情報を表示
            activeChannels.forEach(channel => {
                const memberList = channel.members.length > 5
                    ? channel.members.slice(0, 5).join(', ') + ` ...他${channel.members.length - 5}人`
                    : channel.members.join(', ');

                embed.addFields({
                    name: `${channel.name} (${channel.count}人)`,
                    value: memberList || 'なし',
                    inline: false
                });
            });

            // サーバー全体の統計
            embed.addFields({
                name: '📊 全体の統計',
                value: `総チャンネル数: ${voiceChannels.size}\n` +
                       `アクティブチャンネル: ${activeChannels.length}\n` +
                       `使用率: ${Math.round((activeChannels.length / voiceChannels.size) * 100)}%`,
                inline: false
            });

        } else if (view === 'popularity') {
            // チャンネルの人気度分析
            const channelStats = new Map();
            let maxMembers = 0;

            voiceChannels.forEach(channel => {
                const memberCount = channel.members.size;
                maxMembers = Math.max(maxMembers, memberCount);
                
                channelStats.set(channel.name, {
                    current: memberCount,
                    maxCapacity: channel.userLimit || '∞',
                    usagePercentage: channel.userLimit 
                        ? Math.round((memberCount / channel.userLimit) * 100) 
                        : 0
                });
            });

            // 結果を視覚的に表示
            embed
                .setTitle('📊 ボイスチャンネル人気度分析')
                .setColor('#2196F3')
                .setDescription('チャンネルごとの使用状況と容量')
                .setTimestamp();

            channelStats.forEach((stats, channelName) => {
                const barLength = 20;
                const filledBars = Math.round((stats.current / (stats.maxCapacity === '∞' ? maxMembers : stats.maxCapacity)) * barLength);
                const progressBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars);

                embed.addFields({
                    name: channelName,
                    value: `${progressBar} ${stats.current}/${stats.maxCapacity}\n` +
                           `使用率: ${stats.usagePercentage}%`,
                    inline: false
                });
            });

            // 推奨チャンネル
            const recommendedChannel = Array.from(channelStats.entries())
                .sort((a, b) => a[1].current - b[1].current)[0];

            if (recommendedChannel) {
                embed.addFields({
                    name: '💡 おすすめチャンネル',
                    value: `**${recommendedChannel[0]}**が空いています！\n` +
                           `現在の参加者: ${recommendedChannel[1].current}人`,
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};