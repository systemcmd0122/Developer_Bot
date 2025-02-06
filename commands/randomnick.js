const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 権限を持つロールのID
const PERMISSION_ROLE_ID = '1336993137406771272';

// アクティブなセッションを追跡
const activeRandomnickSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randomnick')
        .setDescription('サーバーメンバーのニックネームをランダムに統一します')
        .addIntegerOption(option =>
            option.setName('minutes')
                .setDescription('ニックネームを変更する時間（分）')
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('revert')
                .setDescription('すぐに元のニックネームに戻す場合はtrue')
                .setRequired(false)),

    async execute(interaction) {
        try {
            if (!interaction.member.roles.cache.has(PERMISSION_ROLE_ID)) {
                return await interaction.reply({
                    content: 'このコマンドを使用する権限がありません。',
                    ephemeral: true
                });
            }

            const shouldRevert = interaction.options.getBoolean('revert') || false;
            const guildId = interaction.guild.id;
            
            // 既存のセッションをチェック
            if (activeRandomnickSessions.has(guildId)) {
                return await interaction.reply({
                    content: '既にニックネーム変更セッションが進行中です。',
                    ephemeral: true
                });
            }

            const members = await interaction.guild.members.fetch();
            const realMembers = members.filter(member => !member.user.bot);

            if (shouldRevert) {
                await interaction.deferReply();
                let revertCount = 0;

                for (const [, member] of realMembers) {
                    try {
                        if (member.id === interaction.member.id || member.manageable) {
                            if (member.nickname) {
                                await member.setNickname(null);
                                revertCount++;
                            }
                        }
                    } catch (error) {
                        console.error(`Error reverting nickname for ${member.user.tag}:`, error);
                    }
                }

                const revertEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('ニックネームリセット完了')
                    .setDescription(`${revertCount}人のニックネームを元に戻しました。`)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [revertEmbed] });
            }

            const randomMember = realMembers.random();
            if (!randomMember) {
                return await interaction.reply({
                    content: 'メンバーが見つかりませんでした。',
                    ephemeral: true
                });
            }

            const selectedName = randomMember.displayName;
            const previousNicknames = new Map();
            const minutes = interaction.options.getInteger('minutes') || 10;
            const endTime = Date.now() + (minutes * 60 * 1000);
            
            await interaction.deferReply();
            let changeCount = 0;

            // ニックネーム変更アニメーション用の埋め込み
            const progressEmbed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('ニックネーム変更中...')
                .setDescription('メンバーのニックネームを変更しています...')
                .setTimestamp();

            const initialMessage = await interaction.editReply({
                embeds: [progressEmbed]
            });

            // メンバーのニックネーム変更
            for (const [, member] of realMembers) {
                try {
                    if (member.id === interaction.member.id || member.manageable) {
                        previousNicknames.set(member.id, member.displayName);
                        await member.setNickname(selectedName);
                        changeCount++;
                        
                        // 進捗更新
                        progressEmbed
                            .setDescription(`変更済み: ${changeCount}人\n選択された名前: ${selectedName}`)
                            .setProgress(changeCount / realMembers.size * 100);
                        
                        await initialMessage.edit({ embeds: [progressEmbed] });
                    }
                } catch (error) {
                    console.error(`Error setting nickname for ${member.user.tag}:`, error);
                }
            }

            // 停止ボタンの作成
            const stopButton = new ButtonBuilder()
                .setCustomId('stop_randomnick')
                .setLabel('停止して元に戻す')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(stopButton);

            // 最終的な埋め込みの作成
            const finalEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('ニックネーム変更完了')
                .setDescription(`${changeCount}人のニックネームを「${selectedName}」に変更しました。`)
                .addFields({ 
                    name: '残り時間', 
                    value: `${minutes}:00` 
                })
                .setTimestamp();

            await initialMessage.edit({
                embeds: [finalEmbed],
                components: [row]
            });

            // セッション情報の保存
            const sessionInfo = {
                previousNicknames,
                endTime,
                messageId: initialMessage.id,
                interaction,
                intervalId: null,
                active: true
            };

            activeRandomnickSessions.set(guildId, sessionInfo);

            // カウントダウンタイマーの開始
            const intervalId = setInterval(async () => {
                if (!sessionInfo.active) {
                    clearInterval(intervalId);
                    return;
                }

                const remaining = Math.max(0, endTime - Date.now());
                const remainingMinutes = Math.floor(remaining / 60000);
                const remainingSeconds = Math.floor((remaining % 60000) / 1000);

                finalEmbed.spliceFields(0, 1, {
                    name: '残り時間',
                    value: `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
                });

                try {
                    await initialMessage.edit({ embeds: [finalEmbed] });
                } catch (error) {
                    console.error('Error updating countdown:', error);
                }

                if (remaining <= 0) {
                    await handleRevert(guildId);
                }
            }, 1000);

            sessionInfo.intervalId = intervalId;

            // 指定時間後に自動で元に戻す
            setTimeout(async () => {
                if (sessionInfo.active) {
                    await handleRevert(guildId);
                }
            }, minutes * 60 * 1000);

        } catch (error) {
            console.error('Error in randomnick command:', error);
            const errorMessage = interaction.replied || interaction.deferred ?
                await interaction.editReply('ニックネームの変更中にエラーが発生しました。') :
                await interaction.reply({
                    content: 'ニックネームの変更中にエラーが発生しました。',
                    ephemeral: true
                });
        }
    },
};

// 停止ボタンのイベントハンドラを登録
const handleStopButton = async (interaction) => {
    const guildId = interaction.guild.id;
    const session = activeRandomnickSessions.get(guildId);

    if (!session || !session.active) {
        await interaction.reply({
            content: 'アクティブなセッションが見つかりませんでした。',
            ephemeral: true
        });
        return;
    }

    await handleRevert(guildId);
    await interaction.reply({
        content: 'ニックネーム変更をキャンセルしました。',
        ephemeral: true
    });
};

// リバート処理の共通関数
async function handleRevert(guildId) {
    const session = activeRandomnickSessions.get(guildId);
    if (!session || !session.active) return;

    session.active = false;
    clearInterval(session.intervalId);

    let revertCount = 0;
    for (const [memberId, previousNick] of session.previousNicknames) {
        try {
            const member = await session.interaction.guild.members.fetch(memberId);
            if (member && (member.id === session.interaction.member.id || member.manageable)) {
                await member.setNickname(previousNick);
                revertCount++;
            }
        } catch (error) {
            console.error(`Error resetting nickname for member ${memberId}:`, error);
        }
    }

    const finalEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('ニックネーム変更セッション終了')
        .setDescription(`${revertCount}人のニックネームを元に戻しました。`)
        .setTimestamp();

    try {
        const message = await session.interaction.channel.messages.fetch(session.messageId);
        await message.edit({
            embeds: [finalEmbed],
            components: []
        });
    } catch (error) {
        console.error('Error updating final message:', error);
    }

    activeRandomnickSessions.delete(guildId);
}

// イベントハンドラをエクスポート
module.exports.handleStopButton = handleStopButton;