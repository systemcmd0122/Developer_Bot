// commands/game.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// 募集ボードのデータを保存するファイルのパス
const GAME_BOARDS_PATH = path.join(__dirname, '..', 'data', 'gameBoards.json');

// ロールIDを設定
const GAME_ROLE_ID = '1331169578155507772';

// ゲームボードのデータを読み込む関数
async function loadGameBoards() {
    try {
        await fs.access(GAME_BOARDS_PATH);
        const data = await fs.readFile(GAME_BOARDS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // ファイルが存在しない場合は空のオブジェクトを作成して保存
            await fs.mkdir(path.dirname(GAME_BOARDS_PATH), { recursive: true });
            await fs.writeFile(GAME_BOARDS_PATH, '{}', 'utf8');
            return {};
        }
        console.error('Error loading game boards:', error);
        throw error;
    }
}

// ゲームボードのデータを保存する関数
async function saveGameBoards(boards) {
    try {
        // 一時ファイルに書き込み
        const tempFilePath = `${GAME_BOARDS_PATH}.temp`;
        await fs.writeFile(tempFilePath, JSON.stringify(boards, null, 2), 'utf8');
        
        // 完了したら本来のファイルに移動（アトミック操作）
        await fs.rename(tempFilePath, GAME_BOARDS_PATH);
    } catch (error) {
        console.error('Error saving game boards:', error);
        throw error;
    }
}

// 募集ボードのEmbedを作成する関数
function createRecruitmentEmbed(game, creator, participants, maxParticipants) {
    const participantList = participants.length > 0
        ? participants.map((p, index) => `${index + 1}. <@${p.id}>`).join('\n')
        : 'まだ参加者はいません';

    return new EmbedBuilder()
        .setTitle(`🎮 ${game}の募集`)
        .setDescription(`<@${creator.id}> が ${game} で遊ぶメンバーを募集しています！\n参加したい方は下のボタンをクリックしてください。`)
        .setColor('#00a0ff')
        .addFields(
            { name: '主催者', value: `<@${creator.id}>`, inline: true },
            { name: '募集人数', value: `${participants.length}/${maxParticipants}人`, inline: true },
            { name: '参加者一覧', value: participantList }
        )
        .setFooter({ text: `募集ID: ${Date.now()}` })
        .setTimestamp();
}

// ボタンを作成する関数
function createButtons(isFull, isCreator) {
    const joinButton = new ButtonBuilder()
        .setCustomId('game-join')
        .setLabel('参加する')
        .setStyle(ButtonStyle.Success)
        .setDisabled(isFull);

    const leaveButton = new ButtonBuilder()
        .setCustomId('game-leave')
        .setLabel('参加をキャンセル')
        .setStyle(ButtonStyle.Secondary);

    const deleteButton = new ButtonBuilder()
        .setCustomId('game-delete')
        .setLabel('募集を削除')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);
    
    // 主催者か管理者権限を持つ場合のみ削除ボタンを表示
    if (isCreator) {
        row.addComponents(deleteButton);
    }

    return row;
}

