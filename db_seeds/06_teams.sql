CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    image TEXT,
    name TEXT NOT NULL,
    super_admins UUID[],
    admins UUID[],
    members UUID[],
    invite_code TEXT,
    settings JSONB
);
