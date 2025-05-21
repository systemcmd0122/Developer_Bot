const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const supabase = require('../utils/supabase');

module.exports = {
    category: 'ロール管理',
    data: new SlashCommandBuilder()
        .setName('roleboard')
        .setDescription('ロール付与・削除用のボードを管理')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('新しいロールボードを作成')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('ボードの名前')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('ボードの説明')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('ロールをボードに追加')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('ボードの名前')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('追加するロール')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('ロールの説明')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('ロールをボードから削除')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('ボードの名前')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('削除するロール')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('ボードを削除')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('削除するボードの名前')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('ボードを更新')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('更新するボードの名前')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Supabaseテーブルの初期設定
        await this.initializeDatabase();

        switch (subcommand) {
            case 'create':
                await this.handleCreate(interaction);
                break;
            case 'add':
                await this.handleAdd(interaction);
                break;
            case 'remove':
                await this.handleRemove(interaction);
                break;
            case 'delete':
                await this.handleDelete(interaction);
                break;
            case 'refresh':
                await this.handleRefresh(interaction);
                break;
        }
    },

    async initializeDatabase() {
        // roleboardsテーブルが存在しない場合は作成
        const { error: boardError } = await supabase.schema.createTable('roleboards', {
            id: 'uuid',
            guild_id: 'text',
            name: 'text',
            message_id: 'text',
            channel_id: 'text',
            description: 'text',
            created_at: 'timestamp with time zone',
            primary: ['id'],
            unique: ['guild_id', 'name']
        }).ifNotExists();

        // roleboard_rolesテーブルが存在しない場合は作成
        const { error: rolesError } = await supabase.schema.createTable('roleboard_roles', {
            id: 'uuid',
            board_id: 'uuid',
            role_id: 'text',
            role_name: 'text',
            description: 'text',
            created_at: 'timestamp with time zone',
            primary: ['id'],
            foreign: {
                board_id: {
                    table: 'roleboards',
                    column: 'id'
                }
            }
        }).ifNotExists();
    },

    async handleCreate(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description') || 'ロールを選択してください';

        try {
            // 既存のボードをチェック
            const { data: existingBoard } = await supabase
                .from('roleboards')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (existingBoard) {
                return await interaction.editReply('そのボード名は既に使用されています。');
            }

            // 新しいボードを作成
            const embed = new EmbedBuilder()
                .setTitle(`🎭 ${name}`)
                .setDescription(description)
                .setColor('#FF6B6B')
                .setFooter({ text: '下のボタンをクリックしてロールを設定できます' })
                .setTimestamp();

            const message = await interaction.channel.send({
                embeds: [embed],
                components: []
            });

            // Supabaseに保存
            const { data: board, error } = await supabase
                .from('roleboards')
                .insert({
                    guild_id: interaction.guildId,
                    name: name,
                    message_id: message.id,
                    channel_id: interaction.channel.id,
                    description: description,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            await interaction.editReply(`ロールボード「${name}」を作成しました。`);
        } catch (error) {
            console.error('ロールボード作成エラー:', error);
            await interaction.editReply('ロールボードの作成中にエラーが発生しました。');
        }
    },

    async handleAdd(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');
        const role = interaction.options.getRole('role');
        const description = interaction.options.getString('description') || '説明なし';

        try {
            // ボードを取得
            const { data: board, error: boardError } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (boardError || !board) {
                return await interaction.editReply('指定されたボードが見つかりません。');
            }

            // ロールが既に追加されているか確認
            const { data: existingRole } = await supabase
                .from('roleboard_roles')
                .select('id')
                .eq('board_id', board.id)
                .eq('role_id', role.id)
                .single();

            if (existingRole) {
                return await interaction.editReply('そのロールは既にボードに追加されています。');
            }

            // ロールを追加
            const { error: roleError } = await supabase
                .from('roleboard_roles')
                .insert({
                    board_id: board.id,
                    role_id: role.id,
                    role_name: role.name,
                    description: description,
                    created_at: new Date().toISOString()
                });

            if (roleError) throw roleError;

            // ボードを更新
            await this.updateBoardMessage(interaction.client, board.id);

            await interaction.editReply(`ロール「${role.name}」をボード「${name}」に追加しました。`);
        } catch (error) {
            console.error('ロール追加エラー:', error);
            await interaction.editReply('ロールの追加中にエラーが発生しました。');
        }
    },

    async handleRemove(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');
        const role = interaction.options.getRole('role');

        try {
            // ボードを取得
            const { data: board, error: boardError } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (boardError || !board) {
                return await interaction.editReply('指定されたボードが見つかりません。');
            }

            // ロールを削除
            const { error: roleError } = await supabase
                .from('roleboard_roles')
                .delete()
                .eq('board_id', board.id)
                .eq('role_id', role.id);

            if (roleError) throw roleError;

            // ボードを更新
            await this.updateBoardMessage(interaction.client, board.id);

            await interaction.editReply(`ロール「${role.name}」をボード「${name}」から削除しました。`);
        } catch (error) {
            console.error('ロール削除エラー:', error);
            await interaction.editReply('ロールの削除中にエラーが発生しました。');
        }
    },

    async handleDelete(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');

        try {
            // ボードを取得
            const { data: board, error: boardError } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (boardError || !board) {
                return await interaction.editReply('指定されたボードが見つかりません。');
            }

            // メッセージを削除
            try {
                const channel = await interaction.guild.channels.fetch(board.channel_id);
                const message = await channel.messages.fetch(board.message_id);
                await message.delete();
            } catch (error) {
                console.error('メッセージ削除エラー:', error);
            }

            // ボードを削除（関連するロールは自動的に削除される）
            const { error: deleteError } = await supabase
                .from('roleboards')
                .delete()
                .eq('id', board.id);

            if (deleteError) throw deleteError;

            await interaction.editReply(`ロールボード「${name}」を削除しました。`);
        } catch (error) {
            console.error('ボード削除エラー:', error);
            await interaction.editReply('ボードの削除中にエラーが発生しました。');
        }
    },

    async handleRefresh(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');

        try {
            // ボードを取得
            const { data: board, error: boardError } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (boardError || !board) {
                return await interaction.editReply('指定されたボードが見つかりません。');
            }

            // 古いメッセージを削除
            try {
                const channel = await interaction.guild.channels.fetch(board.channel_id);
                const oldMessage = await channel.messages.fetch(board.message_id);
                await oldMessage.delete();
            } catch (error) {
                console.error('古いメッセージ削除エラー:', error);
            }

            // 新しいメッセージを作成
            const channel = await interaction.guild.channels.fetch(board.channel_id);
            const embed = new EmbedBuilder()
                .setTitle(`🎭 ${board.name}`)
                .setDescription(board.description)
                .setColor('#FF6B6B')
                .setFooter({ text: '下のボタンをクリックしてロールを設定できます' })
                .setTimestamp();

            const message = await channel.send({
                embeds: [embed],
                components: []
            });

            // メッセージIDを更新
            const { error: updateError } = await supabase
                .from('roleboards')
                .update({ message_id: message.id })
                .eq('id', board.id);

            if (updateError) throw updateError;

            // ボードを更新
            await this.updateBoardMessage(interaction.client, board.id);

            await interaction.editReply(`ロールボード「${name}」を更新しました。`);
        } catch (error) {
            console.error('ボード更新エラー:', error);
            await interaction.editReply('ボードの更新中にエラーが発生しました。');
        }
    },

    async updateBoardMessage(client, boardId) {
        try {
            // ボード情報を取得
            const { data: board, error: boardError } = await supabase
                .from('roleboards')
                .select('*')
                .eq('id', boardId)
                .single();

            if (boardError || !board) throw new Error('ボードが見つかりません。');

            // ロールを取得
            const { data: roles, error: rolesError } = await supabase
                .from('roleboard_roles')
                .select('*')
                .eq('board_id', boardId);

            if (rolesError) throw rolesError;

            try {
                const channel = await client.channels.fetch(board.channel_id);
                const message = await channel.messages.fetch(board.message_id);

                // Embedを更新
                let description = board.description + '\n\n';
                roles.forEach(role => {
                    description += `<@&${role.role_id}>: ${role.description}\n`;
                });

                const embed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(description);

                // ボタンを作成
                const components = [];
                for (let i = 0; i < roles.length; i += 5) {
                    const row = new ActionRowBuilder();
                    const chunk = roles.slice(i, i + 5);

                    chunk.forEach(role => {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`role-${role.role_id}`)
                                .setLabel(role.role_name)
                                .setStyle(ButtonStyle.Primary)
                        );
                    });

                    components.push(row);
                }

                // メッセージを更新
                await message.edit({
                    embeds: [embed],
                    components: components
                });
            } catch (error) {
                console.error('メッセージ更新エラー:', error);
                throw error;
            }
        } catch (error) {
            console.error('ボード更新エラー:', error);
            throw error;
        }
    },

    async handleRoleButtonClick(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith('role-')) return;

        await interaction.deferReply({ ephemeral: true });

        try {
            const roleId = interaction.customId.replace('role-', '');
            const member = interaction.member;
            const role = await interaction.guild.roles.fetch(roleId);

            if (!role) {
                return await interaction.editReply('このロールは存在しないか削除されています。');
            }

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                await interaction.editReply(`ロール「${role.name}」を削除しました。`);
            } else {
                await member.roles.add(roleId);
                await interaction.editReply(`ロール「${role.name}」を追加しました。`);
            }
        } catch (error) {
            console.error('ロール操作エラー:', error);
            await interaction.editReply('ロールの操作中にエラーが発生しました。');
        }
    }
};
