const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randomnick')
        .setDescription('サーバーメンバーのニックネームをランダムに統一します')
        .addIntegerOption(option =>
            option.setName('minutes')
                .setDescription('ニックネームを変更する時間（分）')
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('required_role')
                .setDescription('このコマンドを使用するために必要なロール（指定しない場合は誰でも使用可能）')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('revert')
                .setDescription('すぐに元のニックネームに戻す場合はtrue')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // リバートオプションのチェック
            const shouldRevert = interaction.options.getBoolean('revert') || false;
            
            // 必要なロールのチェック
            const requiredRole = interaction.options.getRole('required_role');
            if (requiredRole) {
                const hasRole = interaction.member.roles.cache.has(requiredRole.id);
                if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return await interaction.reply({
                        content: `このコマンドを使用するには ${requiredRole.name} ロールが必要です。`,
                        ephemeral: true
                    });
                }
            }

            // メンバー情報の取得
            const members = await interaction.guild.members.fetch();
            const realMembers = members.filter(member => !member.user.bot);

            // リバートモードの処理
            if (shouldRevert) {
                await interaction.deferReply();
                let revertCount = 0;

                for (const [, member] of realMembers) {
                    try {
                        if (member.manageable) {
                            if (member.nickname) {
                                await member.setNickname(null);
                                revertCount++;
                            }
                        }
                    } catch (error) {
                        console.error(`Error reverting nickname for ${member.user.tag}:`, error);
                    }
                }

                return await interaction.editReply(`${revertCount}人のニックネームを元に戻しました。`);
            }

            // 通常モードの処理
            const randomMember = realMembers.random();
            if (!randomMember) {
                return await interaction.reply({
                    content: 'メンバーが見つかりませんでした。',
                    ephemeral: true
                });
            }

            const selectedName = randomMember.displayName;
            const previousNicknames = new Map();
            const minutes = interaction.options.getInteger('minutes') || 10;
            
            await interaction.deferReply();
            let changeCount = 0;

            for (const [, member] of realMembers) {
                try {
                    if (member.manageable) {
                        previousNicknames.set(member.id, member.displayName);
                        await member.setNickname(selectedName);
                        changeCount++;
                    }
                } catch (error) {
                    console.error(`Error setting nickname for ${member.user.tag}:`, error);
                }
            }
            
            await interaction.editReply(
                `${changeCount}人のニックネームを「${selectedName}」に変更しました。` +
                `${minutes}分後に元に戻ります。`
            );
            
            // 指定時間後に元に戻す
            setTimeout(async () => {
                let revertCount = 0;
                for (const [memberId, previousNick] of previousNicknames) {
                    try {
                        const member = await interaction.guild.members.fetch(memberId);
                        if (member && member.manageable) {
                            await member.setNickname(previousNick);
                            revertCount++;
                        }
                    } catch (error) {
                        console.error(`Error resetting nickname for member ${memberId}:`, error);
                    }
                }
                
                await interaction.followUp({
                    content: `${revertCount}人のニックネームを元に戻しました。`,
                    ephemeral: true
                });
            }, minutes * 60 * 1000);

        } catch (error) {
            console.error('Error in randomnick command:', error);
            const errorMessage = interaction.replied || interaction.deferred ?
                await interaction.editReply('ニックネームの変更中にエラーが発生しました。') :
                await interaction.reply({
                    content: 'ニックネームの変更中にエラーが発生しました。',
                    ephemeral: true
                });
        }
    },
};