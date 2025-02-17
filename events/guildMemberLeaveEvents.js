const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const LEAVE_CHANNEL_ID = '1340837420224086148';
        
        try {
            const channel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('👋 さようなら')
                .setDescription(`${member.user.tag} さんがサーバーを退出しました`)
                .setColor('#ff6347')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `現在のメンバー数: ${member.guild.memberCount}人` });

            await channel.send({ embeds: [embed] });
            console.log(chalk.green(`✓ Leave message sent for ${member.user.username}`));
        } catch (error) {
            console.error(chalk.red('✗ Error sending leave message:'), error);
        }
    },
};