import { NextResponse } from 'next/server';
import db from '@/lib/db'; // knex
import { Team } from '@/types/teams';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(request: Request) {
    try {
        // Parse the request body
        const body = await request.json();
        const { team_id, name, members, owners, rooms, settings } = body;

        // Validate required fields
        if (!team_id) {
            return NextResponse.json({
                error: 'Bad Request',
                message: 'team_id is required'
            }, { status: 400 });
        }

        // Check if team exists
        const existingTeam = await db('teams').where({ id: team_id }).first();
        if (!existingTeam) {
            return NextResponse.json({
                error: 'Not Found',
                message: 'Team not found'
            }, { status: 404 });
        }

        // Prepare update data (only include fields that are provided)
        const updateData: Partial<Team> = {};
        if (name !== undefined) updateData.name = name;
        if (members !== undefined) updateData.members = members;
        if (owners !== undefined) updateData.owners = owners;
        if (rooms !== undefined) updateData.rooms = rooms;
        if (settings !== undefined) updateData.settings = settings;

        // Update the team
        await db('teams')
            .where({ id: team_id })
            .update(updateData);

        // Fetch the updated team
        const updatedTeam = await db('teams')
            .where({ id: team_id })
            .first(['id', 'name', 'members', 'owners', 'rooms', 'invite_code', 'settings']);

        return NextResponse.json({
            message: 'Team updated successfully',
            team: updatedTeam
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

export async function POST(request: Request) {
    try {
        // Get the current user session
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse the request body
        const body = await request.json();
        const { teamId, userId, action, roomId } = body;

        if (!teamId || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get the team from the database
        const team = await db('teams').where('id', teamId).first();

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Handle different actions
        if (action === 'add_member') {
            // Initialize members array if it doesn't exist
            let members = team.members || [];

            // Add the user to members if not already there
            if (!members.includes(userId) && userId) {
                members.push(userId);

                // Update the team in the database
                await db('teams')
                    .where('id', teamId)
                    .update({
                        members: members,
                        updated_at: new Date().toISOString()
                    });
            }
        } else if (action === 'remove_member') {
            // Remove the user from members
            const members = (team.members || []).filter((id: string) => id !== userId);

            // Update the team in the database
            await db('teams')
                .where('id', teamId)
                .update({
                    members: members,
                    updated_at: new Date().toISOString()
                });
        } else if (action === 'add_room') {
            // Initialize rooms array if it doesn't exist
            let rooms = team.rooms || [];

            // Add the room to rooms if not already there and roomId exists
            if (!rooms.includes(roomId) && roomId) {
                rooms.push(roomId);

                // Update the team in the database
                await db('teams')
                    .where('id', teamId)
                    .update({
                        rooms: db.raw('?', [rooms]),
                        updated_at: new Date().toISOString()
                    });
            }
        } else if (action === 'remove_room') {
            // Remove the room from rooms
            const rooms = (team.rooms || []).filter((id: string) => id !== roomId);

            // Update the team in the database
            await db('teams')
                .where('id', teamId)
                .update({
                    rooms: db.raw('?', [rooms]),
                    updated_at: new Date().toISOString()
                });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error updating team:', error);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}
