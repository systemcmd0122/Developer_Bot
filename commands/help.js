const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('利用可能なコマンドの一覧を表示します')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('詳細を表示したい特定のコマンド名')
                .setRequired(false)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = interaction.client.commands.map(cmd => ({
            name: `${cmd.data.name} - ${cmd.data.description}`,
            value: cmd.data.name
        }));
        
        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        await interaction.respond(
            filtered.slice(0, 25)
        );
    },

    async execute(interaction) {
        const commands = interaction.client.commands;
        const specificCommand = interaction.options.getString('command');

        if (specificCommand) {
            const command = commands.get(specificCommand);
            if (!command) {
                return interaction.reply({
                    content: `❌ コマンド \`${specificCommand}\` は見つかりませんでした。`,
                    ephemeral: true
                });
            }

            const commandEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📖 コマンド: ${command.data.name}`)
                .setDescription(command.data.description)
                .setTimestamp();

            // コマンドのオプションがある場合は追加
            if (command.data.options && command.data.options.length > 0) {
                const optionsField = command.data.options.map(option => {
                    const required = option.required ? '(必須)' : '(任意)';
                    return `・**${option.name}** ${required}\n→ ${option.description}`;
                }).join('\n');
                
                commandEmbed.addFields({ 
                    name: '📝 オプション', 
                    value: optionsField 
                });
            }

            return interaction.reply({ 
                embeds: [commandEmbed],
                ephemeral: true 
            });
        }

        // メインのヘルプメニューを作成
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔍 コマンドヘルプ')
            .setDescription('以下のカテゴリーから確認したいコマンドを選択してください。')
            .setTimestamp();

        // コマンドをカテゴリーごとに分類
        const categories = new Map();
        commands.forEach(cmd => {
            // カテゴリーが明示的に設定されていない場合は "その他" に分類
            const category = cmd.category || 'その他';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(cmd);
        });

        // カテゴリーごとのフィールドを追加
        categories.forEach((cmds, category) => {
            const commandsList = cmds.map(cmd => 
                `\`/${cmd.data.name}\` - ${cmd.data.description}`
            ).join('\n');
            
            helpEmbed.addFields({
                name: `📁 ${category}`,
                value: commandsList
            });
        });

        // セレクトメニューを作成
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help-select')
            .setPlaceholder('詳細を確認したいコマンドを選択')
            .addOptions(
                commands.map(cmd => ({
                    label: cmd.data.name,
                    description: cmd.data.description.slice(0, 100), // 説明は100文字まで
                    value: cmd.data.name
                }))
            );

        const row = new ActionRowBuilder()
            .addComponents(selectMenu);

        const response = await interaction.reply({
            embeds: [helpEmbed],
            components: [row],
            ephemeral: true
        });

        // セレクトメニューのインタラクションを待ち受け
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300000 // 5分間有効
        });

        collector.on('collect', async i => {
            if (i.customId === 'help-select') {
                const selectedCommand = commands.get(i.values[0]);
                const commandEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`📖 コマンド: ${selectedCommand.data.name}`)
                    .setDescription(selectedCommand.data.description)
                    .setTimestamp();

                if (selectedCommand.data.options && selectedCommand.data.options.length > 0) {
                    const optionsField = selectedCommand.data.options.map(option => {
                        const required = option.required ? '(必須)' : '(任意)';
                        return `・**${option.name}** ${required}\n→ ${option.description}`;
                    }).join('\n');
                    
                    commandEmbed.addFields({ 
                        name: '📝 オプション', 
                        value: optionsField 
                    });
                }

                await i.update({
                    embeds: [commandEmbed],
                    components: [row]
                });
            }
        });

        collector.on('end', async () => {
            // コレクターの有効期限が切れた場合、コンポーネントを無効化
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    selectMenu.setDisabled(true)
                );

            await interaction.editReply({
                components: [disabledRow]
            }).catch(() => {});
        });
    }
};