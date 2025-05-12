require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const os = require('os');
const https = require('https');

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
app.use(express.static('public'));
app.use(express.json());

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
].filter(Boolean); // undefined/nullを除外

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

        // メインのURLでping試行
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

        // 最後の成功から5分以上経過している場合、警告を表示
        if (!pingSuccess && (Date.now() - lastSuccessfulPing > 5 * 60 * 1000)) {
            console.warn(chalk.red('Warning: No successful ping in the last 5 minutes'));
        }

        // メモリ使用状況のログ
        const used = process.memoryUsage();
        console.log(chalk.cyan(
            `Memory Usage - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, ` +
            `Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`
        ));

        // CPU使用率の監視
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

    // Express endpointsの強化
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

// Global data stores with persistence
client.commands = new Collection();
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

    // JSONファイルに保存
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

// Enhanced error handling for routes
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } catch (error) {
        console.error('Error serving dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// メトリクスAPIエンドポイント
app.get('/metrics', (req, res) => {
    try {
        const metrics = getMetrics();
        if (metrics) {
            res.json(metrics);
        } else {
            res.status(500).json({ error: 'Failed to collect metrics' });
        }
    } catch (error) {
        console.error('Error serving metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// JSONファイルの更新を監視する機能
let jsonCache = {};
const jsonWatcher = fs.watch(DATA_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
        const filePath = path.join(DATA_DIR, filename);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const newData = JSON.parse(content);
            const oldData = jsonCache[filename];
            jsonCache[filename] = newData;

            if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
                console.log(chalk.blue(`JSON file updated: ${filename}`));
            }
        } catch (error) {
            console.error(`Error watching JSON file ${filename}:`, error);
        }
    }
});

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

// Enhanced interaction handling with command tracking
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
        
        // コマンド使用状況を追跡
        trackCommand(interaction.commandName, interaction.user);
        
    } catch (error) {
        console.error('Error executing command:', error);
        const errorMessage = {
            content: 'コマンドの実行中にエラーが発生しました。',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
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

// Enhanced error handling
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

// Enhanced startup sequence
(async () => {
    try {
        await animateStartup();

        // コマンドの読み込みと登録
        console.log(chalk.yellow('Loading commands...'));
        const commands = await loadCommands();
        
        if (commands.length > 0) {
            console.log(chalk.yellow('Registering commands...'));
            await registerCommands(commands);
        }

        // イベントの読み込み
        console.log(chalk.yellow('Loading events...'));
        loadEvents();

        // JSONファイルの読み込み
        console.log(chalk.yellow('Loading JSON files...'));
        jsonCache = loadJsonFiles();

        // Botの起動
        await client.login(process.env.DISCORD_TOKEN);
        
        // サーバーの起動
        keepAlive();

    } catch (error) {
        console.error(chalk.red('Error during startup:'), error);
        process.exit(1);
    }
})();

// Enhanced graceful shutdown
async function gracefulShutdown() {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    try {
        // コマンド使用状況の保存
        const statsPath = path.join(DATA_DIR, 'commandStats.json');
        fs.writeFileSync(statsPath, JSON.stringify({
            usage: Array.from(commandStats.usage.entries()),
            recent: commandStats.recent
        }, null, 2));

        // jsonWatcherの停止
        if (jsonWatcher) {
            jsonWatcher.close();
        }

        // クライアントの停止
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

// Export for testing
module.exports = { app, client };