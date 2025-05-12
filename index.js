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

// JSONファイルを動的に読み込む関数
function loadJsonFiles() {
    const jsonFiles = {};
    try {
        const dataPath = path.join(__dirname, 'data');
        
        // dataディレクトリが存在しない場合は作成
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath);
        }

        // dataディレクトリ内のすべてのJSONファイルを読み込む
        const files = fs.readdirSync(dataPath).filter(file => file.endsWith('.json'));
        
        for (const file of files) {
            const filePath = path.join(dataPath, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(file, '.json');
            jsonFiles[fileName] = JSON.parse(fileContent);
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
    'https://ping.web.app', // バックアッププライベートping用URL
    'https://api.web.app',
    'https://previous-miguelita-tisk-01010100-9d3d68f7.koyeb.app/'  // バックアッププライベートping用URL2
];

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
        const timeout = setTimeout(() => controller.abort(), 5000); // 5秒でタイムアウト

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
            logPingStatus('retry', `Attempt ${retryCount + 1}/${MAX_RETRY_COUNT}`);
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
    const appUrl = process.env.APP_URL;
    const urls = [
        `${appUrl}/ping`,
        `${appUrl}/health`,
        ...PING_URLS
    ].filter(Boolean); // undefined/nullを除外

    let lastSuccessfulPing = Date.now();
    
    setInterval(async () => {
        let pingSuccess = false;

        // メインのURLでping試行
        for (const url of urls) {
            try {
                const isSuccess = await retryPing(url);
                if (isSuccess) {
                    pingSuccess = true;
                    lastSuccessfulPing = Date.now();
                    break;
                }
            } catch (error) {
                logPingStatus('error', `URL: ${url} - ${error.message}`);
            }
        }

        // 最後の成功から5分以上経過している場合、警告を表示
        if (!pingSuccess && (Date.now() - lastSuccessfulPing > 5 * 60 * 1000)) {
            console.error(chalk.red('Warning: No successful ping in the last 5 minutes'));
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
            return acc + ((total - idle) / total);
        }, 0) / cpus.length;

        if (cpuUsage > 0.8) { // CPU使用率が80%を超えた場合
            console.warn(chalk.yellow(`High CPU usage detected: ${Math.round(cpuUsage * 100)}%`));
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
                botStatus: 'disconnected'
            });
        }
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

// New command tracking
const commandStats = {
    usage: {},
    recent: []
};

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
            commands: commandStats
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

// JSONファイルの一覧を取得するエンドポイント
app.get('/data/json-files', (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data');
        if (!fs.existsSync(dataPath)) {
            return res.json({ files: [] });
        }

        const files = fs.readdirSync(dataPath)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(dataPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: path.basename(file, '.json'),
                    size: stats.size,
                    lastModified: stats.mtime,
                    content: JSON.parse(fs.readFileSync(filePath, 'utf8'))
                };
            });

        res.json({ files });
    } catch (error) {
        console.error('Error listing JSON files:', error);
        res.status(500).json({ error: 'Failed to list JSON files' });
    }
});

// 個別のJSONファイルを取得するエンドポイント
app.get('/data/json/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'data', `${filename}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonContent = JSON.parse(fileContent);
        res.json(jsonContent);
    } catch (error) {
        console.error(`Error serving JSON file ${req.params.filename}:`, error);
        res.status(500).json({ error: 'Failed to load JSON file' });
    }
});

