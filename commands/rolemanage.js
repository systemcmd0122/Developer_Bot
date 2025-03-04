const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// 保存ディレクトリのパスを設定
const SAVE_DIR = path.join(process.cwd(), 'data', 'roleboards');

module.exports = {
    category: 'ロール管理',
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('save')
                .setDescription('ロールボードの設定を保存')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('保存するロールボードの名前')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('filename')
                        .setDescription('保存するファイル名（.txtは自動で追加）')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('load')
                .setDescription('保存したロールボードの設定を読み込む')
                .addStringOption(option =>
                    option
                        .setName('filename')
                        .setDescription('読み込むファイル名（.txtは自動で追加）')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // 保存ディレクトリの作成を確認
        await this.ensureSaveDirectory();

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

            case 'save': {
                const boardName = interaction.options.getString('name');
                const fileName = interaction.options.getString('filename');

                const board = serverRoleBoards[interaction.guildId][boardName];
                if (!board) {
                    return interaction.reply({
                        content: 'そのロールボードは存在しません。',
                        ephemeral: true
                    });
                }

                try {
                    // 保存データの準備
                    const saveData = {
                        guildId: interaction.guildId,
                        boardName: boardName,
                        messageId: board.messageId,
                        channelId: board.channelId,
                        description: board.description,
                        roles: board.roles,
                        savedAt: new Date().toISOString(),
                        savedBy: interaction.user.id
                    };

                    // ファイルに保存
                    const filePath = path.join(SAVE_DIR, `${fileName}.txt`);
                    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf8');

                    return interaction.reply({
                        content: `ロールボード「${boardName}」の設定を「${fileName}.txt」に保存しました。`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('ロールボード保存中にエラーが発生:', error);
                    return interaction.reply({
                        content: 'ロールボードの保存中にエラーが発生しました。',
                        ephemeral: true
                    });
                }
            }

            case 'load': {
                const fileName = interaction.options.getString('filename');
                const filePath = path.join(SAVE_DIR, `${fileName}.txt`);

                try {
                    // ファイルの存在確認
                    await fs.access(filePath);

                    // ファイルの読み込み
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const saveData = JSON.parse(fileContent);

                    // 同じギルドかチェック
                    if (saveData.guildId !== interaction.guildId) {
                        return interaction.reply({
                            content: 'この設定は別のサーバー用のものです。',
                            ephemeral: true
                        });
                    }

                    // 新しいメッセージを作成
                    const embed = new EmbedBuilder()
                        .setTitle(`🎭 ${saveData.boardName}`)
                        .setDescription(saveData.description)
                        .setColor('#ff00ff')
                        .setTimestamp();

                    const message = await interaction.channel.send({
                        embeds: [embed],
                        components: []
                    });

                    // 新しいボードデータを設定
                    serverRoleBoards[interaction.guildId][saveData.boardName] = {
                        messageId: message.id,
                        channelId: interaction.channel.id,
                        description: saveData.description,
                        roles: saveData.roles
                    };

                    // ボードを更新
                    await this.updateRoleBoard(interaction, saveData.boardName);

                    return interaction.reply({
                        content: `ロールボード「${saveData.boardName}」の設定を読み込み、新しく作成しました。`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('ロールボード読み込み中にエラーが発生:', error);
                    return interaction.reply({
                        content: 'ロールボードの読み込み中にエラーが発生しました。ファイルが存在しないか、正しい形式ではない可能性があります。',
                        ephemeral: true
                    });
                }
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

    async ensureSaveDirectory() {
        try {
            await fs.access(SAVE_DIR);
        } catch (error) {
            // ディレクトリが存在しない場合は作成
            await fs.mkdir(SAVE_DIR, { recursive: true });
        }
    },

    async updateRoleBoard(interaction, boardName) {
        const board = interaction.client.roleBoards[interaction.guildId][boardName];
        if (!board) return false;

        try {
            const channel = await interaction.guild.channels.fetch(board.channelId);
            const message = await channel.messages.fetch(board.messageId);

            const embed = EmbedBuilder.from(message.embeds[0]);
            
            let description = board.description + '\n\n';
            for (const [roleId, roleData] of Object.entries(board.roles)) {
                description += `<@&${roleId}>: ${roleData.description}\n`;
            }
            
            embed.setDescription(description);

            const components = [];
            const roleEntries = Object.entries(board.roles);
            
            if (roleEntries.length > 0) {
                for (let i = 0; i < roleEntries.length; i += 5) {
                    const row = new ActionRowBuilder();
                    
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