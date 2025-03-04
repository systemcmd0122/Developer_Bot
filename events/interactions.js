// interactions.js - インタラクションデータの永続化を管理
const fs = require('fs');
const path = require('path');

class InteractionManager {
    constructor(client) {
        this.client = client;
        this.dataPath = path.join(__dirname, 'data', 'interactions.json');
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
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf8');
                this.interactions = JSON.parse(data);
                console.log('✓ Interactions loaded successfully');
            }
        } catch (error) {
            console.error('Error loading interactions:', error);
        }
    }

    // インタラクションデータをファイルに保存
    saveInteractions() {
        try {
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(this.dataPath, JSON.stringify(this.interactions, null, 2));
        } catch (error) {
            console.error('Error saving interactions:', error);
        }
    }

    // ボタンインタラクションを保存
    saveButtonInteraction(messageId, buttonData) {
        this.interactions.buttons[messageId] = buttonData;
        this.saveInteractions();
    }

    // メニューインタラクションを保存
    saveMenuInteraction(messageId, menuData) {
        this.interactions.menus[messageId] = menuData;
        this.saveInteractions();
    }

    // ボード情報を保存
    saveBoardInteraction(messageId, boardData) {
        this.interactions.boards[messageId] = boardData;
        this.saveInteractions();
    }

    // ボタンインタラクションを取得
    getButtonInteraction(messageId) {
        return this.interactions.buttons[messageId];
    }

    // メニューインタラクションを取得
    getMenuInteraction(messageId) {
        return this.interactions.menus[messageId];
    }

    // ボード情報を取得
    getBoardInteraction(messageId) {
        return this.interactions.boards[messageId];
    }

    // インタラクションを削除
    removeInteraction(messageId) {
        delete this.interactions.buttons[messageId];
        delete this.interactions.menus[messageId];
        delete this.interactions.boards[messageId];
        this.saveInteractions();
    }

    // すべてのインタラクションを取得
    getAllInteractions() {
        return this.interactions;
    }
}

module.exports = InteractionManager;