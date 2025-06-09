const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('valorant-store')
        .setDescription('Valorantストア情報を表示します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('featured')
                .setDescription('フィーチャードストア（バンドル）を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('offers')
                .setDescription('現在のストアオファーを表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('night-market')
                .setDescription('ナイトマーケット情報を表示（利用可能な場合）')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        try {
            const headers = {
                'accept': 'application/json',
                'Authorization': process.env.VALORANT_API_KEY || process.env.API_KEY
            };

            if (subcommand === 'featured') {
                // フィーチャードストア（バンドル）情報を取得
                const response = await axios.get('https://api.henrikdev.xyz/valorant/v1/store-featured', { headers });
                
                if (response.status !== 200 || !response.data.data) {
                    throw new Error('フィーチャードストア情報を取得できませんでした');
                }

                const featuredData = response.data.data;
                const embed = new EmbedBuilder()
                    .setTitle('🛍️ Valorant フィーチャードストア')
                    .setDescription('現在販売中のバンドル情報')
                    .setColor('#FF4655')
                    .setThumbnail('https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png') // VP icon
                    .setTimestamp();

                // バンドル情報を追加
                if (featuredData.bundles && featuredData.bundles.length > 0) {
                    featuredData.bundles.forEach((bundle, index) => {
                        if (index < 5) { // 最大5つまで表示
                            const price = bundle.base_price ? `${bundle.base_price} VP` : '価格不明';
                            const description = bundle.description || 'バンドルの詳細情報';
                            
                            embed.addFields({
                                name: `📦 ${bundle.display_name || `バンドル ${index + 1}`}`,
                                value: `**価格:** ${price}\n**説明:** ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
                                inline: false
                            });
                        }
                    });
                } else {
                    embed.addFields({
                        name: '📦 バンドル情報',
                        value: '現在販売中のバンドルはありません',
                        inline: false
                    });
                }

                // 残り時間情報（利用可能な場合）
                if (featuredData.bundle_remaining_seconds) {
                    const remainingTime = Math.floor(featuredData.bundle_remaining_seconds / 3600);
                    embed.addFields({
                        name: '⏰ 残り時間',
                        value: `約 ${remainingTime} 時間`,
                        inline: true
                    });
                }

                embed.setFooter({ 
                    text: '※ フィーチャードストア情報は全プレイヤー共通です',
                    iconURL: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png'
                });

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'offers') {
                // ストアオファー情報を表示（仮想的な実装）
                const embed = new EmbedBuilder()
                    .setTitle('🏪 Valorant ストアオファー')
                    .setDescription('**⚠️ 制限事項について**\n\n個人のデイリーストア情報は、Riot Gamesのポリシーにより現在APIで取得できません。\n\n以下の情報のみ利用可能です：')
                    .setColor('#FFA500')
                    .addFields(
                        {
                            name: '✅ 利用可能な機能',
                            value: '• フィーチャードストア（バンドル）\n• 武器スキン・アイテム情報\n• エージェント情報\n• マップ情報',
                            inline: true
                        },
                        {
                            name: '❌ 利用不可能な機能',
                            value: '• 個人のデイリーストア\n• ナイトマーケット\n• 個人の購入履歴\n• VP・RP残高',
                            inline: true
                        },
                        {
                            name: '💡 代替案',
                            value: '• ゲーム内でストアを確認\n• `/valorant-store featured` でバンドル確認\n• 武器スキン情報は別途検索可能',
                            inline: false
                        }
                    )
                    .setThumbnail('https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/displayicon.png')
                    .setFooter({ 
                        text: 'Riot Games API制限により、個人ストア情報は取得できません',
                        iconURL: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png'
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'night-market') {
                // ナイトマーケット情報（制限事項を説明）
                const embed = new EmbedBuilder()
                    .setTitle('🌙 Valorant ナイトマーケット')
                    .setDescription('**⚠️ ナイトマーケット情報について**\n\nナイトマーケットの個人情報は、現在のAPIでは取得できません。')
                    .setColor('#4B0082')
                    .addFields(
                        {
                            name: '🔒 制限理由',
                            value: 'Riot Gamesのポリシーにより、個人のストア情報（ナイトマーケットを含む）は非公開です。',
                            inline: false
                        },
                        {
                            name: '💭 ナイトマーケットとは',
                            value: '• 期間限定で開催される特別なストア\n• 通常より安い価格でスキンを購入可能\n• 個人ごとに異なるラインナップ\n• 開催期間は不定期',
                            inline: false
                        },
                        {
                            name: '📱 確認方法',
                            value: '• ゲーム内のストアタブで確認\n• 開催中は通知が表示されます\n• ナイトマーケットアイコンをクリック',
                            inline: false
                        }
                    )
                    .setThumbnail('https://media.valorant-api.com/currencies/f08d4ae3-a6e6-4b62-b9c5-4c6396e2a7b0/displayicon.png') // KC icon
                    .setFooter({ 
                        text: 'ナイトマーケットの詳細はゲーム内で確認してください',
                        iconURL: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png'
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Valorant store command error:', error);
            
            let errorMessage = '❌ ストア情報の取得中にエラーが発生しました。';
            if (error.response?.status === 404) {
                errorMessage = '❌ ストア情報が見つかりませんでした。';
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
                    { name: 'エラー内容', value: error.message || '不明なエラー', inline: false }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};