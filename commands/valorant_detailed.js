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

// エージェント名の日本語変換
const agentNameTranslation = {
    'Jett': 'ジェット',
    'Reyna': 'レイナ',
    'Raze': 'レイズ',
    'Phoenix': 'フェニックス',
    'Yoru': 'ヨル',
    'Neon': 'ネオン',
    'Iso': 'イソ',
    'Sova': 'ソーヴァ',
    'Breach': 'ブリーチ',
    'Skye': 'スカイ',
    'KAY/O': 'ケイオー',
    'Fade': 'フェイド',
    'Gekko': 'ゲッコー',
    'Sage': 'セージ',
    'Cypher': 'サイファー',
    'Killjoy': 'キルジョイ',
    'Chamber': 'チェンバー',
    'Deadlock': 'デッドロック',
    'Omen': 'オーメン',
    'Brimstone': 'ブリムストーン',
    'Viper': 'ヴァイパー',
    'Astra': 'アストラ',
    'Harbor': 'ハーバー',
    'Clove': 'クローブ',
    'Vyse': 'ヴァイス'
};

// マップ名の日本語変換
const mapNameTranslation = {
    'Bind': 'バインド',
    'Haven': 'ヘイヴン',
    'Split': 'スプリット',
    'Ascent': 'アセント',
    'Dust2': 'ダスト2',
    'Breeze': 'ブリーズ',
    'Fracture': 'フラクチャー',
    'Icebox': 'アイスボックス',
    'Pearl': 'パール',
    'Lotus': 'ロータス',
    'Sunset': 'サンセット',
    'Abyss': 'アビス'
};

// ダメージ分析関数
function analyzeDamageStats(matches, username, tag) {
    let totalDamage = 0;
    let totalRounds = 0;
    let damagePerRound = [];
    let bodyDamage = 0;
    let legDamage = 0;
    let headDamage = 0;
    let matchCount = 0;

    matches.forEach(match => {
        const playerStats = match.players?.all_players?.find(p => 
            p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
        );
        
        if (playerStats && playerStats.stats) {
            const damage = playerStats.stats.damage || 0;
            totalDamage += damage;
            totalRounds += match.rounds?.length || 0;
            
            if (damage > 0 && match.rounds?.length > 0) {
                damagePerRound.push(damage / match.rounds.length);
            }
            
            // ダメージ内訳（利用可能な場合）
            bodyDamage += playerStats.stats.bodyshots || 0;
            legDamage += playerStats.stats.legshots || 0;
            headDamage += playerStats.stats.headshots || 0;
            
            matchCount++;
        }
    });

    const avgDamagePerRound = damagePerRound.length > 0 
        ? (damagePerRound.reduce((sum, dmg) => sum + dmg, 0) / damagePerRound.length).toFixed(1)
        : 'N/A';

    return {
        totalDamage,
        avgDamagePerRound,
        avgDamagePerMatch: matchCount > 0 ? (totalDamage / matchCount).toFixed(0) : 'N/A',
        bodyDamage,
        legDamage,
        headDamage
    };
}

// エージェント使用率分析
function analyzeAgentUsage(matches, username, tag) {
    const agentCount = {};
    let totalMatches = 0;

    matches.forEach(match => {
        const playerStats = match.players?.all_players?.find(p => 
            p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
        );
        
        if (playerStats && playerStats.character) {
            const agent = playerStats.character;
            agentCount[agent] = (agentCount[agent] || 0) + 1;
            totalMatches++;
        }
    });

    // 使用率順にソート
    const sortedAgents = Object.entries(agentCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5) // TOP5
        .map(([agent, count]) => ({
            agent: agentNameTranslation[agent] || agent,
            count,
            percentage: ((count / totalMatches) * 100).toFixed(1)
        }));

    return sortedAgents;
}

