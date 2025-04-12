-- Supabase SQLスキーマ定義

-- インタラクションデータ用テーブル
CREATE TABLE interactions (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'button', 'menu', 'board'
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, type)
);

-- アクティビティ設定用テーブル
CREATE TABLE activity_settings (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    notification_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- フレンドコード用テーブル
CREATE TABLE friend_codes (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    code TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, user_id, game_name)
);

-- フレンドコード掲示板用テーブル
CREATE TABLE friend_code_boards (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id)
);

-- 人気ゲーム用テーブル
CREATE TABLE popular_games (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    user_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, game_name)
);

-- ロールボード用テーブル
CREATE TABLE role_boards (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    board_name TEXT NOT NULL,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, message_id)
);

-- ロールボード内のロール情報用テーブル
CREATE TABLE role_board_roles (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES role_boards(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(board_id, role_id)
);

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