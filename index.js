// index.js
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const fs = require('fs');
const path = require('path');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();
client.customResponses = new Collection();

// カスタムレスポンスの読み込み
function loadCustomResponses() {
    const responsesPath = path.join(__dirname, 'custom-responses.json');
    if (fs.existsSync(responsesPath)) {
        const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf8'));
        client.customResponses.clear();
        for (const [trigger, response] of Object.entries(responses)) {
            client.customResponses.set(trigger.toLowerCase(), response);
        }
        console.log(`${client.customResponses.size}個のカスタムレスポンスを読み込みました`);
    }
}

// カスタムレスポンスの保存
function saveCustomResponses() {
    const responsesPath = path.join(__dirname, 'custom-responses.json');
    const responses = Object.fromEntries(client.customResponses);
    fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
}

// コマンドファイルの読み込み
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// イベントファイルの読み込み
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

// 起動時にカスタムレスポンスを読み込む
client.once('ready', () => {
    loadCustomResponses();
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

// メッセージ作成イベントのハンドラ
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // m!pからのURLメッセージの自動削除
    if (message.content.startsWith('m!p') && message.content.includes('http')) {
        setTimeout(() => {
            message.delete().catch(console.error);
        }, 2500);
    }

    // カスタムレスポンスのチェック
    const messageContent = message.content.toLowerCase();
    for (const [trigger, response] of client.customResponses) {
        if (messageContent.includes(trigger)) {
            await message.reply(response);
            break;
        }
    }
});

// 新規メンバー参加時のイベントハンドラ
client.on('guildMemberAdd', async member => {
    try {
        const roleId = '1331169578155507772';
        await member.roles.add(roleId);
        console.log(`Added role ${roleId} to new member ${member.user.tag}`);
    } catch (error) {
        console.error('Error adding role to new member:', error);
    }
});

client.login(token);