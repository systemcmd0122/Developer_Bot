// commands/afk.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// AFKユーザーの状態を保存するためのデータパス
const AFK_DATA_PATH = path.join(__dirname, '..', 'data', 'afk-settings.json');

// デフォルト設定
const DEFAULT_SETTINGS = {
    enabled: false,
    timeout: 30, // 分単位
    notifyBeforeKick: true,
    notifyTimeout: 5, // 分単位
    ignoredRoles: [],
    ignoredChannels: [],
    activeChecks: {}
};

// 設定の読み込み
function loadSettings() {
    try {
        if (fs.existsSync(AFK_DATA_PATH)) {
            const data = fs.readFileSync(AFK_DATA_PATH, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('AFKの設定読み込みエラー:', error);
        return {};
    }
}

// 設定の保存
function saveSettings(settings) {
    try {
        const dirPath = path.dirname(AFK_DATA_PATH);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(AFK_DATA_PATH, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
        console.error('AFKの設定保存エラー:', error);
    }
}

// アクティブチェックの開始
function startActiveCheck(client, guildId) {
    const settings = loadSettings();
    const guildSettings = settings[guildId] || { ...DEFAULT_SETTINGS };
    
    // 既存のチェックがあれば解除
    if (guildSettings.activeChecks && guildSettings.activeChecks[guildId]) {
        clearInterval(guildSettings.activeChecks[guildId]);
    }
    
    // AFKチェックが有効な場合のみ実行
    if (!guildSettings.enabled) return;
    
    const checkIntervalMs = 60000; // 1分ごとにチェック
    
    const intervalId = setInterval(async () => {
        try {
            const guild = await client.guilds.fetch(guildId);
            const voiceChannels = guild.channels.cache.filter(
                c => c.type === 2 && !guildSettings.ignoredChannels.includes(c.id)
            );
            
            for (const [_, channel] of voiceChannels) {
                for (const [memberId, member] of channel.members) {
                    // 無視すべきロールを持っているかチェック
                    const hasIgnoredRole = member.roles.cache.some(
                        role => guildSettings.ignoredRoles.includes(role.id)
                    );
                    
                    if (hasIgnoredRole) continue;
                    
                    // ユーザーのAFK時間をチェック
                    const afkData = guildSettings.users?.[memberId] || {
                        joinedAt: Date.now(),
                        notified: false
                    };
                    
                    // 新しいユーザーか、チャンネル移動したユーザーの場合は時間をリセット
                    if (!afkData.joinedAt || afkData.channelId !== channel.id) {
                        afkData.joinedAt = Date.now();
                        afkData.channelId = channel.id;
                        afkData.notified = false;
                    }
                    
                    const afkTime = (Date.now() - afkData.joinedAt) / 60000; // 分単位
                    
                    // 通知タイミングのチェック
                    if (guildSettings.notifyBeforeKick && 
                        !afkData.notified && 
                        afkTime >= (guildSettings.timeout - guildSettings.notifyTimeout)) {
                        
                        try {
                            await member.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('⚠️ AFKの警告')
                                        .setDescription(`あなたは${channel.name}で${Math.floor(afkTime)}分間アクティビティがありません。\n${guildSettings.notifyTimeout}分後に自動的にボイスチャンネルから切断されます。`)
                                        .setColor('#FFA500')
                                        .setTimestamp()
                                ]
                            });
                            afkData.notified = true;
                        } catch (dmError) {
                            console.error(`DMの送信に失敗: ${member.user.username}`, dmError);
                        }
                    }
                    
                    // キックタイミングのチェック
                    if (afkTime >= guildSettings.timeout) {
                        try {
                            await member.voice.disconnect('長時間AFKのため自動切断されました');
                            
                            // ログチャンネルがある場合は通知
                            if (guildSettings.logChannelId) {
                                const logChannel = guild.channels.cache.get(guildSettings.logChannelId);
                                if (logChannel) {
                                    await logChannel.send({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setTitle('🔇 AFKユーザーを切断しました')
                                                .setDescription(`**ユーザー:** ${member.user.username}\n**チャンネル:** ${channel.name}\n**AFK時間:** ${Math.floor(afkTime)}分`)
                                                .setColor('#FF0000')
                                                .setTimestamp()
                                        ]
                                    });
                                }
                            }
                            
                            // ユーザーデータをリセット
                            delete guildSettings.users[memberId];
                        } catch (kickError) {
                            console.error(`ユーザーの切断に失敗: ${member.user.username}`, kickError);
                        }
                    } else {
                        // ユーザーデータを更新
                        if (!guildSettings.users) guildSettings.users = {};
                        guildSettings.users[memberId] = afkData;
                    }
                }
            }
            
            // 設定を保存
            settings[guildId] = guildSettings;
            saveSettings(settings);
            
        } catch (error) {
            console.error('AFKチェック中にエラーが発生しました:', error);
        }
    }, checkIntervalMs);
    
    // インターバルIDを保存
    guildSettings.activeChecks[guildId] = intervalId;
    settings[guildId] = guildSettings;
    saveSettings(settings);
}

