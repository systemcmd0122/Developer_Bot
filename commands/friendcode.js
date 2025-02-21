// commands/friendcode.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
        ),

    // コマンド実行時の処理
    async execute(interaction) {
        // フレンドコードの保存先を初期化
        if (!interaction.client.friendCodes[interaction.guildId]) {
            interaction.client.friendCodes[interaction.guildId] = {
                users: {},
                boards: {},
                popularGames: [] // 人気ゲームのリストを追加
            };
        }

        const subcommand = interaction.options.getSubcommand();
        const guildData = interaction.client.friendCodes[interaction.guildId];

        switch (subcommand) {
            case 'add': {
                const game = interaction.options.getString('game');
                const code = interaction.options.getString('code');
                const note = interaction.options.getString('note') || '';
                const userId = interaction.user.id;

                // ユーザーのフレンドコード初期化
                if (!guildData.users[userId]) {
                    guildData.users[userId] = {};
                }

                // フレンドコードを登録
                guildData.users[userId][game] = {
                    code: code,
                    note: note,
                    updatedAt: new Date().toISOString()
                };

                // 人気ゲームリストを更新
                this.updatePopularGames(interaction.client, interaction.guildId);

                // データ永続化
                await this.saveData(interaction.client);

                // 掲示板の更新
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

                // フレンドコードを削除
                delete guildData.users[userId][game];

                // データが空になったら、ユーザーエントリも削除
                if (Object.keys(guildData.users[userId]).length === 0) {
                    delete guildData.users[userId];
                }

                // 人気ゲームリストを更新
                this.updatePopularGames(interaction.client, interaction.guildId);

                // データ永続化
                await this.saveData(interaction.client);

                // 掲示板の更新
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

                // ゲームごとにフィールドを追加（縦一列に並べる）
                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: false // 縦一列に表示するためfalseに変更
                    });
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('friendcode-delete-all')
                            .setLabel('すべて削除')
                            .setStyle(ButtonStyle.Danger),
                    );

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true // ユーザーだけに表示
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
                    .setDescription(`<@${targetUser.id}>`) // メンションを追加
                    .setColor('#0099ff')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                // ゲームごとにフィールドを追加（縦一列に並べる）
                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: false // 縦一列に表示するためfalseに変更
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true // ユーザーだけに表示
                });
            }

            case 'games': {
                // 登録されているゲーム一覧を集計
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

                // ゲーム名と登録者数をフィールドに追加（縦一列に並べる）
                const sortedGames = [...games.entries()]
                    .sort((a, b) => b[1] - a[1]); // 登録者数で降順ソート

                for (const [game, count] of sortedGames) {
                    // 上限があるので最大25個に制限
                    if (embed.data.fields && embed.data.fields.length >= 25) break;

                    embed.addFields({
                        name: game,
                        value: `登録者数: ${count}人`,
                        inline: false // 縦一列に表示するためfalseに変更
                    });
                }

                // ゲーム選択用のセレクトメニューを作成
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

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true // ユーザーだけに表示
                });
            }

            case 'create_board': {
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description') || 'フレンドコード掲示板です。各ゲームのボタンを押すと、登録者が表示されます。';

                // 掲示板の作成
                const embed = new EmbedBuilder()
                    .setTitle(`🎮 ${title}`)
                    .setDescription(description)
                    .setColor('#00aaff')
                    .setTimestamp();

                const message = await interaction.channel.send({
                    embeds: [embed],
                    components: []
                });

                // 掲示板情報を保存
                if (!guildData.boards) {
                    guildData.boards = {};
                }

                guildData.boards[message.id] = {
                    channelId: interaction.channel.id,
                    title: title,
                    description: description
                };

                // データ永続化
                await this.saveData(interaction.client);

                // 掲示板を更新
                await this.updateBoard(interaction, message.id);

                return interaction.reply({
                    content: `フレンドコード掲示板「${title}」を作成しました！`,
                    ephemeral: true
                });
            }
        }
    },

    // データ永続化用のヘルパーメソッド
    async saveData(client) {
        const dataDir = path.join(__dirname, '..', 'data');
        
        // データディレクトリがなければ作成
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const filePath = path.join(dataDir, 'friendcodes.json');
        
        // インデント付きで保存して人間が読めるようにする
        const dataToSave = JSON.stringify(client.friendCodes, null, 2);
        
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, dataToSave, (err) => {
                if (err) {
                    console.error('フレンドコードの保存中にエラーが発生しました:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    // データ読み込み用のヘルパーメソッド（インデックスjsから呼び出す）
    loadData(client) {
        const dataDir = path.join(__dirname, '..', 'data');
        const filePath = path.join(dataDir, 'friendcodes.json');
        
        // ファイルが存在しない場合は空のオブジェクトを返す
        if (!fs.existsSync(filePath)) {
            return {};
        }
        
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            
            // 各サーバーごとに人気ゲームリストを更新
            for (const guildId in parsedData) {
                this.updatePopularGames(client, guildId);
            }
            
            return parsedData;
        } catch (err) {
            console.error('フレンドコードの読み込み中にエラーが発生しました:', err);
            return {};
        }
    },

    // 人気ゲームリストを更新するヘルパーメソッド
    updatePopularGames(client, guildId) {
        if (!client.friendCodes[guildId]) return;
        
        const guildData = client.friendCodes[guildId];
        const games = new Map();
        
        // ゲームの登録者数を集計
        for (const userId in guildData.users) {
            for (const game in guildData.users[userId]) {
                games.set(game, (games.get(game) || 0) + 1);
            }
        }
        
        // 登録者数で降順ソートして、上位10件を保存
        const popularGames = [...games.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([game]) => game);
        
        guildData.popularGames = popularGames;
    },

    // 掲示板更新用のヘルパーメソッド
    async updateBoard(interaction, messageId) {
        const guildData = interaction.client.friendCodes[interaction.guildId];
        const board = guildData.boards[messageId];
        
        if (!board) return false;
        
        try {
            const channel = await interaction.guild.channels.fetch(board.channelId);
            const message = await channel.messages.fetch(messageId);
            
            // すべてのゲームを収集
            const games = new Set();
            for (const userId in guildData.users) {
                for (const game in guildData.users[userId]) {
                    games.add(game);
                }
            }
            
            // ゲームがない場合
            if (games.size === 0) {
                await message.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(board.title)
                            .setDescription(board.description + '\n\n現在登録されているゲームはありません。')
                            .setColor('#00aaff')
                            .setTimestamp()
                    ],
                    components: []
                });
                return true;
            }
            
            // 埋め込みを更新
            const embed = EmbedBuilder.from(message.embeds[0]);
            embed.setDescription(board.description);
            
            // セレクトメニューを使って表示（最大25個まで）
            const sortedGames = [...games].sort();
            const components = [];
            
            // 25個までしか選択肢を表示できないので、分割する
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
            }
            
            // メッセージを更新
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
        // ボタンのハンドリング
        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            // フレンドコード関連のボタンか確認
            if (!customId.startsWith('friendcode-')) return;
            
            const guildData = interaction.client.friendCodes[interaction.guildId];
            
            // 「すべて削除」ボタン
            if (customId === 'friendcode-delete-all') {
                if (guildData.users[interaction.user.id]) {
                    delete guildData.users[interaction.user.id];
                    await this.saveData(interaction.client);
                    await this.updateAllBoards(interaction);
                    
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
        
        // セレクトメニューのハンドリング
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            
            // ゲーム選択メニュー
            if (customId === 'friendcode-select-game') {
                const gameName = interaction.values[0];
                await this.showGameUsers(interaction, gameName);
                return;
            }
            
            // 掲示板のセレクトメニュー
            if (customId.startsWith('friendcode-board-')) {
                const gameName = interaction.values[0];
                await this.showGameUsers(interaction, gameName);
                return;
            }
        }
    },

    // 特定のゲームの登録ユーザーを表示
    async showGameUsers(interaction, gameName) {
        const guildData = interaction.client.friendCodes[interaction.guildId];
        const usersWithGame = [];
        
        // ゲームを登録しているユーザーを探す
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
        
        // ユーザーごとにフィールドを追加（縦一列に並べる、メンションとアイコン付き）
        for (const user of usersWithGame) {
            try {
                const member = await interaction.guild.members.fetch(user.userId);
                let value = `<@${user.userId}>\nコード: ${user.data.code}`;
                if (user.data.note) {
                    value += `\n備考: ${user.data.note}`;
                }
                
                // ユーザー名とアイコンを含むフィールド
                embed.addFields({
                    name: member.user.username,
                    value: value,
                    inline: false // 縦一列に表示するためfalseに変更
                });
                
                // アバターを設定（一番最後に更新されたユーザーのアバターが表示される）
                embed.setThumbnail(member.user.displayAvatarURL());
            } catch (error) {
                console.error(`ユーザー情報取得エラー (ID: ${user.userId}):`, error);
                // エラーの場合でもIDだけは表示
                embed.addFields({
                    name: `不明なユーザー (ID: ${user.userId})`,
                    value: `<@${user.userId}>\nコード: ${user.data.code}`,
                    inline: false // 縦一列に表示するためfalseに変更
                });
            }
        }
        
        await interaction.reply({
            embeds: [embed],
            ephemeral: true // ユーザーだけに表示
        });
    },

    // オートコンプリート処理
    async autocomplete(interaction) {
        if (!interaction.isAutocomplete()) return;
        
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'game') return;
        
        const guildData = interaction.client.friendCodes[interaction.guildId] || {};
        const input = focusedOption.value.toLowerCase();
        let choices = [];
        
        // 自分が登録したゲームのリスト
        const userGames = guildData.users?.[interaction.user.id] || {};
        
        if (interaction.options.getSubcommand() === 'remove') {
            // 削除の場合は自分が登録したゲームだけを表示
            choices = Object.keys(userGames);
        } else {
            // 追加の場合は既存の人気ゲームリストを表示
            choices = guildData.popularGames || [];
            
            // サーバー内の全ゲームも含める
            const allGames = new Set(choices);
            
            for (const userId in guildData.users || {}) {
                for (const game in guildData.users[userId] || {}) {
                    allGames.add(game);
                }
            }
            
            choices = [...allGames];
        }
        
        // 入力文字列でフィルタリング
        const filtered = input
            ? choices.filter(game => game.toLowerCase().includes(input))
            : choices;
        
        // 最大25個まで
        await interaction.respond(
            filtered.slice(0, 25).map(game => ({
                name: game,
                value: game
            }))
        );
    }
};