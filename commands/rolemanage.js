// commands/rolemanage.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolemanage')
        .setDescription('サーバーのロール管理を高度にサポート')
        .addSubcommand(subcommand => 
            subcommand
                .setName('create')
                .setDescription('新しいロール選択ボードを作成')
                .addStringOption(option => 
                    option
                        .setName('name')
                        .setDescription('ロール選択ボードの名前')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('description')
                        .setDescription('ロール選択ボードの説明')
                        .setRequired(false)
                )
                .addStringOption(option => 
                    option
                        .setName('category')
                        .setDescription('ロールのカテゴリ（オプション）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('list')
                .setDescription('現在のロールボードを一覧表示')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('delete')
                .setDescription('ロールボードを削除')
                .addStringOption(option => 
                    option
                        .setName('name')
                        .setDescription('削除するロールボードの名前')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // サーバー内でロールボードを管理するためのオブジェクト
        const serverRoleBoards = interaction.client.roleBoards || {};
        interaction.client.roleBoards = serverRoleBoards;

        const subcommand = interaction.options.getSubcommand();

        // ロールボード作成
        if (subcommand === 'create') {
            const name = interaction.options.getString('name');
            const description = interaction.options.getString('description') || 'ロールを選択してください';
            const category = interaction.options.getString('category');

            // サーバーの全ロールを取得（特定の条件に基づいてフィルタリング）
            const roles = interaction.guild.roles.cache
                .filter(role => 
                    role.name !== '@everyone' && 
                    !role.managed && 
                    role.position < interaction.guild.members.me.roles.highest.position &&
                    // 管理者権限を持つロールを除外
                    !role.permissions.has('Administrator')
                )
                .sort((a, b) => b.position - a.position);

            if (roles.size === 0) {
                return interaction.reply({
                    content: '選択可能なロールがありません。',
                    ephemeral: true
                });
            }

            // カテゴリでフィルタリングするオプションを追加
            const filteredRoles = category 
                ? roles.filter(role => role.name.toLowerCase().includes(category.toLowerCase()))
                : roles;

            if (filteredRoles.size === 0) {
                return interaction.reply({
                    content: `カテゴリ「${category}」に該当するロールがありません。`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎭 ${name}`)
                .setDescription(description)
                .setColor('#ff00ff')
                .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`role-board-${name}`)
                .setPlaceholder('ロールを選択')
                .setMinValues(0)
                .setMaxValues(filteredRoles.size)
                .addOptions(
                    filteredRoles.map(role => ({
                        label: role.name,
                        value: role.id,
                        description: `メンバー数: ${role.members.size}`,
                        default: interaction.member.roles.cache.has(role.id)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const roleBoard = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            // ロールボード情報を保存
            serverRoleBoards[name] = {
                messageId: roleBoard.id,
                channelId: interaction.channel.id,
                roles: Array.from(filteredRoles.keys()),
                category: category
            };

            return interaction.reply({
                content: `ロールボード「${name}」を作成しました。`,
                ephemeral: true
            });
        }

        // ロールボード一覧
        if (subcommand === 'list') {
            if (Object.keys(serverRoleBoards).length === 0) {
                return interaction.reply({
                    content: '現在、ロールボードは作成されていません。',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎭 ロールボード一覧')
                .setColor('#0099ff');

            Object.entries(serverRoleBoards).forEach(([name, board]) => {
                embed.addFields({
                    name: name,
                    value: `カテゴリ: ${board.category || 'なし'}\nロール数: ${board.roles.length}`,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ロールボード削除
        if (subcommand === 'delete') {
            const name = interaction.options.getString('name');

            if (!serverRoleBoards[name]) {
                return interaction.reply({
                    content: `ロールボード「${name}」は存在しません。`,
                    ephemeral: true
                });
            }

            const board = serverRoleBoards[name];
            const channel = interaction.guild.channels.cache.get(board.channelId);

            if (channel) {
                try {
                    const message = await channel.messages.fetch(board.messageId);
                    await message.delete();
                } catch (error) {
                    console.error('メッセージ削除中にエラーが発生:', error);
                }
            }

            delete serverRoleBoards[name];

            return interaction.reply({
                content: `ロールボード「${name}」を削除しました。`,
                ephemeral: true
            });
        }
    },

    async handleRoleInteraction(interaction) {
        // カスタムIDが role-board- で始まるインタラクションを処理
        if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('role-board-')) {
            return;
        }

        // すでに応答済みの場合は何もしない
        if (interaction.replied || interaction.deferred) {
            return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const roleBoards = interaction.client.roleBoards;

        // 対応するロールボードを見つける
        const boardName = interaction.customId.replace('role-board-', '');
        const board = roleBoards[boardName];

        if (!board) {
            return interaction.reply({
                content: 'このロールボードは無効です。',
                ephemeral: true
            });
        }

        // 現在のユーザーロールをフィルタリング
        const currentRoles = member.roles.cache
            .filter(role => board.roles.includes(role.id))
            .map(role => role.id);
        
        // 選択されたロールを追加し、選択解除されたロールを削除
        const rolesToAdd = interaction.values.filter(id => !currentRoles.includes(id));
        const rolesToRemove = currentRoles.filter(id => !interaction.values.includes(id));

        await member.roles.add(rolesToAdd);
        await member.roles.remove(rolesToRemove);

        const addedRoles = rolesToAdd.map(id => `<@&${id}>`).join(', ') || 'なし';
        const removedRoles = rolesToRemove.map(id => `<@&${id}>`).join(', ') || 'なし';

        const resultEmbed = new EmbedBuilder()
            .setTitle(`🎭 ロールボード: ${boardName}`)
            .addFields(
                { name: '追加したロール', value: addedRoles, inline: false },
                { name: '削除したロール', value: removedRoles, inline: false }
            )
            .setColor('#00ff00')
            .setTimestamp();

        // 応答を更新
        await interaction.deferUpdate();

        // 結果を表示
        await interaction.followUp({
            embeds: [resultEmbed],
            ephemeral: true
        });
    }
};