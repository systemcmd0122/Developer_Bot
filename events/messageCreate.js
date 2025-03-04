// events/messageCreate.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            // talk.jsコマンドのメッセージ処理機能を利用
            const talkCommand = message.client.commands.get('talk');
            if (talkCommand && talkCommand.processMessage) {
                await talkCommand.processMessage(message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    },
};