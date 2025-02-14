// events/guildMemberAdd.js
module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // ユーザーが bot かどうかをチェック
            if (member.user.bot) {
                await member.roles.add('1331212375969366056');
            } else {
                await member.roles.add('1331169578155507772');
            }
        } catch (error) {
            console.error('Error adding default role:', error);
        }
    }
};