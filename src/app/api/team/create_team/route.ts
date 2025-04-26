import { NextResponse } from 'next/server';
import db from '@/lib/db'; // knex
import { Team } from '@/types/teams';

export async function POST(request: Request) {
    try {
        const teamData: Team = await request.json();

        const [newTeam] = await db('teams')
            .insert(teamData)
            .returning(['id', 'name', 'members', 'owners', 'invite_code', 'settings']);

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