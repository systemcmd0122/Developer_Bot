// commands/role.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    category: 'ロール管理',
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('自分でロールを選択できます'),
    async execute(interaction) {
        const roles = interaction.guild.roles.cache
            .filter(role => 
                role.name !== '@everyone' && 
                !role.managed && 
                role.position < interaction.guild.members.me.roles.highest.position
            )
            .sort((a, b) => b.position - a.position);

        if (roles.size === 0) {
            return interaction.reply({
                content: '選択可能なロールがありません。',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 ロール選択')
            .setDescription('下のメニューから取得したいロールを選択してください。')
            .setColor('#ff00ff')
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('role-select')
            .setPlaceholder('ロールを選択')
            .setMinValues(0)
            .setMaxValues(roles.size)
            .addOptions(
                roles.map(role => ({
                    label: role.name,
                    value: role.id,
                    description: `メンバー数: ${role.members.size}`,
                    default: interaction.member.roles.cache.has(role.id)
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const currentRoles = member.roles.cache
                .filter(role => roles.has(role.id))
                .map(role => role.id);
            
            // 選択されたロールを追加し、選択解除されたロールを削除
            const rolesToAdd = i.values.filter(id => !currentRoles.includes(id));
            const rolesToRemove = currentRoles.filter(id => !i.values.includes(id));

            await member.roles.add(rolesToAdd);
            await member.roles.remove(rolesToRemove);

            const addedRoles = rolesToAdd.map(id => `<@&${id}>`).join(', ') || 'なし';
            const removedRoles = rolesToRemove.map(id => `<@&${id}>`).join(', ') || 'なし';

            const resultEmbed = new EmbedBuilder()
                .setTitle('🎭 ロール更新完了')
                .addFields(
                    { name: '追加したロール', value: addedRoles },
                    { name: '削除したロール', value: removedRoles }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await i.update({
                embeds: [resultEmbed],
                components: [row]
            });
        });

        collector.on('end', async () => {
            const endEmbed = new EmbedBuilder()
                .setTitle('🎭 ロール選択')
                .setDescription('セッションの有効期限が切れました。もう一度コマンドを実行してください。')
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.editReply({
                embeds: [endEmbed],
                components: []
            });
        });
    },
};