const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcomeexisting')
        .setDescription('既存のユーザーにウェルカムメッセージを送信')
        .addUserOption(option => 
            option.setName('user')
                  .setDescription('ウェルカムメッセージを送信するユーザー')
                  .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                  .setDescription('一度に送信するメッセージの最大数（デフォルト: 10）')
                  .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const WELCOME_CHANNEL_ID = '1340837420224086148';
        const channel = interaction.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        
        if (!channel) {
            return interaction.editReply({
                content: `チャンネルID: ${WELCOME_CHANNEL_ID} が見つかりません。`,
                ephemeral: true
            });
        }

        // 特定のユーザーが指定された場合
        const targetUser = interaction.options.getUser('user');
        if (targetUser) {
            try {
                const member = await interaction.guild.members.fetch(targetUser.id);
                
                const embed = new EmbedBuilder()
                    .setTitle('👋 ようこそ！')
                    .setDescription(`${member.user} さん、${interaction.guild.name} へようこそ！`)
                    .setColor('#00ff00')
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `現在のメンバー数: ${interaction.guild.memberCount}人` });

                await channel.send({ embeds: [embed] });
                
                return interaction.editReply({
                    content: `${member.user.username} さんにウェルカムメッセージを送信しました。`,
                    ephemeral: true
                });
            } catch (error) {
                console.error(chalk.red('✗ Error sending welcome message to specific user:'), error);
                return interaction.editReply({
                    content: `エラーが発生しました: ${error.message}`,
                    ephemeral: true
                });
            }
        }
        
        // すべてのメンバーに送信する場合
        const limit = interaction.options.getInteger('limit') || 10;
        
        try {
            const members = await interaction.guild.members.fetch({ limit: 1000 });
            const filteredMembers = members.filter(member => !member.user.bot).first(limit);
            
            if (filteredMembers.length === 0) {
                return interaction.editReply({
                    content: 'メンバーが見つかりませんでした。',
                    ephemeral: true
                });
            }
            
            await interaction.editReply({
                content: `${filteredMembers.length}人のメンバーにウェルカムメッセージを送信します...`,
                ephemeral: true
            });
            
            let sentCount = 0;
            
            for (const member of filteredMembers) {
                const embed = new EmbedBuilder()
                    .setTitle('👋 ようこそ！')
                    .setDescription(`${member.user} さん、${interaction.guild.name} へようこそ！`)
                    .setColor('#00ff00')
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `現在のメンバー数: ${interaction.guild.memberCount}人` });

                await channel.send({ embeds: [embed] });
                sentCount++;
                
                // Discord APIの負荷を減らすために少し待機
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return interaction.followUp({
                content: `${sentCount}人のメンバーにウェルカムメッセージを送信しました。`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error(chalk.red('✗ Error sending welcome messages:'), error);
            return interaction.editReply({
                content: `エラーが発生しました: ${error.message}`,
                ephemeral: true
            });
        }
    },
};