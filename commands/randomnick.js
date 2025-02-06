const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randomnick')
        .setDescription('サーバーメンバーのニックネームをランダムに統一します')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        try {
            // サーバーメンバーを取得
            const members = await interaction.guild.members.fetch();
            
            // ボットではないメンバーをフィルタリング
            const realMembers = members.filter(member => !member.user.bot);
            
            // ランダムにメンバーを選択
            const randomMember = realMembers.random();
            if (!randomMember) {
                return await interaction.reply({
                    content: 'メンバーが見つかりませんでした。',
                    ephemeral: true
                });
            }

            // 選択されたメンバーの名前を取得
            const selectedName = randomMember.displayName;
            
            // 変更前のニックネームを保存
            const previousNicknames = new Map();
            
            // すべてのメンバーのニックネームを変更
            await interaction.deferReply();
            
            for (const [, member] of realMembers) {
                try {
                    if (member.manageable) {
                        previousNicknames.set(member.id, member.displayName);
                        await member.setNickname(selectedName);
                    }
                } catch (error) {
                    console.error(`Error setting nickname for ${member.user.tag}:`, error);
                }
            }
            
            await interaction.editReply(`全メンバーのニックネームを「${selectedName}」に変更しました。10分後に元に戻ります。`);
            
            // 10分後に元に戻す
            setTimeout(async () => {
                for (const [memberId, previousNick] of previousNicknames) {
                    try {
                        const member = await interaction.guild.members.fetch(memberId);
                        if (member && member.manageable) {
                            await member.setNickname(previousNick);
                        }
                    } catch (error) {
                        console.error(`Error resetting nickname for member ${memberId}:`, error);
                    }
                }
                
                await interaction.followUp({
                    content: 'すべてのニックネームを元に戻しました。',
                    ephemeral: true
                });
            }, 10 * 60 * 1000); // 10分

        } catch (error) {
            console.error('Error in randomnick command:', error);
            await interaction.reply({
                content: 'ニックネームの変更中にエラーが発生しました。',
                ephemeral: true
            });
        }
    },
};