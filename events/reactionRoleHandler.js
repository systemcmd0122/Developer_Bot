const supabase = require('../utils/supabase');

async function handleReactionAdd(reaction, user) {
    if (user.bot) return;

    try {
        // 部分的なリアクションの場合は完全なデータを取得
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('リアクションのフェッチ中にエラーが発生しました:', error);
                return;
            }
        }

        // 部分的なメッセージの場合は完全なデータを取得
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('メッセージのフェッチ中にエラーが発生しました:', error);
                return;
            }
        }

        // ロールボードを検索
        const { data: board, error: boardError } = await supabase
            .from('roleboards')
            .select('*')
            .eq('message_id', reaction.message.id)
            .eq('active', true)
            .single();

        if (boardError) {
            console.error('ロールボードの検索中にエラーが発生しました:', boardError);
            return;
        }

        if (!board) {
            return; // ロールボードではないメッセージへのリアクション
        }

        // ロール情報を取得
        const { data: roleData, error: roleError } = await supabase
            .from('roleboard_roles')
            .select('*')
            .eq('board_id', board.id)
            .eq('emoji', reaction.emoji.name)
            .single();

        if (roleError) {
            console.error('ロール情報の検索中にエラーが発生しました:', roleError);
            return;
        }

        if (!roleData) {
            return; // 登録されていない絵文字へのリアクション
        }

        // リアクションを削除
        await reaction.users.remove(user.id);

        // ギルドメンバーを取得
        const guild = reaction.message.guild;
        if (!guild) {
            console.error('ギルドが見つかりません');
            return;
        }

        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (error) {
            console.error('メンバー情報の取得中にエラーが発生しました:', error);
            return;
        }

        let role;
        try {
            role = await guild.roles.fetch(roleData.role_id);
        } catch (error) {
            console.error('ロールの取得中にエラーが発生しました:', error);
            return;
        }

        if (!role) {
            console.error('ロールが見つかりません');
            return;
        }

        // Botの権限チェック
        const botMember = await guild.members.fetch(guild.client.user.id);
        if (!botMember.permissions.has('ManageRoles')) {
            await reaction.message.channel.send({
                content: `<@${user.id}> Botにロールを管理する権限がないため、操作できません。`,
                ephemeral: true
            }).then(msg => setTimeout(() => msg.delete(), 5000));
            return;
        }

        // ロールの位置チェック
        if (role.position >= botMember.roles.highest.position) {
            await reaction.message.channel.send({
                content: `<@${user.id}> このロールはBotより上位にあるため、操作できません。`,
                ephemeral: true
            }).then(msg => setTimeout(() => msg.delete(), 5000));
            return;
        }

        try {
            // ロールの付与状態を確認して反転
            if (member.roles.cache.has(role.id)) {
                // ロールを削除
                await member.roles.remove(role);
                
                // 履歴を記録
                await supabase.from('role_assignments').insert({
                    board_id: board.id,
                    role_id: role.id,
                    user_id: user.id,
                    guild_id: guild.id,
                    action_type: 'remove'
                });

                // uses カウントを更新
                await supabase
                    .from('roleboard_roles')
                    .update({ 
                        uses: roleData.uses + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', roleData.id);

                // 通知を送信
                await reaction.message.channel.send({
                    content: `<@${user.id}> ロール「${role.name}」を削除しました。`,
                    ephemeral: true
                }).then(msg => setTimeout(() => msg.delete(), 5000));

            } else {
                // ロールを付与
                await member.roles.add(role);
                
                // 履歴を記録
                await supabase.from('role_assignments').insert({
                    board_id: board.id,
                    role_id: role.id,
                    user_id: user.id,
                    guild_id: guild.id,
                    action_type: 'add'
                });

                // uses カウントを更新
                await supabase
                    .from('roleboard_roles')
                    .update({ 
                        uses: roleData.uses + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', roleData.id);

                // 通知を送信
                await reaction.message.channel.send({
                    content: `<@${user.id}> ロール「${role.name}」を付与しました。`,
                    ephemeral: true
                }).then(msg => setTimeout(() => msg.delete(), 5000));
            }

        } catch (error) {
            console.error('ロールの操作中にエラーが発生しました:', error);
            await reaction.message.channel.send({
                content: `<@${user.id}> ロールの操作中にエラーが発生しました。`,
                ephemeral: true
            }).then(msg => setTimeout(() => msg.delete(), 5000));
        }

    } catch (error) {
        console.error('[Error] リアクション処理中のエラー:', error);
    }
}

module.exports = { handleReactionAdd };