module.exports = {
    category: 'サーバー管理',
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('ボイスチャンネルでのAFKユーザー対策を設定します')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('現在のAFK対策設定を表示します')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('AFK対策を有効にします')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('AFK対策を無効にします')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('AFKとみなす時間を設定します')
                .addIntegerOption(option =>
                    option.setName('minutes')
                        .setDescription('AFKとみなす時間（分）')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(120)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('notification')
                .setDescription('キック前の通知設定を変更します')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('通知を有効にするか')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('minutes')
                        .setDescription('キック前の通知時間（分）')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(30)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ignore_role')
                .setDescription('特定のロールをAFKチェックから除外します')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('除外するロール')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('add')
                        .setDescription('追加する場合はtrue、削除する場合はfalse')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ignore_channel')
                .setDescription('特定のボイスチャンネルをAFKチェックから除外します')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('除外するボイスチャンネル')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('add')
                        .setDescription('追加する場合はtrue、削除する場合はfalse')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('log_channel')
                .setDescription('AFKキックのログを送信するチャンネルを設定します')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('ログを送信するチャンネル')
                        .setRequired(true)
                )
        ),
        
    // コマンド実行時の処理
    async execute(interaction) {
        if (!interaction.guild) {
            return await interaction.reply({
                content: 'このコマンドはサーバー内でのみ使用できます。',
                ephemeral: true
            });
        }
        
        const guildId = interaction.guild.id;
        const settings = loadSettings();
        
        // このギルドの設定がなければ初期設定を作成
        if (!settings[guildId]) {
            settings[guildId] = { ...DEFAULT_SETTINGS };
        }
        
        const guildSettings = settings[guildId];
        
        // 各サブコマンドの処理
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'status':
                // 現在の設定を表示
                const ignoredRoles = guildSettings.ignoredRoles.map(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role ? role.name : 'Unknown Role';
                }).join(', ') || 'なし';
                
                const ignoredChannels = guildSettings.ignoredChannels.map(id => {
                    const channel = interaction.guild.channels.cache.get(id);
                    return channel ? channel.name : 'Unknown Channel';
                }).join(', ') || 'なし';
                
                const logChannel = guildSettings.logChannelId 
                    ? interaction.guild.channels.cache.get(guildSettings.logChannelId)?.name || 'Unknown Channel'
                    : 'なし';
                
                const embed = new EmbedBuilder()
                    .setTitle('🔇 AFK対策の設定')
                    .setDescription(`現在のサーバーのAFK対策設定です。`)
                    .setColor(guildSettings.enabled ? '#00FF00' : '#FF0000')
                    .addFields(
                        { name: '状態', value: guildSettings.enabled ? '有効' : '無効', inline: true },
                        { name: 'タイムアウト', value: `${guildSettings.timeout}分`, inline: true },
                        { name: 'キック前通知', value: guildSettings.notifyBeforeKick ? `${guildSettings.notifyTimeout}分前` : '無効', inline: true },
                        { name: '除外ロール', value: ignoredRoles, inline: false },
                        { name: '除外チャンネル', value: ignoredChannels, inline: false },
                        { name: 'ログチャンネル', value: logChannel, inline: false }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                break;
                
            case 'enable':
                // 有効化
                guildSettings.enabled = true;
                await interaction.reply({
                    content: `✅ AFK対策を有効にしました。タイムアウト: ${guildSettings.timeout}分`,
                    ephemeral: true
                });
                
                // アクティブチェックを開始
                startActiveCheck(interaction.client, guildId);
                break;
                
            case 'disable':
                // 無効化
                guildSettings.enabled = false;
                
                // 既存のチェックがあれば解除
                if (guildSettings.activeChecks && guildSettings.activeChecks[guildId]) {
                    clearInterval(guildSettings.activeChecks[guildId]);
                    delete guildSettings.activeChecks[guildId];
                }
                
                await interaction.reply({
                    content: '✅ AFK対策を無効にしました。',
                    ephemeral: true
                });
                break;
                
            case 'timeout':
                // タイムアウト時間の設定
                const minutes = interaction.options.getInteger('minutes');
                guildSettings.timeout = minutes;
                
                await interaction.reply({
                    content: `✅ AFKタイムアウト時間を${minutes}分に設定しました。`,
                    ephemeral: true
                });
                
                // 設定が変更されたので既存のチェックを再起動
                if (guildSettings.enabled) {
                    startActiveCheck(interaction.client, guildId);
                }
                break;
                
            case 'notification':
                // 通知設定
                const notifyEnabled = interaction.options.getBoolean('enabled');
                guildSettings.notifyBeforeKick = notifyEnabled;
                
                const notifyMinutes = interaction.options.getInteger('minutes');
                if (notifyMinutes) {
                    guildSettings.notifyTimeout = notifyMinutes;
                }
                
                let notifyMessage;
                if (notifyEnabled) {
                    notifyMessage = `✅ キック前通知を有効にしました。キック${guildSettings.notifyTimeout}分前に通知します。`;
                } else {
                    notifyMessage = '✅ キック前通知を無効にしました。';
                }
                
                await interaction.reply({
                    content: notifyMessage,
                    ephemeral: true
                });
                break;
                
            case 'ignore_role':
                // ロールの除外設定
                const role = interaction.options.getRole('role');
                const addRole = interaction.options.getBoolean('add');
                
                if (!guildSettings.ignoredRoles) {
                    guildSettings.ignoredRoles = [];
                }
                
                if (addRole) {
                    if (!guildSettings.ignoredRoles.includes(role.id)) {
                        guildSettings.ignoredRoles.push(role.id);
                    }
                    await interaction.reply({
                        content: `✅ ロール「${role.name}」をAFKチェックから除外しました。`,
                        ephemeral: true
                    });
                } else {
                    guildSettings.ignoredRoles = guildSettings.ignoredRoles.filter(id => id !== role.id);
                    await interaction.reply({
                        content: `✅ ロール「${role.name}」のAFKチェック除外を解除しました。`,
                        ephemeral: true
                    });
                }
                break;
                
            case 'ignore_channel':
                // チャンネルの除外設定
                const channel = interaction.options.getChannel('channel');
                const addChannel = interaction.options.getBoolean('add');
                
                // ボイスチャンネルかどうかをチェック
                if (channel.type !== 2) { // 2 = ボイスチャンネル
                    return await interaction.reply({
                        content: '❌ ボイスチャンネルを選択してください。',
                        ephemeral: true
                    });
                }
                
                if (!guildSettings.ignoredChannels) {
                    guildSettings.ignoredChannels = [];
                }
                
                if (addChannel) {
                    if (!guildSettings.ignoredChannels.includes(channel.id)) {
                        guildSettings.ignoredChannels.push(channel.id);
                    }
                    await interaction.reply({
                        content: `✅ チャンネル「${channel.name}」をAFKチェックから除外しました。`,
                        ephemeral: true
                    });
                } else {
                    guildSettings.ignoredChannels = guildSettings.ignoredChannels.filter(id => id !== channel.id);
                    await interaction.reply({
                        content: `✅ チャンネル「${channel.name}」のAFKチェック除外を解除しました。`,
                        ephemeral: true
                    });
                }
                break;
                
            case 'log_channel':
                // ログチャンネルの設定
                const logCh = interaction.options.getChannel('channel');
                
                // テキストチャンネルかどうかをチェック
                if (logCh.type !== 0) { // 0 = テキストチャンネル
                    return await interaction.reply({
                        content: '❌ テキストチャンネルを選択してください。',
                        ephemeral: true
                    });
                }
                
                guildSettings.logChannelId = logCh.id;
                await interaction.reply({
                    content: `✅ AFKキックのログを「${logCh.name}」に送信するように設定しました。`,
                    ephemeral: true
                });
                break;
        }
        
        // 設定を保存
        settings[guildId] = guildSettings;
        saveSettings(settings);
    },
    
    // ボットロード時に各サーバーのアクティブチェックを開始
    loadAfkChecks(client) {
        const settings = loadSettings();
        
        for (const [guildId, guildSettings] of Object.entries(settings)) {
            if (guildSettings.enabled) {
                startActiveCheck(client, guildId);
            }
        }
        
        console.log('✓ AFKチェック機能を読み込みました');
    }
};