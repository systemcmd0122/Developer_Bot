// commands/valorant.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('valorant')
        .setDescription('VALORANTのプレイヤー情報を表示します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('プレイヤーの統計情報を表示します')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Riot ID (例: player#NA1)')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('matches')
                .setDescription('最近の試合履歴を表示します')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Riot ID (例: player#NA1)')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('表示する試合数 (最大5)')
                        .setMinValue(1)
                        .setMaxValue(5))
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const username = interaction.options.getString('username');
        const [name, tag] = username.split('#');

        if (!tag) {
            return await interaction.editReply('Riot IDの形式が正しくありません。(例: player#NA1)');
        }

        try {
            if (subcommand === 'stats') {
                await handleStats(interaction, name, tag);
            } else if (subcommand === 'matches') {
                const count = interaction.options.getInteger('count') || 3;
                await handleMatches(interaction, name, tag, count);
            }
        } catch (error) {
            console.error('Error in valorant command:', error);
            await interaction.editReply('プレイヤー情報の取得中にエラーが発生しました。');
        }
    }
};

async function handleStats(interaction, name, tag) {
    try {
        // VALORANTのAPIエンドポイント
        const accountResponse = await axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`);
        const mmrResponse = await axios.get(`https://api.henrikdev.xyz/valorant/v1/mmr/ap/${name}/${tag}`);

        const account = accountResponse.data.data;
        const mmr = mmrResponse.data.data;

        const embed = new EmbedBuilder()
            .setColor('#FF4654')
            .setTitle(`${account.name}#${account.tag}のプロフィール`)
            .setThumbnail(account.card.small)
            .addFields(
                { name: 'アカウントレベル', value: account.account_level.toString(), inline: true },
                { name: '現在のランク', value: mmr.currenttierpatched || '未確認', inline: true },
                { name: 'ランクレーティング', value: mmr.ranking_in_tier ? `${mmr.ranking_in_tier}/100` : '未確認', inline: true },
                { name: '最近の変動', value: mmr.mmr_change_to_last_game ? `${mmr.mmr_change_to_last_game > 0 ? '+' : ''}${mmr.mmr_change_to_last_game}` : '未確認', inline: true }
            )
            .setFooter({ text: '※ ランク情報は最新の競争モードの試合結果を反映しています' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        throw error;
    }
}

async function handleMatches(interaction, name, tag, count) {
    try {
        const response = await axios.get(`https://api.henrikdev.xyz/valorant/v3/matches/ap/${name}/${tag}?filter=competitive`);
        const matches = response.data.data.slice(0, count);

        const embed = new EmbedBuilder()
            .setColor('#FF4654')
            .setTitle(`${name}#${tag}の最近の試合`)
            .setDescription(`最近の${count}試合の結果:`);

        for (const match of matches) {
            const playerData = match.players.all_players.find(p => 
                p.name.toLowerCase() === name.toLowerCase() && 
                p.tag.toLowerCase() === tag.toLowerCase()
            );

            if (playerData) {
                const result = playerData.team.toLowerCase() === match.teams.red.has_won ? '勝利' : '敗北';
                const kda = `${playerData.stats.kills}/${playerData.stats.deaths}/${playerData.stats.assists}`;
                const score = `${match.teams.red.rounds_won} - ${match.teams.blue.rounds_won}`;
                const agent = playerData.character;
                const map = match.metadata.map;

                embed.addFields({
                    name: `${map} - ${result}`,
                    value: `エージェント: ${agent}\nKDA: ${kda}\nスコア: ${score}\nプレイ日時: <t:${Math.floor(new Date(match.metadata.game_start).getTime() / 1000)}:R>`,
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        throw error;
    }
}