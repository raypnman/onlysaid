import { NextResponse } from 'next/server';
import db from '@/lib/db'; // knex
import { Team } from '@/types/teams';

export async function GET(request: Request) {
    try {
        // Extract parameters from the URL
        const url = new URL(request.url);
        const team_id = url.searchParams.get('team_id');
        const invite_code = url.searchParams.get('invite_code');

        // Check if at least one parameter is provided
        if (!team_id && !invite_code) {
            return NextResponse.json({
                error: 'Bad Request',
                message: 'Either team_id or invite_code is required'
            }, { status: 400 });
        }

        // Query the database for the team
        let query = db('teams');

        if (team_id) {
            query = query.where({ id: team_id });
        } else if (invite_code) {
            query = query.where({ invite_code });
        }

        const team = await query.first(['id', 'name', 'members', 'owners', 'rooms', 'invite_code', 'settings']);

        if (!team) {
            return NextResponse.json({
                error: 'Not Found',
                message: 'Team not found'
            }, { status: 404 });
        }

        return NextResponse.json({
            message: 'Team retrieved successfully',
            team
        });

    } catch (error) {
        // Return a more detailed error for debugging
        console.log("error", error);
        return NextResponse.json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
