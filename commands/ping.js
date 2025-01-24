// commands/ping.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('リアルタイムで通信速度を表示します'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏓 Ping測定中...')
            .setColor('#00ff00');
        
        const sent = await interaction.reply({ 
            embeds: [embed],
            fetchReply: true 
        });

        const pingValues = [];
        const interval = setInterval(async () => {
            const ping = interaction.client.ws.ping;
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            pingValues.push({ ping, latency });

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🏓 Ping測定')
                .setColor('#00ff00')
                .addFields(
                    { name: 'WebSocket Ping', value: `${ping}ms`, inline: true },
                    { name: 'API Latency', value: `${latency}ms`, inline: true }
                )
                .setFooter({ text: '測定中...' });

            await interaction.editReply({ embeds: [updatedEmbed] });
        }, 1000);

        // 10秒後に測定を停止
        setTimeout(async () => {
            clearInterval(interval);
            const avgPing = Math.round(pingValues.reduce((acc, val) => acc + val.ping, 0) / pingValues.length);
            const avgLatency = Math.round(pingValues.reduce((acc, val) => acc + val.latency, 0) / pingValues.length);

            const finalEmbed = new EmbedBuilder()
                .setTitle('🏓 Ping測定結果')
                .setColor('#00ff00')
                .addFields(
                    { name: '平均 WebSocket Ping', value: `${avgPing}ms`, inline: true },
                    { name: '平均 API Latency', value: `${avgLatency}ms`, inline: true }
                )
                .setFooter({ text: '測定完了' });

            await interaction.editReply({ embeds: [finalEmbed] });
        }, 10000);
    },
};