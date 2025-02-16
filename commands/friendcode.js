// commands/friendcode.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
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
                boards: {}
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

                // データ永続化
                await this.saveData(interaction.client);

                // 掲示板の更新
                await this.updateAllBoards(interaction);

                return interaction.reply({
                    content: `${game} のフレンドコードを登録しました！`,
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
                    .setColor('#00ff00')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();

                // ゲームごとにフィールドを追加
                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: true
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
                    ephemeral: false
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
                    .setColor('#0099ff')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                // ゲームごとにフィールドを追加
                for (const [game, data] of Object.entries(userCodes)) {
                    let value = `コード: ${data.code}`;
                    if (data.note) {
                        value += `\n備考: ${data.note}`;
                    }
                    value += `\n更新: ${new Date(data.updatedAt).toLocaleDateString('ja-JP')}`;

                    embed.addFields({
                        name: game,
                        value: value,
                        inline: true
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false
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

                // ゲーム名と登録者数をフィールドに追加
                const sortedGames = [...games.entries()]
                    .sort((a, b) => b[1] - a[1]); // 登録者数で降順ソート

                for (const [game, count] of sortedGames) {
                    // ボタンサブコマンドで使用する場合は20個までしか作れないため、最大20個に制限
                    if (embed.data.fields && embed.data.fields.length >= 20) break;

                    embed.addFields({
                        name: game,
                        value: `登録者数: ${count}人`,
                        inline: true
                    });
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('friendcode-show-users')
                            .setLabel('登録者を表示')
                            .setStyle(ButtonStyle.Primary),
                    );

                return interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: false
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
            return JSON.parse(data);
        } catch (err) {
            console.error('フレンドコードの読み込み中にエラーが発生しました:', err);
            return {};
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
            
            // ボタンコンポーネントを構築（5個ずつ、最大25個まで）
            const components = [];
            const sortedGames = [...games].sort();
            
            for (let i = 0; i < Math.min(sortedGames.length, 25); i += 5) {
                const row = new ActionRowBuilder();
                const groupGames = sortedGames.slice(i, i + 5);
                
                for (const game of groupGames) {
                    const button = new ButtonBuilder()
                        .setCustomId(`friendcode-game-${game}`)
                        .setLabel(game)
                        .setStyle(ButtonStyle.Primary);
                    
                    row.addComponents(button);
                }
                
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

    // ボタンハンドラー
    async handleButton(interaction) {
        if (!interaction.isButton()) return;
        
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
        
        // 「登録者を表示」ボタン
        if (customId === 'friendcode-show-users') {
            const gameIndex = interaction.message.embeds[0].fields.findIndex(
                field => field.name === interaction.values?.[0]
            );
            
            if (gameIndex === -1) {
                await interaction.reply({
                    content: 'ゲームが見つかりません。',
                    ephemeral: true
                });
                return;
            }
            
            const gameName = interaction.message.embeds[0].fields[gameIndex].name;
            await this.showGameUsers(interaction, gameName);
            return;
        }
        
        // ゲームボタン
        if (customId.startsWith('friendcode-game-')) {
            const gameName = customId.replace('friendcode-game-', '');
            await this.showGameUsers(interaction, gameName);
            return;
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
        
        // ユーザーごとにフィールドを追加
        for (const user of usersWithGame) {
            try {
                const member = await interaction.guild.members.fetch(user.userId);
                let value = `コード: ${user.data.code}`;
                if (user.data.note) {
                    value += `\n備考: ${user.data.note}`;
                }
                
                embed.addFields({
                    name: member.user.username,
                    value: value,
                    inline: true
                });
            } catch (error) {
                console.error(`ユーザー情報取得エラー (ID: ${user.userId}):`, error);
                // エラーの場合でもIDだけは表示
                embed.addFields({
                    name: `不明なユーザー (ID: ${user.userId})`,
                    value: `コード: ${user.data.code}`,
                    inline: true
                });
            }
        }
        
        await interaction.reply({
            embeds: [embed],
            ephemeral: false
        });
    }
};