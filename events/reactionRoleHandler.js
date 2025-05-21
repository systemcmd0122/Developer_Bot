const supabase = require('../utils/supabase');

// キャッシュを保持するオブジェクト
const roleboardCache = new Map();
const roleDataCache = new Map();

// キャッシュの有効期限（1時間）
const CACHE_TTL = 60 * 60 * 1000;

// キャッシュからロールボードを取得または更新
async function getRoleboardFromCache(messageId) {
    const now = Date.now();
    const cached = roleboardCache.get(messageId);
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }

    const { data: board, error } = await supabase
        .from('roleboards')
        .select('*')
        .eq('message_id', messageId)
        .eq('active', true)
        .single();

    if (!error && board) {
        roleboardCache.set(messageId, {
            data: board,
            timestamp: now
        });
    }

    return board;
}

// キャッシュからロール情報を取得または更新
async function getRoleDataFromCache(boardId, emojiId) {
    const cacheKey = `${boardId}:${emojiId}`;
    const now = Date.now();
    const cached = roleDataCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }

    const { data: roleData, error } = await supabase
        .from('roleboard_roles')
        .select('*')
        .eq('board_id', boardId)
        .eq('emoji_id', emojiId)
        .maybeSingle();

    if (!error) {
        roleDataCache.set(cacheKey, {
            data: roleData,
            timestamp: now
        });
    }

    return roleData;
}

// ロールの付与/削除を非同期で記録
async function recordRoleAssignment(data) {
    try {
        await supabase.from('role_assignments').insert(data);
    } catch (error) {
        console.error('履歴の記録中にエラーが発生しました:', error);
    }
}

// 使用統計の更新を非同期で実行
async function updateRoleStats(roleId, uses) {
    try {
        await supabase
            .from('roleboard_roles')
            .update({ 
                uses: uses,
                last_used_at: new Date().toISOString()
            })
            .eq('id', roleId);
    } catch (error) {
        console.error('統計の更新中にエラーが発生しました:', error);
    }
}

async function handleReactionAdd(reaction, user) {
    if (user.bot) return;

    try {
        // パーシャルデータの同時取得
        const [fetchedReaction, fetchedMessage] = await Promise.all([
            reaction.partial ? reaction.fetch() : reaction,
            reaction.message.partial ? reaction.message.fetch() : reaction.message
        ]).catch(error => {
            console.error('データのフェッチ中にエラーが発生しました:', error);
            return [];
        });

        if (!fetchedReaction || !fetchedMessage) return;

        // キャッシュからロールボードを取得
        const board = await getRoleboardFromCache(reaction.message.id);
        if (!board) {
            return; // ロールボードではないメッセージへのリアクション
        }

        // 絵文字のIDまたは名前を取得
        const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;
        
        // キャッシュからロール情報を取得
        const roleData = await getRoleDataFromCache(board.id, emojiIdentifier);
        if (!roleData) {
            // キャッシュにない場合は直接検索
            const { data: newRoleData, error: roleError } = await supabase
                .from('roleboard_roles')
                .select('*')
                .eq('board_id', board.id)
                .or(`emoji_id.eq.${emojiIdentifier},emoji.eq.${reaction.emoji.name}`)
                .single();

            if (roleError || !newRoleData) {
                return; // 登録されていない絵文字へのリアクション
            }
            
            // キャッシュに保存
            roleDataCache.set(`${board.id}:${emojiIdentifier}`, {
                data: newRoleData,
                timestamp: Date.now()
            });
            
            // 以降の処理のために代入
            Object.assign(roleData, newRoleData);
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
