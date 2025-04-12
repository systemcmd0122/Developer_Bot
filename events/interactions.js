const fs = require('fs');
const path = require('path');
const supabase = require('../utils/supabase');

class InteractionManager {
    constructor(client) {
        this.client = client;
        this.dataPath = path.join(__dirname, '..', 'data', 'interactions.json');
        this.interactions = {
            buttons: {},
            menus: {},
            boards: {}
        };
        this.loadInteractions();
    }

    async loadInteractions() {
        try {
            const { data, error } = await supabase
                .from('interactions')
                .select('message_id, type, data');

            if (error) {
                console.error('Error loading interactions from Supabase:', error);
                return;
            }

            // リセットして新しく読み込む
            this.interactions = {
                buttons: {},
                menus: {},
                boards: {}
            };

            for (const item of data) {
                const { message_id, type, data: itemData } = item;
                
                switch (type) {
                    case 'button':
                        this.interactions.buttons[message_id] = itemData;
                        break;
                    case 'menu':
                        this.interactions.menus[message_id] = itemData;
                        break;
                    case 'board':
                        this.interactions.boards[message_id] = itemData;
                        break;
                }
            }

            console.log('✓ Interactions loaded successfully from Supabase');
        } catch (error) {
            console.error('Error loading interactions:', error);
            this.interactions = {
                buttons: {},
                menus: {},
                boards: {}
            };
        }
    }

    async saveButtonInteraction(messageId, buttonData) {
        if (!messageId || !buttonData) {
            throw new Error('Invalid button interaction data');
        }
        
        try {
            this.interactions.buttons[messageId] = buttonData;
            
            // Supabaseにデータを保存（upsert）
            const { error } = await supabase
                .from('interactions')
                .upsert(
                    {
                        message_id: messageId,
                        type: 'button',
                        data: buttonData,
                        guild_id: buttonData.guildId || 'unknown',
                        updated_at: new Date()
                    },
                    { onConflict: 'message_id,type' }
                );

            if (error) {
                console.error('Error saving button interaction to Supabase:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error in saveButtonInteraction:', error);
            throw error;
        }
    }

    async saveMenuInteraction(messageId, menuData) {
        if (!messageId || !menuData) {
            throw new Error('Invalid menu interaction data');
        }
        
        try {
            this.interactions.menus[messageId] = menuData;
            
            // Supabaseにデータを保存（upsert）
            const { error } = await supabase
                .from('interactions')
                .upsert(
                    {
                        message_id: messageId,
                        type: 'menu',
                        data: menuData,
                        guild_id: menuData.guildId || 'unknown',
                        updated_at: new Date()
                    },
                    { onConflict: 'message_id,type' }
                );

            if (error) {
                console.error('Error saving menu interaction to Supabase:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error in saveMenuInteraction:', error);
            throw error;
        }
    }

    async saveBoardInteraction(messageId, boardData) {
        if (!messageId || !boardData) {
            throw new Error('Invalid board interaction data');
        }
        
        try {
            this.interactions.boards[messageId] = boardData;
            
            // Supabaseにデータを保存（upsert）
            const { error } = await supabase
                .from('interactions')
                .upsert(
                    {
                        message_id: messageId,
                        type: 'board',
                        data: boardData,
                        guild_id: boardData.guildId || 'unknown',
                        updated_at: new Date()
                    },
                    { onConflict: 'message_id,type' }
                );

            if (error) {
                console.error('Error saving board interaction to Supabase:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error in saveBoardInteraction:', error);
            throw error;
        }
    }

    getButtonInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.buttons[messageId] || null;
    }

    getMenuInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.menus[messageId] || null;
    }

    getBoardInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.boards[messageId] || null;
    }

    async removeInteraction(messageId) {
        if (!messageId) return;

        let modified = false;
        if (messageId in this.interactions.buttons) {
            delete this.interactions.buttons[messageId];
            modified = true;
        }
        if (messageId in this.interactions.menus) {
            delete this.interactions.menus[messageId];
            modified = true;
        }
        if (messageId in this.interactions.boards) {
            delete this.interactions.boards[messageId];
            modified = true;
        }

        if (modified) {
            // Supabaseから該当のデータを削除
            const { error } = await supabase
                .from('interactions')
                .delete()
                .eq('message_id', messageId);

            if (error) {
                console.error('Error removing interaction from Supabase:', error);
            }
        }
    }

    async getAllInteractions() {
        return {
            buttons: { ...this.interactions.buttons },
            menus: { ...this.interactions.menus },
            boards: { ...this.interactions.boards }
        };
    }

    async getBoardList(guildId = null) {
        try {
            let query = supabase
                .from('friend_code_boards')
                .select('message_id, guild_id, channel_id, title, description');
            
            if (guildId) {
                query = query.eq('guild_id', guildId);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('エラー: 掲示板リスト取得:', error);
                return [];
            }
            
            return data;
        } catch (error) {
            console.error('エラー: 掲示板リスト取得処理:', error);
            return [];
        }
    }
    
    async updateBoardContent(messageId, newTitle, newDescription) {
        try {
            if (!this.interactions.boards[messageId]) {
                throw new Error('指定された掲示板が見つかりません');
            }
            
            // メモリ内のデータを更新
            this.interactions.boards[messageId].title = newTitle;
            this.interactions.boards[messageId].description = newDescription;
            
            // データベースを更新
            const { error } = await supabase
                .from('friend_code_boards')
                .update({
                    title: newTitle,
                    description: newDescription,
                    updated_at: new Date()
                })
                .eq('message_id', messageId);
                
            if (error) {
                console.error('掲示板更新エラー:', error);
                throw error;
            }
            
            // board interactionも更新
            const boardData = { ...this.interactions.boards[messageId], title: newTitle, description: newDescription };
            await this.saveBoardInteraction(messageId, boardData);
            
            return true;
        } catch (error) {
            console.error('掲示板更新処理エラー:', error);
            throw error;
        }
    }
    
    async syncBoards(guildId) {
        try {
            // データベースから最新の掲示板情報を取得
            const { data, error } = await supabase
                .from('friend_code_boards')
                .select('*')
                .eq('guild_id', guildId);
                
            if (error) {
                console.error('掲示板同期エラー:', error);
                return false;
            }
            
            // メモリキャッシュをリセット
            if (!this.interactions.boards) {
                this.interactions.boards = {};
            }
            
            // 掲示板データを更新
            for (const board of data) {
                this.interactions.boards[board.message_id] = {
                    channelId: board.channel_id,
                    title: board.title,
                    description: board.description || '',
                    guildId: board.guild_id
                };
            }
            
            return true;
        } catch (error) {
            console.error('掲示板同期処理エラー:', error);
            return false;
        }
    }

    async cleanup(maxAge = 24 * 60 * 60 * 1000) { 
        const now = Date.now();
        let modified = false;

        // メモリ内のデータを整理
        Object.entries(this.interactions).forEach(([type, interactions]) => {
            Object.entries(interactions).forEach(([id, data]) => {
                if (data.timestamp && (now - data.timestamp > maxAge)) {
                    delete this.interactions[type][id];
                    modified = true;
                }
            });
        });

        // Supabaseのデータは対応する日付フィールドがないため、単純に古いレコードを削除
        const oneDayAgo = new Date(now - maxAge);
        const { error } = await supabase
            .from('interactions')
            .delete()
            .lt('updated_at', oneDayAgo.toISOString());

        if (error) {
            console.error('Error cleaning up interactions in Supabase:', error);
        }
    }
}

module.exports = InteractionManager;