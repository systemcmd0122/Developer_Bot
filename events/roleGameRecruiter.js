const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // ボットのメッセージは無視
        if (message.author.bot) return;

        // メンションされたロールのIDを取得
        const mentionedRoles = message.mentions.roles;
        if (!mentionedRoles.size) return;

        // 監視対象のロールID
        const gameRoles = {
            '1331171347442962453': {
                name: 'Valorant',
                color: '#FF0000',
                description: 'Valorantの募集を開始します！'
            }
        };

        // メンションされたロールが監視対象かチェック
        const matchedRoles = mentionedRoles.filter(role => gameRoles.hasOwnProperty(role.id));
        if (!matchedRoles.size) return;

        try {
            for (const [roleId, role] of matchedRoles) {
                const gameConfig = gameRoles[roleId];
                const participants = new Set([message.author.id]); // 募集者を最初の参加者として追加

                // 募集用のEmbed作成
                const recruitEmbed = new EmbedBuilder()
                    .setColor(gameConfig.color)
                    .setTitle(`${gameConfig.name}の募集`)
                    .setDescription(gameConfig.description)
                    .addFields(
                        { name: '募集者', value: `<@${message.author.id}>` },
                        { name: '参加者', value: Array.from(participants).map(id => `<@${id}>`).join('\n') }
                    )
                    .setTimestamp();

                // 参加ボタンの作成
                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`join_${roleId}`)
                            .setLabel('参加する')
                            .setStyle(ButtonStyle.Success)
                    );

                // 募集メッセージを送信
                const recruitMessage = await message.channel.send({
                    embeds: [recruitEmbed],
                    components: [button]
                });

                // InteractionManagerにボタンの情報を保存
                message.client.interactionManager.saveButtonInteraction(recruitMessage.id, {
                    roleId,
                    participants: Array.from(participants),
                    gameConfig,
                    messageId: recruitMessage.id,
                    channelId: message.channel.id,
                    guildId: message.guild.id,
                    timestamp: Date.now()
                });

                console.log(chalk.green(`Created game recruitment for ${gameConfig.name}`));
            }
        } catch (error) {
            console.error(chalk.red('Error creating game recruitment:'), error);
            await message.channel.send('ゲーム募集の作成中にエラーが発生しました。');
        }
    }
};