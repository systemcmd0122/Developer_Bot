-- Supabase SQLスキーマ定義

-- ロールボード用テーブル
CREATE TABLE roleboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    description TEXT DEFAULT 'リアクションをクリックしてロールを取得できます',
    active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, name),
    UNIQUE(guild_id, message_id)
);

CREATE INDEX idx_roleboards_guild_id ON roleboards(guild_id);
CREATE INDEX idx_roleboards_message_id ON roleboards(message_id);
CREATE INDEX idx_roleboards_created_by ON roleboards(created_by);
CREATE INDEX idx_roleboards_active ON roleboards(active);

-- ロールボード内のロール情報用テーブル
CREATE TABLE roleboard_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES roleboards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    position INTEGER,
    uses INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(board_id, role_id),
    UNIQUE(board_id, emoji)
);

CREATE INDEX idx_roleboard_roles_board_id ON roleboard_roles(board_id);
CREATE INDEX idx_roleboard_roles_emoji ON roleboard_roles(emoji);

-- ロール付与履歴用テーブル
CREATE TABLE role_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES roleboards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE,
    action_type TEXT NOT NULL CHECK (action_type IN ('add', 'remove')),
    UNIQUE(board_id, role_id, user_id, assigned_at)
);

CREATE INDEX idx_role_assignments_user ON role_assignments(user_id, guild_id);
CREATE INDEX idx_role_assignments_role ON role_assignments(role_id);
CREATE INDEX idx_role_assignments_board ON role_assignments(board_id);

-- トリガーの作成：updated_atとlast_used_atの自動更新用
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_roleboards_updated_at
    BEFORE UPDATE ON roleboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roleboard_roles_updated_at
    BEFORE UPDATE ON roleboard_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- AI会話履歴用テーブル
CREATE TABLE conversation_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' または 'model'
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    username TEXT,
    UNIQUE(user_id, channel_id, timestamp)
);