// マップ統計分析
function analyzeMapStats(matches, username, tag) {
    const mapStats = {};

    matches.forEach(match => {
        const playerStats = match.players?.all_players?.find(p => 
            p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
        );
        
        if (playerStats && match.metadata?.map) {
            const mapName = match.metadata.map;
            if (!mapStats[mapName]) {
                mapStats[mapName] = { wins: 0, losses: 0, total: 0 };
            }
            
            mapStats[mapName].total++;
            
            const playerTeam = playerStats.team;
            if (match.teams && match.teams[playerTeam] && match.teams[playerTeam].has_won) {
                mapStats[mapName].wins++;
            } else {
                mapStats[mapName].losses++;
            }
        }
    });

    // 勝率順にソート
    const sortedMaps = Object.entries(mapStats)
        .filter(([, stats]) => stats.total >= 2) // 2試合以上プレイしたマップのみ
        .sort(([,a], [,b]) => (b.wins/b.total) - (a.wins/a.total))
        .slice(0, 5)
        .map(([mapName, stats]) => ({
            map: mapNameTranslation[mapName] || mapName,
            wins: stats.wins,
            losses: stats.losses,
            total: stats.total,
            winRate: ((stats.wins / stats.total) * 100).toFixed(1)
        }));

    return sortedMaps;
}

