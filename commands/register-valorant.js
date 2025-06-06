const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// データファイルのパス
const DATA_DIR = path.join(__dirname, '..', 'data');
const VALORANT_DATA_FILE = path.join(DATA_DIR, 'valorant_users.json');

// データディレクトリとファイルの初期化
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(VALORANT_DATA_FILE)) {
    fs.writeFileSync(VALORANT_DATA_FILE, JSON.stringify({}, null, 2));
}

// ユーザーデータの読み書き関数
function loadUserData() {
    try {
        const data = fs.readFileSync(VALORANT_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading user data:', error);
        return {};
    }
}

function saveUserData(data) {
    try {
        fs.writeFileSync(VALORANT_DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user data:', error);
        return false;
    }
}

// アカウントの検証
async function validateAccount(username, tag, region) {
    try {
        const headers = {
            'accept': 'application/json',
            'Authorization': process.env.VALORANT_API_KEY || process.env.API_KEY
        };

        const accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`;
        const response = await axios.get(accountUrl, { headers });
        
        if (response.status === 200 && response.data.data) {
            return {
                valid: true,
                region: response.data.data.region || region,
                puuid: response.data.data.puuid,
                card: response.data.data.card
            };
        }
        return { valid: false };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register-valorant')
        .setDescription('Valorantアカウントを登録します')
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
                .setDescription('地域を選択してください（未指定の場合は自動検出）')
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
        const region = interaction.options.getString('region');
        const userId = interaction.user.id;

        try {
            // アカウントの検証
            const validation = await validateAccount(username, tag, region);
            
            if (!validation.valid) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ アカウント登録失敗')
                    .setDescription('指定されたValorantアカウントが見つかりませんでした。\nユーザー名とタグを確認してください。')
                    .setColor('#FF0000')
                    .addFields(
                        { name: '入力されたアカウント', value: `${username}#${tag}`, inline: true },
                        { name: '指定地域', value: region || '自動検出', inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            // ユーザーデータの読み込み
            const userData = loadUserData();

            // ユーザーデータの登録/更新
            userData[userId] = {
                username: username,
                tag: tag,
                region: validation.region,
                puuid: validation.puuid,
                card: validation.card,
                registeredAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                discordTag: interaction.user.tag
            };

            // データの保存
            if (!saveUserData(userData)) {
                throw new Error('データの保存に失敗しました');
            }

            // 成功メッセージ
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Valorantアカウント登録完了')
                .setDescription(`<@${userId}>のValorantアカウントが正常に登録されました！`)
                .setColor('#00FF00')
                .addFields(
                    { name: '登録されたアカウント', value: `**${username}#${tag}**`, inline: true },
                    { name: '地域', value: `**${validation.region.toUpperCase()}**`, inline: true },
                    { name: '登録日時', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setThumbnail(validation.card?.small || 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png')
                .setFooter({ 
                    text: '今後は /myrank コマンドで簡単にランク情報を確認できます！',
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Register valorant command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ エラーが発生しました')
                .setDescription('アカウントの登録処理中にエラーが発生しました。')
                .setColor('#FF0000')
                .addFields(
                    { name: 'エラー詳細', value: error.message || '不明なエラー', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};