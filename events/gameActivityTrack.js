const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        const GAME_ACTIVITY_CHANNEL_ID = process.env.GAME_ACTIVITY_CHANNEL_ID;
        
        if (!GAME_ACTIVITY_CHANNEL_ID) return;

        const oldGame = oldPresence?.activities?.find(activity => activity.type === 0);
        const newGame = newPresence?.activities?.find(activity => activity.type === 0);

        // プレイ時間コマンドの取得
        const playtimeCommand = newPresence.client.commands.get('playtime');
        if (!playtimeCommand) return;

        // ゲーム開始時の処理
        if (!oldGame && newGame) {
            try {
                // プレイ時間の追跡を開始
                playtimeCommand.trackGameStart(newPresence.user.id, newGame.name, Date.now());

                const channel = newPresence.client.channels.cache.get(GAME_ACTIVITY_CHANNEL_ID);
                if (!channel) return;

                // Get member object to access displayName
                const member = newPresence.member;
                if (!member) return;

                const gameStartEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎮 ゲーム開始')
                    .setDescription(`**${member.displayName}** が **${newGame.name}** をプレイし始めました！`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        { 
                            name: 'ゲーム', 
                            value: newGame.name, 
                            inline: true 
                        },
                        { 
                            name: 'プレイヤー', 
                            value: member.toString(), 
                            inline: true 
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [gameStartEmbed] });

                console.log(chalk.green(`✓ Game Activity: ${member.displayName} started playing ${newGame.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error tracking game start activity:'), error);
            }
        }
        // ゲーム終了時の処理
        else if (oldGame && !newGame) {
            try {
                // プレイ時間の追跡を終了
                playtimeCommand.trackGameEnd(newPresence.user.id, oldGame.name, Date.now());

                const channel = newPresence.client.channels.cache.get(GAME_ACTIVITY_CHANNEL_ID);
                if (!channel) return;

                const member = newPresence.member;
                if (!member) return;

                const gameEndEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🎮 ゲーム終了')
                    .setDescription(`**${member.displayName}** が **${oldGame.name}** のプレイを終了しました`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        {
                            name: 'ゲーム',
                            value: oldGame.name,
                            inline: true
                        },
                        {
                            name: 'プレイヤー',
                            value: member.toString(),
                            inline: true
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [gameEndEmbed] });

                console.log(chalk.yellow(`✓ Game Activity: ${member.displayName} stopped playing ${oldGame.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error tracking game end activity:'), error);
            }
        }
        // ゲーム切り替え時の処理
        else if (oldGame && newGame && oldGame.name !== newGame.name) {
            try {
                // 古いゲームのプレイ時間追跡を終了
                playtimeCommand.trackGameEnd(newPresence.user.id, oldGame.name, Date.now());
                // 新しいゲームのプレイ時間追跡を開始
                playtimeCommand.trackGameStart(newPresence.user.id, newGame.name, Date.now());

                const channel = newPresence.client.channels.cache.get(GAME_ACTIVITY_CHANNEL_ID);
                if (!channel) return;

                const member = newPresence.member;
                if (!member) return;

                const gameSwitchEmbed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('🎮 ゲーム切り替え')
                    .setDescription(`**${member.displayName}** が別のゲームに切り替えました`)
                    .setThumbnail(newPresence.user.displayAvatarURL())
                    .addFields(
                        {
                            name: '切り替え前',
                            value: oldGame.name,
                            inline: true
                        },
                        {
                            name: '切り替え後',
                            value: newGame.name,
                            inline: true
                        },
                        {
                            name: 'プレイヤー',
                            value: member.toString(),
                            inline: true
                        }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [gameSwitchEmbed] });

                console.log(chalk.blue(`✓ Game Activity: ${member.displayName} switched from ${oldGame.name} to ${newGame.name}`));
            } catch (error) {
                console.error(chalk.red('✗ Error tracking game switch activity:'), error);
            }
        }

        // プレイ中のゲームの状態が更新された場合（同じゲームを継続してプレイ中）
        else if (oldGame && newGame && oldGame.name === newGame.name) {
            // 同じゲームのプレイを継続中の場合は何もしない
            return;
        }
    },
};