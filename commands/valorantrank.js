const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('valorant')
        .setDescription('ヴァロラントのプレイヤー情報を表示します')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('プレイヤー名（例: PlayerName）')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('プレイヤータグ（例: 1234）')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('region')
                .setDescription('地域を選択してください')
                .setRequired(false)
                .addChoices(
                    { name: 'アジア太平洋 (AP)', value: 'ap' },
                    { name: 'ブラジル (BR)', value: 'br' },
                    { name: 'ヨーロッパ (EU)', value: 'eu' },
                    { name: '韓国 (KR)', value: 'kr' },
                    { name: 'ラテンアメリカ (LATAM)', value: 'latam' },
                    { name: '北アメリカ (NA)', value: 'na' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const tag = interaction.options.getString('tag');
        let region = interaction.options.getString('region');
        
        try {
            const headers = {
                'accept': 'application/json',
                'Authorization': process.env.VALORANT_API_KEY || process.env.API_KEY
            };

            // まずアカウント情報を取得して地域を確認
            if (!region) {
                const accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`;
                const accountResponse = await axios.get(accountUrl, { headers });
                
                if (accountResponse.status !== 200 || !accountResponse.data.data) {
                    await interaction.editReply('❌ プレイヤーが見つかりませんでした。ユーザー名とタグを確認してください。');
                    return;
                }
                
                region = accountResponse.data.data.region;
            }

            // 各種データを並列で取得
            const [rankResponse, lifetimeResponse, playerCardResponse, matchesResponse] = await Promise.allSettled([
                axios.get(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v1/lifetime/mmr-history/${region}/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`, { headers }),
                axios.get(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${username}/${tag}`, { headers })
            ]);

            // ランクデータの処理
            if (rankResponse.status !== 'fulfilled' || !rankResponse.value.data.data) {
                await interaction.editReply('❌ ランク情報を取得できませんでした。');
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
                .setTitle(`🎯 ${username}#${tag} のヴァロラント情報`)
                .setColor('#FF4655')
                .setThumbnail(playerCardData?.card?.small || currentRankImage || 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png')
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
                    }
                )
                .setFooter({ 
                    text: `地域: ${region.toUpperCase()} | 取得日時: ${new Date().toLocaleString('ja-JP')}`,
                    iconURL: 'https://media.valorant-api.com/gamemodes/96bd3920-4f36-d026-2b28-c683eb0bcac5/displayicon.png'
                })
                .setTimestamp();

            // ランクアイコンを画像として表示
            if (currentRankImage) {
                embed.setImage(currentRankImage);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Valorant command error:', error);
            
            let errorMessage = '❌ エラーが発生しました。';
            if (error.response?.status === 404) {
                errorMessage = '❌ プレイヤーが見つかりませんでした。ユーザー名とタグを確認してください。';
            } else if (error.response?.status === 429) {
                errorMessage = '❌ APIの利用制限に達しました。しばらく時間をおいてから再試行してください。';
            } else if (error.response?.status === 403) {
                errorMessage = '❌ APIキーが無効です。管理者に連絡してください。';
            }
            
            await interaction.editReply(errorMessage);
        }
    }
};
