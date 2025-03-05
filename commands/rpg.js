const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Gemini APIの設定
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// RPGデータを保存するディレクトリのパス
const RPG_DIR = path.join(__dirname, '..', 'data', 'rpg');

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(RPG_DIR)) {
    fs.mkdirSync(RPG_DIR, { recursive: true });
}

// アクティブな戦闘を保存するMap
const activeBattles = new Map();

// 職業の定義
const JOBS = {
    WARRIOR: {
        name: '戦士',
        baseHP: 100,
        baseMP: 20,
        baseAtk: 15,
        baseDef: 12,
        skills: {
            'かいしん': { mp: 0, power: 2.0, description: '会心の一撃！', type: 'attack' },
            'ぼうぎょ': { mp: 0, power: 1.5, description: '防御力が上がった！', type: 'defense' }
        }
    },
    MAGE: {
        name: '魔法使い',
        baseHP: 70,
        baseMP: 50,
        baseAtk: 8,
        baseDef: 8,
        skills: {
            'メラ': { mp: 4, power: 1.8, description: '炎の魔法！', type: 'magic' },
            'ホイミ': { mp: 6, power: 30, description: 'HP回復！', type: 'heal' }
        }
    },
    PRIEST: {
        name: '僧侶',
        baseHP: 85,
        baseMP: 40,
        baseAtk: 10,
        baseDef: 10,
        skills: {
            'ホイミ': { mp: 5, power: 40, description: 'HP回復！', type: 'heal' },
            'マホトーン': { mp: 8, power: 1.0, description: '敵の魔法を封じた！', type: 'support' }
        }
    }
};

// モンスターの定義
const MONSTERS = {
    'スライム': {
        hp: 30,
        atk: 8,
        def: 5,
        exp: 5,
        gold: 3,
        drops: ['スライムゼリー'],
        description: 'どこにでもいる青いスライム。',
        level: 1
    },
    'ゴーレム': {
        hp: 100,
        atk: 15,
        def: 15,
        exp: 20,
        gold: 15,
        drops: ['がんせきへい'],
        description: '岩で出来た巨人。防御力が高い。',
        level: 5
    },
    'ドラゴン': {
        hp: 200,
        atk: 25,
        def: 20,
        exp: 50,
        gold: 100,
        drops: ['りゅうのうろこ'],
        description: '炎を吐く強大なドラゴン。',
        level: 10
    }
};

// アイテムの定義
const ITEMS = {
    'やくそう': {
        type: 'heal',
        power: 30,
        description: 'HPを30回復する薬草',
        price: 8
    },
    'まほうのみず': {
        type: 'mp',
        power: 20,
        description: 'MPを20回復する水',
        price: 15
    },
    'ぎんのつるぎ': {
        type: 'weapon',
        power: 15,
        description: '攻撃力+15の剣',
        price: 500
    }
};

