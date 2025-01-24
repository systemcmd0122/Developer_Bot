// commands/server.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('ボットをホストしているサーバーの情報を表示します'),
    async execute(interaction) {
        const totalMemory = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100;
        const freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100;
        const usedMemory = Math.round((totalMemory - freeMemory) * 100) / 100;

        const embed = new EmbedBuilder()
            .setTitle('🖥️ ホストサーバー情報')
            .setColor('#0099ff')
            .addFields(
                { name: 'OS', value: `${os.type()} ${os.release()}`, inline: true },
                { name: 'プラットフォーム', value: os.platform(), inline: true },
                { name: 'アーキテクチャ', value: os.arch(), inline: true },
                { name: 'CPU', value: os.cpus()[0].model, inline: false },
                { name: 'CPU コア数', value: os.cpus().length.toString(), inline: true },
                { name: '稼働時間', value: `${Math.floor(os.uptime() / 3600)}時間`, inline: true },
                { name: 'メモリ使用量', value: `${usedMemory}GB / ${totalMemory}GB`, inline: false },
                { name: 'Node.jsバージョン', value: process.version, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};