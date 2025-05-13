const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// グー、チョキ、パーの絵文字とそれぞれが勝つ手を定義
const HANDS = {
    ROCK: { emoji: '✊', beats: 'SCISSORS', name: 'グー' },
    SCISSORS: { emoji: '✌️', beats: 'PAPER', name: 'チョキ' },
    PAPER: { emoji: '🖐️', beats: 'ROCK', name: 'パー' }
};

module.exports = {
    category: 'ゲーム',
    data: new SlashCommandBuilder()
        .setName('janken')
        .setDescription('他のユーザーとじゃんけんで遊びます')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('対戦相手を選択してください')
                .setRequired(true)),

    gameStates: new Map(), // ゲーム状態を保持するMap

    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        
        // 自分自身との対戦を防ぐ
        if (opponent.id === interaction.user.id) {
            await interaction.reply({
                content: '自分自身とじゃんけんすることはできません！',
                ephemeral: true
            });
            return;
        }

        // Botとの対戦を防ぐ
        if (opponent.bot) {
            await interaction.reply({
                content: 'Botとじゃんけんすることはできません！',
                ephemeral: true
            });
            return;
        }

        // ゲームの状態を保存
        const gameState = {
            challenger: interaction.user.id,
            opponent: opponent.id,
            challengerHand: null,
            opponentHand: null,
            timestamp: Date.now() // タイムスタンプを追加
        };

        // ボタンを作成
        const buttons = Object.entries(HANDS).map(([key, value]) => {
            return new ButtonBuilder()
                .setCustomId(`janken-${interaction.user.id}-${opponent.id}-${key}`)
                .setEmoji(value.emoji)
                .setLabel(value.name)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        const embed = new EmbedBuilder()
            .setTitle('✨ じゃんけん対戦 ✨')
            .setDescription(`${interaction.user} が ${opponent} に対戦を申し込みました！\n\n` +
                `両プレイヤーは下のボタンから手を選んでください。\n` +
                `選んだ手は相手には見えません。`)
            .setColor('#FF69B4')
            .setTimestamp();

        // メッセージを送信し、gameStateを保存
        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // メッセージIDをゲーム状態に紐付ける
        this.gameStates.set(message.id, gameState);

        // 1分後にゲームを終了
        setTimeout(() => {
            if (this.gameStates.has(message.id)) {
                const game = this.gameStates.get(message.id);
                if (!game.challengerHand || !game.opponentHand) {
                    const embed = new EmbedBuilder()
                        .setTitle('じゃんけんタイムアウト')
                        .setDescription('1分以内に両プレイヤーが手を選択しなかったため、ゲームを終了しました。')
                        .setColor('#FF0000')
                        .setTimestamp();

                    interaction.editReply({
                        embeds: [embed],
                        components: []
                    }).catch(console.error);
                    this.gameStates.delete(message.id);
                }
            }
        }, 60000);
    },

    // ボタンインタラクションのハンドラー
    async handleJankenButton(interaction) {
        // インタラクションを確認
        if (!interaction.isButton()) return;

        const [, challengerId, opponentId, hand] = interaction.customId.split('-');
        const gameState = this.gameStates.get(interaction.message.id);

        if (!gameState) {
            await interaction.reply({
                content: 'このゲームは既に終了しているか、存在しません。',
                ephemeral: true
            });
            return;
        }

        const isChallenger = interaction.user.id === challengerId;
        const isOpponent = interaction.user.id === opponentId;

        if (!isChallenger && !isOpponent) {
            await interaction.reply({
                content: 'このじゃんけんの参加者ではありません。',
                ephemeral: true
            });
            return;
        }

        // 既に手を選んでいる場合
        if ((isChallenger && gameState.challengerHand) || (isOpponent && gameState.opponentHand)) {
            await interaction.reply({
                content: '既に手を選択しています。相手の選択をお待ちください。',
                ephemeral: true
            });
            return;
        }

        // 手を記録
        if (isChallenger) {
            gameState.challengerHand = hand;
        } else {
            gameState.opponentHand = hand;
        }

        await interaction.reply({
            content: `${HANDS[hand].emoji} を選択しました。相手の選択をお待ちください。`,
            ephemeral: true
        });

        // 両者が手を選んだ場合、結果を表示
        if (gameState.challengerHand && gameState.opponentHand) {
            const challenger = await interaction.client.users.fetch(challengerId);
            const opponent = await interaction.client.users.fetch(opponentId);

            const challengerEmoji = HANDS[gameState.challengerHand].emoji;
            const opponentEmoji = HANDS[gameState.opponentHand].emoji;

            let result;
            if (gameState.challengerHand === gameState.opponentHand) {
                result = {
                    text: 'あいこ！',
                    color: '#FFFF00'
                };
            } else if (HANDS[gameState.challengerHand].beats === gameState.opponentHand) {
                result = {
                    text: `${challenger.username}の勝ち！`,
                    color: '#00FF00'
                };
            } else {
                result = {
                    text: `${opponent.username}の勝ち！`,
                    color: '#00FF00'
                };
            }

            const embed = new EmbedBuilder()
                .setTitle('じゃんけんの結果')
                .setDescription(
                    `${challenger}: ${challengerEmoji}\n` +
                    `${opponent}: ${opponentEmoji}\n\n` +
                    `**${result.text}**`
                )
                .setColor(result.color)
                .setTimestamp();

            // もう一度遊ぶボタンを作成
            const playAgainButton = new ButtonBuilder()
                .setCustomId(`janken-again-${challengerId}-${opponentId}`)
                .setLabel('もう一度遊ぶ')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(playAgainButton);

            await interaction.message.edit({
                embeds: [embed],
                components: [row]
            });

            // ゲーム状態をクリア
            this.gameStates.delete(interaction.message.id);
        }
    },

    // 「もう一度遊ぶ」ボタンのハンドラー
    async handlePlayAgain(interaction) {
        if (!interaction.isButton()) return;

        const [, , challengerId, opponentId] = interaction.customId.split('-');

        // 参加者以外のクリックを防ぐ
        if (interaction.user.id !== challengerId && interaction.user.id !== opponentId) {
            await interaction.reply({
                content: 'このじゃんけんの参加者ではありません。',
                ephemeral: true
            });
            return;
        }

        // 新しいゲーム状態を作成
        const gameState = {
            challenger: challengerId,
            opponent: opponentId,
            challengerHand: null,
            opponentHand: null,
            timestamp: Date.now() // タイムスタンプを追加
        };

        // ボタンを作成
        const buttons = Object.entries(HANDS).map(([key, value]) => {
            return new ButtonBuilder()
                .setCustomId(`janken-${challengerId}-${opponentId}-${key}`)
                .setEmoji(value.emoji)
                .setLabel(value.name)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        const challenger = await interaction.client.users.fetch(challengerId);
        const opponent = await interaction.client.users.fetch(opponentId);

        const embed = new EmbedBuilder()
            .setTitle('✨ じゃんけん対戦 ✨')
            .setDescription(`${challenger} vs ${opponent}\n\n` +
                `両プレイヤーは下のボタンから手を選んでください。\n` +
                `選んだ手は相手には見えません。`)
            .setColor('#FF69B4')
            .setTimestamp();

        const message = await interaction.update({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // 新しいゲーム状態を保存
        this.gameStates.set(message.id, gameState);

        // 1分後にゲームを終了
        setTimeout(() => {
            if (this.gameStates.has(message.id)) {
                const game = this.gameStates.get(message.id);
                if (!game.challengerHand || !game.opponentHand) {
                    const embed = new EmbedBuilder()
                        .setTitle('じゃんけんタイムアウト')
                        .setDescription('1分以内に両プレイヤーが手を選択しなかったため、ゲームを終了しました。')
                        .setColor('#FF0000')
                        .setTimestamp();

                    interaction.editReply({
                        embeds: [embed],
                        components: []
                    }).catch(console.error);
                    this.gameStates.delete(message.id);
                }
            }
        }, 60000);
    }
};
