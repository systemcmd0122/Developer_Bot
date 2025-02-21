const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 権限を持つロールのID
const PERMISSION_ROLE_ID = '1336993137406771272';

// アクティブなセッションを追跡
const activeShuffleSessions = new Map();

module.exports = {
    category: 'ネタ系',
    data: new SlashCommandBuilder()
        .setName('nicknames')
        .setDescription('サーバーメンバーのニックネームを操作します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('shuffle')
                .setDescription('メンバー間でニックネームをシャッフルします')
                .addIntegerOption(option =>
                    option.setName('minutes')
                        .setDescription('ニックネームを変更する時間（分）')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('指定したニックネームをランダムに割り当てます')
                .addStringOption(option =>
                    option.setName('names')
                        .setDescription('カンマ区切りのニックネームリスト')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('minutes')
                        .setDescription('ニックネームを変更する時間（分）')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false))),

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

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            if (subcommand === 'revert') {
                return await handleRevert(interaction, guildId);
            }

            // 既存のセッションをチェック
            if (activeShuffleSessions.has(guildId)) {
                return await interaction.reply({
                    content: '既にニックネーム変更セッションが進行中です。\n`/nicknames revert` で元に戻すことができます。',
                    ephemeral: true
                });
            }

            const minutes = interaction.options.getInteger('minutes') || 10;
            const endTime = Date.now() + (minutes * 60 * 1000);

            await interaction.deferReply();

            const members = await interaction.guild.members.fetch();
            const realMembers = members.filter(member => !member.user.bot);

            if (realMembers.size === 0) {
                return await interaction.editReply({
                    content: 'メンバーが見つかりませんでした。',
                    ephemeral: true
                });
            }

            // 進行状況の埋め込み
            const progressEmbed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('ニックネーム変更中...')
                .setDescription('メンバーのニックネームを変更しています...')
                .setTimestamp();

            const initialMessage = await interaction.editReply({
                embeds: [progressEmbed]
            });

            let nicknames;
            if (subcommand === 'shuffle') {
                nicknames = Array.from(realMembers.values()).map(member => member.displayName);
                shuffleArray(nicknames);
            } else {
                const namesInput = interaction.options.getString('names');
                nicknames = namesInput.split(',').map(name => name.trim());
                
                // 名前の数が足りない場合は繰り返し使用
                while (nicknames.length < realMembers.size) {
                    nicknames = nicknames.concat(nicknames);
                }
                shuffleArray(nicknames);
                nicknames = nicknames.slice(0, realMembers.size);
            }

            const previousNicknames = new Map();
            let changeCount = 0;
            let errorCount = 0;
            let index = 0;

            for (const [, member] of realMembers) {
                try {
                    if (member.manageable) {
                        previousNicknames.set(member.id, member.nickname || null);
                        await member.setNickname(nicknames[index]);
                        changeCount++;
                        
                        progressEmbed.setDescription(
                            `変更済み: ${changeCount}人\n` +
                            `失敗: ${errorCount}人`
                        );
                        
                        await initialMessage.edit({ embeds: [progressEmbed] });
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error setting nickname for ${member.user.tag}:`, error);
                    errorCount++;
                }
                index++;
            }

            const finalEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('ニックネーム変更完了')
                .setDescription(
                    `${changeCount}人のニックネームを変更しました。\n` +
                    `${errorCount > 0 ? `${errorCount}人の変更に失敗しました。\n\n` : '\n'}` +
                    '元に戻すには `/nicknames revert` を使用してください。'
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

            activeShuffleSessions.set(guildId, sessionInfo);

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
                    await handleRevert(interaction, guildId);
                }
            }, 1000);

            sessionInfo.intervalId = intervalId;

            // 指定時間後に自動で元に戻す
            setTimeout(async () => {
                if (sessionInfo.active) {
                    await handleRevert(interaction, guildId);
                }
            }, minutes * 60 * 1000);

        } catch (error) {
            console.error('Error in nicknames command:', error);
            const errorMessage = interaction.replied || interaction.deferred ?
                await interaction.editReply('ニックネームの変更中にエラーが発生しました。') :
                await interaction.reply({
                    content: 'ニックネームの変更中にエラーが発生しました。',
                    ephemeral: true
                });
        }
    },
};

// 配列をシャッフルする関数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// リバート処理の共通関数
async function handleRevert(interaction, guildId) {
    const session = activeShuffleSessions.get(guildId);
    if (!session) {
        return await interaction.reply({
            content: 'アクティブなニックネーム変更セッションが見つかりませんでした。',
            ephemeral: true
        });
    }

    if (!session.active) {
        return await interaction.reply({
            content: 'セッションは既に終了しています。',
            ephemeral: true
        });
    }

    session.active = false;
    clearInterval(session.intervalId);

    let revertCount = 0;
    let errorCount = 0;

    for (const [memberId, previousNick] of session.previousNicknames) {
        try {
            const member = await interaction.guild.members.fetch(memberId);
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

    const revertEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('ニックネーム変更セッション終了')
        .setDescription(
            `${revertCount}人のニックネームを元に戻しました。` +
            `${errorCount > 0 ? `\n${errorCount}人の変更に失敗しました。` : ''}`
        )
        .setTimestamp();

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [revertEmbed] });
        } else {
            await interaction.reply({ embeds: [revertEmbed] });
        }

        const message = await session.interaction.channel.messages.fetch(session.messageId);
        await message.edit({
            embeds: [revertEmbed]
        });
    } catch (error) {
        console.error('Error updating messages:', error);
    }

    activeShuffleSessions.delete(guildId);
}