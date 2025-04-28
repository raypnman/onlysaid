import { NextResponse } from 'next/server';
import db from '@/lib/db'; // knex
import { Team } from '@/types/teams';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const teamData: Team = await request.json();

        const [newTeam] = await db('teams')
            .insert(teamData)
            .returning(['id', 'name', 'members', 'owners', 'invite_code', 'settings']);

        // --- Create a folder under /agent_home/ with the team's id (uuid4) ---
        const safeTeamId = newTeam.id.replace(/[^a-zA-Z0-9-_]/g, '_'); // sanitize, though uuid4 should be safe
        const folderPath = path.join('/agent_home', safeTeamId);
        await fs.mkdir(folderPath, { recursive: true });

        return NextResponse.json({
            message: 'Team created successfully',
            team: newTeam,
            team_id: newTeam.id
        });

    } catch (error) {

        // Return a more detailed error for debugging
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}