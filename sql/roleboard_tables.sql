-- ロールボード用テーブル
CREATE TABLE roleboards (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(guild_id, message_id)
);

-- ロールボードのロール設定用テーブル
CREATE TABLE roleboard_roles (
    id SERIAL PRIMARY KEY,
    board_id INTEGER REFERENCES roleboards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    uses INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(board_id, role_id),
    UNIQUE(board_id, emoji)
);

-- ロール割り当て履歴用テーブル
CREATE TABLE role_assignments (
    id SERIAL PRIMARY KEY,
    board_id INTEGER REFERENCES roleboards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'add' または 'remove'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_roleboards_guild_message ON roleboards(guild_id, message_id);
CREATE INDEX idx_roleboard_roles_board ON roleboard_roles(board_id);
CREATE INDEX idx_role_assignments_board ON role_assignments(board_id);
CREATE INDEX idx_role_assignments_user ON role_assignments(user_id);
