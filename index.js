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

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
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
client.friendCodes = {};
client.roleBoards = {};
client.userPreferences = {};
client.startTime = Date.now();

// New command tracking
const commandStats = {
    usage: {},
    recent: []
};

// Track command usage
function trackCommand(commandName, user) {
    // Update usage count
    commandStats.usage[commandName] = (commandStats.usage[commandName] || 0) + 1;
    
    // Add to recent commands
    const recentCommand = {
        command: commandName,
        user: user.username,
        timestamp: new Date().toISOString()
    };
    
    commandStats.recent.unshift(recentCommand);
    
    // Keep only last 10 commands
    if (commandStats.recent.length > 10) {
        commandStats.recent.pop();
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

app.get('/health', (req, res) => {
    try {
        const health = {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: Date.now()
        };
        res.status(200).json(health);
    } catch (error) {
        console.error('Error checking health:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// JSONファイルの更新を監視する機能
let jsonCache = {};
const jsonWatcher = fs.watch(path.join(__dirname, 'data'), (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
        const filePath = path.join(__dirname, 'data', filename);
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
            // フレンドコードインタラクションハンドラー
            if (interaction.customId.startsWith('friendcode-')) {
                const friendCodeCommand = client.commands.get('friendcode');
                if (friendCodeCommand && friendCodeCommand.handleInteraction) {
                    await friendCodeCommand.handleInteraction(interaction);
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
    // AFKチェックの読み込み
    try {
        const afkCommand = client.commands.get('afk');
        if (afkCommand && afkCommand.loadAfkChecks) {
            afkCommand.loadAfkChecks(client);
            console.log(chalk.green('✓ AFK checks loaded successfully'));
        }
    } catch (error) {
        console.error(chalk.red('Error loading AFK checks:'), error);
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

        console.log(chalk.yellow('🔌 Connecting to Discord...'));
        
        await client.login(process.env.DISCORD_TOKEN);
        console.log(chalk.green('✓ Bot is ready!'));

        // フレンドコードの読み込み
        try {
            const friendCodeCommand = client.commands.get('friendcode');
            if (friendCodeCommand && friendCodeCommand.loadData) {
                client.friendCodes = friendCodeCommand.loadData(client);
                console.log(chalk.green('✓ Friend codes loaded successfully'));
            }
        } catch (error) {
            console.error(chalk.red('Error loading friend codes:'), error);
        }

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