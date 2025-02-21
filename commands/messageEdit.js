// commands/messageEdit.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ユーザーメッセージ削除リストを格納するオブジェクト
let userDeleteList = {};

// ユーザーメッセージ削除リストのファイルパスを設定
const savePath = path.join(__dirname, '..', 'data', 'userMessageDeleteList.json');

// 特定の管理者ロールID
const ADMIN_ROLE_ID = '1331169550728957982';

// ディレクトリが存在しない場合は作成
function ensureDirExists() {
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// データの保存処理
function saveData() {
    try {
        ensureDirExists();
        fs.writeFileSync(savePath, JSON.stringify(userDeleteList, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving user delete list:', error);
    }
}

// データの読み込み処理
function loadData() {
    try {
        if (fs.existsSync(savePath)) {
            const data = fs.readFileSync(savePath, 'utf8');
            userDeleteList = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading user delete list:', error);
        userDeleteList = {};
    }
}

// 初期化時にデータを読み込む
loadData();

module.exports = {
    category: 'メッセージ管理',
    data: new SlashCommandBuilder()
        .setName('messageedit')
        .setDescription('ユーザーメッセージの自動削除を管理します')
        .setDefaultMemberPermissions(PermissionFlagsBits.ADMINISTRATOR)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('指定したユーザーのメッセージの自動削除を開始します')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('メッセージを削除するユーザー')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('削除理由（オプション）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('指定したユーザーのメッセージの自動削除を停止します')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('削除を停止するユーザー')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('現在自動削除が有効なユーザーのリストを表示します')
        ),

    async execute(interaction) {
        // 特定のロールを持っているか確認
        const hasRequiredRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ADMINISTRATOR);
        
        // 管理者権限またはADMIN_ROLE_IDを持っていない場合は実行を拒否
        if (!isAdmin && !hasRequiredRole) {
            const embed = new EmbedBuilder()
                .setTitle('⛔ 権限エラー')
                .setDescription('このコマンドを実行する権限がありません。')
                .setColor('#FF0000')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || '理由は指定されていません';

            // すでにリストに存在する場合
            if (userDeleteList[targetUser.id]) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ 自動削除の設定済み')
                    .setDescription(`${targetUser.username} は既に自動削除リストに登録されています。`)
                    .setColor('#FFA500')
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // ユーザーを削除リストに追加
            userDeleteList[targetUser.id] = {
                username: targetUser.username,
                startedAt: new Date().toISOString(),
                startedBy: interaction.user.id,
                reason: reason
            };

            // データを保存
            saveData();

            const embed = new EmbedBuilder()
                .setTitle('✅ 自動削除を開始しました')
                .setDescription(`${targetUser.username} のメッセージを自動削除します。`)
                .addFields(
                    { name: '対象ユーザー', value: `<@${targetUser.id}>`, inline: true },
                    { name: '設定者', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '削除理由', value: reason, inline: false }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (subcommand === 'stop') {
            const targetUser = interaction.options.getUser('user');

            // リストに存在しない場合
            if (!userDeleteList[targetUser.id]) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ 自動削除の設定なし')
                    .setDescription(`${targetUser.username} は自動削除リストに登録されていません。`)
                    .setColor('#FFA500')
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // ユーザーを削除リストから削除
            delete userDeleteList[targetUser.id];

            // データを保存
            saveData();

            const embed = new EmbedBuilder()
                .setTitle('🛑 自動削除を停止しました')
                .setDescription(`${targetUser.username} のメッセージの自動削除を停止しました。`)
                .addFields(
                    { name: '対象ユーザー', value: `<@${targetUser.id}>`, inline: true },
                    { name: '停止者', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (subcommand === 'list') {
            const userIds = Object.keys(userDeleteList);

            if (userIds.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 自動削除リスト')
                    .setDescription('現在、自動削除が設定されているユーザーはいません。')
                    .setColor('#0099FF')
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const userListEntries = userIds.map(userId => {
                const info = userDeleteList[userId];
                const startDate = new Date(info.startedAt).toLocaleString('ja-JP');
                return `<@${userId}> (${info.username}) - ${startDate}に<@${info.startedBy}>が設定\n理由: ${info.reason}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('📋 自動削除リスト')
                .setDescription('現在、以下のユーザーのメッセージが自動削除されます：\n\n' + userListEntries.join('\n\n'))
                .setColor('#0099FF')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },

    // メッセージイベントハンドラー（外部から呼び出される）
    handleMessage(message) {
        if (message.author.bot) return false;

        // ユーザーがリストに存在する場合、メッセージを削除
        if (userDeleteList[message.author.id]) {
            message.delete()
                .then(() => {
                    console.log(`Auto-deleted message from ${message.author.username}`);
                })
                .catch(error => {
                    console.error('Error auto-deleting message:', error);
                });
            return true;
        }
        return false;
    },

    // データロード関数（初期化時に呼び出される）
    loadData() {
        loadData();
        return userDeleteList;
    },

    // データ保存関数（必要に応じて外部から呼び出される）
    saveData() {
        saveData();
    }
};