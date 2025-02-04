require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const os = require('os');

const BOT_VERSION = '1.1.0';
const PORT = process.env.PORT || 8000;
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Express app setup
const app = express();

// Static file serving
app.use(express.static('public'));

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
client.friendCodes = {};
client.roleBoards = {};
client.userPreferences = {};
client.startTime = Date.now();

// Metrics collection function
function getMetrics() {
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
}

// Express routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/metrics', (req, res) => {
    const metrics = getMetrics();
    res.json(metrics);
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    const commands = [];
    
    let frameIndex = 0;
    for (const file of commandFiles) {
        const frame = FRAMES[frameIndex % FRAMES.length];
        process.stdout.write(`\r${chalk.blue(frame)} Loading command: ${chalk.white(file)}`);
        
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        frameIndex++;
    }
    
    console.log(chalk.green(`\n✓ Loaded ${client.commands.size} commands`));
    return commands;
}

function loadEvents() {
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
}

async function registerCommands(commands) {
    try {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        console.log(chalk.yellow('Started refreshing application (/) commands.'));

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(chalk.green('Successfully reloaded application (/) commands.'));
    } catch (error) {
        console.error(chalk.red('Error while registering commands:'), error);
    }
}

// Interaction handling
client.on(Events.InteractionCreate, async interaction => {
    try {
        // Handle slash commands
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
        // Handle select menus for role management
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

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error);
});

// Start the application
(async () => {
    await animateStartup();
    
    // Load and register commands
    const commands = await loadCommands();
    await registerCommands(commands);
    
    // Load events
    loadEvents();

    // Start Express server
    app.listen(PORT, () => {
        console.log(chalk.green(`✓ Metrics server running on port ${PORT}`));
    });

    console.log(chalk.yellow('🔌 Connecting to Discord...'));
    
    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log(chalk.green('✓ Bot is ready!'));
    } catch (error) {
        console.error(chalk.red('✗ Failed to connect:'), error);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    client.destroy();
    process.exit(0);
});