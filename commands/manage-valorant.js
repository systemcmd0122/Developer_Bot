const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// データファイルのパス
const VALORANT_DATA_FILE = path.join(__dirname, '..', 'data', 'valorant_users.json');

// ユーザーデータの読み書き関数
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

function saveUserData(data) {
    try {
        fs.writeFileSync(VALORANT_DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user data:', error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-valorant')
        .setDescription('Valorantアカウント情報を管理します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('登録済みのアカウント情報を確認'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('登録済みのアカウント情報を削除'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('サーバー内の登録済みユーザー一覧を表示（管理者のみ）')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            const userData = loadUserData();

            if (subcommand === 'info') {
                if (!userData[userId]) {
                    const notRegisteredEmbed = new EmbedBuilder()
                        .setTitle('❌ アカウント未登録')
                        .setDescription('Valorantアカウントが登録されていません。\n`/register-valorant` コマンドでアカウントを登録してください。')
                        .setColor('#FF9900')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [notRegisteredEmbed] });
                    return;
                }

                const userAccount = userData[userId];
                const infoEmbed = new EmbedBuilder()
                    .setTitle('📋 登録済みアカウント情報')
                    .setColor('#0099FF')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: 'Valorantアカウント', value: `**${userAccount.username}#${userAccount.tag}**`, inline: false },
                        { name: '地域', value: `**${userAccount.region.toUpperCase()}**`, inline: true },
                        { name: 'Discordアカウント', value: `**${userAccount.discordTag}**`, inline: true },
                        { name: '登録日時', value: `<t:${Math.floor(new Date(userAccount.registeredAt).getTime() / 1000)}:F>`, inline: false },
                        { name: '最終更新', value: `<t:${Math.floor(new Date(userAccount.lastUpdated).getTime() / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ 
                        text: 'アカウント情報を更新する場合は、再度 /register-valorant を実行してください',
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [infoEmbed] });

            } else if (subcommand === 'delete') {
                if (!userData[userId]) {
                    const notRegisteredEmbed = new EmbedBuilder()
                        .setTitle('❌ アカウント未登録')
                        .setDescription('削除するValorantアカウントが登録されていません。')
                        .setColor('#FF9900')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [notRegisteredEmbed] });
                    return;
                }

                const userAccount = userData[userId];
                delete userData[userId];

                if (!saveUserData(userData)) {
                    throw new Error('データの保存に失敗しました');
                }

                const deleteEmbed = new EmbedBuilder()
                    .setTitle('🗑️ アカウント削除完了')
                    .setDescription(`**${userAccount.username}#${userAccount.tag}** の登録情報を削除しました。`)
                    .setColor('#FF0000')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: '削除されたアカウント', value: `${userAccount.username}#${userAccount.tag}`, inline: true },
                        { name: '地域', value: userAccount.region.toUpperCase(), inline: true },
                        { name: '削除日時', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ 
                        text: '再度登録する場合は /register-valorant コマンドをご利用ください',
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [deleteEmbed] });

            } else if (subcommand === 'list') {
                // 管理者権限のチェック
                if (!interaction.member.permissions.has('Administrator')) {
                    const noPermissionEmbed = new EmbedBuilder()
                        .setTitle('❌ 権限不足')
                        .setDescription('このコマンドは管理者のみ使用できます。')
                        .setColor('#FF0000')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [noPermissionEmbed] });
                    return;
                }

                const registeredUsers = Object.entries(userData);
                
                if (registeredUsers.length === 0) {
                    const noUsersEmbed = new EmbedBuilder()
                        .setTitle('📋 登録済みユーザー一覧')
                        .setDescription('登録済みのユーザーはいません。')
                        .setColor('#FF9900')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [noUsersEmbed] });
                    return;
                }

                // ユーザーリストを作成（最大25個まで）
                const userList = registeredUsers.slice(0, 25).map(([discordId, account], index) => {
                    return {
                        name: `${index + 1}. ${account.discordTag}`,
                        value: `**Valorant:** ${account.username}#${account.tag}\n**地域:** ${account.region.toUpperCase()}\n**登録:** <t:${Math.floor(new Date(account.registeredAt).getTime() / 1000)}:d>`,
                        inline: true
                    };
                });

                const listEmbed = new EmbedBuilder()
                    .setTitle('📋 登録済みユーザー一覧')
                    .setDescription(`**合計登録者数:** ${registeredUsers.length}人`)
                    .setColor('#00FF00')
                    .addFields(userList)
                    .setFooter({ 
                        text: registeredUsers.length > 25 ? `${registeredUsers.length - 25}人のユーザーが表示されていません` : `全${registeredUsers.length}人を表示中`,
                        iconURL: interaction.guild.iconURL()
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [listEmbed] });
            }

        } catch (error) {
            console.error('Manage valorant command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ エラーが発生しました')
                .setDescription('コマンドの処理中にエラーが発生しました。')
                .setColor('#FF0000')
                .addFields(
                    { name: 'エラー詳細', value: error.message || '不明なエラー', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};