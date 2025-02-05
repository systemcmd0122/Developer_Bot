const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('helpdesk')
        .setDescription('サーバーのヘルプデスクを開きます')
        .addSubcommand(subcommand => 
            subcommand
                .setName('create')
                .setDescription('新しいヘルプチケットを作成')
                .addStringOption(option => 
                    option
                        .setName('issue')
                        .setDescription('問題や質問の詳細')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('list')
                .setDescription('アクティブなヘルプチケットを表示')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('close')
                .setDescription('ヘルプチケットを閉じる')
                .addStringOption(option => 
                    option
                        .setName('ticket_id')
                        .setDescription('閉じるチケットのID')
                        .setRequired(true)
                )
        ),

    // チケットデータを保存するためのマップ
    tickets: new Map(),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // チケット作成
        if (subcommand === 'create') {
            const issue = interaction.options.getString('issue');
            const ticketId = `TICKET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            const ticket = {
                id: ticketId,
                userId: interaction.user.id,
                username: interaction.user.username,
                issue: issue,
                status: 'open',
                createdAt: new Date(),
                messages: []
            };

            this.tickets.set(ticketId, ticket);

            const embed = new EmbedBuilder()
                .setTitle('🎫 ヘルプチケット作成')
                .setColor('#00ff00')
                .addFields(
                    { name: 'チケットID', value: ticketId, inline: false },
                    { name: '問題', value: issue, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // チケット一覧
        if (subcommand === 'list') {
            const openTickets = [...this.tickets.values()]
                .filter(ticket => ticket.status === 'open');

            if (openTickets.length === 0) {
                return interaction.reply({
                    content: '現在オープンなチケットはありません。',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎫 オープンチケット一覧')
                .setColor('#0099ff')
                .addFields(
                    ...openTickets.map(ticket => ({
                        name: `チケットID: ${ticket.id}`,
                        value: `作成者: ${ticket.username}\n問題: ${ticket.issue}`
                    }))
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // チケット閉じる
        if (subcommand === 'close') {
            const ticketId = interaction.options.getString('ticket_id');
            const ticket = this.tickets.get(ticketId);

            if (!ticket) {
                return interaction.reply({
                    content: '指定されたチケットは見つかりませんでした。',
                    ephemeral: true
                });
            }

            ticket.status = 'closed';
            ticket.closedAt = new Date();

            const embed = new EmbedBuilder()
                .setTitle('🎫 チケット終了')
                .setColor('#ff0000')
                .addFields(
                    { name: 'チケットID', value: ticketId, inline: false },
                    { name: '対応ステータス', value: '終了', inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};