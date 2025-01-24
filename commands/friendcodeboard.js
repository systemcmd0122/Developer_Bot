// commands/friendcodeboard.js
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const FRIENDCODE_FILE = path.join(__dirname, '..', 'friendcodes.json');

// JSONファイルの読み込み
const loadFriendCodes = () => {
    try {
        if (!fs.existsSync(FRIENDCODE_FILE)) {
            fs.writeFileSync(FRIENDCODE_FILE, JSON.stringify({}));
        }
        return JSON.parse(fs.readFileSync(FRIENDCODE_FILE, 'utf8'));
    } catch (error) {
        console.error('フレンドコードファイルの読み込みエラー:', error);
        return {};
    }
};

// JSONファイルの保存
const saveFriendCodes = (friendCodes) => {
    try {
        fs.writeFileSync(FRIENDCODE_FILE, JSON.stringify(friendCodes, null, 2));
    } catch (error) {
        console.error('フレンドコードファイルの保存エラー:', error);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friendcodeboard')
        .setDescription('フレンドコード共有ボードを作成します')
        .addStringOption(option => 
            option.setName('game')
                .setDescription('フレンドコードを共有するゲーム名')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async execute(interaction) {
        try {
            const gameName = interaction.options.getString('game');
            let friendCodes = loadFriendCodes();
            
            // ゲームごとのフレンドコードを初期化
            if (!friendCodes[gameName]) {
                friendCodes[gameName] = {};
            }
            saveFriendCodes(friendCodes);

            // フレンドコード情報を含むEmbedを作成する関数
            const createFriendCodeEmbed = () => {
                const embed = new EmbedBuilder()
                    .setTitle(`🎮 ${gameName} フレンドコード共有ボード`)
                    .setDescription('ボタンからフレンドコードを登録・確認できます。')
                    .setColor('#00ff00');

                // フレンドコードを表示
                const friendCodeEntries = Object.entries(friendCodes[gameName] || {});
                if (friendCodeEntries.length > 0) {
                    const fields = friendCodeEntries.map(([userId, code]) => {
                        const member = interaction.guild.members.cache.get(userId);
                        return {
                            name: member ? member.displayName : 'Unknown User',
                            value: code,
                            inline: true
                        };
                    });

                    // 3列のグリッドになるように調整
                    while (fields.length % 3 !== 0) {
                        fields.push({ name: '\u200B', value: '\u200B', inline: true });
                    }

                    embed.addFields(fields);
                } else {
                    embed.setDescription('まだフレンドコードが登録されていません。');
                }

                return embed;
            };

            // 管理ボタンを作成
            const createManageButton = () => {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`manage-friendcode-${gameName}`)
                            .setLabel('フレンドコード管理')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎮')
                    );
            };

            // まず、コマンドに応答
            await interaction.reply({ 
                content: `${gameName}のフレンドコードボードを作成しています...`, 
                ephemeral: true 
            });

            // メインのフレンドコードボードを送信
            const messageRef = await interaction.channel.send({
                embeds: [createFriendCodeEmbed()],
                components: [createManageButton()]
            });

            // インタラクションの処理
            const collector = messageRef.createMessageComponentCollector({
                time: 0 // 永続的に収集
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === `manage-friendcode-${gameName}`) {
                        // フレンドコード入力モーダルを作成
                        const modal = new ModalBuilder()
                            .setCustomId(`friendcode-modal-${gameName}`)
                            .setTitle(`${gameName} フレンドコード登録`);

                        const friendCodeInput = new TextInputBuilder()
                            .setCustomId('friendcode-input')
                            .setLabel('フレンドコードを入力')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const actionRow = new ActionRowBuilder().addComponents(friendCodeInput);
                        modal.addComponents(actionRow);

                        await i.showModal(modal);
                    }
                } catch (error) {
                    console.error('インタラクション処理中にエラーが発生:', error);
                }
            });

            // モーダル送信イベントのハンドラ
            interaction.client.on('interactionCreate', async modalInteraction => {
                if (!modalInteraction.isModalSubmit()) return;
                
                if (modalInteraction.customId === `friendcode-modal-${gameName}`) {
                    const friendCode = modalInteraction.fields.getTextInputValue('friendcode-input');
                    
                    // フレンドコードを更新
                    friendCodes = loadFriendCodes(); // 最新のデータを再読み込み
                    friendCodes[gameName][modalInteraction.user.id] = friendCode;
                    saveFriendCodes(friendCodes);

                    // メッセージを更新
                    await messageRef.edit({
                        embeds: [createFriendCodeEmbed()],
                        components: [createManageButton()]
                    });

                    // 確認メッセージ
                    await modalInteraction.reply({
                        content: `${gameName}のフレンドコードを登録しました！`,
                        ephemeral: true
                    });
                }
            });

            // 初期メッセージを更新
            await interaction.editReply({ 
                content: `${gameName}のフレンドコードボードを作成しました。`, 
                flags: 64 // ephemeral flagを使用
            });

        } catch (error) {
            console.error('friendcodeboard コマンドの実行中にエラーが発生:', error);
            
            const errorResponse = {
                content: 'コマンドの実行中にエラーが発生しました。もう一度お試しください。',
                flags: 64 // ephemeral flagを使用
            };
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        }
    },
};