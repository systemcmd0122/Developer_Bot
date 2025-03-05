// interactions.js - インタラクションデータの永続化を管理
const fs = require('fs');
const path = require('path');

class InteractionManager {
    constructor(client) {
        this.client = client;
        // データの保存先を../dataに修正
        this.dataPath = path.join(__dirname, '..', 'data', 'interactions.json');
        this.interactions = {
            buttons: {},
            menus: {},
            boards: {}
        };
        this.loadInteractions();
    }

    // インタラクションデータをファイルから読み込む
    loadInteractions() {
        try {
            // データディレクトリの作成を確認
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf8');
                this.interactions = JSON.parse(data);
                console.log('✓ Interactions loaded successfully');
            } else {
                // ファイルが存在しない場合は新規作成
                this.saveInteractions();
                console.log('✓ Created new interactions file');
            }
        } catch (error) {
            console.error('Error loading interactions:', error);
            // エラーが発生した場合でもデフォルト構造を維持
            this.interactions = {
                buttons: {},
                menus: {},
                boards: {}
            };
        }
    }

    // インタラクションデータをファイルに保存
    saveInteractions() {
        try {
            // データディレクトリの存在を確認し、必要に応じて作成
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // データを整形して保存
            const dataToSave = JSON.stringify(this.interactions, null, 2);
            fs.writeFileSync(this.dataPath, dataToSave, 'utf8');
        } catch (error) {
            console.error('Error saving interactions:', error);
            throw error; // エラーを上位に伝播させる
        }
    }

    // ボタンインタラクションを保存
    saveButtonInteraction(messageId, buttonData) {
        if (!messageId || !buttonData) {
            throw new Error('Invalid button interaction data');
        }
        this.interactions.buttons[messageId] = buttonData;
        this.saveInteractions();
    }

    // メニューインタラクションを保存
    saveMenuInteraction(messageId, menuData) {
        if (!messageId || !menuData) {
            throw new Error('Invalid menu interaction data');
        }
        this.interactions.menus[messageId] = menuData;
        this.saveInteractions();
    }

    // ボード情報を保存
    saveBoardInteraction(messageId, boardData) {
        if (!messageId || !boardData) {
            throw new Error('Invalid board interaction data');
        }
        this.interactions.boards[messageId] = boardData;
        this.saveInteractions();
    }

    // ボタンインタラクションを取得
    getButtonInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.buttons[messageId] || null;
    }

    // メニューインタラクションを取得
    getMenuInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.menus[messageId] || null;
    }

    // ボード情報を取得
    getBoardInteraction(messageId) {
        if (!messageId) return null;
        return this.interactions.boards[messageId] || null;
    }

    // インタラクションを削除
    removeInteraction(messageId) {
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
            this.saveInteractions();
        }
    }

    // すべてのインタラクションを取得
    getAllInteractions() {
        return {
            buttons: { ...this.interactions.buttons },
            menus: { ...this.interactions.menus },
            boards: { ...this.interactions.boards }
        };
    }

    // 古いインタラクションをクリーンアップ（オプション）
    cleanup(maxAge = 24 * 60 * 60 * 1000) { // デフォルト24時間
        const now = Date.now();
        let modified = false;

        Object.entries(this.interactions).forEach(([type, interactions]) => {
            Object.entries(interactions).forEach(([id, data]) => {
                if (data.timestamp && (now - data.timestamp > maxAge)) {
                    delete this.interactions[type][id];
                    modified = true;
                }
            });
        });

        if (modified) {
            this.saveInteractions();
        }
    }
}

module.exports = InteractionManager;