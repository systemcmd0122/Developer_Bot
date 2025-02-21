// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category: 'サーバー管理',
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('サーバーの詳細な統計情報を表示し、管理機能を提供します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('overview')
                .setDescription('サーバーの詳細な統計情報を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('activity')
                .setDescription('メンバーのアクティビティ統計を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('未使用のロールとチャンネルを検出')
                .addBooleanOption(option =>
                    option
                        .setName('execute')
                        .setDescription('検出された項目を削除するかどうか')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'overview') {
            const guild = interaction.guild;
            await guild.members.fetch();
            await guild.channels.fetch();
            await guild.roles.fetch();

            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(member => 
                member.presence?.status === 'online' || 
                member.presence?.status === 'idle' || 
                member.presence?.status === 'dnd'
            ).size;
            const botsCount = guild.members.cache.filter(member => member.user.bot).size;
            const channelStats = {
                total: guild.channels.cache.size,
                text: guild.channels.cache.filter(c => c.type === 0).size,
                voice: guild.channels.cache.filter(c => c.type === 2).size,
                categories: guild.channels.cache.filter(c => c.type === 4).size
            };

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} の統計情報`)
                .setColor('#00ff00')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { 
                        name: '👥 メンバー統計', 
                        value: `総メンバー数: ${totalMembers}\nオンライン: ${onlineMembers}\nボット: ${botsCount}`,
                        inline: true 
                    },
                    { 
                        name: '📝 チャンネル統計', 
                        value: `総チャンネル数: ${channelStats.total}\nテキスト: ${channelStats.text}\n` +
                               `ボイス: ${channelStats.voice}\nカテゴリ: ${channelStats.categories}`,
                        inline: true 
                    },
                    {
                        name: '🎭 ロール情報',
                        value: `総ロール数: ${guild.roles.cache.size}\n` +
                               `カスタムロール: ${guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone').size}`,
                        inline: true
                    },
                    {
                        name: '🔄 サーバー詳細',
                        value: `作成日: ${guild.createdAt.toLocaleDateString()}\n` +
                               `ブースト数: ${guild.premiumSubscriptionCount || 0}\n` +
                               `認証レベル: ${guild.verificationLevel}`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'activity') {
            const guild = interaction.guild;
            await guild.members.fetch();

            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            const joinedLast30Days = guild.members.cache.filter(member => 
                member.joinedTimestamp > thirtyDaysAgo
            ).size;

            const activeMembers = guild.members.cache.filter(member => 
                member.presence?.activities?.length > 0
            ).size;

            const statusCounts = {
                online: guild.members.cache.filter(m => m.presence?.status === 'online').size,
                idle: guild.members.cache.filter(m => m.presence?.status === 'idle').size,
                dnd: guild.members.cache.filter(m => m.presence?.status === 'dnd').size,
                offline: guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size
            };

            const embed = new EmbedBuilder()
                .setTitle(`📈 ${guild.name} のアクティビティ統計`)
                .setColor('#0099ff')
                .addFields(
                    {
                        name: '📅 新規メンバー',
                        value: `過去30日間の参加: ${joinedLast30Days}名`,
                        inline: true
                    },
                    {
                        name: '🎮 現在のアクティビティ',
                        value: `アクティブメンバー: ${activeMembers}名`,
                        inline: true
                    },
                    {
                        name: '🟢 オンラインステータス',
                        value: `オンライン: ${statusCounts.online}\n` +
                               `退席中: ${statusCounts.idle}\n` +
                               `取り込み中: ${statusCounts.dnd}\n` +
                               `オフライン: ${statusCounts.offline}`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'cleanup') {
            const execute = interaction.options.getBoolean('execute');
            const guild = interaction.guild;
            
            // 未使用のロールとチャンネルを検出
            const unusedRoles = guild.roles.cache.filter(role => 
                !role.managed && 
                role.name !== '@everyone' && 
                role.members.size === 0
            );

            const emptyChannels = guild.channels.cache.filter(channel => 
                (channel.type === 0 || channel.type === 2) && // テキストまたはボイスチャンネル
                channel.members.size === 0 &&
                !channel.isThread()
            );

            const embed = new EmbedBuilder()
                .setTitle('🧹 クリーンアップ分析')
                .setColor(execute ? '#ff0000' : '#ffff00')
                .addFields(
                    {
                        name: '未使用ロール',
                        value: unusedRoles.size > 0 ? 
                            unusedRoles.map(r => r.name).join('\n') : 
                            '未使用のロールはありません',
                        inline: false
                    },
                    {
                        name: '空のチャンネル',
                        value: emptyChannels.size > 0 ? 
                            emptyChannels.map(c => c.name).join('\n') : 
                            '空のチャンネルはありません',
                        inline: false
                    }
                );

            if (execute) {
                let deletedRoles = 0;
                let deletedChannels = 0;

                for (const [, role] of unusedRoles) {
                    try {
                        await role.delete('自動クリーンアップ');
                        deletedRoles++;
                    } catch (error) {
                        console.error(`Failed to delete role ${role.name}:`, error);
                    }
                }

                for (const [, channel] of emptyChannels) {
                    try {
                        await channel.delete('自動クリーンアップ');
                        deletedChannels++;
                    } catch (error) {
                        console.error(`Failed to delete channel ${channel.name}:`, error);
                    }
                }

                embed.addFields({
                    name: '🗑️ クリーンアップ結果',
                    value: `削除されたロール: ${deletedRoles}\n` +
                           `削除されたチャンネル: ${deletedChannels}`,
                    inline: false
                });
            } else {
                embed.setDescription('これは分析モードです。削除を実行するには `execute: true` オプションを使用してください。');
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};