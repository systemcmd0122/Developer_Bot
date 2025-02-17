// events/messageListener.js
const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            if (message.author.bot) return;
            
            // メッセージ編集コマンドのハンドラを取得
            const messageEditCommand = message.client.commands.get('messageedit');
            
            // ハンドラが存在し、メッセージ削除関数が呼び出せる場合
            if (messageEditCommand && messageEditCommand.handleMessage) {
                // メッセージを処理（削除が行われた場合はtrueが返る）
                const isDeleted = messageEditCommand.handleMessage(message);
                
                if (isDeleted) {
                    console.log(chalk.yellow(`Auto-deleted message from ${message.author.username} in #${message.channel.name}`));
                }
            }
        } catch (error) {
            console.error(chalk.red('Error in message listener:'), error);
        }
    },
};