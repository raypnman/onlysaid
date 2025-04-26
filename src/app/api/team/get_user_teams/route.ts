import { NextResponse } from 'next/server';
import db from '@/lib/db'; // knex

export async function POST(request: Request) {
    try {
        const { user_id } = await request.json();

        if (!user_id) {
            return NextResponse.json({
                error: 'Bad Request',
                message: 'user_id is required'
            }, { status: 400 });
        }

        // Query the database for teams where the user is a member or owner
        const teams = await db('teams')
            .where('members', '@>', `{${user_id}}`)
            .orWhere('owners', '@>', `{${user_id}}`)
            .select(['id', 'name', 'members', 'owners', 'invite_code', 'settings']);

        return NextResponse.json({
            message: 'Teams retrieved successfully',
            teams
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