module.exports = {
    category: 'ゲーム',
    data: new SlashCommandBuilder()
        .setName('rpg')
        .setDescription('ドラゴンクエスト風RPG')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('新しく冒険を始める')
                .addStringOption(option =>
                    option
                        .setName('job')
                        .setDescription('職業を選択')
                        .setRequired(true)
                        .addChoices(
                            { name: '戦士', value: 'WARRIOR' },
                            { name: '魔法使い', value: 'MAGE' },
                            { name: '僧侶', value: 'PRIEST' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('battle')
                .setDescription('モンスターと戦闘'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('ステータスを確認'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shop')
                .setDescription('ショップで買い物'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('inventory')
                .setDescription('持ち物を確認'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ranking')
                .setDescription('ランキングを表示')),

    // プレイヤーデータのファイルパスを取得
    getPlayerDataPath(userId) {
        return path.join(RPG_DIR, `${userId}.json`);
    },

    // プレイヤーデータを読み込む
    loadPlayerData(userId) {
        const dataPath = this.getPlayerDataPath(userId);
        if (fs.existsSync(dataPath)) {
            try {
                const data = fs.readFileSync(dataPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error(chalk.red('✗ Error reading player data:'), error);
                return null;
            }
        }
        return null;
    },

    // プレイヤーデータを保存
    savePlayerData(userId, data) {
        const dataPath = this.getPlayerDataPath(userId);
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    },

    // 新しいプレイヤーデータを作成
    createNewPlayer(userId, username, jobType) {
        const job = JOBS[jobType];
        return {
            userId: userId,
            username: username,
            job: jobType,
            level: 1,
            exp: 0,
            nextLevelExp: 100,
            hp: job.baseHP,
            maxHp: job.baseHP,
            mp: job.baseMP,
            maxMp: job.baseMP,
            atk: job.baseAtk,
            def: job.baseDef,
            gold: 50,
            inventory: {
                'やくそう': 3,
                'まほうのみず': 2
            },
            equipment: {},
            skills: Object.keys(job.skills),
            battleWins: 0,
            battleLosses: 0,
            created: new Date().toISOString()
        };
    },

    // 経験値からレベルアップを判定
    checkLevelUp(playerData) {
        let leveled = false;
        while (playerData.exp >= playerData.nextLevelExp) {
            playerData.level++;
            playerData.exp -= playerData.nextLevelExp;
            playerData.nextLevelExp = Math.floor(playerData.nextLevelExp * 1.5);

            // ステータス上昇
            const job = JOBS[playerData.job];
            playerData.maxHp += Math.floor(job.baseHP * 0.1);
            playerData.maxMp += Math.floor(job.baseMP * 0.1);
            playerData.atk += Math.floor(job.baseAtk * 0.1);
            playerData.def += Math.floor(job.baseDef * 0.1);

            playerData.hp = playerData.maxHp;
            playerData.mp = playerData.maxMp;
            leveled = true;
        }
        return leveled;
    },

    // バトルコマンドの作成
    createBattleButtons(playerData) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonCount = 0;

        // 通常攻撃ボタン
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('attack')
                .setLabel('こうげき')
                .setStyle(ButtonStyle.Primary)
        );
        buttonCount++;

        // スキルボタン
        for (const skill of playerData.skills) {
            if (buttonCount === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonCount = 0;
            }

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`skill_${skill}`)
                    .setLabel(skill)
                    .setStyle(ButtonStyle.Secondary)
            );
            buttonCount++;
        }

        // アイテムボタン
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('item')
                .setLabel('どうぐ')
                .setStyle(ButtonStyle.Success)
        );
        buttonCount++;

        // にげるボタン
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('escape')
                .setLabel('にげる')
                .setStyle(ButtonStyle.Danger)
        );

        rows.push(currentRow);
        return rows;
    },

    // バトル画面の作成
    createBattleEmbed(battleData) {
        const player = battleData.player;
        const monster = battleData.monster;
        const job = JOBS[player.job];

        return new EmbedBuilder()
            .setTitle(`🗡️ バトル - ${monster.name}があらわれた！`)
            .setDescription(monster.description)
            .addFields(
                { name: 'プレイヤー', value: `${player.username} - Lv.${player.level} ${job.name}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'モンスター', value: monster.name, inline: true },
                { name: 'HP', value: `${player.hp}/${player.maxHp}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'HP', value: `${battleData.monsterHp}/${monster.hp}`, inline: true },
                { name: 'MP', value: `${player.mp}/${player.maxMp}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '状態', value: battleData.status || '通常', inline: true }
            )
            .setColor('#FF0000')
            .setFooter({ text: battleData.message || 'コマンドを選択してください' });
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'start':
                await this.handleStart(interaction);
                break;
            case 'battle':
                await this.handleBattle(interaction);
                break;
            case 'status':
                await this.handleStatus(interaction);
                break;
            case 'shop':
                await this.handleShop(interaction);
                break;
            case 'inventory':
                await this.handleInventory(interaction);
                break;
            case 'ranking':
                await this.handleRanking(interaction);
                break;
        }
    },

    async handleStart(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const jobType = interaction.options.getString('job');

        // 既存のプレイヤーデータをチェック
        if (this.loadPlayerData(userId)) {
            await interaction.reply({
                content: '既に冒険を始めています！`/rpg status`で状態を確認できます。',
                ephemeral: true
            });
            return;
        }

        // 新しいプレイヤーデータを作成
        const playerData = this.createNewPlayer(userId, username, jobType);
        this.savePlayerData(userId, playerData);

        const job = JOBS[jobType];
        const embed = new EmbedBuilder()
            .setTitle('🎮 新しい冒険の始まり！')
            .setDescription(`${username}は${job.name}として冒険を始めました！`)
            .addFields(
                { name: 'HP', value: playerData.hp.toString(), inline: true },
                { name: 'MP', value: playerData.mp.toString(), inline: true },
                { name: 'ゴールド', value: playerData.gold.toString(), inline: true },
                { name: '持っているスキル', value: playerData.skills.join(', ') },
                { name: '持ち物', value: Object.entries(playerData.inventory).map(([item, count]) => `${item} x${count}`).join('\n') }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Gemini APIを使って冒険の開始メッセージを生成
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
            const prompt = `ユーザー「${username}」が${job.name}として冒険を始めました。
                          ドラゴンクエストっぽい感じで、励ましと冒険のアドバイスを含んだ短いメッセージを書いてください。`;
            
            const result = await model.generateContent(prompt);
            const message = result.response.text();
            
            await interaction.followUp(message);
        } catch (error) {
            console.error(chalk.red('✗ Error generating welcome message:'), error);
        }
    },

    async handleBattle(interaction) {
        const userId = interaction.user.id;
        const playerData = this.loadPlayerData(userId);

        if (!playerData) {
            await interaction.reply({
                content: '冒険がまだ始まっていません！`/rpg start`で冒険を始めましょう。',
                ephemeral: true
            });
            return;
        }

        if (activeBattles.has(userId)) {
            await interaction.reply({
                content: '既に戦闘中です！',
                ephemeral: true
            });
            return;
        }

        // プレイヤーのレベルに応じて出現するモンスターを選択
        const availableMonsters = Object.entries(MONSTERS)
            .filter(([_, monster]) => Math.abs(monster.level - playerData.level) <= 3)
            .map(([name, data]) => ({ name, ...data }));

        if (availableMonsters.length === 0) {
            await interaction.reply({
                content: 'エラー：適切なモンスターが見つかりません。',
                ephemeral: true
            });
            return;
        }

        const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
        const battleData = {
            player: playerData,
            monster: monster,
            monsterHp: monster.hp,
            status: '戦闘開始',
            turn: 1,
            message: `${monster.name}があらわれた！`
        };

        activeBattles.set(userId, battleData);

        const embed = this.createBattleEmbed(battleData);
        const buttons = this.createBattleButtons(playerData);

        await interaction.reply({
            embeds: [embed],
            components: buttons
        });
    },

    async handleStatus(interaction) {
        const userId = interaction.user.id;
        const playerData = this.loadPlayerData(userId);

        if (!playerData) {
            await interaction.reply({
                content: '冒険がまだ始まっていません！`/rpg start`で冒険を始めましょう。',
                ephemeral: true
            });
            return;
        }

        const job = JOBS[playerData.job];
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${playerData.username}のステータス`)
            .setDescription(`Lv.${playerData.level} ${job.name}`)
            .addFields(
                { name: 'HP', value: `${playerData.hp}/${playerData.maxHp}`, inline: true },
                { name: 'MP', value: `${playerData.mp}/${playerData.maxMp}`, inline: true },
                { name: 'ゴールド', value: playerData.gold.toString(), inline: true },
                { name: '攻撃力', value: playerData.atk.toString(), inline: true },
                { name: '防御力', value: playerData.def.toString(), inline: true },
                { name: '戦闘成績', value: `${playerData.battleWins}勝 ${playerData.battleLosses}敗`, inline: true },
                { name: '経験値', value: `${playerData.exp}/${playerData.nextLevelExp}`, inline: false },
                { name: 'スキル', value: playerData.skills.join(', '), inline: false }
            )
            .setColor('#0099FF')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleShop(interaction) {
        const userId = interaction.user.id;
        const playerData = this.loadPlayerData(userId);

        if (!playerData) {
            await interaction.reply({
                content: '冒険がまだ始まっていません！`/rpg start`で冒険を始めましょう。',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏪 道具屋')
            .setDescription(`所持金: ${playerData.gold}G`)
            .addFields(
                Object.entries(ITEMS).map(([name, item]) => ({
                    name: `${name} - ${item.price}G`,
                    value: item.description,
                    inline: true
                }))
            )
            .setColor('#FFD700');

        const buttons = new ActionRowBuilder()
            .addComponents(
                Object.keys(ITEMS).map(itemName =>
                    new ButtonBuilder()
                        .setCustomId(`buy_${itemName}`)
                        .setLabel(`${itemName}を買う`)
                        .setStyle(ButtonStyle.Primary)
                )
            );

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    },

    async handleInventory(interaction) {
        const userId = interaction.user.id;
        const playerData = this.loadPlayerData(userId);

        if (!playerData) {
            await interaction.reply({
                content: '冒険がまだ始まっていません！`/rpg start`で冒険を始めましょう。',
                ephemeral: true
            });
            return;
        }

        const inventoryText = Object.entries(playerData.inventory)
            .map(([item, count]) => `${item} x${count}`)
            .join('\n');

        const equipmentText = Object.entries(playerData.equipment)
            .map(([slot, item]) => `${slot}: ${item}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🎒 ${playerData.username}の持ち物`)
            .addFields(
                { name: '所持金', value: `${playerData.gold}G`, inline: false },
                { name: 'アイテム', value: inventoryText || 'なし', inline: false },
                { name: '装備', value: equipmentText || 'なし', inline: false }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleRanking(interaction) {
        const files = fs.readdirSync(RPG_DIR).filter(file => file.endsWith('.json'));
        const rankings = [];

        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(RPG_DIR, file), 'utf8'));
                rankings.push({
                    username: data.username,
                    level: data.level,
                    battleWins: data.battleWins,
                    exp: data.exp
                });
            } catch (error) {
                console.error(chalk.red('✗ Error reading ranking data:'), error);
            }
        }

        // レベルでソート
        rankings.sort((a, b) => b.level - a.level);

        const embed = new EmbedBuilder()
            .setTitle('🏆 冒険者ランキング')
            .setDescription('上位10名の冒険者')
            .addFields(
                rankings.slice(0, 10).map((player, index) => ({
                    name: `${index + 1}位: ${player.username}`,
                    value: `レベル: ${player.level} | 勝利数: ${player.battleWins}`,
                    inline: false
                }))
            )
            .setColor('#FFD700')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        if (!activeBattles.has(userId)) return;

        const battleData = activeBattles.get(userId);
        const playerData = battleData.player;

        // ボタンのカスタムIDに基づいてアクションを処理
        if (interaction.customId === 'attack') {
            // 通常攻撃の処理
            const damage = Math.max(1, playerData.atk - battleData.monster.def);
            battleData.monsterHp -= damage;
            battleData.message = `${playerData.username}の攻撃！\n${battleData.monster.name}に${damage}のダメージ！`;
        } else if (interaction.customId.startsWith('skill_')) {
            // スキル攻撃の処理
            const skillName = interaction.customId.replace('skill_', '');
            const skill = JOBS[playerData.job].skills[skillName];

            if (playerData.mp < skill.mp) {
                await interaction.reply({
                    content: 'MPが足りません！',
                    ephemeral: true
                });
                return;
            }

            playerData.mp -= skill.mp;
            let damage = 0;

            switch (skill.type) {
                case 'attack':
                    damage = Math.max(1, Math.floor(playerData.atk * skill.power) - battleData.monster.def);
                    battleData.monsterHp -= damage;
                    battleData.message = `${playerData.username}は${skillName}を使った！\n${battleData.monster.name}に${damage}のダメージ！`;
                    break;
                case 'heal':
                    const healAmount = Math.min(skill.power, playerData.maxHp - playerData.hp);
                    playerData.hp += healAmount;
                    battleData.message = `${playerData.username}は${skillName}を使った！\nHPが${healAmount}回復した！`;
                    break;
            }
        } else if (interaction.customId === 'escape') {
            // 逃走の処理
            const escapeChance = Math.random();
            if (escapeChance > 0.5) {
                battleData.message = '逃げ出した！';
                activeBattles.delete(userId);
                this.savePlayerData(userId, playerData);
                
                await interaction.update({
                    embeds: [this.createBattleEmbed(battleData)],
                    components: []
                });
                return;
            } else {
                battleData.message = '逃げ出せなかった！';
            }
        }

        // モンスターの攻撃
        if (battleData.monsterHp > 0) {
            const monsterDamage = Math.max(1, battleData.monster.atk - playerData.def);
            playerData.hp -= monsterDamage;
            battleData.message += `\n${battleData.monster.name}の攻撃！\n${playerData.username}に${monsterDamage}のダメージ！`;
        }

        // 戦闘終了判定
        if (battleData.monsterHp <= 0) {
            // 勝利処理
            const expGain = battleData.monster.exp;
            const goldGain = battleData.monster.gold;
            playerData.exp += expGain;
            playerData.gold += goldGain;
            playerData.battleWins++;

            battleData.message = `${battleData.monster.name}を倒した！\n${expGain}の経験値と${goldGain}Gを獲得！`;
            
            // レベルアップ判定
            if (this.checkLevelUp(playerData)) {
                battleData.message += `\nレベルアップ！ ${playerData.level}になった！`;
            }

            activeBattles.delete(userId);
            this.savePlayerData(userId, playerData);

            await interaction.update({
                embeds: [this.createBattleEmbed(battleData)],
                components: []
            });
            return;
        } else if (playerData.hp <= 0) {
            // 敗北処理
            playerData.hp = Math.max(1, Math.floor(playerData.maxHp * 0.1));
            playerData.gold = Math.max(0, playerData.gold - Math.floor(playerData.gold * 0.1));
            playerData.battleLosses++;

            battleData.message = '力尽きてしまった...\n最近の町に戻された...';
            
            activeBattles.delete(userId);
            this.savePlayerData(userId, playerData);

            await interaction.update({
                embeds: [this.createBattleEmbed(battleData)],
                components: []
            });
            return;
        }

        // 戦闘継続
        this.savePlayerData(userId, playerData);
        await interaction.update({
            embeds: [this.createBattleEmbed(battleData)],
            components: this.createBattleButtons(playerData)
        });
    }
};

// インタラクション（ボタンクリックなど）のハンドラーを設定
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    if (!activeBattles.has(userId)) return;

    const battleData = activeBattles.get(userId);
    const playerData = battleData.player;

    // ボタンのカスタムIDに基づいてアクションを処理
    if (interaction.customId === 'attack') {
        // 通常攻撃の処理
        const damage = Math.max(1, playerData.atk - battleData.monster.def);
        battleData.monsterHp -= damage;
        battleData.message = `${playerData.username}の攻撃！\n${battleData.monster.name}に${damage}のダメージ！`;
    } else if (interaction.customId.startsWith('skill_')) {
        // スキル攻撃の処理
        const skillName = interaction.customId.replace('skill_', '');
        const skill = JOBS[playerData.job].skills[skillName];

        if (playerData.mp < skill.mp) {
            await interaction.reply({
                content: 'MPが足りません！',
                ephemeral: true
            });
            return;
        }

        playerData.mp -= skill.mp;
        let damage = 0;

        switch (skill.type) {
            case 'attack':
                damage = Math.max(1, Math.floor(playerData.atk * skill.power) - battleData.monster.def);
                battleData.monsterHp -= damage;
                battleData.message = `${playerData.username}は${skillName}を使った！\n${battleData.monster.name}に${damage}のダメージ！`;
                break;
            case 'heal':
                const healAmount = Math.min(skill.power, playerData.maxHp - playerData.hp);
                playerData.hp += healAmount;
                battleData.message = `${playerData.username}は${skillName}を使った！\nHPが${healAmount}回復した！`;
                break;
        }
    } else if (interaction.customId === 'escape') {
        // 逃走の処理
        const escapeChance = Math.random();
        if (escapeChance > 0.5) {
            battleData.message = '逃げ出した！';
            activeBattles.delete(userId);
            this.savePlayerData(userId, playerData);
            
            await interaction.update({
                embeds: [this.createBattleEmbed(battleData)],
                components: []
            });
            return;
        } else {
            battleData.message = '逃げ出せなかった！';
        }
    }

    // モンスターの攻撃
    if (battleData.monsterHp > 0) {
        const monsterDamage = Math.max(1, battleData.monster.atk - playerData.def);
        playerData.hp -= monsterDamage;
        battleData.message += `\n${battleData.monster.name}の攻撃！\n${playerData.username}に${monsterDamage}のダメージ！`;
    }

    // 戦闘終了判定
    if (battleData.monsterHp <= 0) {
        // 勝利処理
        const expGain = battleData.monster.exp;
        const goldGain = battleData.monster.gold;
        playerData.exp += expGain;
        playerData.gold += goldGain;
        playerData.battleWins++;

        battleData.message = `${battleData.monster.name}を倒した！\n${expGain}の経験値と${goldGain}Gを獲得！`;
        
        // レベルアップ判定
        if (this.checkLevelUp(playerData)) {
            battleData.message += `\nレベルアップ！ ${playerData.level}になった！`;
        }

        activeBattles.delete(userId);
        this.savePlayerData(userId, playerData);

        await interaction.update({
            embeds: [this.createBattleEmbed(battleData)],
            components: []
        });
        return;
    } else if (playerData.hp <= 0) {
        // 敗北処理
        playerData.hp = Math.max(1, Math.floor(playerData.maxHp * 0.1));
        playerData.gold = Math.max(0, playerData.gold - Math.floor(playerData.gold * 0.1));
        playerData.battleLosses++;

        battleData.message = '力尽きてしまった...\n最近の町に戻された...';
        
        activeBattles.delete(userId);
        this.savePlayerData(userId, playerData);

        await interaction.update({
            embeds: [this.createBattleEmbed(battleData)],
            components: []
        });
        return;
    }

    // 戦闘継続
    this.savePlayerData(userId, playerData);
    await interaction.update({
        embeds: [this.createBattleEmbed(battleData)],
        components: this.createBattleButtons(playerData)
    });
});