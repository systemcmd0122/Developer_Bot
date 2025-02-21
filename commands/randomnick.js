const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 権限を持つロールのID
const PERMISSION_ROLE_ID = '1336993137406771272';

// アクティブなセッションを追跡
const activeRandomnickSessions = new Map();

module.exports = {
    category: 'ネタ系',
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
            // コマンド実行者の権限チェック
            if (!interaction.member.roles.cache.has(PERMISSION_ROLE_ID)) {
                return await interaction.reply({
                    content: 'このコマンドを使用する権限がありません。',
                    ephemeral: true
                });
            }

            // Botの権限チェック
            const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
            if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                return await interaction.reply({
                    content: 'Botにニックネームを変更する権限がありません。',
                    ephemeral: true
                });
            }

            const shouldRevert = interaction.options.getBoolean('revert') || false;
            const guildId = interaction.guild.id;
            
            if (shouldRevert) {
                await interaction.deferReply();
                const session = activeRandomnickSessions.get(guildId);
                
                if (!session) {
                    // セッションがない場合は全メンバーのニックネームをリセット
                    const members = await interaction.guild.members.fetch();
                    const realMembers = members.filter(member => !member.user.bot);
                    let revertCount = 0;
                    let errorCount = 0;

                    for (const [, member] of realMembers) {
                        try {
                            // メンバーのニックネーム変更権限チェック
                            if (member.manageable && member.nickname) {
                                await member.setNickname(null);
                                revertCount++;
                            }
                        } catch (error) {
                            console.error(`Error resetting nickname for ${member.user.tag}:`, error);
                            errorCount++;
                        }
                    }

                    const revertEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('ニックネームリセット完了')
                        .setDescription(`${revertCount}人のニックネームを元に戻しました。${errorCount > 0 ? `\n${errorCount}人の変更に失敗しました。` : ''}`)
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [revertEmbed] });
                } else {
                    // アクティブなセッションがある場合は保存された元のニックネームに戻す
                    session.active = false;
                    clearInterval(session.intervalId);
                    let revertCount = 0;
                    let errorCount = 0;

                    for (const [memberId, previousNick] of session.previousNicknames) {
                        try {
                            const member = await interaction.guild.members.fetch(memberId);
                            if (member && member.manageable) {
                                await member.setNickname(previousNick || null);
                                revertCount++;
                            }
                        } catch (error) {
                            console.error(`Error resetting nickname for member ${memberId}:`, error);
                            errorCount++;
                        }
                    }

                    const revertEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('ニックネームリセット完了')
                        .setDescription(`${revertCount}人のニックネームを元に戻しました。${errorCount > 0 ? `\n${errorCount}人の変更に失敗しました。` : ''}`)
                        .setTimestamp();

                    try {
                        const message = await session.interaction.channel.messages.fetch(session.messageId);
                        await message.edit({
                            embeds: [revertEmbed],
                            components: []
                        });
                    } catch (error) {
                        console.error('Error updating session message:', error);
                    }

                    activeRandomnickSessions.delete(guildId);
                    return await interaction.editReply({ embeds: [revertEmbed] });
                }
            }

            // 既存のセッションをチェック
            if (activeRandomnickSessions.has(guildId)) {
                return await interaction.reply({
                    content: '既にニックネーム変更セッションが進行中です。\n`/randomnick revert: true` で元に戻すことができます。',
                    ephemeral: true
                });
            }

            const members = await interaction.guild.members.fetch();
            const realMembers = members.filter(member => !member.user.bot);

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
            let errorCount = 0;

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
                    // メンバーのニックネーム変更権限チェック
                    if (member.manageable) {
                        previousNicknames.set(member.id, member.nickname || null);
                        await member.setNickname(selectedName);
                        changeCount++;
                        
                        // 進捗更新（エラーカウントも含める）
                        progressEmbed.setDescription(
                            `変更済み: ${changeCount}人\n` +
                            `失敗: ${errorCount}人\n` +
                            `選択された名前: ${selectedName}`
                        );
                        
                        await initialMessage.edit({ embeds: [progressEmbed] });
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error setting nickname for ${member.user.tag}:`, error);
                    errorCount++;
                }
            }

            // 最終的な埋め込みの作成
            const finalEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('ニックネーム変更完了')
                .setDescription(
                    `${changeCount}人のニックネームを「${selectedName}」に変更しました。\n` +
                    `${errorCount > 0 ? `${errorCount}人の変更に失敗しました。\n\n` : '\n'}` +
                    '元に戻すには `/randomnick revert: true` を使用してください。'
                )
                .addFields({ 
                    name: '残り時間', 
                    value: `${minutes}:00` 
                })
                .setTimestamp();

            await initialMessage.edit({
                embeds: [finalEmbed]
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

// リバート処理の共通関数
async function handleRevert(guildId) {
    const session = activeRandomnickSessions.get(guildId);
    if (!session || !session.active) return;

    session.active = false;
    clearInterval(session.intervalId);

    let revertCount = 0;
    let errorCount = 0;

    for (const [memberId, previousNick] of session.previousNicknames) {
        try {
            const member = await session.interaction.guild.members.fetch(memberId);
            if (member && member.manageable) {
                await member.setNickname(previousNick);
                revertCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error(`Error resetting nickname for member ${memberId}:`, error);
            errorCount++;
        }
    }

    const finalEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('ニックネーム変更セッション終了')
        .setDescription(
            `${revertCount}人のニックネームを元に戻しました。` +
            `${errorCount > 0 ? `\n${errorCount}人の変更に失敗しました。` : ''}`
        )
        .setTimestamp();

    try {
        const message = await session.interaction.channel.messages.fetch(session.messageId);
        await message.edit({
            embeds: [finalEmbed]
        });
    } catch (error) {
        console.error('Error updating final message:', error);
    }

    activeRandomnickSessions.delete(guildId);
}