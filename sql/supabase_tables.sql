-- Supabase SQLスキーマ定義

-- インタラクションデータ用テーブル
CREATE TABLE interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('button', 'menu', 'board')),
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, type)
);

CREATE INDEX idx_interactions_message_id ON interactions(message_id);
CREATE INDEX idx_interactions_guild_id ON interactions(guild_id);

-- ロールボード用テーブル
CREATE TABLE roleboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, name),
    UNIQUE(guild_id, message_id)
);

CREATE INDEX idx_roleboards_guild_id ON roleboards(guild_id);
CREATE INDEX idx_roleboards_message_id ON roleboards(message_id);

-- ロールボード内のロール情報用テーブル
CREATE TABLE roleboard_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES roleboards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    description TEXT,
    position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(board_id, role_id)
);

CREATE INDEX idx_roleboard_roles_board_id ON roleboard_roles(board_id);

-- トリガーの作成：updated_atの自動更新用
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interactions_updated_at
    BEFORE UPDATE ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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