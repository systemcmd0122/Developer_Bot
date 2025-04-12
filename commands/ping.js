const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('ボットの応答速度とステータスを表示します'),
    
    category: 'システム',
    
    async execute(interaction) {
        const sent = await interaction.deferReply({ ephemeral: true });
        
        const apiLatency = interaction.client.ws.ping;
        
        const responseTime = sent.createdTimestamp - interaction.createdTimestamp;
        
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const memoryUsage = process.memoryUsage();
        const usedMemoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const totalMemoryMB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMemoryMB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        let statusEmoji;
        if (apiLatency < 100) {
            statusEmoji = '🟢';
        } else if (apiLatency < 300) {
            statusEmoji = '🟡';
        } else {
            statusEmoji = '🔴';
        }
        
        // Embed作成
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`${statusEmoji} ボットステータス`)
            .setDescription('現在のボットの応答状況とシステム情報')
            .addFields(
                { name: '🏓 Ping', value: `APIレイテンシー: **${apiLatency}ms**\n応答時間: **${responseTime}ms**`, inline: false },
                { name: '⏱️ 稼働時間', value: `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`, inline: true },
                { name: '💾 メモリ使用量', value: `${usedMemoryMB}MB / ${totalMemoryMB}GB\n空き: ${freeMemoryMB}GB`, inline: true },
                { name: '🖥️ サーバー', value: `${os.type()} ${os.release()}\n${os.cpus()[0].model}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Bot Status Monitor' });
        
        await interaction.editReply({ embeds: [embed] });
    }
}; 