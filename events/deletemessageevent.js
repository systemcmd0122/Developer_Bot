const { Events } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            // m!から始まるメッセージの処理（10秒後に削除）
            if (message.content.startsWith('m!')) {
                console.log(chalk.blue(`Auto delete scheduled for m! message from ${message.author.tag}`));
                setTimeout(async () => {
                    try {
                        await message.delete();
                        console.log(chalk.green(`✓ Deleted m! message from ${message.author.tag}`));
                    } catch (error) {
                        console.error(chalk.red('✗ Error deleting m! message:'), error);
                    }
                }, 10000); // 10秒
                return;
            }

            // 特定のボットのメッセージの処理（20秒後に削除）
            const TARGET_BOT_IDS = [
                '411916947773587456',
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
                }, 20000); // 20秒
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in message create event:'), error);
        }
    },
};