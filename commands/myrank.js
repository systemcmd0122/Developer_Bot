const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// データファイルのパス
const VALORANT_DATA_FILE = path.join(__dirname, '..', 'data', 'valorant_users.json');

// ユーザーデータの読み込み
function loadUserData() {
    try {
        if (!fs.existsSync(VALORANT_DATA_FILE)) {
            return {};
        }
        const data = fs.readFileSync(VALORANT_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading user data:', error);
        return {};
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrank')
        .setDescription('登録済みのValorantアカウントのランク情報を表示します')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('他のユーザーのランクを確認（省略可）')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;

        try {
            // ユーザーデータの読み込み
            const userData = loadUserData();
            
            if (!userData[userId]) {
                const notRegisteredEmbed = new EmbedBuilder()
                    .setTitle('❌ アカウント未登録')
                    .setDescription(
                        targetUser.id === interaction.user.id 
                            ? 'Valorantアカウントが登録されていません。\n`/register-valorant` コマンドでアカウントを登録してください。'
                            : `<@${userId}>はValorantアカウントを登録していません。`
                    )
                    .setColor('#FF9900')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.editReply({ embeds: [notRegisteredEmbed] });
                return;
            }

            const userAccount = userData[userId];
            const { username, tag, region } = userAccount;

            const headers = {
                'accept': 'application/json',
                'Authorization': process.env.VALORANT_API_KEY || process.env.API_KEY
            };

            // 各種データを並列で取得（元のvalorantコマンドと同じロジック）
            const [rankResponse, lifetimeResponse, playerCardResponse, matchesResponse] = await Promise.allSettled([
                axios.get(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v1/lifetime/mmr-history/${region}/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${username}/${tag}`, { headers })
            ]);

            // ランクデータの処理
            if (rankResponse.status !== 'fulfilled' || !rankResponse.value.data.data) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ データ取得失敗')
                    .setDescription('ランク情報を取得できませんでした。しばらく時間をおいてから再試行してください。')
                    .setColor('#FF0000')
                    .addFields(
                        { name: '登録アカウント', value: `${username}#${tag}`, inline: true },
                        { name: '地域', value: region.toUpperCase(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            const rankData = rankResponse.value.data.data;
            const playerCardData = playerCardResponse.status === 'fulfilled' ? playerCardResponse.value.data.data : null;
            const matchesData = matchesResponse.status === 'fulfilled' ? matchesResponse.value.data.data : [];

            // 現在のランク情報
            const currentRank = rankData.current_data?.currenttierpatched || 'Unranked';
            const currentRankImage = rankData.current_data?.images?.small || '';
            const currentElo = rankData.current_data?.elo || 0;
            const rr = rankData.current_data?.ranking_in_tier || 0;
            
            // 最高ランク情報
            const highestRank = rankData.highest_rank?.patched_tier || 'N/A';
            const highestRankImage = rankData.highest_rank?.tier 
                ? `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${rankData.highest_rank.tier}/smallicon.png`
                : '';

            // 最近の試合統計を計算
            let stats = {
                kills: 0,
                deaths: 0,
                assists: 0,
                wins: 0,
                matches: 0,
                headshots: 0,
                bodyshots: 0
            };

            if (matchesData && matchesData.length > 0) {
                matchesData.slice(0, 5).forEach(match => {
                    const playerStats = match.players?.all_players?.find(p => 
                        p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
                    );
                    
                    if (playerStats) {
                        stats.kills += playerStats.stats?.kills || 0;
                        stats.deaths += playerStats.stats?.deaths || 0;
                        stats.assists += playerStats.stats?.assists || 0;
                        stats.headshots += playerStats.stats?.headshots || 0;
                        stats.bodyshots += playerStats.stats?.bodyshots || 0;
                        stats.matches++;
                        
                        const playerTeam = playerStats.team;
                        if (match.teams && match.teams[playerTeam] && match.teams[playerTeam].has_won) {
                            stats.wins++;
                        }
                    }
                });
            }

            const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : 'N/A';
            const winRate = stats.matches > 0 ? ((stats.wins / stats.matches) * 100).toFixed(1) : 'N/A';
            const headshotRate = (stats.headshots + stats.bodyshots) > 0 
                ? ((stats.headshots / (stats.headshots + stats.bodyshots)) * 100).toFixed(1) 
                : 'N/A';

            // Embedの作成
            const embed = new EmbedBuilder()
                .setTitle(`🎯 ${targetUser.displayName} のヴァロラント情報`)
                .setDescription(`**${username}#${tag}**`)
                .setColor('#FF4655')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🏆 現在のランク', 
                        value: `**${currentRank}**\n${rr} RR`, 
                        inline: true 
                    },
                    {
                        name: '⭐ 最高ランク',
                        value: `**${highestRank}**`,
                        inline: true
                    },
                    {
                        name: '📊 直近5試合の統計',
                        value: `**K/D:** ${kd}\n**勝率:** ${winRate}%\n**HS率:** ${headshotRate}%`,
                        inline: true
                    },
                    {
                        name: '📅 アカウント情報',
                        value: `**登録日:** <t:${Math.floor(new Date(userAccount.registeredAt).getTime() / 1000)}:d>\n**地域:** ${region.toUpperCase()}`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `取得日時: ${new Date().toLocaleString('ja-JP')}`,
                    iconURL: 'https://media.valorant-api.com/gamemodes/96bd3920-4f36-d026-2b28-c683eb0bcac5/displayicon.png'
                })
                .setTimestamp();

            // ランクアイコンを画像として表示
            if (currentRankImage) {
                embed.setImage(currentRankImage);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('MyRank command error:', error);
            
            let errorMessage = '❌ エラーが発生しました。';
            if (error.response?.status === 404) {
                errorMessage = '❌ プレイヤーが見つかりませんでした。アカウント情報を再登録してください。';
            } else if (error.response?.status === 429) {
                errorMessage = '❌ APIの利用制限に達しました。しばらく時間をおいてから再試行してください。';
            } else if (error.response?.status === 403) {
                errorMessage = '❌ APIキーが無効です。管理者に連絡してください。';
            }

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ エラー')
                .setDescription(errorMessage)
                .setColor('#FF0000')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