module.exports = {
    category: 'ゲーム',
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('ゲームの募集を作成します')
        .addStringOption(option => 
            option.setName('game')
                .setDescription('募集するゲーム名')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('max')
                .setDescription('最大参加人数 (主催者を含む)')
                .setMinValue(2)
                .setMaxValue(20)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            // オプションから情報を取得
            const gameName = interaction.options.getString('game');
            const maxParticipants = interaction.options.getInteger('max') || 4; // デフォルトは4人
            
            // 初期参加者（主催者）
            const creator = {
                id: interaction.user.id,
                username: interaction.user.username
            };
            
            const participants = [creator];
            
            // Embedを作成
            const embed = createRecruitmentEmbed(gameName, creator, participants, maxParticipants);
            
            // ボタンを作成
            const row = createButtons(participants.length >= maxParticipants, true);
            
            // ロールをメンション
            const content = `<@&${GAME_ROLE_ID}> ${gameName}の募集が開始されました！`;
            
            // メッセージを送信
            const message = await interaction.reply({
                content: content,
                embeds: [embed],
                components: [row],
                fetchReply: true
            });
            
            // ゲームボードのデータを保存
            const boardId = message.id;
            const gameBoards = await loadGameBoards();
            
            gameBoards[boardId] = {
                id: boardId,
                game: gameName,
                creatorId: creator.id,
                maxParticipants: maxParticipants,
                participants: participants,
                channelId: interaction.channelId,
                createdAt: Date.now()
            };
            
            await saveGameBoards(gameBoards);
            
            // ボタンインタラクションのコレクターを設定
            const collector = message.createMessageComponentCollector({
                time: 6 * 60 * 60 * 1000 // 6時間
            });
            
            collector.on('collect', async i => {
                // その時点での最新のゲームボードデータを取得
                const currentGameBoards = await loadGameBoards();
                const currentBoard = currentGameBoards[boardId];
                
                if (!currentBoard) {
                    await i.reply({
                        content: 'この募集は既に削除されています。',
                        ephemeral: true
                    });
                    return;
                }
                
                // ユーザーが主催者かどうか判定
                const isCreator = i.user.id === currentBoard.creatorId;
                // 管理者権限を持っているかどうか判定
                const isAdmin = i.member.permissions.has(PermissionFlagsBits.ManageMessages);
                
                switch (i.customId) {
                    case 'game-join':
                        // 既に参加しているかチェック
                        const alreadyJoined = currentBoard.participants.some(p => p.id === i.user.id);
                        
                        if (alreadyJoined) {
                            await i.reply({
                                content: 'あなたは既にこの募集に参加しています。',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // 最大人数チェック
                        if (currentBoard.participants.length >= currentBoard.maxParticipants) {
                            await i.reply({
                                content: 'この募集は既に満員です。',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // 参加者リストに追加
                        currentBoard.participants.push({
                            id: i.user.id,
                            username: i.user.username
                        });
                        
                        await i.reply({
                            content: `${gameName}の募集に参加しました！`,
                            ephemeral: true
                        });
                        break;
                        
                    case 'game-leave':
                        // 参加していなければエラー
                        const participantIndex = currentBoard.participants.findIndex(p => p.id === i.user.id);
                        
                        if (participantIndex === -1) {
                            await i.reply({
                                content: 'あなたはこの募集に参加していません。',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // 主催者は参加キャンセルできない
                        if (isCreator) {
                            await i.reply({
                                content: '主催者は参加をキャンセルできません。募集を削除するには「募集を削除」ボタンを使用してください。',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // 参加者リストから削除
                        currentBoard.participants = currentBoard.participants.filter(p => p.id !== i.user.id);
                        
                        await i.reply({
                            content: `${gameName}の募集への参加をキャンセルしました。`,
                            ephemeral: true
                        });
                        break;
                        
                    case 'game-delete':
                        // 主催者か管理者権限を持つメンバーのみ削除可能
                        if (!isCreator && !isAdmin) {
                            await i.reply({
                                content: 'この募集を削除できるのは主催者か管理者権限を持つメンバーのみです。',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // ゲームボードデータから削除
                        delete currentGameBoards[boardId];
                        
                        // ゲームボードデータを保存
                        await saveGameBoards(currentGameBoards);
                        
                        // メッセージを編集して募集終了を表示
                        const closedEmbed = new EmbedBuilder()
                            .setTitle(`🚫 ${gameName}の募集は終了しました`)
                            .setDescription('この募集は終了しました。')
                            .setColor('#ff0000')
                            .setTimestamp();
                        
                        await i.update({
                            content: `${gameName}の募集は終了しました。`,
                            embeds: [closedEmbed],
                            components: []
                        });
                        
                        collector.stop();
                        break;
                }
                
                // ボードが削除されていなければ更新（既に削除されている場合は更新しない）
                if (currentGameBoards[boardId]) {
                    // Embedを更新
                    const updatedEmbed = createRecruitmentEmbed(
                        currentBoard.game,
                        { id: currentBoard.creatorId },
                        currentBoard.participants,
                        currentBoard.maxParticipants
                    );
                    
                    // ボタンを更新（主催者または管理者のみ削除ボタンを表示）
                    const updatedRow = createButtons(
                        currentBoard.participants.length >= currentBoard.maxParticipants,
                        isCreator || isAdmin
                    );
                    
                    // 人数が集まったらメンション
                    let updatedContent = content;
                    if (currentBoard.participants.length === currentBoard.maxParticipants) {
                        const mentions = currentBoard.participants.map(p => `<@${p.id}>`).join(' ');
                        updatedContent = `${mentions} ${gameName}の参加者が集まりました！`;
                    }
                    
                    // メッセージを更新
                    await i.message.edit({
                        content: updatedContent,
                        embeds: [updatedEmbed],
                        components: [updatedRow]
                    });
                    
                    // ゲームボードデータを保存
                    await saveGameBoards(currentGameBoards);
                }
            });
            
            collector.on('end', async () => {
                try {
                    // 古いメッセージを取得
                    const message = await interaction.channel.messages.fetch(boardId).catch(() => null);
                    
                    if (message) {
                        // 募集終了メッセージに更新
                        const closedEmbed = new EmbedBuilder()
                            .setTitle(`⏱️ ${gameName}の募集は終了しました`)
                            .setDescription('募集の有効期限が切れました。')
                            .setColor('#808080')
                            .setTimestamp();
                            
                        await message.edit({
                            content: `${gameName}の募集は終了しました。`,
                            embeds: [closedEmbed],
                            components: []
                        });
                    }
                    
                    // ゲームボードデータから削除
                    const finalGameBoards = await loadGameBoards();
                    if (finalGameBoards[boardId]) {
                        delete finalGameBoards[boardId];
                        await saveGameBoards(finalGameBoards);
                    }
                } catch (error) {
                    console.error('Error ending game recruitment:', error);
                }
            });
            
        } catch (error) {
            console.error('Error creating game recruitment:', error);
            await interaction.reply({
                content: 'ゲーム募集の作成中にエラーが発生しました。',
                ephemeral: true
            });
        }
    },
    
    async handleGameButton(interaction) {
        return true;
    }
};