require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const BOT_VERSION = '1.1.0';
const FRAMES = [
    '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'
];

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

async function loadCommands() {
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

    // シンプル化された相互作用ハンドラー
    client.on('interactionCreate', async (interaction) => {
        try {
            // スラッシュコマンド処理
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                
                if (!command) return;

                // すでに応答済みの場合は何もしない
                if (interaction.replied || interaction.deferred) return;

                await command.execute(interaction);
            }
            
            // ロールボード相互作用処理
            const roleManageCommand = interaction.client.commands.get('rolemanage');
            if (roleManageCommand && roleManageCommand.handleRoleInteraction && interaction.isStringSelectMenu()) {
                await roleManageCommand.handleRoleInteraction(interaction);
            }
        } catch (error) {
            console.error(chalk.red('Interaction Error:'), error);
            
            try {
                // エラー応答を最小限に抑える
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

// Startup sequence
animateStartup().then(() => {
    loadEvents();

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

// Optional: Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    client.destroy();
    process.exit(0);
});