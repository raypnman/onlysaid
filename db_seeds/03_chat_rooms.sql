-- Create the chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    name TEXT DEFAULT 'New Chat',
    unread INTEGER DEFAULT 0,
    active_users UUID[]
);

-- Create the messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    room_id UUID,
    sender UUID,
    content TEXT NOT NULL,
    avatar TEXT,
    -- TODO: to be added
    reactions JSONB,
    reply_to UUID,
    mention UUID[],
    attachment UUID[]
);
