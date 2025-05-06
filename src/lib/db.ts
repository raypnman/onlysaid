import knex, { Knex } from 'knex';

export const DBTABLES = {
    CHATROOM: 'chat',
    PLANS: 'plans',
    TASKS: 'tasks',
    LOGS: 'logs',
    SKILLS: 'skills',
    USERS: 'users',
    TEAMS: 'teams',
}

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: parseInt(process.env.PGPORT || '5432'),
    },
    pool: { min: 0, max: 7 }
});

export default db as Knex; 