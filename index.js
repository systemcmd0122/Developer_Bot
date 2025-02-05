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
        GatewayIntentBits.GuildPresences
    ],
    // Add reconnection settings
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

// Enhanced interaction handling
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(chalk.red(`No command matching ${interaction.commandName} was found.`));
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(chalk.red('Error executing command:'), error);
                const errorMessage = 'コマンドの実行中にエラーが発生しました。';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }
        else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('role-board-')) {
            const roleManageCommand = client.commands.get('rolemanage');
            if (roleManageCommand && roleManageCommand.handleRoleInteraction) {
                await roleManageCommand.handleRoleInteraction(interaction);
            }
        }
    } catch (error) {
        console.error(chalk.red('Error handling interaction:'), error);
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