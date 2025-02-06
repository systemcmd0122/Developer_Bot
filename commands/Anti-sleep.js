const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');

// アンチスリープの状態を保存するMap
const antiSleepStates = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antisleep')
        .setDescription('寝落ち防止機能を管理します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('寝落ち防止を開始します')
                .addIntegerOption(option =>
                    option
                        .setName('interval')
                        .setDescription('音声を再生する間隔（分）')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('寝落ち防止を停止します')),

    async execute(interaction) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({
                content: 'この機能を使用するには、ボイスチャンネルに接続している必要があります。',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            // 既に実行中の場合は停止
            if (antiSleepStates.has(interaction.member.id)) {
                this.stopAntiSleep(interaction.member.id);
            }

            const interval = interaction.options.getInteger('interval') || 5; // デフォルトは5分
            await this.startAntiSleep(interaction);
            
            await interaction.reply({
                content: `寝落ち防止機能を開始しました。\n間隔: ${interval}分\n\n⚠️ 注意:\n- 定期的に音声が再生されます\n- 音量注意\n- /antisleep stop で停止できます`,
                ephemeral: true
            });
        } else if (subcommand === 'stop') {
            if (!antiSleepStates.has(interaction.member.id)) {
                return interaction.reply({
                    content: '寝落ち防止機能は既に停止しています。',
                    ephemeral: true
                });
            }

            this.stopAntiSleep(interaction.member.id);
            await interaction.reply({
                content: '寝落ち防止機能を停止しました。',
                ephemeral: true
            });
        }
    },

    async startAntiSleep(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        const interval = interaction.options.getInteger('interval') || 5;

        // ボイスチャンネルに接続
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        // オーディオプレイヤーを作成
        const player = createAudioPlayer();
        connection.subscribe(player);

        // 音声ファイルのパスを設定
        const soundFile = path.join(__dirname, '..', 'assets', 'alert.mp3');

        // 定期実行の設定
        const intervalId = setInterval(() => {
            // メンバーがまだボイスチャンネルにいるか確認
            if (!member.voice.channel) {
                this.stopAntiSleep(member.id);
                return;
            }

            // 音声を再生
            const resource = createAudioResource(soundFile);
            player.play(resource);

            // ステータス変更をログに記録
            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`Playing anti-sleep alert for ${member.user.tag}`);
            });

            player.on('error', error => {
                console.error(`Error playing anti-sleep alert: ${error.message}`);
            });
        }, interval * 60 * 1000); // 分をミリ秒に変換

        // 状態を保存
        antiSleepStates.set(member.id, {
            connection,
            player,
            intervalId,
            channelId: voiceChannel.id
        });
    },

    stopAntiSleep(memberId) {
        const state = antiSleepStates.get(memberId);
        if (state) {
            clearInterval(state.intervalId);
            state.connection.destroy();
            state.player.stop();
            antiSleepStates.delete(memberId);
        }
    }
};