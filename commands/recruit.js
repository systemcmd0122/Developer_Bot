const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// ゲーム情報の定義
const GAME_ROLES = {
    'valorant': {
        id: '1331171347442962453',
        name: 'VALORANT',
        color: '#FF4654',
        emoji: '🎯',
        maxPlayers: 5,
        description: '5vs5のタクティカルシューター'
    },
    'genshin': {
        id: '1333703412453212172',
        name: '原神',
        color: '#5CC6FF',
        emoji: '⚔️',
        maxPlayers: 4,
        description: 'オープンワールドアクションRPG'
    },
    'minecraft': {
        id: '1331171555731832843',
        name: 'Minecraft',
        color: '#7DCE6E',
        emoji: '⛏️',
        maxPlayers: 0,
        description: 'サンドボックス型クラフトゲーム'
    },
    'grandcross': {
        id: '1331171504880095242',
        name: '七つの大罪',
        color: '#FFD700',
        emoji: '🗡️',
        maxPlayers: 4,
        description: 'アニメライセンスモバイルRPG'
    }
};

// 募集の有効期限オプション
const DURATION_OPTIONS = [
    { name: '30分', value: 30 },
    { name: '1時間', value: 60 },
    { name: '2時間', value: 120 },
    { name: '3時間', value: 180 },
    { name: '6時間', value: 360 }
];

// 募集用の埋め込みメッセージを作成する関数
function createRecruitEmbed(gameInfo, playersNeeded, hostId, participants, memo, waitingList, remainingTime = null) {
    const embed = new EmbedBuilder()
        .setColor(gameInfo.color)
        .setTitle(`${gameInfo.emoji} ${gameInfo.name}の募集`)
        .setDescription(gameInfo.description)
        .addFields(
            { name: '主催者', value: `<@${hostId}>`, inline: true },
            { name: '募集人数', value: `${playersNeeded}人`, inline: true },
            { name: '現在の参加者', value: `${participants.size}/${playersNeeded + 1}人`, inline: true },
            { name: 'メモ', value: memo || 'なし', inline: false },
            { name: '参加者リスト', value: formatParticipantsList(participants), inline: false }
        )
        .setTimestamp();

    if (waitingList.size > 0) {
        embed.addFields({
            name: 'キャンセル待ちリスト',
            value: formatParticipantsList(waitingList),
            inline: false
        });
    }

    if (remainingTime !== null) {
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        embed.addFields({
            name: '残り時間',
            value: `${hours}時間${minutes}分`,
            inline: true
        });
    }

    return embed;
}

// ボタンを作成する関数
function createButtons() {
    const joinButton = new ButtonBuilder()
        .setCustomId('join_recruit')
        .setLabel('参加する')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const leaveButton = new ButtonBuilder()
        .setCustomId('leave_recruit')
        .setLabel('参加を取り消す')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    const waitingButton = new ButtonBuilder()
        .setCustomId('waiting_recruit')
        .setLabel('キャンセル待ち')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄');

    const closeButton = new ButtonBuilder()
        .setCustomId('close_recruit')
        .setLabel('募集を締め切る')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒');

    return new ActionRowBuilder()
        .addComponents(joinButton, leaveButton, waitingButton, closeButton);
}

// 参加者リストをフォーマットする関数
function formatParticipantsList(participants) {
    return participants.size > 0
        ? Array.from(participants).map(id => `<@${id}>`).join('\n')
        : 'なし';
}

// 埋め込みメッセージを更新する関数
async function updateEmbed(mainMessage, embed, gameInfo, playersNeeded, participants, memo, waitingList, remainingTime) {
    try {
        embed.data.fields = [];
        embed.addFields(
            { name: '主催者', value: `<@${mainMessage.interaction.user.id}>`, inline: true },
            { name: '募集人数', value: `${playersNeeded}人`, inline: true },
            { name: '現在の参加者', value: `${participants.size}/${playersNeeded + 1}人`, inline: true },
            { name: 'メモ', value: memo || 'なし', inline: false },
            { name: '参加者リスト', value: formatParticipantsList(participants), inline: false }
        );

        if (waitingList.size > 0) {
            embed.addFields({
                name: 'キャンセル待ちリスト',
                value: formatParticipantsList(waitingList),
                inline: false
            });
        }

        if (remainingTime !== null) {
            const hours = Math.floor(remainingTime / 3600);
            const minutes = Math.floor((remainingTime % 3600) / 60);
            embed.addFields({
                name: '残り時間',
                value: `${hours}時間${minutes}分`,
                inline: true
            });
        }

        await mainMessage.edit({
            content: mainMessage.content,
            embeds: [embed],
            components: mainMessage.components
        });
    } catch (error) {
        console.error('Error updating embed:', error);
    }
}

