// events/gameActivityTrack.js
const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'activitySettings.json');
const EXCLUDED_ROLE_ID = '1331212375969366056';

async function loadSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        try {
            const GAME_ACTIVITY_CHANNEL_ID = process.env.GAME_ACTIVITY_CHANNEL_ID;
            if (!GAME_ACTIVITY_CHANNEL_ID) return;

            // ユーザーが不在の場合は処理しない
            if (!newPresence?.user) return;

            // メンバーオブジェクトを取得
            const member = newPresence.member;
            if (!member) return;

            // 特定のロールを持つメンバーは通知しない
            if (member.roles.cache.has(EXCLUDED_ROLE_ID)) {
                return;
            }

            // ユーザーの通知設定を確認
            const settings = await loadSettings();
            const userSetting = settings[newPresence.user.id];
            
            // 設定がオフの場合は通知をスキップ（undefined の場合はデフォルトでオン）
            if (userSetting === false) return;

            const oldGame = oldPresence?.activities?.find(activity => activity.type === 0);
            const newGame = newPresence?.activities?.find(activity => activity.type === 0);

            // ゲーム開始時の処理
            if (!oldGame && newGame) {
                try {
                    const channel = await newPresence.client.channels.fetch(GAME_ACTIVITY_CHANNEL_ID);
                    if (!channel) return;

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

                    await channel.send({ embeds: [gameStartEmbed] });
                    console.log(chalk.green(`✓ Game Activity: ${member.displayName} started playing ${newGame.name}`));
                } catch (error) {
                    console.error(chalk.red('✗ Error in game start handling:'), error);
                }
            }
            // ゲーム終了時の処理
            else if (oldGame && !newGame) {
                try {
                    const channel = await newPresence.client.channels.fetch(GAME_ACTIVITY_CHANNEL_ID);
                    if (!channel) return;

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

                    await channel.send({ embeds: [gameEndEmbed] });
                    console.log(chalk.yellow(`✓ Game Activity: ${member.displayName} stopped playing ${oldGame.name}`));
                } catch (error) {
                    console.error(chalk.red('✗ Error in game end handling:'), error);
                }
            }
            // ゲーム切り替え時の処理
            else if (oldGame && newGame && oldGame.name !== newGame.name) {
                try {
                    const channel = await newPresence.client.channels.fetch(GAME_ACTIVITY_CHANNEL_ID);
                    if (!channel) return;

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

                    await channel.send({ embeds: [gameSwitchEmbed] });
                    console.log(chalk.blue(`✓ Game Activity: ${member.displayName} switched from ${oldGame.name} to ${newGame.name}`));
                } catch (error) {
                    console.error(chalk.red('✗ Error in game switch handling:'), error);
                }
            }
        } catch (error) {
            console.error(chalk.red('✗ Error in presence update event:'), error);
        }
    },
};