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
                popularGames: []
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

                if (!guildData.users[userId]) {
                    guildData.users[userId] = {};
                }

                guildData.users[userId][game] = {
                    code: code,
                    note: note,
                    updatedAt: new Date().toISOString()
                };

                this.updatePopularGames(interaction.client, interaction.guildId);
                await this.saveData(interaction.client);
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

                this.updatePopularGames(interaction.client, interaction.guildId);
                await this.saveData(interaction.client);
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
                interaction.client.interactionManager.saveButtonInteraction(interaction.id, {
                    type: 'delete-all',
                    userId: interaction.user.id
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
                interaction.client.interactionManager.saveMenuInteraction(interaction.id, {
                    type: 'game-select',
                    games: gameOptions
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

                // ボード情報を保存
                interaction.client.interactionManager.saveBoardInteraction(message.id, {
                    channelId: interaction.channel.id,
                    title: title,
                    description: description
                });

                await this.saveData(interaction.client);
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
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const filePath = path.join(dataDir, 'friendcodes.json');
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

    // データ読み込み用のヘルパーメソッド
    loadData(client) {
        const dataDir = path.join(__dirname, '..', 'data');
        const filePath = path.join(dataDir, 'friendcodes.json');
        
        if (!fs.existsSync(filePath)) {
            return {};
        }
        
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            
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
                interaction.client.interactionManager.saveMenuInteraction(`board-${messageId}`, {
                    type: 'board-game-select',
                    games: gameOptions,
                    boardId: messageId
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
                    await this.saveData(interaction.client);
                    await this.updateAllBoards(interaction);
                    
                    // インタラクションを削除
                    interaction.client.interactionManager.removeInteraction(interaction.message.id);
                    
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
        if (focusedOption.name !== 'game') return;
        
        const guildData = interaction.client.friendCodes[interaction.guildId] || {};
        const input = focusedOption.value.toLowerCase();
        let choices = [];
        
        const userGames = guildData.users?.[interaction.user.id] || {};
        
        if (interaction.options.getSubcommand() === 'remove') {
            choices = Object.keys(userGames);
        } else {
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
    }
};