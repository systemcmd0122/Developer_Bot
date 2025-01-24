// commands/poll.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('投票を作成します')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('投票の質問')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('options')
                .setDescription('選択肢（カンマ区切り）')
                .setRequired(true)),
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = interaction.options.getString('options').split(',').map(opt => opt.trim());
        
        if (options.length < 2 || options.length > 10) {
            return interaction.reply({
                content: '選択肢は2つ以上10個以下で指定してください。',
                ephemeral: true
            });
        }

        const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        const embed = new EmbedBuilder()
            .setTitle('📊 ' + question)
            .setColor('#ff9900')
            .setDescription(
                options.map((opt, i) => `${reactions[i]} ${opt}`).join('\n\n')
            )
            .setFooter({ text: `作成者: ${interaction.user.username}` })
            .setTimestamp();

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        
        for (let i = 0; i < options.length; i++) {
            await message.react(reactions[i]);
        }
    },
};