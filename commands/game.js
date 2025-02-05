// commands/game.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('ゲーム関連のユーティリティコマンド')
        .addSubcommand(subcommand =>
            subcommand
                .setName('matchmaking')
                .setDescription('ゲーム参加者を募集')
                .addStringOption(option => 
                    option.setName('game')
                        .setDescription('ゲーム名')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('players')
                        .setDescription('必要なプレイヤー数')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName('description')
                        .setDescription('追加の説明')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('friendcode')
                .setDescription('ゲーム用フレンドコードを管理')
                .addStringOption(option => 
                    option.setName('game')
                        .setDescription('ゲーム名')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName('code')
                        .setDescription('フレンドコード')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('backlog')
                .setDescription('プレイ予定のゲームリストを管理')
                .addStringOption(option => 
                    option.setName('action')
                        .setDescription('実行する操作')
                        .setRequired(true)
                        .addChoices(
                            { name: '追加', value: 'add' },
                            { name: '削除', value: 'remove' },
                            { name: '一覧', value: 'list' }
                        )
                )
                .addStringOption(option => 
                    option.setName('game')
                        .setDescription('ゲーム名（追加・削除時に必要）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('achievements')
                .setDescription('ゲーム実績を共有')
                .addStringOption(option => 
                    option.setName('game')
                        .setDescription('ゲーム名')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName('achievement')
                        .setDescription('達成した実績')
                        .setRequired(true)
                )
        ),

    // グローバル変数の初期化
    initialize(client) {
        if (!client.gameData) {
            client.gameData = {
                matchmaking: {},
                friendCodes: {},
                gameBacklogs: {}
            };
        }
    },

    async execute(interaction) {
        // クライアントデータの初期化
        if (!interaction.client.gameData) {
            this.initialize(interaction.client);
        }

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'matchmaking') {
            const game = interaction.options.getString('game');
            const requiredPlayers = interaction.options.getInteger('players');
            const description = interaction.options.getString('description') || 'ゲーム参加者募集！';

            const matchEmbed = new EmbedBuilder()
                .setTitle(`🎮 ${game} マッチメイキング`)
                .setDescription(description)
                .addFields(
                    { name: '必要プレイヤー', value: `${requiredPlayers}名`, inline: true },
                    { name: '現在の参加者', value: '1名', inline: true }
                )
                .setColor('#00ff00')
                .setFooter({ text: `募集者: ${interaction.user.username}` });

            const joinButton = new ButtonBuilder()
                .setCustomId(`matchmaking_join_${game}`)
                .setLabel('参加')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`matchmaking_cancel_${game}`)
                .setLabel('キャンセル')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(joinButton, cancelButton);

            const matchMessage = await interaction.reply({ 
                embeds: [matchEmbed], 
                components: [row] 
            });

            // マッチメイキングデータを保存
            interaction.client.gameData.matchmaking[game] = {
                host: userId,
                requiredPlayers,
                players: [userId],
                messageId: matchMessage.id,
                channelId: interaction.channelId
            };
        }

        else if (subcommand === 'friendcode') {
            const game = interaction.options.getString('game');
            const code = interaction.options.getString('code');

            // フレンドコードを保存
            if (!interaction.client.gameData.friendCodes[userId]) {
                interaction.client.gameData.friendCodes[userId] = {};
            }
            interaction.client.gameData.friendCodes[userId][game] = code;

            const codeEmbed = new EmbedBuilder()
                .setTitle('🎮 フレンドコード')
                .setDescription(`${game}のフレンドコードを登録しました`)
                .addFields({ name: 'コード', value: code })
                .setColor('#0099ff');

            await interaction.reply({ embeds: [codeEmbed], ephemeral: true });
        }

        else if (subcommand === 'backlog') {
            const action = interaction.options.getString('action');
            const game = interaction.options.getString('game');

            // バックログデータの初期化
            if (!interaction.client.gameData.gameBacklogs[userId]) {
                interaction.client.gameData.gameBacklogs[userId] = [];
            }

            const userBacklog = interaction.client.gameData.gameBacklogs[userId];

            if (action === 'add' && game) {
                if (!userBacklog.includes(game)) {
                    userBacklog.push(game);
                    const addEmbed = new EmbedBuilder()
                        .setTitle('📋 ゲームバックログ')
                        .setDescription(`${game}をバックログに追加しました`)
                        .setColor('#00ff00');
                    await interaction.reply({ embeds: [addEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ 
                        content: 'このゲームは既にバックログに存在します', 
                        ephemeral: true 
                    });
                }
            }
            else if (action === 'remove' && game) {
                const index = userBacklog.indexOf(game);
                if (index > -1) {
                    userBacklog.splice(index, 1);
                    const removeEmbed = new EmbedBuilder()
                        .setTitle('📋 ゲームバックログ')
                        .setDescription(`${game}をバックログから削除しました`)
                        .setColor('#ff0000');
                    await interaction.reply({ embeds: [removeEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ 
                        content: 'このゲームはバックログに存在しません', 
                        ephemeral: true 
                    });
                }
            }
            else if (action === 'list') {
                const listEmbed = new EmbedBuilder()
                    .setTitle('📋 ゲームバックログ')
                    .setDescription(
                        userBacklog.length > 0 
                        ? userBacklog.map((g, i) => `${i + 1}. ${g}`).join('\n')
                        : 'バックログは空です'
                    )
                    .setColor('#0099ff');
                await interaction.reply({ embeds: [listEmbed], ephemeral: true });
            }
        }

        else if (subcommand === 'achievements') {
            const game = interaction.options.getString('game');
            const achievement = interaction.options.getString('achievement');

            const achievementEmbed = new EmbedBuilder()
                .setTitle('🏆 ゲーム実績')
                .setDescription(`${interaction.user.username}が${game}で実績を達成！`)
                .addFields({ name: '実績', value: achievement })
                .setColor('#ffff00')
                .setThumbnail(interaction.user.displayAvatarURL());

            await interaction.reply({ embeds: [achievementEmbed] });
        }
    },

    // インタラクションハンドラー
    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        const [type, action, game] = interaction.customId.split('_');
        if (type !== 'matchmaking') return;

        const matchData = interaction.client.gameData.matchmaking[game];
        if (!matchData) return;

        if (action === 'join') {
            // 参加処理
            if (matchData.players.includes(interaction.user.id)) {
                await interaction.reply({ 
                    content: 'すでに参加しています', 
                    ephemeral: true 
                });
                return;
            }

            matchData.players.push(interaction.user.id);

            const updatedEmbed = new EmbedBuilder()
                .setTitle(`🎮 ${game} マッチメイキング`)
                .setDescription(matchData.description || 'ゲーム参加者募集！')
                .addFields(
                    { name: '必要プレイヤー', value: `${matchData.requiredPlayers}名`, inline: true },
                    { name: '現在の参加者', value: `${matchData.players.length}名`, inline: true }
                )
                .setColor('#00ff00')
                .setFooter({ text: `募集者: ${interaction.client.users.cache.get(matchData.host).username}` });

            await interaction.update({ embeds: [updatedEmbed] });

            // 必要人数に達した場合
            if (matchData.players.length === matchData.requiredPlayers) {
                const completeEmbed = new EmbedBuilder()
                    .setTitle(`🎮 ${game} マッチメイキング`)
                    .setDescription('必要人数に達しました！ゲームを開始できます。')
                    .addFields({
                        name: '参加者',
                        value: matchData.players.map(id => `<@${id}>`).join(', ')
                    })
                    .setColor('#00ff00');

                await interaction.channel.send({ embeds: [completeEmbed] });
                
                // マッチメイキングデータを削除
                delete interaction.client.gameData.matchmaking[game];
            }
        }
        else if (action === 'cancel') {
            // キャンセル処理
            if (interaction.user.id !== matchData.host) {
                await interaction.reply({ 
                    content: 'マッチメイキングの主催者のみがキャンセルできます', 
                    ephemeral: true 
                });
                return;
            }

            const cancelEmbed = new EmbedBuilder()
                .setTitle(`🎮 ${game} マッチメイキング`)
                .setDescription('マッチメイキングがキャンセルされました')
                .setColor('#ff0000');

            await interaction.update({ embeds: [cancelEmbed], components: [] });

            // マッチメイキングデータを削除
            delete interaction.client.gameData.matchmaking[game];
        }
    }
};