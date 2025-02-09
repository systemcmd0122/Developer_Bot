const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('コマンド一覧と使い方を表示')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('特定のコマンドの詳細を見る')
                .setRequired(false)),

    async execute(interaction) {
        const { client } = interaction;
        const requestedCommand = interaction.options.getString('command');

        // 特定のコマンドの詳細を表示
        if (requestedCommand) {
            const command = client.commands.get(requestedCommand.toLowerCase());
            if (!command) {
                return interaction.reply({
                    content: `\`${requestedCommand}\`というコマンドは見つかりませんでした。`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`/${command.data.name}`)
                .setDescription(command.data.description)
                .addFields({
                    name: '使い方',
                    value: `/${command.data.name} ${command.data.options?.map(opt => 
                        opt.required ? `<${opt.name}>` : `[${opt.name}]`
                    ).join(' ') || ''}`
                });

            if (command.data.options?.length > 0) {
                embed.addFields({
                    name: 'オプション',
                    value: command.data.options.map(opt => 
                        `• ${opt.name}: ${opt.description}`
                    ).join('\n')
                });
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // コマンド一覧を表示
        const commandList = client.commands.map(cmd => ({
            name: cmd.data.name,
            description: cmd.data.description
        }));

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('コマンド一覧')
            .setDescription([
                'スラッシュコマンドで簡単に操作できます！',
                '',
                '詳しい使い方を見るには:',
                '`/help [コマンド名]` と入力してください',
                '',
                '**使用可能なコマンド:**',
                ...commandList.map(cmd => `• \`/${cmd.name}\` - ${cmd.description}`)
            ].join('\n'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};