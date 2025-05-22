require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events, REST, Routes, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const os = require('os');
const https = require('https');
const InteractionManager = require('./events/interactions');
const supabase = require('./utils/supabase');

const BOT_VERSION = '1.1.0';
const PORT = process.env.PORT || 8000;

// データディレクトリの設定
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Express server setup
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Health check endpoints
app.get('/ping', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    const health = {
        status: client.ws.status === 0 ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        botStatus: client.ws.status
    };
    res.status(client.ws.status === 0 ? 200 : 503).json(health);
});

// Keep-alive system
function keepAlive() {
    const PING_INTERVAL = 2 * 60 * 1000; // 2分
    const urls = [process.env.APP_URL, ...process.env.PING_URLS || []].filter(Boolean);

    setInterval(async () => {
        for (const baseUrl of urls) {
            try {
                const url = baseUrl.endsWith('/ping') ? baseUrl : `${baseUrl}/ping`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(url, { 
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Discord-Bot/1.0' }
                });
                
                clearTimeout(timeout);
                if (response.ok) break;
            } catch (error) {
                console.error(chalk.yellow(`Ping failed for ${url}:`, error.message));
            }
        }

        // メモリ使用状況のログ
        const used = process.memoryUsage();
        console.log(chalk.cyan(
            `Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB`
        ));
    }, PING_INTERVAL);

    app.listen(PORT, () => console.log(chalk.green(`Health check server running on port ${PORT}`)));
}

// Discord client setup
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ],
    failIfNotExists: false
});

// コレクションの初期化
client.commands = new Collection();
client.buttonHandlers = new Collection();
client.menuHandlers = new Collection();
client.modalHandlers = new Collection();
client.startTime = Date.now();

// コマンド使用状況の追跡
const commandStats = {
    usage: new Collection(),
    recent: []
};

function trackCommand(commandName, user) {
    if (!commandStats.usage.has(commandName)) {
        commandStats.usage.set(commandName, { count: 0, users: new Set() });
    }

    const stats = commandStats.usage.get(commandName);
    stats.count++;
    stats.users.add(user.id);
    
    commandStats.recent.unshift({
        command: commandName,
        user: user.tag,
        timestamp: new Date().toISOString()
    });
    
    if (commandStats.recent.length > 10) {
        commandStats.recent.pop();
    }

    fs.writeFileSync(
        path.join(DATA_DIR, 'commandStats.json'),
        JSON.stringify({
            usage: Array.from(commandStats.usage.entries()),
            recent: commandStats.recent
        }, null, 2)
    );
}

// コマンドのローディング
async function loadCommands() {
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        try {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        } catch (error) {
            console.error(chalk.red(`Failed to load command ${file}:`, error));
        }
    }
    
    return commands;
}

// イベントのローディング
function loadEvents() {
    const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        try {
            const event = require(`./events/${file}`);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to load event ${file}:`, error));
        }
    }
}

// スラッシュコマンドの登録
async function registerCommands(commands) {
    try {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        console.log(chalk.yellow('Registering application commands...'));
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        console.log(chalk.green('Successfully registered application commands.'));
    } catch (error) {
        console.error(chalk.red('Error registering commands:', error));
        throw error;
    }
}

// インタラクションの処理
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
            trackCommand(interaction.commandName, interaction.user);
            return;
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            if (customId.startsWith('janken-')) {
                const jankenCommand = client.commands.get('janken');
                if (jankenCommand) {
                    if (customId.startsWith('janken-again-')) {
                        await jankenCommand.handlePlayAgain(interaction);
                    } else {
                        await jankenCommand.handleJankenButton(interaction);
                    }
                }
                return;
            }

            const buttonHandler = client.buttonHandlers.get(customId);
            if (buttonHandler) {
                await buttonHandler(interaction);
            }
            return;
        }

        if (interaction.isStringSelectMenu()) {
            const menuHandler = client.menuHandlers.get(interaction.customId);
            if (menuHandler) {
                await menuHandler(interaction);
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            const modalHandler = client.modalHandlers.get(interaction.customId);
            if (modalHandler) {
                await modalHandler(interaction);
            }
        }
    } catch (error) {
        console.error(chalk.red('Error handling interaction:', error));
        try {
            const errorMessage = { 
                content: 'インタラクションの処理中にエラーが発生しました。', 
                ephemeral: true 
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (err) {
            console.error(chalk.red('Error sending error response:', err));
        }
    }
});

// リアクションハンドラー
const { handleReactionAdd } = require('./events/reactionRoleHandler');
client.on(Events.MessageReactionAdd, handleReactionAdd);

// インタラクションマネージャーの初期化
client.interactionManager = new InteractionManager(client);

// グレースフルシャットダウン
async function gracefulShutdown() {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    try {
        fs.writeFileSync(
            path.join(DATA_DIR, 'commandStats.json'),
            JSON.stringify({
                usage: Array.from(commandStats.usage.entries()),
                recent: commandStats.recent
            }, null, 2)
        );

        if (client) {
            await client.destroy();
        }

        process.exit(0);
    } catch (error) {
        console.error(chalk.red('Error during shutdown:', error));
        process.exit(1);
    }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled promise rejection:', error));
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught exception:', error));
});

// 切断時の再接続
client.on('disconnect', () => console.log(chalk.yellow('Bot disconnected. Attempting to reconnect...')));
client.on('reconnecting', () => console.log(chalk.yellow('Bot reconnecting...')));

// 起動シーケンス
(async () => {
    try {
        console.log(chalk.yellow('Loading commands...'));
        const commands = await loadCommands();
        
        console.log(chalk.yellow('Loading events...'));
        loadEvents();
        
        console.log(chalk.yellow('Registering commands...'));
        if (commands.length > 0) {
            await registerCommands(commands);
        }
        
        await client.login(process.env.DISCORD_TOKEN);
        keepAlive();
        
        console.log(chalk.green(`Bot successfully started (v${BOT_VERSION})`));
    } catch (error) {
        console.error(chalk.red('Startup error:', error));
        process.exit(1);
    }
})();
