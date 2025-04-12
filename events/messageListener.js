const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            if (message.author.bot) return;
            
            const messageEditCommand = message.client.commands.get('messageedit');
            
            if (messageEditCommand && messageEditCommand.handleMessage) {
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