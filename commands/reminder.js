const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reminder')
        .setDescription('リマインダーを設定します')
        .addSubcommand(subcommand => 
            subcommand
                .setName('set')
                .setDescription('新しいリマインダーを設定')
                .addStringOption(option => 
                    option
                        .setName('task')
                        .setDescription('リマインダーのタスク')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option
                        .setName('minutes')
                        .setDescription('リマインダーまでの分数')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('list')
                .setDescription('アクティブなリマインダーを表示')
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName('clear')
                .setDescription('すべてのリマインダーを削除')
        ),

    // リマインダーデータを保存するためのマップ
    reminders: new Map(),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // リマインダー設定
        if (subcommand === 'set') {
            const task = interaction.options.getString('task');
            const minutes = interaction.options.getInteger('minutes');

            const reminderId = `REMINDER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            const reminder = {
                id: reminderId,
                userId: interaction.user.id,
                username: interaction.user.username,
                task: task,
                createdAt: new Date(),
                triggerAt: new Date(Date.now() + minutes * 60000)
            };

            this.reminders.set(reminderId, reminder);

            // タイマーセット
            setTimeout(async () => {
                try {
                    const user = await interaction.client.users.fetch(reminder.userId);
                    const embed = new EmbedBuilder()
                        .setTitle('⏰ リマインダー')
                        .setColor('#ffff00')
                        .setDescription(`タスク: ${reminder.task}`)
                        .setTimestamp();

                    await user.send({ embeds: [embed] });
                    this.reminders.delete(reminderId);
                } catch (error) {
                    console.error('リマインダー送信エラー:', error);
                }
            }, minutes * 60000);

            const embed = new EmbedBuilder()
                .setTitle('⏰ リマインダー設定')
                .setColor('#00ff00')
                .addFields(
                    { name: 'リマインダーID', value: reminderId, inline: false },
                    { name: 'タスク', value: task, inline: false },
                    { name: '通知まで', value: `${minutes}分`, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // リマインダー一覧
        if (subcommand === 'list') {
            const activeReminders = [...this.reminders.values()]
                .filter(reminder => reminder.userId === interaction.user.id);

            if (activeReminders.length === 0) {
                return interaction.reply({
                    content: '現在アクティブなリマインダーはありません。',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('⏰ アクティブリマインダー')
                .setColor('#0099ff')
                .addFields(
                    ...activeReminders.map(reminder => ({
                        name: `リマインダーID: ${reminder.id}`,
                        value: `タスク: ${reminder.task}\n通知予定: ${reminder.triggerAt.toLocaleString()}`
                    }))
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // リマインダークリア
        if (subcommand === 'clear') {
            const userReminders = [...this.reminders.values()]
                .filter(reminder => reminder.userId === interaction.user.id);

            userReminders.forEach(reminder => {
                this.reminders.delete(reminder.id);
            });

            await interaction.reply({
                content: `${userReminders.length}件のリマインダーを削除しました。`,
                ephemeral: true
            });
        }
    }
};