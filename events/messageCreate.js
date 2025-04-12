const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            const talkCommand = message.client.commands.get('talk');
            if (talkCommand && talkCommand.processMessage) {
                await talkCommand.processMessage(message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    },
};