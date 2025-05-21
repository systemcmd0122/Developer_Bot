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
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // Botのリアクションは無視
    if (user.bot) return;

    try {
        // 部分的なリアクションの場合は完全なデータを取得
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[Error] リアクションのフェッチに失敗:', error);
                return;
            }
        }

        // 部分的なメッセージの場合は完全なデータを取得
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('[Error] メッセージのフェッチに失敗:', error);
                return;
            }
        }

        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', reaction.message.id)
            .eq('active', true)
            .single();

        if (boardError) {
            console.error('[Error] ロールボードの検索エラー:', boardError);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        if (!board) {
            await reaction.users.remove(user.id).catch(console.error);
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
            console.error('[Error] ロール情報の検索エラー:', roleError);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        if (!roleData) {
            console.log('[Info] 該当するロールが見つかりません:', reaction.emoji.name);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        // ギルドメンバーを取得
        const guild = reaction.message.guild;
        if (!guild) {
            console.error('[Error] ギルドが見つかりません');
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (error) {
            console.error('[Error] メンバーのフェッチに失敗:', error);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        let role;
        try {
            role = await guild.roles.fetch(roleData.role_id);
        } catch (error) {
            console.error('[Error] ロールのフェッチに失敗:', error);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        if (!role) {
            console.error('[Error] ロールが存在しません:', roleData.role_id);
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        // Botの権限チェック
        const botMember = await guild.members.fetch(client.user.id);
        if (!botMember.permissions.has('ManageRoles')) {
            console.error('[Error] Botにロールを管理する権限がありません');
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        // ロールの位置チェック
        if (role.position >= botMember.roles.highest.position) {
            console.error('[Error] Botより上位のロールは操作できません');
            await reaction.users.remove(user.id).catch(console.error);
            return;
        }

        try {
            // ロールの切り替え処理
            if (member.roles.cache.has(role.id)) {
                // ロールを持っている場合は削除
                await member.roles.remove(role, `ロールボード: ${board.name}`);
                console.log(`[Success] ロールを削除: ${role.name} from ${member.user.tag}`);

                // ロール割り当て履歴を記録
                await supabase
                    .from('role_assignments')
                    .insert({
                        board_id: board.id,
                        role_id: role.id,
                        user_id: user.id,
                        guild_id: guild.id,
                        action_type: 'remove',
                        timestamp: new Date().toISOString()
                    })
                    .catch(error => console.error('[Error] ロール割り当て履歴の記録に失敗:', error));

            } else {
                // ロールを持っていない場合は付与
                await member.roles.add(role, `ロールボード: ${board.name}`);
                console.log(`[Success] ロールを付与: ${role.name} to ${member.user.tag}`);

                // 使用統計を更新
                await supabase
                    .from('roleboard_roles')
                    .update({
                        uses: (roleData.uses || 0) + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', roleData.id)
                    .catch(error => console.error('[Error] 使用統計の更新に失敗:', error));

                // ロール割り当て履歴を記録
                await supabase
                    .from('role_assignments')
                    .insert({
                        board_id: board.id,
                        role_id: role.id,
                        user_id: user.id,
                        guild_id: guild.id,
                        action_type: 'add',
                        timestamp: new Date().toISOString()
                    })
                    .catch(error => console.error('[Error] ロール割り当て履歴の記録に失敗:', error));
            }

            // リアクションを解除して1の状態を保つ
            await reaction.users.remove(user.id).catch(console.error);

            // ロールボードのリアクション数を1に保つ
            const reactionUsers = await reaction.users.fetch();
            for (const [id, reactionUser] of reactionUsers) {
                if (id !== client.user.id) {
                    await reaction.users.remove(id).catch(console.error);
                }
            }

        } catch (error) {
            console.error('[Error] ロールの操作に失敗:', error);
            await reaction.users.remove(user.id).catch(console.error);
        }
    } catch (error) {
        console.error('[Error] リアクション処理中のエラー:', error);
        await reaction.users.remove(user.id).catch(console.error);
    }
});

// MessageReactionRemoveイベントは不要になったため削除
// client.on(Events.MessageReactionRemove, async (reaction, user) => {
//     // Botのリアクションは無視
//     if (user.bot) return;

//     try {
//         // 部分的なリアクションの場合は完全なデータを取得
//         if (reaction.partial) {
//             try {
//                 await reaction.fetch();
//             } catch (error) {
//                 console.error('[Error] リアクションのフェッチに失敗:', error);
//                 return;
//             }
//         }

//         // 部分的なメッセージの場合は完全なデータを取得
//         if (reaction.message.partial) {
//             try {
//                 await reaction.message.fetch();
//             } catch (error) {
//                 console.error('[Error] メッセージのフェッチに失敗:', error);
//                 return;
//             }
//         }

//         // ロールボードを検索
//         const { data: board, error: boardError } = await supabase
//             .from('roleboards')
//             .select('*')
//             .eq('message_id', reaction.message.id)
//             .eq('active', true)
//             .single();

//         if (boardError) {
//             console.error('[Error] ロールボードの検索エラー:', boardError);
//             return;
//         }

//         if (!board) {
//             return; // ロールボードでないメッセージなので無視
//         }

//         // ロール情報を取得
//         const { data: roleData, error: roleError } = await supabase
//             .from('roleboard_roles')
//             .select('*')
//             .eq('board_id', board.id)
//             .eq('emoji', reaction.emoji.name)
//             .single();

//         if (roleError) {
//             console.error('[Error] ロール情報の検索エラー:', roleError);
//             return;
//         }

//         if (!roleData) {
//             console.log('[Info] 該当するロールが見つかりません:', reaction.emoji.name);
//             return;
//         }

//         // ギルドメンバーを取得
//         const guild = reaction.message.guild;
//         if (!guild) {
//             console.error('[Error] ギルドが見つかりません');
//             return;
//         }

//         let member;
//         try {
//             member = await guild.members.fetch(user.id);
//         } catch (error) {
//             console.error('[Error] メンバーのフェッチに失敗:', error);
//             return;
//         }

//         let role;
//         try {
//             role = await guild.roles.fetch(roleData.role_id);
//         } catch (error) {
//             console.error('[Error] ロールのフェッチに失敗:', error);
//             return;
//         }

//         if (!role) {
//             console.error('[Error] ロールが存在しません:', roleData.role_id);
//             return;
//         }

//         // Botの権限チェック
//         const botMember = await guild.members.fetch(client.user.id);
//         if (!botMember.permissions.has('ManageRoles')) {
//             console.error('[Error] Botにロールを管理する権限がありません');
//             await user.send('申し訳ありません。Botにロールを管理する権限がないため、ロールを削除できません。').catch(console.error);
//             return;
//         }

//         // ロールの位置チェック
//         if (role.position >= botMember.roles.highest.position) {
//             console.error('[Error] Botより上位のロールは操作できません');
//             await user.send('申し訳ありません。このロールはBotより上位にあるため、操作できません。').catch(console.error);
//             return;
//         }

//         // ロールを持っているか確認
//         if (!member.roles.cache.has(role.id)) {
//             return; // ロールを持っていない場合は何もしない
//         }

//         // ロールを削除
//         try {
//             await member.roles.remove(role, `ロールボード: ${board.name}`);
//             console.log(`[Success] ロールを削除: ${role.name} from ${member.user.tag}`);

//             // ロール割り当て履歴を記録
//             const { error: assignmentError } = await supabase
//                 .from('role_assignments')
//                 .insert({
//                     board_id: board.id,
//                     role_id: role.id,
//                     user_id: user.id,
//                     guild_id: guild.id,
//                     action_type: 'remove',
//                     timestamp: new Date().toISOString()
//                 });

//             if (assignmentError) {
//                 console.error('[Error] ロール割り当て履歴の記録に失敗:', assignmentError);
//             }

//             // ユーザーにDMで通知
//             const successEmbed = {
//                 color: 0xFF6B6B,
//                 title: 'ロール削除完了',
//                 description: `ロール「${role.name}」を削除しました。`,
//                 fields: [
//                     {
//                         name: 'サーバー',
//                         value: guild.name,
//                         inline: true
//                     },
//                     {
//                         name: 'ロールボード',
//                         value: board.name,
//                         inline: true
//                     }
//                 ],
//                 timestamp: new Date(),
//                 footer: {
//                     text: '再度リアクションを付けることでロールを取得できます'
//                 }
//             };

//             await user.send({ embeds: [successEmbed] }).catch(error => {
//                 console.log('[Warning] DMの送信に失敗:', error);
//             });

//         } catch (error) {
//             console.error('[Error] ロールの削除に失敗:', error);
//             await user.send({
//                 embeds: [{
//                     color: 0xFF0000,
//                     title: 'エラー',
//                     description: 'ロールの削除中にエラーが発生しました。\nサーバー管理者に連絡してください。',
