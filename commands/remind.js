// commands/remind.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('リマインダーを設定します')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('時間（例: 1h, 30m, 1d）')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('リマインドメッセージ')
                .setRequired(true)),
    async execute(interaction) {
        const timeStr = interaction.options.getString('time');
        const message = interaction.options.getString('message');
        
        const timeMatch = timeStr.match(/^(\d+)([hmd])$/);
        if (!timeMatch) {
            return interaction.reply({
                content: '時間の形式が正しくありません。例: 1h, 30m, 1d',
                ephemeral: true
            });
        }

        const [, amount, unit] = timeMatch;
        const multipliers = {
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
        };

        const ms = parseInt(amount) * multipliers[unit];
        if (ms > 7 * 24 * 60 * 60 * 1000) { // 最大7日
            return interaction.reply({
                content: 'リマインダーは最大7日までしか設定できません。',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('⏰ リマインダーを設定しました')
            .setColor('#00ff00')
            .addFields(
                { name: '時間', value: timeStr, inline: true },
                { name: 'メッセージ', value: message, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(async () => {
            const reminderEmbed = new EmbedBuilder()
                .setTitle('⏰ リマインダー')
                .setColor('#ff0000')
                .setDescription(message)
                .addFields(
                    { name: '設定時刻から', value: timeStr, inline: true },
                    { name: '設定者', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.channel.send({
                content: `${interaction.user.toString()} リマインダーの時間です！`,
                embeds: [reminderEmbed]
            });
        }, ms);
    },
};