const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const supabase = require('../utils/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleboard')
        .setDescription('ロール付与ボードを管理します')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('新しいロール付与ボードを作成します')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('ロールボードの名前')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('ロールボードの説明')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_role')
                .setDescription('ロールボードにロールを追加します')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ロールボードのメッセージID')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('追加するロール')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('ロールに紐付ける絵文字')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('ロールの説明')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove_role')
                .setDescription('ロールボードからロールを削除します')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ロールボードのメッセージID')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('削除するロール')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('ロールボードを削除します')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ロールボードのメッセージID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('サーバー内のロールボード一覧を表示します')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction);
                    break;
                case 'add_role':
                    await handleAddRole(interaction);
                    break;
                case 'remove_role':
                    await handleRemoveRole(interaction);
                    break;
                case 'delete':
                    await handleDelete(interaction);
                    break;
                case 'list':
                    await handleList(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error in roleboard command:', error);
            await interaction.editReply({
                content: 'コマンドの実行中にエラーが発生しました。',
                ephemeral: true
            });
        }
    }
};

async function handleCreate(interaction) {
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');

    // ロールボードの説明用Embedを作成
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(name)
        .setDescription(description)
        .addFields(
            { name: '使い方', value: '下の絵文字をクリックしてロールを取得/削除できます' },
            { name: 'ロール一覧', value: '現在登録されているロールはありません' }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

    try {
        // メッセージを送信
        const message = await interaction.channel.send({ embeds: [embed] });

        // Supabaseにロールボードを登録
        const { error } = await supabase
            .from('roleboards')
            .insert({
                guild_id: interaction.guildId,
                channel_id: interaction.channelId,
                message_id: message.id,
                name: name,
                description: description,
                created_by: interaction.user.id
            })
            .select()
            .single();

        if (error) throw error;

        await interaction.editReply({
            content: `ロールボード「${name}」を作成しました。\nメッセージID: ${message.id}`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error creating roleboard:', error);
        await interaction.editReply({
            content: 'ロールボードの作成中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleAddRole(interaction) {
    const messageId = interaction.options.getString('message_id');
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    const description = interaction.options.getString('description') || '';

    try {
        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', messageId)
            .eq('guild_id', interaction.guildId)
            .eq('active', true)
            .single();

        if (boardError || !board) {
            await interaction.editReply({
                content: '指定されたロールボードが見つかりません。',
                ephemeral: true
            });
            return;
        }

        // 絵文字の重複チェック
        const { data: existingRole } = await supabase
            .from('roleboard_roles')
            .select('*')
            .eq('board_id', board.id)
            .eq('emoji', emoji)
            .maybeSingle();

        if (existingRole) {
            await interaction.editReply({
                content: 'この絵文字は既に使用されています。',
                ephemeral: true
            });
            return;
        }

        // ロールを登録
        const { error: insertError } = await supabase
            .from('roleboard_roles')
            .insert({
                board_id: board.id,
                role_id: role.id,
                emoji: emoji,
                description: description
            });

        if (insertError) throw insertError;

        // メッセージを取得して更新
        const message = await interaction.channel.messages.fetch(messageId);
        const embed = message.embeds[0];
        const roleList = await getRoleList(board.id, interaction.guild);

        const updatedEmbed = EmbedBuilder.from(embed)
            .setFields(
                { name: '使い方', value: '下の絵文字をクリックしてロールを取得/削除できます' },
                { name: 'ロール一覧', value: roleList }
            );

        await message.edit({ embeds: [updatedEmbed] });
        await message.react(emoji);

        await interaction.editReply({
            content: `ロール「${role.name}」を追加しました。`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error adding role:', error);
        await interaction.editReply({
            content: 'ロールの追加中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleRemoveRole(interaction) {
    const messageId = interaction.options.getString('message_id');
    const role = interaction.options.getRole('role');

    try {
        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', messageId)
            .eq('guild_id', interaction.guildId)
            .eq('active', true)
            .single();

        if (boardError || !board) {
            await interaction.editReply({
                content: '指定されたロールボードが見つかりません。',
                ephemeral: true
            });
            return;
        }

        // ロール情報を取得
        const { data: roleData, error: roleError } = await supabase
            .from('roleboard_roles')
            .select('*')
            .eq('board_id', board.id)
            .eq('role_id', role.id)
            .single();

        if (roleError || !roleData) {
            await interaction.editReply({
                content: 'このロールはロールボードに登録されていません。',
                ephemeral: true
            });
            return;
        }

        // ロールを削除
        const { error: deleteError } = await supabase
            .from('roleboard_roles')
            .delete()
            .eq('id', roleData.id);

        if (deleteError) throw deleteError;

        // メッセージを更新
        const message = await interaction.channel.messages.fetch(messageId);
        const embed = message.embeds[0];
        const roleList = await getRoleList(board.id, interaction.guild);

        const updatedEmbed = EmbedBuilder.from(embed)
            .setFields(
                { name: '使い方', value: '下の絵文字をクリックしてロールを取得/削除できます' },
                { name: 'ロール一覧', value: roleList || 'ロールが登録されていません' }
            );

        await message.edit({ embeds: [updatedEmbed] });
        await message.reactions.cache.get(roleData.emoji)?.remove();

        await interaction.editReply({
            content: `ロール「${role.name}」を削除しました。`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error removing role:', error);
        await interaction.editReply({
            content: 'ロールの削除中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleDelete(interaction) {
    const messageId = interaction.options.getString('message_id');

    try {
        // ロールボードを検索して非アクティブ化
        const { data: board, error: updateError } = await supabase
            .from('roleboards')
            .update({ active: false })
            .eq('message_id', messageId)
            .eq('guild_id', interaction.guildId)
            .select()
            .single();

        if (updateError || !board) {
            await interaction.editReply({
                content: '指定されたロールボードが見つかりません。',
                ephemeral: true
            });
            return;
        }

        // メッセージを削除
        const message = await interaction.channel.messages.fetch(messageId);
        await message.delete();

        await interaction.editReply({
            content: `ロールボード「${board.name}」を削除しました。`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error deleting roleboard:', error);
        await interaction.editReply({
            content: 'ロールボードの削除中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleList(interaction) {
    try {
        // アクティブなロールボードを検索
        const { data: boards, error } = await supabase
            .from('roleboards')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!boards || boards.length === 0) {
            await interaction.editReply({
                content: 'このサーバーにはロールボードが存在しません。',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('ロールボード一覧')
            .setDescription('このサーバーのロールボード一覧です')
            .addFields(
                boards.map(board => ({
                    name: board.name,
                    value: `ID: ${board.message_id}\nチャンネル: <#${board.channel_id}>\n作成者: <@${board.created_by}>\n作成日: ${new Date(board.created_at).toLocaleDateString()}`
                }))
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error listing roleboards:', error);
        await interaction.editReply({
            content: 'ロールボード一覧の取得中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function getRoleList(boardId, guild) {
    const { data: roles, error } = await supabase
        .from('roleboard_roles')
        .select('*')
        .eq('board_id', boardId)
        .order('id', { ascending: true });

    if (error || !roles || roles.length === 0) {
        return '現在登録されているロールはありません';
    }

    return roles.map(role => {
        const description = role.description ? ` - ${role.description}` : '';
        return `${role.emoji} <@&${role.role_id}>${description}`;
    }).join('\n');
}
