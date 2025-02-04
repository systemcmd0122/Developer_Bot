// events/gameActivityTrack.js
const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        const GAME_ACTIVITY_CHANNEL_ID = process.env.GAME_ACTIVITY_CHANNEL_ID;
        
        if (!GAME_ACTIVITY_CHANNEL_ID) return;

        const oldGame = oldPresence?.activities?.find(activity => activity.type === 0);
        const newGame = newPresence?.activities?.find(activity => activity.type === 0);

        if (!oldGame && newGame) {
            try {
                const channel = newPresence.client.channels.cache.get(GAME_ACTIVITY_CHANNEL_ID);
                if (!channel) return;

                const gameStartEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎮 ゲーム開始')
                    .setDescription(`**${newPresence.user.username}** が **${newGame.name}** をプレイし始めました！`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        { 
                            name: 'ゲーム', 
                            value: newGame.name, 
                            inline: true 
                        },
                        { 
                            name: 'プレイヤー', 
                            value: newPresence.user.toString(), 
                            inline: true 
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [gameStartEmbed] });

                console.log(chalk.green(`✓ Game Activity: ${newPresence.user.username} started playing ${newGame.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error tracking game activity:'), error);
            }
        }
    },
};