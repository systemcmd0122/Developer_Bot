const { EmbedBuilder } = require('discord.js');
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

// ランク情報を取得する関数
async function getRankInfo(userAccount) {
    const { username, tag, region } = userAccount;
    
    const headers = {
        'accept': 'application/json',
        'Authorization': process.env.VALORANT_API_KEY || process.env.API_KEY
    };

    try {
        const rankResponse = await axios.get(
            `https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${username}/${tag}`, 
            { headers }
        );

        if (rankResponse.status === 200 && rankResponse.data.data) {
            const rankData = rankResponse.data.data;
            return {
                currentRank: rankData.current_data?.currenttierpatched || 'Unranked',
                rr: rankData.current_data?.ranking_in_tier || 0,
                rankImage: rankData.current_data?.images?.small || '',
                highestRank: rankData.highest_rank?.patched_tier || 'N/A'
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching rank info:', error);
        return null;
    }
}

// メッセージハンドラー
async function handleRankMessage(message) {
    // ボットのメッセージは無視
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

    // ランク関連のキーワードをチェック
    const rankKeywords = [
        'マイランク',
    ];

    const shouldShowRank = rankKeywords.some(keyword => content.includes(keyword));
    
    if (!shouldShowRank) return;

    try {
        const userData = loadUserData();
        
        if (!userData[userId]) {
            // 登録されていない場合は何もしない（スパムを避けるため）
            return;
        }

        const userAccount = userData[userId];
        const rankInfo = await getRankInfo(userAccount);

        if (!rankInfo) {
            // データ取得に失敗した場合は何もしない
            return;
        }

        // 簡潔なランク情報を表示
        const embed = new EmbedBuilder()
            .setTitle(`🎯 ${message.author.displayName} のランク`)
            .setDescription(`**${userAccount.username}#${userAccount.tag}**`)
            .setColor('#FF4655')
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { 
                    name: '🏆 現在のランク', 
                    value: `**${rankInfo.currentRank}**\n${rankInfo.rr} RR`, 
                    inline: true 
                },
                {
                    name: '⭐ 最高ランク',
                    value: `**${rankInfo.highestRank}**`,
                    inline: true
                },
                {
                    name: '🌍 地域',
                    value: `**${userAccount.region.toUpperCase()}**`,
                    inline: true
                }
            )
            .setFooter({ 
                text: '詳細情報は /myrank コマンドをご利用ください',
                iconURL: 'https://media.valorant-api.com/gamemodes/96bd3920-4f36-d026-2b28-c683eb0bcac5/displayicon.png'
            })
            .setTimestamp();

        // ランクアイコンを画像として表示
        if (rankInfo.rankImage) {
            embed.setImage(rankInfo.rankImage);
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in rank message handler:', error);
        // エラーが発生した場合は何もしない（スパムを避けるため）
    }
}

module.exports = {
    handleRankMessage,
    getRankInfo,
    loadUserData
};