require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const os = require('os');
const https = require('https');
const InteractionManager = require('./events/interactions');

const BOT_VERSION = '1.1.0';
const PORT = process.env.PORT || 8000;
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// データディレクトリの確認と作成
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR);
        console.log(chalk.green('✓ Created data directory'));
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// JSONファイルを動的に読み込む関数
function loadJsonFiles() {
    const jsonFiles = {};
    try {
        const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
        
        for (const file of files) {
            const filePath = path.join(DATA_DIR, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            jsonFiles[file.replace('.json', '')] = JSON.parse(fileContent);
        }
        
        console.log(chalk.green(`✓ Loaded ${files.length} JSON files from data directory`));
        return jsonFiles;
    } catch (error) {
        console.error('Error loading JSON files:', error);
        return {};
    }
}

// Express app setup with HTTPS
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ルートパスのリダイレクト
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Koyebスリープモード対策のエンドポイント
app.get('/ping', (req, res) => {
    const timestamp = new Date().toISOString();
    res.status(200).json({
        status: 'ok',
        timestamp,
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// スリープ防止の設定
const PING_INTERVAL = 2 * 60 * 1000; // 2分
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 10000; // 10秒
const PING_URLS = [
    process.env.PING_URL1,
    process.env.PING_URL2,
    process.env.PING_URL3
].filter(Boolean);

// ping用の詳細なロギング関数
function logPingStatus(status, details = '') {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] Keep-alive ping: ${status}${details ? ` - ${details}` : ''}`;
    console.log(chalk.blue(message));
}

// ping失敗時のリトライ処理
async function retryPing(url, retryCount = 0) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'Discord-Bot/1.0' }
        });
        clearTimeout(timeout);

        if (response.ok) {
            logPingStatus('success', `Status: ${response.status}`);
            return true;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(chalk.yellow('Ping request timed out'));
        }
        
        if (retryCount < MAX_RETRY_COUNT) {
            console.log(chalk.yellow(`Retrying ping (${retryCount + 1}/${MAX_RETRY_COUNT})...`));
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return retryPing(url, retryCount + 1);
        }
        logPingStatus('failed', error.message);
        return false;
    }
    return false;
}

// 強化されたkeepAlive関数
function keepAlive() {
    const urls = [
        `${process.env.APP_URL}/ping`,
        `${process.env.APP_URL}/health`,
        ...PING_URLS
    ].filter(Boolean);

    let lastSuccessfulPing = Date.now();
    
    setInterval(async () => {
        let pingSuccess = false;

        for (const url of urls) {
            try {
                const success = await retryPing(url);
                if (success) {
                    pingSuccess = true;
                    lastSuccessfulPing = Date.now();
                    break;
                }
            } catch (error) {
                console.error('Error during ping:', error);
            }
        }

        if (!pingSuccess && (Date.now() - lastSuccessfulPing > 5 * 60 * 1000)) {
            console.warn(chalk.red('Warning: No successful ping in the last 5 minutes'));
        }

        const used = process.memoryUsage();
        console.log(chalk.cyan(
            `Memory Usage - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, ` +
            `Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`
        ));

        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length;

        if (cpuUsage > 0.8) {
            console.warn(chalk.red(`High CPU usage detected: ${Math.round(cpuUsage * 100)}%`));
        }

    }, PING_INTERVAL);

    // Express endpoints
    app.get('/ping', (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    app.get('/health', (req, res) => {
        const health = {
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: os.cpus()[0].times,
            loadavg: os.loadavg(),
            botStatus: client.ws.status
        };

        if (health.botStatus === 0) {
            res.status(200).json(health);
        } else {
            res.status(503).json({
                ...health,
                status: 'degraded',
                message: 'Bot connection issues detected'
            });
        }
    });

    const server = app.listen(PORT, () => {
        console.log(chalk.green(`Server is running on port ${PORT}`));
    });

    server.on('error', (error) => {
        console.error('Server error:', error);
    });
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    failIfNotExists: false,
    retryLimit: 5,
    presence: {
        status: 'online'
    }
});

// Initialize Collections
client.commands = new Collection();
client.buttonHandlers = new Collection();
client.menuHandlers = new Collection();
client.modalHandlers = new Collection();
client.roleBoards = {};
client.startTime = Date.now();

// Command tracking system
const commandStats = {
    usage: new Collection(),
    recent: []
};

// Track command usage
function trackCommand(commandName, user) {
    if (!commandStats.usage.has(commandName)) {
        commandStats.usage.set(commandName, {
            count: 0,
            users: new Set()
        });
    }

    const stats = commandStats.usage.get(commandName);
    stats.count++;
    stats.users.add(user.id);
    
    const recentCommand = {
        command: commandName,
        user: user.tag,
        timestamp: new Date().toISOString()
    };
    
    commandStats.recent.unshift(recentCommand);
    if (commandStats.recent.length > 10) {
        commandStats.recent.pop();
    }

    try {
        fs.writeFileSync(
            path.join(DATA_DIR, 'commandStats.json'),
            JSON.stringify({
                usage: Array.from(commandStats.usage.entries()),
                recent: commandStats.recent
            }, null, 2)
        );
    } catch (error) {
        console.error('Error saving command stats:', error);
    }
}

// Enhanced metrics collection
function getMetrics() {
    try {
        const usage = process.memoryUsage();
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100 * 100) / 100;
        const uptime = Math.floor((Date.now() - client.startTime) / 1000);

        return {
            memory: {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
                rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100
            },
            cpu: cpuUsage,
            uptime: {
                seconds: uptime % 60,
                minutes: Math.floor(uptime / 60) % 60,
                hours: Math.floor(uptime / 3600) % 24,
                days: Math.floor(uptime / 86400)
            },
            bot: {
                version: BOT_VERSION,
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                commands: client.commands.size
            },
            system: {
                platform: `${os.type()} ${os.release()}`,
                arch: os.arch(),
                nodejs: process.version
            },
            commands: {
                usage: Array.from(commandStats.usage.entries()).map(([name, stats]) => ({
                    name,
                    count: stats.count,
                    uniqueUsers: stats.users.size
                })),
                recent: commandStats.recent
            }
        };
    } catch (error) {
        console.error('Error getting metrics:', error);
        return null;
    }
}

// Enhanced command loading with retry mechanism
async function loadCommands(retries = 3) {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    const commands = [];
    
    let frameIndex = 0;
    for (const file of commandFiles) {
        let attempts = 0;
        while (attempts < retries) {
            try {
                process.stdout.write(`\r${FRAMES[frameIndex]} Loading command: ${file}`);
                frameIndex = (frameIndex + 1) % FRAMES.length;

                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    break;
                } else {
                    console.error(chalk.red(`\n✗ Command at ${file} missing required properties`));
                    break;
                }
            } catch (error) {
                attempts++;
                if (attempts === retries) {
                    console.error(chalk.red(`\n✗ Failed to load command ${file}:`, error));
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    console.log(chalk.green(`\n✓ Loaded ${client.commands.size} commands`));
    return commands;
}

// Enhanced event loading
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        try {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        } catch (error) {
            console.error(`Error loading event ${file}:`, error);
        }
    }
    console.log(chalk.green(`✓ Loaded ${eventFiles.length} events`));
}

// Enhanced command registration with retry mechanism
async function registerCommands(commands, retries = 3) {
    let attempts = 0;
    while (attempts < retries) {
        try {
            const rest = new REST().setToken(process.env.DISCORD_TOKEN);
            console.log(chalk.yellow('Started refreshing application (/) commands.'));

            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );

            console.log(chalk.green('Successfully reloaded application (/) commands.'));
            return true;
        } catch (error) {
            attempts++;
            console.error(chalk.red('Error registering commands:', error));
            
            if (attempts < retries) {
                console.log(chalk.yellow(`Retrying... (${attempts}/${retries})`));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    return false;
}

// Enhanced interaction handling
client.on(Events.InteractionCreate, async interaction => {
    try {
        // スラッシュコマンドの処理
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
            trackCommand(interaction.commandName, interaction.user);
            return;
        }

        // ボタンインタラクションの処理
        if (interaction.isButton()) {
            // じゃんけんコマンドのボタン処理
            if (interaction.customId.startsWith('janken-')) {
                const jankenCommand = client.commands.get('janken');
                if (!jankenCommand) {
                    await interaction.reply({
                        content: 'じゃんけんコマンドが見つかりません。',
                        ephemeral: true
                    });
                    return;
                }

                if (interaction.customId.startsWith('janken-again-')) {
                    await jankenCommand.handlePlayAgain(interaction);
                } else {
                    await jankenCommand.handleJankenButton(interaction);
                }
                return;
            }

            const buttonHandler = client.buttonHandlers.get(interaction.customId);
            if (buttonHandler) {
                await buttonHandler(interaction);
            }
            return;
        }

        // メニューインタラクションの処理
        if (interaction.isStringSelectMenu()) {
            const menuHandler = client.menuHandlers.get(interaction.customId);
            if (menuHandler) {
                await menuHandler(interaction);
            }
            return;
        }

        // モーダルの送信処理
        if (interaction.isModalSubmit()) {
            const modalHandler = client.modalHandlers.get(interaction.customId);
            if (modalHandler) {
                await modalHandler(interaction);
            }
            return;
        }

    } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = {
            content: 'インタラクションの処理中にエラーが発生しました。',
            ephemeral: true
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
});

// リアクションハンドラー
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    try {
        // 部分的なリアクションの場合は完全なデータを取得
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('リアクションのフェッチに失敗:', error);
                return;
            }
        }

        // 部分的なメッセージの場合は完全なデータを取得
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('メッセージのフェッチに失敗:', error);
                return;
            }
        }

        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', reaction.message.id)
            .single();

        if (boardError) {
            console.error('ロールボードの検索エラー:', boardError);
            return;
        }

        if (!board) {
            console.log('ロールボードが見つかりません:', reaction.message.id);
            return;
        }

        // ロール情報を取得
        const { data: roleData, error: roleError } = await supabase
            .from('roleboard_roles')
            .select('*')
            .eq('board_id', board.id)
            .eq('emoji', reaction.emoji.name)
            .single();

        if (roleError) {
            console.error('ロール情報の検索エラー:', roleError);
            return;
        }

        if (!roleData) {
            console.log('ロール情報が見つかりません:', reaction.emoji.name);
            return;
        }

        // ギルドメンバーを取得
        const guild = reaction.message.guild;
        if (!guild) {
            console.error('ギルドが見つかりません');
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (error) {
            console.error('メンバーのフェッチに失敗:', error);
            return;
        }

        let role;
        try {
            role = await guild.roles.fetch(roleData.role_id);
        } catch (error) {
            console.error('ロールのフェッチに失敗:', error);
            return;
        }

        if (!role) {
            console.error('ロールが存在しません:', roleData.role_id);
            return;
        }

        // ロールを付与
        try {
            await member.roles.add(role);
            console.log(`ロールを付与: ${role.name} to ${member.user.tag}`);
        } catch (error) {
            console.error('ロールの付与に失敗:', error);
            return;
        }

        // 使用統計を更新
        const { error: updateError } = await supabase
            .from('roleboard_roles')
            .update({
                uses: (roleData.uses || 0) + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('id', roleData.id);

        if (updateError) {
            console.error('使用統計の更新に失敗:', updateError);
        }

        // ロール割り当て履歴を記録
        const { error: assignmentError } = await supabase
            .from('role_assignments')
            .insert({
                board_id: board.id,
                role_id: role.id,
                user_id: user.id,
                guild_id: guild.id,
                action_type: 'add'
            });

        if (assignmentError) {
            console.error('ロール割り当て履歴の記録に失敗:', assignmentError);
        }

        // ユーザーにDMで通知
        try {
            await user.send({
                content: `ロール「${role.name}」が付与されました。`,
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.log('DMの送信に失敗:', error);
        }
    } catch (error) {
        console.error('リアクション追加エラー:', error);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;

    try {
        // 部分的なリアクションの場合は完全なデータを取得
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('リアクションのフェッチに失敗:', error);
                return;
            }
        }

        // 部分的なメッセージの場合は完全なデータを取得
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('メッセージのフェッチに失敗:', error);
                return;
            }
        }

        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', reaction.message.id)
            .single();

        if (boardError) {
            console.error('ロールボードの検索エラー:', boardError);
            return;
        }

        if (!board) {
            console.log('ロールボードが見つかりません:', reaction.message.id);
            return;
        }

        // ロール情報を取得
        const { data: roleData, error: roleError } = await supabase
            .from('roleboard_roles')
            .select('*')
            .eq('board_id', board.id)
            .eq('emoji', reaction.emoji.name)
            .single();

        if (roleError) {
            console.error('ロール情報の検索エラー:', roleError);
            return;
        }

        if (!roleData) {
            console.log('ロール情報が見つかりません:', reaction.emoji.name);
            return;
        }

        // ギルドメンバーを取得
        const guild = reaction.message.guild;
        if (!guild) {
            console.error('ギルドが見つかりません');
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (error) {
            console.error('メンバーのフェッチに失敗:', error);
            return;
        }

        let role;
        try {
            role = await guild.roles.fetch(roleData.role_id);
        } catch (error) {
            console.error('ロールのフェッチに失敗:', error);
            return;
        }

        if (!role) {
            console.error('ロールが存在しません:', roleData.role_id);
            return;
        }

        // ロールを削除
        try {
            await member.roles.remove(role);
            console.log(`ロールを削除: ${role.name} from ${member.user.tag}`);
        } catch (error) {
            console.error('ロールの削除に失敗:', error);
            return;
        }

        // ロール割り当て履歴を記録
        const { error: assignmentError } = await supabase
            .from('role_assignments')
            .insert({
                board_id: board.id,
                role_id: role.id,
                user_id: user.id,
                guild_id: guild.id,
                action_type: 'remove'
            });

        if (assignmentError) {
            console.error('ロール割り当て履歴の記録に失敗:', assignmentError);
        }

        // ユーザーにDMで通知
        try {
            await user.send({
                content: `ロール「${role.name}」が削除されました。`,
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.log('DMの送信に失敗:', error);
        }
    } catch (error) {
        console.error('リアクション削除エラー:', error);
    }
});

// Enhanced startup animation
async function animateStartup() {
    console.clear();
    
    const logo = [
        '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄',
        '█░░░░Discord Bot░░░░█',
        '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀'
    ];

    for (let i = 0; i < logo.length; i++) {
        console.log(chalk.cyan(logo[i]));
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(chalk.cyan('\n═══════════════════════'));
    console.log(chalk.yellow('  Starting Services...'));
    console.log(chalk.cyan('═══════════════════════\n'));
}

// Initialize interaction manager
client.interactionManager = new InteractionManager(client);

// Enhanced startup sequence
(async () => {
    try {
        await animateStartup();

        console.log(chalk.yellow('Loading commands...'));
        const commands = await loadCommands();
        
        if (commands.length > 0) {
            console.log(chalk.yellow('Registering commands...'));
            await registerCommands(commands);
        }

        console.log(chalk.yellow('Loading events...'));
        loadEvents();

        console.log(chalk.yellow('Loading JSON files...'));
        jsonCache = loadJsonFiles();

        await client.login(process.env.DISCORD_TOKEN);
        keepAlive();

        console.log(chalk.green('✓ Bot is ready and running!'));

    } catch (error) {
        console.error(chalk.red('Error during startup:'), error);
        process.exit(1);
    }
})();

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error);
});

// Reconnection handling
client.on('disconnect', () => {
    console.log(chalk.yellow('Bot disconnected. Attempting to reconnect...'));
});

client.on('reconnecting', () => {
    console.log(chalk.yellow('Bot reconnecting...'));
});

// Enhanced graceful shutdown
async function gracefulShutdown() {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    try {
        const statsPath = path.join(DATA_DIR, 'commandStats.json');
        fs.writeFileSync(statsPath, JSON.stringify({
            usage: Array.from(commandStats.usage.entries()),
            recent: commandStats.recent
        }, null, 2));

        if (client) {
            await client.destroy();
        }

        console.log(chalk.green('Shutdown completed successfully'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('Error during shutdown:'), error);
        process.exit(1);
    }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = { app, client };