// エコノミー統計分析
function analyzeEconomyStats(matches, username, tag) {
    let totalCreditsSpent = 0;
    let totalCreditsRemaining = 0;
    let matchesWithEconData = 0;
    let avgLoadout = 0;

    matches.forEach(match => {
        const playerStats = match.players?.all_players?.find(p => 
            p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
        );
        
        if (playerStats && playerStats.economy) {
            totalCreditsSpent += playerStats.economy.spent || 0;
            totalCreditsRemaining += playerStats.economy.loadout_value || 0;
            avgLoadout += playerStats.economy.loadout_value || 0;
            matchesWithEconData++;
        }
    });

    return {
        avgCreditsSpent: matchesWithEconData > 0 ? (totalCreditsSpent / matchesWithEconData).toFixed(0) : 'N/A',
        avgLoadoutValue: matchesWithEconData > 0 ? (avgLoadout / matchesWithEconData).toFixed(0) : 'N/A',
        hasEconData: matchesWithEconData > 0
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('valorant-detailed')
        .setDescription('詳細なValorant統計情報を表示します')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('他のユーザーの詳細統計を確認（省略可）')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('matches')
                .setDescription('分析する試合数（デフォルト: 10、最大: 20）')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(20)),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const matchCount = interaction.options.getInteger('matches') || 10;
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

            // 詳細な試合データを取得
            const matchesResponse = await axios.get(
                `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${username}/${tag}?size=${matchCount}`, 
                { headers }
            );

            if (!matchesResponse.data.data || matchesResponse.data.data.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setTitle('❌ データ不足')
                    .setDescription('分析に十分な試合データが見つかりませんでした。')
                    .setColor('#FF9900')
                    .addFields(
                        { name: 'アカウント', value: `${username}#${tag}`, inline: true },
                        { name: '地域', value: region.toUpperCase(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [noDataEmbed] });
                return;
            }

            const matches = matchesResponse.data.data;

            // 各種統計分析
            const damageStats = analyzeDamageStats(matches, username, tag);
            const agentUsage = analyzeAgentUsage(matches, username, tag);
            const mapStats = analyzeMapStats(matches, username, tag);
            const economyStats = analyzeEconomyStats(matches, username, tag);

            // 総合スコア分析
            let totalScore = 0;
            let totalCombatScore = 0;
            let matchesAnalyzed = 0;
            let firstKills = 0;
            let firstDeaths = 0;
            let clutchesWon = 0;
            let multikills = { double: 0, triple: 0, quadra: 0, ace: 0 };

            matches.forEach(match => {
                const playerStats = match.players?.all_players?.find(p => 
                    p.name.toLowerCase() === username.toLowerCase() && p.tag === tag
                );
                
                if (playerStats && playerStats.stats) {
                    totalScore += playerStats.stats.score || 0;
                    totalCombatScore += playerStats.stats.damage || 0;
                    firstKills += playerStats.stats.first_bloods || 0;
                    firstDeaths += playerStats.stats.first_deaths || 0;
                    
                    // マルチキル分析（利用可能な場合）
                    if (playerStats.stats.kills >= 5) multikills.ace++;
                    else if (playerStats.stats.kills >= 4) multikills.quadra++;
                    else if (playerStats.stats.kills >= 3) multikills.triple++;
                    else if (playerStats.stats.kills >= 2) multikills.double++;
                    
                    matchesAnalyzed++;
                }
            });

            const avgScore = matchesAnalyzed > 0 ? (totalScore / matchesAnalyzed).toFixed(0) : 'N/A';
            const firstKillRatio = (firstKills + firstDeaths) > 0 
                ? ((firstKills / (firstKills + firstDeaths)) * 100).toFixed(1) 
                : 'N/A';

            // メインEmbed
            const mainEmbed = new EmbedBuilder()
                .setTitle(`📊 ${targetUser.displayName} の詳細統計`)
                .setDescription(`**${username}#${tag}** | 直近${matchesAnalyzed}試合の分析`)
                .setColor('#9F7AEA')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: '🎯 パフォーマンス指標',
                        value: `**平均スコア:** ${avgScore}\n**平均ADR:** ${damageStats.avgDamagePerRound}\n**ファーストキル率:** ${firstKillRatio}%`,
                        inline: true
                    },
                    {
                        name: '💥 ダメージ統計',
                        value: `**総ダメージ:** ${damageStats.totalDamage.toLocaleString()}\n**試合平均:** ${damageStats.avgDamagePerMatch}\n**ラウンド平均:** ${damageStats.avgDamagePerRound}`,
                        inline: true
                    },
                    {
                        name: '🔥 マルチキル記録',
                        value: `**ダブルキル:** ${multikills.double}回\n**トリプルキル:** ${multikills.triple}回\n**クアドラキル:** ${multikills.quadra}回\n**エース:** ${multikills.ace}回`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `分析期間: 直近${matchesAnalyzed}試合 | ${new Date().toLocaleString('ja-JP')}`,
                    iconURL: 'https://media.valorant-api.com/gamemodes/96bd3920-4f36-d026-2b28-c683eb0bcac5/displayicon.png'
                })
                .setTimestamp();

            // エージェント使用率Embed
            const agentEmbed = new EmbedBuilder()
                .setTitle('🤖 エージェント使用統計')
                .setColor('#4ECDC4')
                .setDescription(
                    agentUsage.length > 0 
                        ? agentUsage.map((agent, index) => 
                            `**${index + 1}.** ${agent.agent} - ${agent.count}試合 (${agent.percentage}%)`
                          ).join('\n')
                        : 'データ不足'
                )
                .setTimestamp();

            // マップ統計Embed
            const mapEmbed = new EmbedBuilder()
                .setTitle('🗺️ マップ別統計')
                .setColor('#FF6B6B')
                .setDescription(
                    mapStats.length > 0
                        ? mapStats.map((map, index) => 
                            `**${index + 1}.** ${map.map} - ${map.wins}勝${map.losses}敗 (勝率${map.winRate}%)`
                          ).join('\n')
                        : '十分なデータがありません（各マップ2試合以上必要）'
                )
                .setTimestamp();

            // エコノミー統計Embed（データがある場合のみ）
            const embeds = [mainEmbed, agentEmbed, mapEmbed];
            
            if (economyStats.hasEconData) {
                const economyEmbed = new EmbedBuilder()
                    .setTitle('💰 エコノミー統計')
                    .setColor('#FFD93D')
                    .addFields(
                        { name: '平均支出', value: `${economyStats.avgCreditsSpent} クレジット`, inline: true },
                        { name: '平均装備価値', value: `${economyStats.avgLoadoutValue} クレジット`, inline: true }
                    )
                    .setTimestamp();
                
                embeds.push(economyEmbed);
            }

            await interaction.editReply({ embeds });

        } catch (error) {
            console.error('Valorant detailed command error:', error);
            
            let errorMessage = '❌ 詳細統計の取得中にエラーが発生しました。';
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
                .addFields(
                    { name: 'エラー詳細', value: error.message || '不明なエラー', inline: false }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};