// 参加ボタンの処理
async function handleJoin(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime) {
    if (participants.has(i.user.id)) {
        await i.reply({
            content: 'すでに参加しています！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    if (waitingList.has(i.user.id)) {
        await i.reply({
            content: 'すでにキャンセル待ちリストに登録されています！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    if (participants.size <= playersNeeded) {
        participants.add(i.user.id);
        await updateEmbed(mainMessage, embed, gameInfo, playersNeeded, participants, memo, waitingList, remainingTime);
        
        if (participants.size === playersNeeded + 1) {
            const mentionList = Array.from(participants).map(id => `<@${id}>`).join(' ');
            await i.channel.send({
                content: `${gameInfo.emoji} ${gameInfo.name}のメンバーが集まりました！\n${mentionList}`,
                allowedMentions: { users: Array.from(participants) }
            });
        }

        await i.reply({
            content: '参加登録しました！',
            flags: [ 'Ephemeral' ]
        });
    } else {
        await i.reply({
            content: '募集人数が既に満員のため、キャンセル待ちボタンから登録してください。',
            flags: [ 'Ephemeral' ]
        });
    }
}

// 離脱ボタンの処理
async function handleLeave(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime) {
    if (!participants.has(i.user.id)) {
        await i.reply({
            content: '参加していないため、取り消しできません！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    if (i.user.id === mainMessage.interaction.user.id) {
        await i.reply({
            content: '主催者は参加を取り消せません！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    participants.delete(i.user.id);

    // キャンセル待ちリストから1人を昇格
    if (waitingList.size > 0) {
        const nextParticipant = waitingList.values().next().value;
        waitingList.delete(nextParticipant);
        participants.add(nextParticipant);
        await i.channel.send({
            content: `<@${nextParticipant}> キャンセル待ちから参加メンバーに昇格しました！`,
            allowedMentions: { users: [nextParticipant] }
        });
    }

    await updateEmbed(mainMessage, embed, gameInfo, playersNeeded, participants, memo, waitingList, remainingTime);

    await i.reply({
        content: '参加を取り消しました！',
        flags: [ 'Ephemeral' ]
    });
}

// キャンセル待ちボタンの処理
async function handleWaitingList(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime) {
    if (participants.has(i.user.id)) {
        await i.reply({
            content: 'すでに参加者として登録されています！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    if (waitingList.has(i.user.id)) {
        waitingList.delete(i.user.id);
        await i.reply({
            content: 'キャンセル待ちを取り消しました！',
            flags: [ 'Ephemeral' ]
        });
    } else {
        waitingList.add(i.user.id);
        await i.reply({
            content: 'キャンセル待ちリストに登録しました！',
            flags: [ 'Ephemeral' ]
        });
    }

    await updateEmbed(mainMessage, embed, gameInfo, playersNeeded, participants, memo, waitingList, remainingTime);
}

// 募集締め切りボタンの処理
async function handleClose(i, mainMessage, collector, participants, waitingList, gameInfo, embed) {
    if (i.user.id !== mainMessage.interaction.user.id) {
        await i.reply({
            content: '主催者のみが募集を締め切ることができます！',
            flags: [ 'Ephemeral' ]
        });
        return;
    }

    collector.stop('closed');
    const mentionList = Array.from(participants).map(id => `<@${id}>`).join(' ');
    embed.setColor('#808080')
        .setTitle(`${gameInfo.emoji} ${gameInfo.name}の募集【締切済み】`);

    await mainMessage.edit({
        content: `${gameInfo.name}の募集を締め切りました。\n参加者: ${mentionList}`,
        embeds: [embed],
        components: []
    });

    await i.reply({
        content: '募集を締め切りました。',
        flags: [ 'Ephemeral' ]
    });
}

// コレクター終了時の処理
async function handleCollectorEnd(reason, mainMessage, gameInfo, embed, participants) {
    if (reason === 'time') {
        embed.setColor('#808080')
            .setTitle(`${gameInfo.emoji} ${gameInfo.name}の募集【期限切れ】`);
        
        const mentionList = Array.from(participants).map(id => `<@${id}>`).join(' ');
        await mainMessage.edit({
            content: `${gameInfo.name}の募集が期限切れになりました。\n最終参加者: ${mentionList}`,
            embeds: [embed],
            components: []
        });
    }
}

// メインのコマンド定義
module.exports = {
    data: new SlashCommandBuilder()
        .setName('recruit')
        .setDescription('ゲームの募集を開始します')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('募集するゲーム')
                .setRequired(true)
                .addChoices(
                    { name: 'VALORANT', value: 'valorant' },
                    { name: '原神', value: 'genshin' },
                    { name: 'Minecraft', value: 'minecraft' },
                    { name: '七つの大罪', value: 'grandcross' }
                ))
        .addIntegerOption(option =>
            option.setName('players')
                .setDescription('募集する人数')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(99))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('募集の有効期限')
                .setRequired(true)
                .addChoices(...DURATION_OPTIONS))
        .addStringOption(option =>
            option.setName('memo')
                .setDescription('追加メッセージ（任意）')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const game = interaction.options.getString('game');
            const playersNeeded = interaction.options.getInteger('players');
            const duration = interaction.options.getInteger('duration');
            const memo = interaction.options.getString('memo') || '';
            const gameInfo = GAME_ROLES[game];

            // 参加者管理
            const participants = new Set([interaction.user.id]);
            const waitingList = new Set(); // キャンセル待ちリスト

            // 募集用の埋め込みメッセージを作成
            const embed = createRecruitEmbed(gameInfo, playersNeeded, interaction.user.id, participants, memo, waitingList);

            // ボタンを作成
            const buttons = createButtons();

            // 募集メッセージを送信
            const mainMessage = await interaction.reply({
                content: `<@&${gameInfo.id}> メンバー募集中！\n>>> ゲーム：${gameInfo.name}\n${gameInfo.description}`,
                embeds: [embed],
                components: [buttons],
                fetchReply: true
            });

            // ボタンのコレクターを設定
            const collector = mainMessage.createMessageComponentCollector({
                time: duration * 60 * 1000 // 分をミリ秒に変換
            });

            // 残り時間の更新用タイマー
            let remainingTime = duration * 60;
            const timerInterval = setInterval(() => {
                remainingTime -= 1;
                if (remainingTime % 60 === 0) { // 1分ごとに更新
                    updateEmbed(mainMessage, embed, gameInfo, playersNeeded, participants, memo, waitingList, remainingTime);
                }
            }, 1000);

            // ボタンのインタラクションを処理
            collector.on('collect', async i => {
                try {
                    switch (i.customId) {
                        case 'join_recruit':
                            await handleJoin(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime);
                            break;
                        case 'leave_recruit':
                            await handleLeave(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime);
                            break;
                        case 'waiting_recruit':
                            await handleWaitingList(i, mainMessage, participants, waitingList, playersNeeded, gameInfo, embed, memo, remainingTime);
                            break;
                        case 'close_recruit':
                            await handleClose(i, mainMessage, collector, participants, waitingList, gameInfo, embed);
                            clearInterval(timerInterval);
                            break;
                    }
                } catch (error) {
                    console.error('Error handling button interaction:', error);
                    try {
                        await i.reply({
                            content: 'ボタンの処理中にエラーが発生しました。',
                            flags: [ 'Ephemeral' ]
                        });
                    } catch (replyError) {
                        console.error('Error sending error message:', replyError);
                    }
                }
            });

            // コレクターが終了したときの処理
            collector.on('end', (collected, reason) => {
                clearInterval(timerInterval);
                handleCollectorEnd(reason, mainMessage, gameInfo, embed, participants);
            });

        } catch (error) {
            console.error('Error in recruit command:', error);
            try {
                if (!interaction.replied) {
                    await interaction.reply({
                        content: 'コマンドの実行中にエラーが発生しました。',
                        flags: [ 'Ephemeral' ]
                    });
                }
            } catch (replyError) {
                console.error('Error sending error message:', replyError);
            }
        }
    },
};
