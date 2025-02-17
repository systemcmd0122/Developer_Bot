const { Events, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const WELCOME_CHANNEL_ID = '1340837420224086148';
        
        try {
            const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('👋 ようこそ！')
                .setDescription(`${member.user} さん、${member.guild.name} へようこそ！`)
                .setColor('#00ff00')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `現在のメンバー数: ${member.guild.memberCount}人` });

            await channel.send({ embeds: [embed] });
            console.log(chalk.green(`✓ Welcome message sent for ${member.user.username}`));
        } catch (error) {
            console.error(chalk.red('✗ Error sending welcome message:'), error);
        }
    },
};