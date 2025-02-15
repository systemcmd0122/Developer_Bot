// commands/rolemanage.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolemanage')
        .setDescription('サーバーのロール管理を高度にサポート')
        .addSubcommand(subcommand => 
            subcommand
                .setName('create')
                .setDescription('新しいロールボードを作成')
                .addStringOption(option => 
                    option
                        .setName('name')
                        .setDescription('ロールボードの名前')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('description')
                        .setDescription('ロールボードの説明')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('add')
                .setDescription('ロールボードにロールを追加')
                .addStringOption(option => 
                    option
                        .setName('board')
                        .setDescription('ロールボードの名前')
                        .setRequired(true)
                )
                .addRoleOption(option => 
                    option
                        .setName('role')
                        .setDescription('追加するロール')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('description')
                        .setDescription('ロールの説明')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('remove')
                .setDescription('ロールボードからロールを削除')
                .addStringOption(option => 
                    option
                        .setName('board')
                        .setDescription('ロールボードの名前')
                        .setRequired(true)
                )
                .addRoleOption(option => 
                    option
                        .setName('role')
                        .setDescription('削除するロール')
                        .setRequired(true)
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
        const serverRoleBoards = interaction.client.roleBoards;
        if (!interaction.client.roleBoards[interaction.guildId]) {
            interaction.client.roleBoards[interaction.guildId] = {};
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create': {
                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description') || 'ロールを選択してください';

                if (serverRoleBoards[interaction.guildId][name]) {
                    return interaction.reply({
                        content: 'そのロールボードは既に存在します。',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🎭 ${name}`)
                    .setDescription(description)
                    .setColor('#ff00ff')
                    .setTimestamp();

                const message = await interaction.channel.send({
                    embeds: [embed],
                    components: []
                });

                serverRoleBoards[interaction.guildId][name] = {
                    messageId: message.id,
                    channelId: interaction.channel.id,
                    roles: {},
                    description: description
                };

                return interaction.reply({
                    content: `ロールボード「${name}」を作成しました。`,
                    ephemeral: true
                });
            }

            case 'add': {
                const boardName = interaction.options.getString('board');
                const role = interaction.options.getRole('role');
                const description = interaction.options.getString('description') || '説明なし';

                const board = serverRoleBoards[interaction.guildId][boardName];
                if (!board) {
                    return interaction.reply({
                        content: 'そのロールボードは存在しません。',
                        ephemeral: true
                    });
                }

                if (board.roles[role.id]) {
                    return interaction.reply({
                        content: 'そのロールは既にボードに追加されています。',
                        ephemeral: true
                    });
                }

                board.roles[role.id] = {
                    name: role.name,
                    description: description
                };

                await this.updateRoleBoard(interaction, boardName);

                return interaction.reply({
                    content: `ロール「${role.name}」をボード「${boardName}」に追加しました。`,
                    ephemeral: true
                });
            }

            case 'remove': {
                const boardName = interaction.options.getString('board');
                const role = interaction.options.getRole('role');

                const board = serverRoleBoards[interaction.guildId][boardName];
                if (!board) {
                    return interaction.reply({
                        content: 'そのロールボードは存在しません。',
                        ephemeral: true
                    });
                }

                if (!board.roles[role.id]) {
                    return interaction.reply({
                        content: 'そのロールはボードに存在しません。',
                        ephemeral: true
                    });
                }

                delete board.roles[role.id];

                await this.updateRoleBoard(interaction, boardName);

                return interaction.reply({
                    content: `ロール「${role.name}」をボード「${boardName}」から削除しました。`,
                    ephemeral: true
                });
            }

            case 'list': {
                const boards = serverRoleBoards[interaction.guildId];
                if (Object.keys(boards).length === 0) {
                    return interaction.reply({
                        content: '現在、ロールボードは作成されていません。',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎭 ロールボード一覧')
                    .setColor('#0099ff');

                for (const [name, board] of Object.entries(boards)) {
                    const roleCount = Object.keys(board.roles).length;
                    const roleList = Object.entries(board.roles)
                        .map(([roleId, roleData]) => `<@&${roleId}>: ${roleData.description}`)
                        .join('\n');
                    
                    embed.addFields({
                        name: name,
                        value: `ロール数: ${roleCount}\n説明: ${board.description}\n\n${roleList || 'ロールがありません'}`,
                        inline: false
                    });
                }

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            case 'delete': {
                const name = interaction.options.getString('name');

                if (!serverRoleBoards[interaction.guildId][name]) {
                    return interaction.reply({
                        content: `ロールボード「${name}」は存在しません。`,
                        ephemeral: true
                    });
                }

                const board = serverRoleBoards[interaction.guildId][name];
                const channel = await interaction.guild.channels.fetch(board.channelId);

                try {
                    const message = await channel.messages.fetch(board.messageId);
                    await message.delete();
                } catch (error) {
                    console.error('メッセージ削除中にエラーが発生:', error);
                }

                delete serverRoleBoards[interaction.guildId][name];

                return interaction.reply({
                    content: `ロールボード「${name}」を削除しました。`,
                    ephemeral: true
                });
            }
        }
    },

    // 新しいヘルパーメソッド: ロールボードの更新を一元化
    async updateRoleBoard(interaction, boardName) {
        const board = interaction.client.roleBoards[interaction.guildId][boardName];
        if (!board) return false;

        try {
            const channel = await interaction.guild.channels.fetch(board.channelId);
            const message = await channel.messages.fetch(board.messageId);

            const embed = EmbedBuilder.from(message.embeds[0]);
            
            // ロールの説明を埋め込みに追加
            let description = board.description + '\n\n';
            for (const [roleId, roleData] of Object.entries(board.roles)) {
                description += `<@&${roleId}>: ${roleData.description}\n`;
            }
            
            embed.setDescription(description);

            // ボタンコンポーネントを再構築
            const components = [];
            const roleEntries = Object.entries(board.roles);
            
            // ロールが存在する場合のみボタンを作成
            if (roleEntries.length > 0) {
                // 5個ずつのボタングループに分割
                for (let i = 0; i < roleEntries.length; i += 5) {
                    const row = new ActionRowBuilder();
                    
                    // 現在のグループ内のロールでボタンを作成（最大5個）
                    const groupRoles = roleEntries.slice(i, i + 5);
                    for (const [roleId, roleData] of groupRoles) {
                        const button = new ButtonBuilder()
                            .setCustomId(`role-${roleId}`)
                            .setLabel(roleData.name)
                            .setStyle(ButtonStyle.Primary);
                        
                        row.addComponents(button);
                    }
                    
                    components.push(row);
                }
            }

            // メッセージを更新
            await message.edit({
                embeds: [embed],
                components: components
            });
            
            return true;
        } catch (error) {
            console.error('ロールボード更新中にエラーが発生:', error);
            return false;
        }
    },

    async handleRoleButton(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith('role-')) {
            return;
        }

        const roleId = interaction.customId.replace('role-', '');
        const member = interaction.member;
        
        try {
            // ロールが存在するか確認
            const role = await interaction.guild.roles.fetch(roleId);
            if (!role) {
                return await interaction.reply({
                    content: 'このロールは存在しないか削除されています。',
                    ephemeral: true
                });
            }

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                await interaction.reply({
                    content: `<@&${roleId}>を削除しました。`,
                    ephemeral: true
                });
            } else {
                await member.roles.add(roleId);
                await interaction.reply({
                    content: `<@&${roleId}>を追加しました。`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('ロール操作中にエラーが発生:', error);
            await interaction.reply({
                content: 'ロールの操作中にエラーが発生しました。',
                ephemeral: true
            });
        }
    }
};