app.get('/metrics', (req, res) => {
    try {
        const metrics = getMetrics();
        if (metrics) {
            res.json(metrics);
        } else {
            res.status(500).json({ error: 'Failed to get metrics' });
        }
    } catch (error) {
        console.error('Error serving metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ヘルスチェックエンドポイントの強化
app.get('/health', (req, res) => {
    try {
        const health = {
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: os.cpus()[0].times,
            loadavg: os.loadavg()
        };
        res.status(200).json(health);
    } catch (error) {
        console.error('Error checking health:', error);
        res.status(500).json({ 
            status: 'error',
            timestamp: Date.now(),
            error: error.message 
        });
    }
});

// JSONファイルの更新を監視する機能
let jsonCache = {};
const dataDir = path.join(__dirname, 'data');

// dataディレクトリが存在しない場合は作成
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(chalk.green('✓ Created data directory'));
    } catch (error) {
        console.error(chalk.red('Error creating data directory:'), error);
    }
}

const jsonWatcher = fs.watch(dataDir, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
        const filePath = path.join(dataDir, filename);
        try {
            // ファイルの存在確認
            if (!fs.existsSync(filePath)) {
                return;
            }
            
            // 少し待って完全に書き込みが終わるのを待つ
            setTimeout(() => {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (content.trim() === '') {
                        console.log(chalk.yellow(`Skipping empty file: ${filename}`));
                        return;
                    }
                    
                    const fileName = path.basename(filename, '.json');
                    jsonCache[fileName] = JSON.parse(content);
                    console.log(chalk.blue(`✓ Updated JSON cache for ${filename}`));
                } catch (innerError) {
                    console.error(`Error updating JSON cache for ${filename}:`, innerError);
                }
            }, 500); // 500msの遅延を設ける
        } catch (error) {
            console.error(`Error accessing file ${filename}:`, error);
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
                const frame = FRAMES[frameIndex % FRAMES.length];
                process.stdout.write(`\r${chalk.blue(frame)} Loading command: ${chalk.white(file)}`);
                
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
                frameIndex++;
            } catch (error) {
                attempts++;
                console.error(`Error loading command ${file} (attempt ${attempts}):`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (attempts === retries) {
                    throw error;
                }
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
                client.once(event.name, (...args) => {
                    try {
                        event.execute(...args);
                    } catch (error) {
                        console.error(`Error executing event ${event.name}:`, error);
                    }
                });
            } else {
                client.on(event.name, (...args) => {
                    try {
                        event.execute(...args);
                    } catch (error) {
                        console.error(`Error executing event ${event.name}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error(`Error loading event ${file}:`, error);
        }
    }
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
                { body: commands },
            );

            console.log(chalk.green('Successfully reloaded application (/) commands.'));
            break;
        } catch (error) {
            attempts++;
            console.error(`Error registering commands (attempt ${attempts}):`, error);
            if (attempts === retries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Enhanced interaction handling with command tracking
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Track command usage before execution
                trackCommand(interaction.commandName, interaction.user);
                
                await command.execute(interaction);
            } catch (error) {
                console.error('Error executing command:', error);
                const errorMessage = 'コマンドの実行中にエラーが発生しました。';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }
        else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            // じゃんけんボタンハンドラー
            if (interaction.customId.startsWith('janken-')) {
                const jankenCommand = client.commands.get('janken');
                if (jankenCommand) {
                    if (interaction.customId === 'janken-again') {
                        await jankenCommand.handlePlayAgain(interaction);
                    } else {
                        await jankenCommand.handleJankenButton(interaction);
                    }
                }
            }
            // ロール管理ボタンハンドラー
            else if (interaction.customId.startsWith('role-')) {
                const roleManageCommand = client.commands.get('rolemanage');
                if (roleManageCommand && roleManageCommand.handleRoleButton) {
                    await roleManageCommand.handleRoleButton(interaction);
                }
            }
            // ゲーム募集ボタンハンドラー
            else if (interaction.customId.startsWith('game-')) {
                const gameCommand = client.commands.get('game');
                if (gameCommand && gameCommand.handleGameButton) {
                    await gameCommand.handleGameButton(interaction);
                }
            }
        }
        else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                }
            } catch (error) {
                console.error('Error handling autocomplete:', error);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
    }
});

// InteractionManagerの初期化
const InteractionManager = require('./events/interactions');
client.interactionManager = new InteractionManager(client);

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
        
        const commands = await loadCommands();
        await registerCommands(commands);
        
        loadEvents();

        // Load JSON files on startup
        const jsonFiles = loadJsonFiles();
        console.log(chalk.green('✓ JSON files loaded successfully'));

        // Start Express server with enhanced error handling
        const server = app.listen(PORT, () => {
            console.log(chalk.green(`✓ Metrics server running on port ${PORT}`));
        });

        server.on('error', (error) => {
            console.error(chalk.red('Express server error:'), error);
        });

        // Start keep-alive mechanism
        keepAlive();
        console.log(chalk.green('✓ Keep-alive service started'));

        console.log(chalk.yellow('🔌 Connecting to Discord...'));
        
        await client.login(process.env.DISCORD_TOKEN);
        console.log(chalk.green('✓ Bot is ready!'));

        // Memory usage monitoring
        setInterval(() => {
            const used = process.memoryUsage();
            if (used.heapUsed > 512 * 1024 * 1024) { // 512MB threshold
                console.warn(chalk.yellow('High memory usage detected:', 
                    `${Math.round(used.heapUsed / 1024 / 1024)}MB`));
            }
        }, 60000);

    } catch (error) {
        console.error(chalk.red('Fatal error during startup:'), error);
        process.exit(1);
    }
})();

// Enhanced graceful shutdown
async function gracefulShutdown() {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    try {
        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('Error during shutdown:'), error);
        process.exit(1);
    }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Export the app for testing purposes
module.exports = { app, client };