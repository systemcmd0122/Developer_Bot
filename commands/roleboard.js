const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const supabase = require('../utils/supabase');

module.exports = {
    category: 'ロール管理',
    data: new SlashCommandBuilder()
        .setName('roleboard')
        .setDescription('ロール付与・削除用のリアクションボードを管理')
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
                    option.setName('emoji')
                        .setDescription('ロール用の絵文字（例：👍）')
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

    async handleCreate(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description') || 'リアクションをクリックしてロールを取得できます';

        try {
            // 既存のボードをチェック
            const { data: existingBoard } = await supabase
                .from('roleboards')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (existingBoard) {
                return await interaction.editReply(`ロールボード「${name}」は既に存在します。`);
            }

            // 新しいボードを作成
            const embed = new EmbedBuilder()
                .setTitle(`🎭 ${name}`)
                .setDescription(description)
                .setColor('#FF6B6B')
                .setFooter({ text: '下のリアクションをクリックしてロールを設定できます' })
                .setTimestamp();

            const message = await interaction.channel.send({
                embeds: [embed]
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
                    created_by: interaction.user.id,
                    active: true
                })
                .select()
                .single();

            if (error) {
                console.error('ロールボード作成エラー:', error);
                await message.delete();
                return await interaction.editReply('ロールボードの作成中にエラーが発生しました。');
            }

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
        const emoji = interaction.options.getString('emoji');
        const description = interaction.options.getString('description') || '説明なし';

        try {
            // ボードを取得
            const { data: board } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (!board) {
                return await interaction.editReply(`ロールボード「${name}」が見つかりません。`);
            }

            // 絵文字が既に使用されているかチェック
            const { data: existingRole } = await supabase
                .from('roleboard_roles')
                .select('*')
                .eq('board_id', board.id)
                .eq('emoji', emoji)
                .single();

            if (existingRole) {
                return await interaction.editReply(`この絵文字は既に使用されています。`);
            }

            // ロールを追加
            const { error } = await supabase
                .from('roleboard_roles')
                .insert({
                    board_id: board.id,
                    role_id: role.id,
                    role_name: role.name,
                    emoji: emoji,
                    description: description,
                    position: 0
                });

            if (error) {
                console.error('ロール追加エラー:', error);
                return await interaction.editReply('ロールの追加中にエラーが発生しました。');
            }

            // メッセージを更新
            await this.updateBoardMessage(interaction.client, board.id);
            await interaction.editReply(`ロールボード「${name}」にロール「${role.name}」を追加しました。`);

            // メッセージにリアクションを追加
            const message = await interaction.channel.messages.fetch(board.message_id);
            await message.react(emoji);
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
            const { data: board } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (!board) {
                return await interaction.editReply(`ロールボード「${name}」が見つかりません。`);
            }

            // ロール情報を取得
            const { data: roleData } = await supabase
                .from('roleboard_roles')
                .select('*')
                .eq('board_id', board.id)
                .eq('role_id', role.id)
                .single();

            if (!roleData) {
                return await interaction.editReply(`このロールはボードに存在しません。`);
            }

            // ロールを削除
            const { error } = await supabase
                .from('roleboard_roles')
                .delete()
                .eq('id', roleData.id);

            if (error) {
                console.error('ロール削除エラー:', error);
                return await interaction.editReply('ロールの削除中にエラーが発生しました。');
            }

            // メッセージを更新
            const message = await interaction.channel.messages.fetch(board.message_id);
            await message.reactions.cache.get(roleData.emoji)?.remove();
            await this.updateBoardMessage(interaction.client, board.id);
            
            await interaction.editReply(`ロールボード「${name}」からロール「${role.name}」を削除しました。`);
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
            const { data: board } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (!board) {
                return await interaction.editReply(`ロールボード「${name}」が見つかりません。`);
            }

            // メッセージを削除
            const message = await interaction.channel.messages.fetch(board.message_id).catch(() => null);
            if (message) {
                await message.delete();
            }

            // ボードを削除
            const { error } = await supabase
                .from('roleboards')
                .delete()
                .eq('id', board.id);

            if (error) {
                console.error('ボード削除エラー:', error);
                return await interaction.editReply('ボードの削除中にエラーが発生しました。');
            }

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
            const { data: board } = await supabase
                .from('roleboards')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('name', name)
                .single();

            if (!board) {
                return await interaction.editReply(`ロールボード「${name}」が見つかりません。`);
            }

            // メッセージを更新
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
            const { data: board } = await supabase
                .from('roleboards')
                .select('*')
                .eq('id', boardId)
                .single();

            if (!board) {
                throw new Error('ボードが見つかりません。');
            }

            // ロール情報を取得
            const { data: roles } = await supabase
                .from('roleboard_roles')
                .select('*')
                .eq('board_id', boardId)
                .order('position', { ascending: true });

            // チャンネルとメッセージを取得
            const guild = await client.guilds.fetch(board.guild_id);
            const channel = await guild.channels.fetch(board.channel_id);
            const message = await channel.messages.fetch(board.message_id);

            // Embedを作成
            const embed = new EmbedBuilder()
                .setTitle(`🎭 ${board.name}`)
                .setDescription(board.description + '\n\n' + 
                    (roles.length > 0 
                        ? roles.map(role => `${role.emoji} : <@&${role.role_id}> - ${role.description}`).join('\n')
                        : '*ロールが設定されていません*'))
                .setColor('#FF6B6B')
                .setFooter({ text: '下のリアクションをクリックしてロールを設定できます' })
                .setTimestamp();

            // メッセージを更新
            await message.edit({ embeds: [embed] });

            // リアクションを更新
            await message.reactions.removeAll();
            for (const role of roles) {
                await message.react(role.emoji);
            }
        } catch (error) {
            console.error('メッセージ更新エラー:', error);
            throw error;
        }
    }
};
