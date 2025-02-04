require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const os = require('os');

const BOT_VERSION = '1.1.0';
const PORT = process.env.PORT || 8000;
const FRAMES = [
    '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'
];

// Express app setup
const app = express();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ] 
});

// Global data stores
client.commands = new Collection();
client.friendCodes = {};      // Friend codes storage
client.roleBoards = {};       // Role boards storage
client.userPreferences = {};  // Optional: for future expandability
client.startTime = Date.now(); // Bot start time for uptime calculation

// メトリクス収集関数
function getMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = os.loadavg()[0]; // 1分間の平均CPU使用率
    const uptime = Math.floor((Date.now() - client.startTime) / 1000); // 秒単位でのアップタイム

    return {
        memory: {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 // MB
        },
        cpu: Math.round(cpuUsage * 100) / 100,
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
        }
    };
}

// Express routes
app.get('/', (req, res) => {
    const metrics = getMetrics();
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Discord Bot Status</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    background-color: #2c2f33;
                    color: #ffffff;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #23272a;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .metric-group {
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: #2c2f33;
                    border-radius: 4px;
                }
                .metric {
                    margin: 10px 0;
                }
                h1 {
                    color: #7289da;
                    text-align: center;
                }
                h2 {
                    color: #7289da;
                    margin-bottom: 10px;
                }
                .status {
                    text-align: center;
                    padding: 10px;
                    background-color: #43b581;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Discord Bot Status</h1>
                <div class="status">🟢 Bot is running</div>
                
                <div class="metric-group">
                    <h2>System Metrics</h2>
                    <div class="metric">CPU Load: ${metrics.cpu}%</div>
                    <div class="metric">Memory (RSS): ${metrics.memory.rss} MB</div>
                    <div class="metric">Heap Used: ${metrics.memory.heapUsed} MB</div>
                    <div class="metric">Heap Total: ${metrics.memory.heapTotal} MB</div>
                </div>

                <div class="metric-group">
                    <h2>Bot Info</h2>
                    <div class="metric">Version: ${metrics.bot.version}</div>
                    <div class="metric">Guilds: ${metrics.bot.guilds}</div>
                    <div class="metric">Users: ${metrics.bot.users}</div>
                    <div class="metric">Commands: ${metrics.bot.commands}</div>
                </div>

                <div class="metric-group">
                    <h2>Uptime</h2>
                    <div class="metric">
                        ${metrics.uptime.days}d ${metrics.uptime.hours}h ${metrics.uptime.minutes}m ${metrics.uptime.seconds}s
                    </div>
                </div>
            </div>
            <script>
                setTimeout(() => location.reload(), 30000); // 30秒ごとに自動更新
            </script>
        </body>
        </html>
    `);
});

// Health check endpoint for Koyeb
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

async function loadCommands() {
    // 既存のコードはそのまま
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    let frameIndex = 0;
    for (const file of commandFiles) {
        const frame = FRAMES[frameIndex % FRAMES.length];
        process.stdout.write(`\r${chalk.blue(frame)} Loading command: ${chalk.white(file)}`);
        
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        frameIndex++;
    }
    
    console.log(chalk.green(`\n✓ Loaded ${client.commands.size} commands`));
}

// 残りの既存の関数はそのまま
function loadEvents() {
    // 既存のコード
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                
                if (!command) return;

                if (interaction.replied || interaction.deferred) return;

                await command.execute(interaction);
            }
            
            const roleManageCommand = interaction.client.commands.get('rolemanage');
            if (roleManageCommand && roleManageCommand.handleRoleInteraction && interaction.isStringSelectMenu()) {
                await roleManageCommand.handleRoleInteraction(interaction);
            }
        } catch (error) {
            console.error(chalk.red('Interaction Error:'), error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'エラーが発生しました。',
                        ephemeral: true
                    });
                }
            } catch (followupError) {
                console.error(chalk.red('Follow-up Error:'), followupError);
            }
        }
    });
}

async function animateStartup() {
    // 既存のコード
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

    await loadCommands();

    console.log(chalk.green('\n\n✓ All commands loaded successfully'));
    console.log(chalk.cyan('\n═══════════════════════'));
    console.log(chalk.green(`✓ Version: ${chalk.white(BOT_VERSION)}`));
    console.log(chalk.green(`✓ Node.js: ${chalk.white(process.version)}`));
    console.log(chalk.cyan('═══════════════════════\n'));
}

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error);
});

// Modified startup sequence to include Express server
animateStartup().then(() => {
    loadEvents();

    // Start Express server
    app.listen(PORT, () => {
        console.log(chalk.green(`✓ Metrics server running on port ${PORT}`));
    });

    console.log(chalk.yellow('🔌 Connecting to Discord...'));
    client.login(process.env.DISCORD_TOKEN)
        .then(() => {
            console.log(chalk.green('✓ Bot is ready!'));
        })
        .catch(error => {
            console.error(chalk.red('✗ Failed to connect:'), error);
            process.exit(1);
        });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    client.destroy();
    process.exit(0);
});