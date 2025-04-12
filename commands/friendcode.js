const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const supabase = require('../utils/supabase');

module.exports = {
    category: 'ゲーム管理',
    data: new SlashCommandBuilder()
        .setName('friendcode')
        .setDescription('ゲームのフレンドコードを共有・管理')
        .addSubcommand(subcommand => 
            subcommand
                .setName('add')
                .setDescription('新しいフレンドコードを追加')
                .addStringOption(option => 
                    option
                        .setName('game')
                        .setDescription('ゲーム名')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option => 
                    option
                        .setName('code')
                        .setDescription('フレンドコード')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('note')
                        .setDescription('備考（オプション）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('remove')
                .setDescription('登録したフレンドコードを削除')
                .addStringOption(option => 
                    option
                        .setName('game')
                        .setDescription('削除するゲーム名')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('update')
                .setDescription('登録済みのフレンドコードを更新')
                .addStringOption(option => 
                    option
                        .setName('game')
                        .setDescription('更新するゲーム名')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option => 
                    option
                        .setName('code')
                        .setDescription('新しいフレンドコード')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('note')
                        .setDescription('新しい備考（オプション）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('list')
                .setDescription('自分のフレンドコード一覧を表示')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('view')
                .setDescription('他のユーザーのフレンドコード一覧を表示')
                .addUserOption(option => 
                    option
                        .setName('user')
                        .setDescription('閲覧するユーザー')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('search')
                .setDescription('特定のゲームのフレンドコードを持つユーザーを検索')
                .addStringOption(option => 
                    option
                        .setName('game')
                        .setDescription('検索するゲーム名')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('export')
                .setDescription('自分のフレンドコード一覧をテキストファイルとしてエクスポート')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('games')
                .setDescription('登録されているゲーム一覧を表示')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('create_board')
                .setDescription('フレンドコード掲示板を作成')
                .addStringOption(option => 
                    option
                        .setName('title')
                        .setDescription('掲示板のタイトル')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('description')
                        .setDescription('掲示板の説明')
                        .setRequired(false)
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('admin')
                .setDescription('管理者用コマンド')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete_user')
                        .setDescription('特定ユーザーのフレンドコード情報を削除')
                        .addUserOption(option =>
                            option
                                .setName('user')
                                .setDescription('削除対象のユーザー')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete_game')
                        .setDescription('特定のゲームの全フレンドコード情報を削除')
                        .addStringOption(option =>
                            option
                                .setName('game')
                                .setDescription('削除対象のゲーム')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete_board')
                        .setDescription('フレンドコード掲示板を削除')
                        .addStringOption(option =>
                            option
                                .setName('board_id')
                                .setDescription('削除する掲示板のID')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('stats')
                        .setDescription('フレンドコード登録状況の統計を表示')
                )
        ),

    // コマンド実行時の処理
    async execute(interaction) {
        // フレンドコードの保存先を初期化（メモリキャッシュ）
        if (!interaction.client.friendCodes) {
            interaction.client.friendCodes = {};
        }
        
        if (!interaction.client.friendCodes[interaction.guildId]) {
            interaction.client.friendCodes[interaction.guildId] = {
                users: {},
                boards: {},
                popularGames: []
            };
            
            // 初期化時にデータを読み込む
            await this.loadFriendCodesFromDB(interaction.client, interaction.guildId);
        }

        const guildData = interaction.client.friendCodes[interaction.guildId];

        // サブコマンドグループを確認
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        
        // 管理者権限確認
        if (subcommandGroup === 'admin') {
            // 管理者権限がない場合は実行を拒否
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return interaction.reply({
                    content: 'このコマンドは管理者のみが使用できます。',
                    ephemeral: true
                });
            }
            
            return this.handleAdminCommands(interaction);
        }

        // 通常のサブコマンド処理
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add': {
                const game = interaction.options.getString('game');
                const code = interaction.options.getString('code');
                const note = interaction.options.getString('note') || '';
                const userId = interaction.user.id;

                if (!guildData.users[userId]) {
                    guildData.users[userId] = {};
                }

                guildData.users[userId][game] = {
                    code: code,
                    note: note,
                    updatedAt: new Date().toISOString()
                };

                // Supabaseに保存
                const { error } = await supabase
                    .from('friend_codes')
                    .upsert({
                        guild_id: interaction.guildId,
                        user_id: userId,
                        game_name: game,
                        code: code,
                        note: note,
                        updated_at: new Date()
                    }, { onConflict: 'guild_id,user_id,game_name' });

                if (error) {
                    console.error('フレンドコード保存エラー:', error);
                    return interaction.reply({
                        content: 'フレンドコードの保存中にエラーが発生しました。',
                        ephemeral: true
                    });
                }

                await this.updatePopularGames(interaction.client, interaction.guildId);
                await this.updateAllBoards(interaction);

                const embed = new EmbedBuilder()
                    .setTitle('フレンドコード登録完了')
                    .setDescription(`${game} のフレンドコードを登録しました！`)
                    .setColor('#00ff00')
                    .addFields({
                        name: 'コード',
                        value: code,
                        inline: true
                    })
                    .setTimestamp();

                if (note) {
                    embed.addFields({
                        name: '備考',
                        value: note,
                        inline: true
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            case 'remove': {
                const game = interaction.options.getString('game');
                const userId = interaction.user.id;

                if (!guildData.users[userId] || !guildData.users[userId][game]) {
                    return interaction.reply({
                        content: `${game} のフレンドコードは登録されていません。`,
                        ephemeral: true
                    });
                }

                delete guildData.users[userId][game];

                if (Object.keys(guildData.users[userId]).length === 0) {
                    delete guildData.users[userId];
                }

                // Supabaseから削除
                const { error } = await supabase
                    .from('friend_codes')
                    .delete()
                    .match({
                        guild_id: interaction.guildId,
                        user_id: userId,
                        game_name: game
                    });

                if (error) {
                    console.error('フレンドコード削除エラー:', error);
                    return interaction.reply({
                        content: 'フレンドコードの削除中にエラーが発生しました。',
                        ephemeral: true
                    });
                }

                await this.updatePopularGames(interaction.client, interaction.guildId);
                await this.updateAllBoards(interaction);

                return interaction.reply({
                    content: `${game} のフレンドコードを削除しました。`,
                    ephemeral: true
                });
            }

            case 'list': {
                const userId = interaction.user.id;
                const userCodes = guildData.users[userId];

                if (!userCodes || Object.keys(userCodes).length === 0) {
                    return interaction.reply({
                        content: 'フレンドコードが登録されていません。',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${interaction.user.username} のフレンドコード一覧`)
                    .setDescription(`<@${interaction.user.id}>`)
                    .setColor('#00ff00')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();

                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: false
                    });
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('friendcode-delete-all')
                            .setLabel('すべて削除')
                            .setStyle(ButtonStyle.Danger)
                    );

                // ボタンインタラクションを保存
                await interaction.client.interactionManager.saveButtonInteraction(interaction.id, {
                    type: 'delete-all',
                    userId: interaction.user.id,
                    guildId: interaction.guildId
                });

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            case 'view': {
                const targetUser = interaction.options.getUser('user');
                const userCodes = guildData.users[targetUser.id];

                if (!userCodes || Object.keys(userCodes).length === 0) {
                    return interaction.reply({
                        content: `${targetUser.username} はフレンドコードを登録していません。`,
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${targetUser.username} のフレンドコード一覧`)
                    .setDescription(`<@${targetUser.id}>`)
                    .setColor('#0099ff')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: false
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            case 'games': {
                const games = new Map();
                for (const userId in guildData.users) {
                    for (const game in guildData.users[userId]) {
                        if (!games.has(game)) {
                            games.set(game, 0);
                        }
                        games.set(game, games.get(game) + 1);
                    }
                }

                if (games.size === 0) {
                    return interaction.reply({
                        content: 'まだゲームが登録されていません。',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('登録されているゲーム一覧')
                    .setColor('#ff9900')
                    .setTimestamp();

                const sortedGames = [...games.entries()]
                    .sort((a, b) => b[1] - a[1]);

                for (const [game, count] of sortedGames) {
                    if (embed.data.fields && embed.data.fields.length >= 25) break;

                    embed.addFields({
                        name: game,
                        value: `登録者数: ${count}人`,
                        inline: false
                    });
                }

                const gameOptions = sortedGames.slice(0, 25).map(([game, count]) => ({
                    label: game,
                    description: `登録者数: ${count}人`,
                    value: game,
                }));

                const row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('friendcode-select-game')
                            .setPlaceholder('ゲームを選択して登録者を表示')
                            .addOptions(gameOptions)
                    );

                // メニューインタラクションを保存
                await interaction.client.interactionManager.saveMenuInteraction(interaction.id, {
                    type: 'game-select',
                    games: gameOptions,
                    guildId: interaction.guildId
                });

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            case 'create_board': {
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description') || 'フレンドコード掲示板です。各ゲームのボタンを押すと、登録者が表示されます。';

                const embed = new EmbedBuilder()
                    .setTitle(`🎮 ${title}`)
                    .setDescription(description)
                    .setColor('#00aaff')
                    .setTimestamp();

                const message = await interaction.channel.send({
                    embeds: [embed],
                    components: []
                });

                if (!guildData.boards) {
                    guildData.boards = {};
                }

                guildData.boards[message.id] = {
                    channelId: interaction.channel.id,
                    title: title,
                    description: description
                };

                // Supabaseに保存
                const { error } = await supabase
                    .from('friend_code_boards')
                    .insert({
                        guild_id: interaction.guildId,
                        message_id: message.id,
                        channel_id: interaction.channel.id,
                        title: title,
                        description: description
                    });

                if (error) {
                    console.error('掲示板保存エラー:', error);
                    return interaction.reply({
                        content: '掲示板の作成中にエラーが発生しました。',
                        ephemeral: true
                    });
                }

                // ボード情報を保存
                await interaction.client.interactionManager.saveBoardInteraction(message.id, {
                    channelId: interaction.channel.id,
                    title: title,
                    description: description,
                    guildId: interaction.guildId
                });

                await this.updateBoard(interaction, message.id);

                return interaction.reply({
                    content: `フレンドコード掲示板「${title}」を作成しました！`,
                    ephemeral: true
                });
            }

            case 'update': {
                const game = interaction.options.getString('game');
                const code = interaction.options.getString('code');
                const note = interaction.options.getString('note');
                const userId = interaction.user.id;

                if (!guildData.users[userId] || !guildData.users[userId][game]) {
                    return interaction.reply({
                        content: `${game} のフレンドコードは登録されていません。先に \`/friendcode add\` コマンドで登録してください。`,
                        ephemeral: true
                    });
                }

                // 現在のデータを取得
                const currentData = guildData.users[userId][game];
                
                // 新しいデータで更新
                guildData.users[userId][game] = {
                    code: code,
                    note: note !== null ? note : currentData.note, // noteが指定されていない場合は現在の値を保持
                    updatedAt: new Date().toISOString()
                };

                // Supabaseに保存
                const { error } = await supabase
                    .from('friend_codes')
                    .upsert({
                        guild_id: interaction.guildId,
                        user_id: userId,
                        game_name: game,
                        code: code,
                        note: note !== null ? note : currentData.note,
                        updated_at: new Date()
                    }, { onConflict: 'guild_id,user_id,game_name' });

                if (error) {
                    console.error('フレンドコード更新エラー:', error);
                    return interaction.reply({
                        content: 'フレンドコードの更新中にエラーが発生しました。',
                        ephemeral: true
                    });
                }

                await this.updateAllBoards(interaction);

                const embed = new EmbedBuilder()
                    .setTitle('フレンドコード更新完了')
                    .setDescription(`${game} のフレンドコードを更新しました！`)
                    .setColor('#00ff00')
                    .addFields({
                        name: 'コード',
                        value: code,
                        inline: true
                    })
                    .setTimestamp();

                if (note !== null) {
                    embed.addFields({
                        name: '備考',
                        value: note,
                        inline: true
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }
            
            case 'search': {
                const game = interaction.options.getString('game');
                
                // このゲームのフレンドコードを持つユーザーをリストアップ
                await this.showGameUsers(interaction, game);
                return;
            }
            
            case 'export': {
                const userId = interaction.user.id;
                const userCodes = guildData.users[userId];

                if (!userCodes || Object.keys(userCodes).length === 0) {
                    return interaction.reply({
                        content: 'フレンドコードが登録されていません。',
                        ephemeral: true
                    });
                }

                // エクスポート用のテキストを作成
                let exportText = `# ${interaction.user.username} のフレンドコード一覧\n`;
                exportText += `エクスポート日時: ${new Date().toLocaleString('ja-JP')}\n\n`;

                for (const [game, data] of Object.entries(userCodes)) {
                    exportText += `## ${game}\n`;
                    exportText += `コード: ${data.code}\n`;
                    if (data.note) {
                        exportText += `備考: ${data.note}\n`;
                    }
                    exportText += `更新日: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}\n\n`;
                }

                // ファイルとして送信
                const buffer = Buffer.from(exportText, 'utf-8');
                const attachment = { 
                    attachment: buffer, 
                    name: `friendcodes_${interaction.user.username}_${Date.now()}.txt` 
                };

                return interaction.reply({
                    content: 'フレンドコード一覧をエクスポートしました。',
                    files: [attachment],
                    ephemeral: true
                });
            }
        }
    },

    // Supabaseからデータを読み込むヘルパーメソッド
    async loadFriendCodesFromDB(client, guildId) {
        try {
            if (!client.friendCodes[guildId]) {
                client.friendCodes[guildId] = {
                    users: {},
                    boards: {},
                    popularGames: []
                };
            }

            const guildData = client.friendCodes[guildId];

            // フレンドコードを読み込む
            const { data: friendCodes, error: friendCodesError } = await supabase
                .from('friend_codes')
                .select('*')
                .eq('guild_id', guildId);

            if (friendCodesError) {
                console.error('フレンドコード読み込みエラー:', friendCodesError);
                return;
            }

            // データを整形
            for (const code of friendCodes) {
                if (!guildData.users[code.user_id]) {
                    guildData.users[code.user_id] = {};
                }

                guildData.users[code.user_id][code.game_name] = {
                    code: code.code,
                    note: code.note || '',
                    updatedAt: code.updated_at
                };
            }

            // 掲示板を読み込む
            const { data: boards, error: boardsError } = await supabase
                .from('friend_code_boards')
                .select('*')
                .eq('guild_id', guildId);

            if (boardsError) {
                console.error('掲示板読み込みエラー:', boardsError);
                return;
            }

            // 掲示板データを整形
            for (const board of boards) {
                guildData.boards[board.message_id] = {
                    channelId: board.channel_id,
                    title: board.title,
                    description: board.description || ''
                };
            }

            // 人気ゲームリストを更新
            await this.updatePopularGames(client, guildId);

            console.log(`✓ フレンドコードデータをロードしました (Guild ID: ${guildId})`);
        } catch (error) {
            console.error('フレンドコードデータロードエラー:', error);
        }
    },

    // 人気ゲームリストを更新するヘルパーメソッド
    async updatePopularGames(client, guildId) {
        try {
            if (!client.friendCodes[guildId]) return;
            
            const guildData = client.friendCodes[guildId];
            const games = new Map();
            
            for (const userId in guildData.users) {
                for (const game in guildData.users[userId]) {
                    games.set(game, (games.get(game) || 0) + 1);
                }
            }
            
            const popularGames = [...games.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([game]) => game);
            
            guildData.popularGames = popularGames;

            // 人気ゲームをSupabaseに更新
            for (const [game, count] of games.entries()) {
                const { error } = await supabase
                    .from('popular_games')
                    .upsert({
                        guild_id: guildId,
                        game_name: game,
                        user_count: count,
                        updated_at: new Date()
                    }, { onConflict: 'guild_id,game_name' });

                if (error) {
                    console.error('人気ゲーム更新エラー:', error);
                }
            }
        } catch (error) {
            console.error('人気ゲーム更新エラー:', error);
        }
    },

    // 掲示板更新用のヘルパーメソッド
    async updateBoard(interaction, messageId) {
        const guildData = interaction.client.friendCodes[interaction.guildId];
        const board = guildData.boards[messageId];
        
        if (!board) return false;
        
        try {
            const channel = await interaction.guild.channels.fetch(board.channelId);
            const message = await channel.messages.fetch(messageId);
            
            const games = new Set();
            for (const userId in guildData.users) {
                for (const game in guildData.users[userId]) {
                    games.add(game);
                }
            }
            
            if (games.size === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(board.title)
                    .setDescription(board.description + '\n\n現在登録されているゲームはありません。')
                    .setColor('#00aaff')
                    .setTimestamp();

                await message.edit({
                    embeds: [embed],
                    components: []
                });
                return true;
            }
            
            const embed = EmbedBuilder.from(message.embeds[0]);
            embed.setDescription(board.description);
            
            const sortedGames = [...games].sort();
            const components = [];
            
            for (let i = 0; i < Math.min(sortedGames.length, 25); i += 25) {
                const gameOptions = sortedGames.slice(i, i + 25).map(game => ({
                    label: game,
                    value: game,
                }));
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`friendcode-board-${messageId}`)
                            .setPlaceholder('ゲームを選択して登録者を表示')
                            .addOptions(gameOptions)
                    );
                
                components.push(row);

                // メニューインタラクションを保存
                await interaction.client.interactionManager.saveMenuInteraction(`board-${messageId}`, {
                    type: 'board-game-select',
                    games: gameOptions,
                    boardId: messageId,
                    guildId: interaction.guildId
                });
            }
            
            await message.edit({
                embeds: [embed],
                components: components
            });
            
            return true;
        } catch (error) {
            console.error('フレンドコード掲示板の更新中にエラーが発生:', error);
            return false;
        }
    },

    // すべての掲示板を更新
    async updateAllBoards(interaction) {
        const guildData = interaction.client.friendCodes[interaction.guildId];
        
        if (!guildData.boards) return;
        
        for (const messageId in guildData.boards) {
            await this.updateBoard(interaction, messageId);
        }
    },

    // ボタン・セレクトメニューハンドラー
    async handleInteraction(interaction) {
        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            if (!customId.startsWith('friendcode-')) return;
            
            const guildData = interaction.client.friendCodes[interaction.guildId];
            
            // 保存されたボタンインタラクションを取得
            const buttonData = interaction.client.interactionManager.getButtonInteraction(interaction.message.id);
            
            if (customId === 'friendcode-delete-all') {
                if (!buttonData || buttonData.userId !== interaction.user.id) {
                    await interaction.reply({
                        content: 'このボタンは使用できません。',
                        ephemeral: true
                    });
                    return;
                }

                if (guildData.users[interaction.user.id]) {
                    delete guildData.users[interaction.user.id];
                    
                    // Supabaseから削除
                    const { error } = await supabase
                        .from('friend_codes')
                        .delete()
                        .match({
                            guild_id: interaction.guildId,
                            user_id: interaction.user.id
                        });

                    if (error) {
                        console.error('フレンドコード削除エラー:', error);
                        return interaction.reply({
                            content: 'フレンドコードの削除中にエラーが発生しました。',
                            ephemeral: true
                        });
                    }
                    
                    await this.updatePopularGames(interaction.client, interaction.guildId);
                    await this.updateAllBoards(interaction);
                    
                    // インタラクションを削除
                    await interaction.client.interactionManager.removeInteraction(interaction.message.id);
                    
                    await interaction.reply({
                        content: 'すべてのフレンドコードを削除しました。',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '登録されているフレンドコードがありません。',
                        ephemeral: true
                    });
                }
                return;
            }
        }
        
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            
            // 保存されたメニューインタラクションを取得
            const menuData = interaction.client.interactionManager.getMenuInteraction(
                customId.startsWith('friendcode-board-') ? 
                `board-${customId.split('-').pop()}` : 
                interaction.message.id
            );
            
            if (!menuData) {
                await interaction.reply({
                    content: 'このメニューは使用できません。',
                    ephemeral: true
                });
                return;
            }

            const gameName = interaction.values[0];
            await this.showGameUsers(interaction, gameName);
            return;
        }
    },

    // 特定のゲームの登録ユーザーを表示
    async showGameUsers(interaction, gameName) {
        const guildData = interaction.client.friendCodes[interaction.guildId];
        const usersWithGame = [];
        
        for (const userId in guildData.users) {
            if (guildData.users[userId][gameName]) {
                usersWithGame.push({
                    userId: userId,
                    data: guildData.users[userId][gameName]
                });
            }
        }
        
        if (usersWithGame.length === 0) {
            await interaction.reply({
                content: `「${gameName}」を登録しているユーザーはいません。`,
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`${gameName} 登録ユーザー一覧`)
            .setColor('#ff00ff')
            .setTimestamp();
        
        for (const user of usersWithGame) {
            try {
                const member = await interaction.guild.members.fetch(user.userId);
                let value = `<@${user.userId}>\nコード: ${user.data.code}`;
                if (user.data.note) {
                    value += `\n備考: ${user.data.note}`;
                }
                
                embed.addFields({
                    name: member.user.username,
                    value: value,
                    inline: false
                });
                
                embed.setThumbnail(member.user.displayAvatarURL());
            } catch (error) {
                console.error(`ユーザー情報取得エラー (ID: ${user.userId}):`, error);
                embed.addFields({
                    name: `不明なユーザー (ID: ${user.userId})`,
                    value: `<@${user.userId}>\nコード: ${user.data.code}`,
                    inline: false
                });
            }
        }
        
        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    },

    // オートコンプリート処理
    async autocomplete(interaction) {
        if (!interaction.isAutocomplete()) return;
        
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'game' && focusedOption.name !== 'board_id') return;
        
        // まだメモリに読み込まれていない場合はDBから読み込む
        if (!interaction.client.friendCodes || !interaction.client.friendCodes[interaction.guildId]) {
            await this.loadFriendCodesFromDB(interaction.client, interaction.guildId);
        }
        
        const guildData = interaction.client.friendCodes[interaction.guildId] || {};
        const input = focusedOption.value.toLowerCase();
        
        // ボードIDのオートコンプリート
        if (focusedOption.name === 'board_id') {
            const boards = Object.entries(guildData.boards || {}).map(([id, board]) => ({
                name: `${board.title} (ID: ${id})`,
                value: id
            }));
            
            const filtered = input
                ? boards.filter(board => board.name.toLowerCase().includes(input))
                : boards;
            
            await interaction.respond(filtered.slice(0, 25));
            return;
        }
        
        // ゲーム名のオートコンプリート
        let choices = [];
        const userGames = guildData.users?.[interaction.user.id] || {};
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        
        if (subcommand === 'remove' || subcommand === 'update') {
            // 自分が登録しているゲームのみ
            choices = Object.keys(userGames);
        } else if (subcommandGroup === 'admin' && subcommand === 'delete_game') {
            // すべてのゲーム
            const allGames = new Set();
            for (const userId in guildData.users || {}) {
                for (const game in guildData.users[userId] || {}) {
                    allGames.add(game);
                }
            }
            choices = [...allGames];
        } else {
            // 人気ゲーム + すべてのゲーム
            choices = guildData.popularGames || [];
            const allGames = new Set(choices);
            
            for (const userId in guildData.users || {}) {
                for (const game in guildData.users[userId] || {}) {
                    allGames.add(game);
                }
            }
            
            choices = [...allGames];
        }
        
        const filtered = input
            ? choices.filter(game => game.toLowerCase().includes(input))
            : choices;
        
        await interaction.respond(
            filtered.slice(0, 25).map(game => ({
                name: game,
                value: game
            }))
        );
    },

    // 管理者コマンドを処理するメソッド
    async handleAdminCommands(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildData = interaction.client.friendCodes[interaction.guildId];
        
        switch(subcommand) {
            case 'delete_user': {
                const targetUser = interaction.options.getUser('user');
                
                if (!guildData.users[targetUser.id]) {
                    return interaction.reply({
                        content: `${targetUser.username} はフレンドコードを登録していません。`,
                        ephemeral: true
                    });
                }
                
                // メモリから削除
                delete guildData.users[targetUser.id];
                
                // データベースから削除
                const { error } = await supabase
                    .from('friend_codes')
                    .delete()
                    .match({
                        guild_id: interaction.guildId,
                        user_id: targetUser.id
                    });
                
                if (error) {
                    console.error('ユーザーデータ削除エラー:', error);
                    return interaction.reply({
                        content: 'データ削除中にエラーが発生しました。',
                        ephemeral: true
                    });
                }
                
                // 人気ゲームと掲示板を更新
                await this.updatePopularGames(interaction.client, interaction.guildId);
                await this.updateAllBoards(interaction);
                
                return interaction.reply({
                    content: `${targetUser.username} のフレンドコードデータをすべて削除しました。`,
                    ephemeral: true
                });
            }
            
            case 'delete_game': {
                const game = interaction.options.getString('game');
                const affectedUsers = [];
                
                // このゲームを持つユーザーをカウント・記録
                for (const userId in guildData.users) {
                    if (guildData.users[userId][game]) {
                        affectedUsers.push(userId);
                        delete guildData.users[userId][game];
                        
                        // ユーザーのゲームがなくなった場合はユーザー自体を削除
                        if (Object.keys(guildData.users[userId]).length === 0) {
                            delete guildData.users[userId];
                        }
                    }
                }
                
                if (affectedUsers.length === 0) {
                    return interaction.reply({
                        content: `「${game}」のフレンドコードを登録しているユーザーはいません。`,
                        ephemeral: true
                    });
                }
                
                // データベースから削除
                const { error } = await supabase
                    .from('friend_codes')
                    .delete()
                    .match({
                        guild_id: interaction.guildId,
                        game_name: game
                    });
                
                if (error) {
                    console.error('ゲームデータ削除エラー:', error);
                    return interaction.reply({
                        content: 'データ削除中にエラーが発生しました。',
                        ephemeral: true
                    });
                }
                
                // 人気ゲームと掲示板を更新
                await this.updatePopularGames(interaction.client, interaction.guildId);
                await this.updateAllBoards(interaction);
                
                return interaction.reply({
                    content: `「${game}」のフレンドコードを ${affectedUsers.length}人 のユーザーから削除しました。`,
                    ephemeral: true
                });
            }
            
            case 'delete_board': {
                const boardId = interaction.options.getString('board_id');
                
                if (!guildData.boards[boardId]) {
                    return interaction.reply({
                        content: '指定された掲示板IDは存在しません。',
                        ephemeral: true
                    });
                }
                
                try {
                    // 掲示板のメッセージを取得して削除
                    const board = guildData.boards[boardId];
                    const channel = await interaction.guild.channels.fetch(board.channelId);
                    const message = await channel.messages.fetch(boardId);
                    await message.delete();
                    
                    // メモリから削除
                    delete guildData.boards[boardId];
                    
                    // データベースから削除
                    const { error } = await supabase
                        .from('friend_code_boards')
                        .delete()
                        .match({
                            guild_id: interaction.guildId,
                            message_id: boardId
                        });
                    
                    if (error) {
                        console.error('掲示板削除エラー:', error);
                        return interaction.reply({
                            content: '掲示板の削除中にエラーが発生しました。',
                            ephemeral: true
                        });
                    }
                    
                    // インタラクションデータも削除
                    await interaction.client.interactionManager.removeInteraction(boardId);
                    await interaction.client.interactionManager.removeInteraction(`board-${boardId}`);
                    
                    return interaction.reply({
                        content: `掲示板「${board.title}」を削除しました。`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('掲示板削除エラー:', error);
                    return interaction.reply({
                        content: '掲示板の削除中にエラーが発生しました。メッセージが既に削除されている可能性があります。',
                        ephemeral: true
                    });
                }
            }
            
            case 'stats': {
                // 統計情報を集計
                const totalUsers = Object.keys(guildData.users).length;
                const totalGames = new Set();
                let totalCodes = 0;
                
                for (const userId in guildData.users) {
                    const games = Object.keys(guildData.users[userId]);
                    totalCodes += games.length;
                    games.forEach(game => totalGames.add(game));
                }
                
                const totalBoards = Object.keys(guildData.boards).length;
                
                // 最も人気のあるゲームのトップ5を取得
                const gamePopularity = new Map();
                for (const userId in guildData.users) {
                    for (const game in guildData.users[userId]) {
                        gamePopularity.set(game, (gamePopularity.get(game) || 0) + 1);
                    }
                }
                
                const topGames = [...gamePopularity.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
                
                // 埋め込みを作成
                const embed = new EmbedBuilder()
                    .setTitle('フレンドコード統計情報')
                    .setColor('#00aaff')
                    .addFields(
                        { name: '登録ユーザー数', value: `${totalUsers}人`, inline: true },
                        { name: '登録ゲーム数', value: `${totalGames.size}種類`, inline: true },
                        { name: '登録コード総数', value: `${totalCodes}件`, inline: true },
                        { name: '掲示板数', value: `${totalBoards}個`, inline: true }
                    )
                    .setTimestamp();
                
                // 人気ゲームがあれば追加
                if (topGames.length > 0) {
                    let topGamesText = '';
                    topGames.forEach(([game, count], index) => {
                        topGamesText += `${index + 1}. ${game} (${count}人)\n`;
                    });
                    
                    embed.addFields({ name: '人気ゲームTOP5', value: topGamesText, inline: false });
                }
                
                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }
        }
    }
};