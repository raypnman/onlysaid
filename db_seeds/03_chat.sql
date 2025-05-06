-- Create the chat_rooms table
CREATE TABLE IF NOT EXISTS chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type TEXT DEFAULT 'chat', -- agent, friend, team
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
    avatar TEXT,
    -- TODO: to be added
    text TEXT,
    reactions JSONB,
    reply_to UUID,
    mentions UUID[],
    image UUID,
    video UUID,
    audio UUID,
    poll UUID,
    contact UUID,
    gif UUID
);
