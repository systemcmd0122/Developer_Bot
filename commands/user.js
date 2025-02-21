// commands/user.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'サーバー管理',
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('サーバーのユーザー一覧を表示します'),
    async execute(interaction) {
        const members = await interaction.guild.members.fetch();
        const memberArray = Array.from(members.values());
        const pageSize = 10;
        const pages = Math.ceil(memberArray.length / pageSize);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * pageSize;
            const end = Math.min(start + pageSize, memberArray.length);
            const currentMembers = memberArray.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('👥 サーバーメンバー一覧')
                .setColor('#ff00ff')
                .setFooter({ text: `ページ ${page + 1}/${pages}` });

            currentMembers.forEach((member, index) => {
                embed.addFields({
                    name: `${start + index + 1}. ${member.user.username}`,
                    value: `ID: ${member.user.id}\nロール: ${member.roles.cache.map(r => r.name).join(', ') || 'なし'}`
                });
            });

            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀️ 前へ')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('次へ ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === pages - 1)
                );
            return row;
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'prev') {
                currentPage--;
            } else if (i.customId === 'next') {
                currentPage++;
            }

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀️ 前へ')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('次へ ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );

            await interaction.editReply({
                components: [disabledRow]
            });
        });
    },
};