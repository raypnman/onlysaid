-- Then create the users table and insert data
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    avatar TEXT,
    agent_id UUID NULL REFERENCES users(id),
    level INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    is_human BOOLEAN DEFAULT FALSE,
    settings JSONB
);

INSERT INTO users (id, username, email, settings, is_human) VALUES ('00000000-0000-4000-0000-000000000000', 'Assistant', 'assistant@onlysaid.com', '{"theme": "light"}', FALSE);
insert into users (id, username, email, settings, is_human) values ('11111111-1111-4111-1111-111111111111', 'You', 'you@example.com', '{"theme": "light"}', TRUE);