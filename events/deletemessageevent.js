const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            if (message.content.startsWith('m!')) {
                console.log(chalk.blue(`Auto delete scheduled for m! message from ${message.author.tag}`));
                setTimeout(async () => {
                    try {
                        await message.delete();
                        console.log(chalk.green(`✓ Deleted m! message from ${message.author.tag}`));
                    } catch (error) {
                        console.error(chalk.red('✗ Error deleting m! message:'), error);
                    }
                }, 10000);
                return;
            }

            const TARGET_BOT_IDS = [
                '411916947773587456', //Jockie Music
                '916300992612540467', //VOICEVOX読み上げbot
            ];

            if (message.author.bot && TARGET_BOT_IDS.includes(message.author.id)) {
                console.log(chalk.blue(`Auto delete scheduled for bot message from ${message.author.tag}`));
                setTimeout(async () => {
                    try {
                        await message.delete();
                        console.log(chalk.green(`✓ Deleted bot message from ${message.author.tag}`));
                    } catch (error) {
                        console.error(chalk.red('✗ Error deleting bot message:'), error);
                    }
                }, 20000);
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in message create event:'), error);
        }
    },
};