const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverquiz')
        .setDescription('サーバーメンバーに関するクイズを開始します'),
    async execute(interaction) {
        const guild = interaction.guild;
        const members = await guild.members.fetch();
        
        // クイズの種類とジェネレーター
        const quizTypes = {
            avatar: async () => {
                const randomMembers = getRandomMembers(members, 4);
                const correctMember = randomMembers[0];
                const question = {
                    type: 'avatar',
                    title: 'このアバターは誰のものでしょう？',
                    image: correctMember.user.displayAvatarURL({ size: 256 }),
                    options: shuffleArray(randomMembers.map(m => ({
                        label: m.displayName,
                        correct: m.id === correctMember.id
                    })))
                };
                return { question, correct: correctMember };
            },
            
            joinDate: async () => {
                // Filter members with valid joinedAt date
                const membersWithJoinDate = Array.from(members.values())
                    .filter(m => m.joinedAt instanceof Date);
                
                // If no valid members found, skip this quiz type
                if (membersWithJoinDate.length === 0) {
                    throw new Error('No members with valid join dates found');
                }

                const member = getRandomMembers(membersWithJoinDate, 1)[0];
                const joinDate = member.joinedAt;
                
                const options = [
                    new Date(joinDate.getTime() - 86400000 * 7),  // 7 days before
                    joinDate,
                    new Date(joinDate.getTime() + 86400000 * 7),  // 7 days after
                    new Date(joinDate.getTime() + 86400000 * 14)  // 14 days after
                ];
                
                return {
                    question: {
                        type: 'joinDate',
                        title: `${member.displayName}さんはいつサーバーに参加した？`,
                        options: shuffleArray(options.map(date => ({
                            label: date.toLocaleDateString('ja-JP'),
                            correct: date.getTime() === joinDate.getTime()
                        })))
                    },
                    correct: member
                };
            },
            
            role: async () => {
                const roledMembers = Array.from(members.values())
                    .filter(m => m.roles.cache.size > 1);
                
                if (roledMembers.length === 0) {
                    throw new Error('No members with roles found');
                }

                const member = getRandomMembers(roledMembers, 1)[0];
                const memberRoles = Array.from(member.roles.cache.values())
                    .filter(r => r.id !== guild.id);
                
                if (memberRoles.length === 0) {
                    throw new Error('Selected member has no valid roles');
                }

                const correctRole = memberRoles[0];
                const otherRoles = Array.from(guild.roles.cache.values())
                    .filter(r => r.id !== guild.id && r.id !== correctRole.id);
                const randomRoles = getRandomElements(otherRoles, 3);
                
                return {
                    question: {
                        type: 'role',
                        title: `${member.displayName}さんが持っているロールは？`,
                        options: shuffleArray([...randomRoles, correctRole].map(role => ({
                            label: role.name,
                            correct: role.id === correctRole.id
                        })))
                    },
                    correct: member
                };
            },

            status: async () => {
                const activeMembers = Array.from(members.values())
                    .filter(m => m.presence?.status);
                
                if (activeMembers.length === 0) {
                    throw new Error('No members with active status found');
                }

                const member = getRandomMembers(activeMembers, 1)[0];
                const statuses = ['online', 'idle', 'dnd', 'offline'];
                const statusLabels = {
                    'online': 'オンライン',
                    'idle': '退席中',
                    'dnd': '取り込み中',
                    'offline': 'オフライン'
                };
                
                return {
                    question: {
                        type: 'status',
                        title: `${member.displayName}さんの現在のステータスは？`,
                        options: shuffleArray(statuses.map(status => ({
                            label: statusLabels[status],
                            correct: status === member.presence?.status
                        })))
                    },
                    correct: member
                };
            },

            activityType: async () => {
                const membersWithActivity = Array.from(members.values())
                    .filter(m => m.presence?.activities?.length > 0);
                
                if (membersWithActivity.length === 0) {
                    throw new Error('No members with activities found');
                }

                const member = getRandomMembers(membersWithActivity, 1)[0];
                const activity = member.presence.activities[0];
                const activityTypes = ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'];
                const activityLabels = {
                    'PLAYING': 'プレイ中',
                    'STREAMING': '配信中',
                    'LISTENING': '視聴中',
                    'WATCHING': '観戦中',
                    'COMPETING': '参加中'
                };

                return {
                    question: {
                        type: 'activity',
                        title: `${member.displayName}さんは何をしている？`,
                        description: `現在のアクティビティ: ${activity.name}`,
                        options: shuffleArray(activityTypes.map(type => ({
                            label: activityLabels[type],
                            correct: type === activity.type
                        })))
                    },
                    correct: member
                };
            },

            memberCount: async () => {
                const totalMembers = guild.memberCount;
                const options = [
                    totalMembers,
                    totalMembers + Math.floor(Math.random() * 10) + 1,
                    totalMembers - Math.floor(Math.random() * 10) - 1,
                    totalMembers + Math.floor(Math.random() * 20) + 11
                ];

                return {
                    question: {
                        type: 'memberCount',
                        title: 'このサーバーの現在の総メンバー数は？',
                        options: shuffleArray(options.map(count => ({
                            label: `${count}人`,
                            correct: count === totalMembers
                        })))
                    }
                };
            },

            nickname: async () => {
                const membersWithNickname = Array.from(members.values())
                    .filter(m => m.nickname);
                
                if (membersWithNickname.length === 0) {
                    throw new Error('No members with nicknames found');
                }

                const member = getRandomMembers(membersWithNickname, 1)[0];
                const wrongNicknames = [
                    member.user.username,
                    member.nickname + '!',
                    member.nickname.slice(1),
                    member.nickname.toUpperCase()
                ];

                return {
                    question: {
                        type: 'nickname',
                        title: `${member.user.username}さんのニックネームは？`,
                        options: shuffleArray([
                            { label: member.nickname, correct: true },
                            ...wrongNicknames.slice(0, 3).map(nick => ({
                                label: nick,
                                correct: false
                            }))
                        ])
                    },
                    correct: member
                };
            },

            boostStatus: async () => {
                const member = getRandomMembers(members, 1)[0];
                const boostingSince = member.premiumSince;
                
                return {
                    question: {
                        type: 'boost',
                        title: `${member.displayName}さんはサーバーをブーストしている？`,
                        options: [
                            { label: 'はい', correct: !!boostingSince },
                            { label: 'いいえ', correct: !boostingSince }
                        ]
                    },
                    correct: member
                };
            }
        };

        // ヘルパー関数
        function getRandomMembers(members, count) {
            const validMembers = Array.from(members).filter(member => member && member.displayName);
            return getRandomElements(validMembers, count);
        }

        function getRandomElements(array, count) {
            if (!array || array.length === 0) {
                throw new Error('No valid elements to select from');
            }
            const shuffled = shuffleArray([...array]);
            return shuffled.slice(0, Math.min(count, shuffled.length));
        }

        function shuffleArray(array) {
            return array.sort(() => Math.random() - 0.5);
        }

        // クイズの実行
        let quiz;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const quizTypeKeys = Object.keys(quizTypes);
                const randomType = quizTypeKeys[Math.floor(Math.random() * quizTypeKeys.length)];
                quiz = await quizTypes[randomType]();
                break;
            } catch (error) {
                attempts++;
                console.warn(`Quiz generation attempt ${attempts} failed:`, error);
                if (attempts === maxAttempts) {
                    await interaction.reply({
                        content: 'クイズの生成中にエラーが発生しました。もう一度お試しください。',
                        ephemeral: true
                    });
                    return;
                }
            }
        }

        if (!quiz || !quiz.question) {
            await interaction.reply({
                content: 'クイズの生成に失敗しました。もう一度お試しください。',
                ephemeral: true
            });
            return;
        }

        // ボタンの作成
        const buttons = quiz.question.options.map((option, index) => 
            new ButtonBuilder()
                .setCustomId(`quiz_${index}`)
                .setLabel(option.label)
                .setStyle(ButtonStyle.Primary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        // 埋め込みメッセージの作成
        const embed = new EmbedBuilder()
            .setTitle(`🎯 ${quiz.question.title}`)
            .setColor('#FF9800')
            .setDescription(
                `${quiz.question.description || '30秒以内に回答してください！'}\n` +
                '全員参加可能です（1人1回のみ）'
            )
            .setTimestamp();

        if (quiz.question.image) {
            embed.setImage(quiz.question.image);
        }

        // クイズの送信
        const reply = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // 回答の収集
        const filter = i => i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({
            filter,
            time: 30000
        });

        // 回答者と結果を追跡
        let participants = new Map(); // userId -> {answer, timestamp}
        let firstCorrectAnswer = null;

        collector.on('collect', async i => {
            // 既に回答済みの場合
            if (participants.has(i.user.id)) {
                await i.reply({
                    content: '既に回答済みです！',
                    ephemeral: true
                });
                return;
            }
            
            const optionIndex = parseInt(i.customId.split('_')[1]);
            const isCorrect = quiz.question.options[optionIndex].correct;
            
            // 回答を記録
            participants.set(i.user.id, {
                answer: optionIndex,
                timestamp: Date.now(),
                isCorrect: isCorrect,
                user: i.user
            });

            // 最初の正解者を記録
            if (isCorrect && !firstCorrectAnswer) {
                firstCorrectAnswer = i.user;
            }

            // 回答したことを通知
            await i.reply({
                content: '回答を受け付けました！',
                ephemeral: true
            });

            // ボタンの状態を更新（無効化はしない）
            await i.message.edit({
                embeds: [embed],
                components: [row]
            });
        });

        collector.on('end', async collected => {
            const correctAnswer = quiz.question.options.find(opt => opt.correct).label;
            
            // 結果の集計
            const totalParticipants = participants.size;
            const correctParticipants = Array.from(participants.values()).filter(p => p.isCorrect).length;
            const correctRate = totalParticipants > 0 ? Math.round((correctParticipants / totalParticipants) * 100) : 0;

            // 参加者の回答を時系列順にソート
            const sortedParticipants = Array.from(participants.values())
                .sort((a, b) => a.timestamp - b.timestamp);

            // 結果の埋め込みメッセージを作成
            const resultEmbed = new EmbedBuilder()
                .setTitle('🎯 クイズ結果発表！')
                .setColor('#4CAF50')
                .setDescription(`**正解**: ${correctAnswer}`)
                .addFields(
                    { name: '参加者数', value: `${totalParticipants}人`, inline: true },
                    { name: '正答率', value: `${correctRate}%`, inline: true },
                    firstCorrectAnswer 
                        ? { name: '🏅 最速正解者', value: firstCorrectAnswer.toString(), inline: true }
                        : { name: '最速正解者', value: 'なし', inline: true }
                );

            // 全参加者の結果を追加
            if (sortedParticipants.length > 0) {
                const answersList = sortedParticipants
                    .map((p, index) => {
                        const mark = p.isCorrect ? '✅' : '❌';
                        return `${index + 1}. ${mark} ${p.user.toString()}`;
                    })
                    .join('\n');
                
                resultEmbed.addFields({
                    name: '📊 回答者一覧',
                    value: answersList
                });
            }

            // ボタンを無効化して結果を表示
            const disabledButtons = buttons.map(button => 
                ButtonBuilder.from(button).setDisabled(true)
            );
            const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);

            await interaction.editReply({
                embeds: [resultEmbed],
                components: [disabledRow]
            });
        });
    },
};