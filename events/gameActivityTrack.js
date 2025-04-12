const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'activitySettings.json');
const EXCLUDED_ROLE_ID = '1331212375969366056';
const NOTIFICATION_COOLDOWN = 5000;
const lastNotificationMap = new Map();

async function loadSettings() {
    try {
        await fs.access(SETTINGS_FILE);
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
            await fs.writeFile(SETTINGS_FILE, '{}', 'utf8');
            return {};
        }
        console.error('Error loading settings:', error);
        throw error;
    }
}

async function saveSettings(settings) {
    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

function checkNotificationCooldown(userId, activityType) {
    const key = `${userId}-${activityType}`;
    const lastNotification = lastNotificationMap.get(key) || 0;
    const currentTime = Date.now();

    if (currentTime - lastNotification < NOTIFICATION_COOLDOWN) {
        return false;
    }

    lastNotificationMap.set(key, currentTime);
    return true;
}

async function sendGameNotification(channel, embed) {
    try {
        await channel.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Error sending game notification:', error);
        return false;
    }
}

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        try {
            const GAME_ACTIVITY_CHANNEL_ID = process.env.GAME_ACTIVITY_CHANNEL_ID;
            if (!GAME_ACTIVITY_CHANNEL_ID) {
                console.warn('Game activity channel ID is not set in environment variables');
                return;
            }

                if (!newPresence?.user || !newPresence?.member) return;
            
            const member = newPresence.member;
            
            if (member.roles.cache.has(EXCLUDED_ROLE_ID)) {
                return;
            }

            const settings = await loadSettings();
            if (settings[newPresence.user.id] === false) {
                return;
            }

            const oldGame = oldPresence?.activities?.find(activity => activity.type === 0);
            const newGame = newPresence?.activities?.find(activity => activity.type === 0);

            const channel = await newPresence.client.channels.fetch(GAME_ACTIVITY_CHANNEL_ID);
            if (!channel) {
                console.error('Could not find game activity channel');
                return;
            }

            if (!oldGame && newGame) {
                if (!checkNotificationCooldown(newPresence.user.id, 'start')) return;

                const gameStartEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎮 ゲーム開始')
                    .setDescription(`**${member.displayName}** が **${newGame.name}** をプレイし始めました！`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        { name: 'ゲーム', value: newGame.name, inline: true },
                        { name: 'プレイヤー', value: member.toString(), inline: true }
                    )
                    .setTimestamp();

                await sendGameNotification(channel, gameStartEmbed);
                console.log(chalk.green(`✓ Game Activity: ${member.displayName} started playing ${newGame.name}`));
            }
            else if (oldGame && !newGame) {
                if (!checkNotificationCooldown(newPresence.user.id, 'end')) return;

                const gameEndEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🎮 ゲーム終了')
                    .setDescription(`**${member.displayName}** が **${oldGame.name}** のプレイを終了しました`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        { name: 'ゲーム', value: oldGame.name, inline: true },
                        { name: 'プレイヤー', value: member.toString(), inline: true }
                    )
                    .setTimestamp();

                await sendGameNotification(channel, gameEndEmbed);
                console.log(chalk.yellow(`✓ Game Activity: ${member.displayName} stopped playing ${oldGame.name}`));
            }
            else if (oldGame && newGame && oldGame.name !== newGame.name) {
                if (!checkNotificationCooldown(newPresence.user.id, 'switch')) return;

                const gameSwitchEmbed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('🎮 ゲーム切り替え')
                    .setDescription(`**${member.displayName}** が別のゲームに切り替えました`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        { name: '切り替え前', value: oldGame.name, inline: true },
                        { name: '切り替え後', value: newGame.name, inline: true },
                        { name: 'プレイヤー', value: member.toString(), inline: true }
                    )
                    .setTimestamp();

                await sendGameNotification(channel, gameSwitchEmbed);
                console.log(chalk.blue(`✓ Game Activity: ${member.displayName} switched from ${oldGame.name} to ${newGame.name}`));
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in presence update event:'), error);
        }
    }
};