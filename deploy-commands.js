// deploy-commands.js
const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`${commands.length}個のスラッシュコマンドの登録を開始します...`);

        // グローバルコマンドとして登録
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`${data.length}個のスラッシュコマンドを登録しました。`);
    } catch (error) {
        console.error('コマンドの登録中にエラーが発生しました:');
        console.error(error);
    }
})();