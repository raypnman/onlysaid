import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db, { DBTABLES } from "@/lib/db";
import { inDevelopment } from "@/utils/common";
import { IAddUsersToWorkspaceArgs, IAddUserToWorkspaceRequest } from "@/../../types/Workspace/Workspace";

export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const userRequests = await request.json();
    const { workspaceId } = await params;

    const usersToInsert = userRequests.map((user: IAddUserToWorkspaceRequest) => ({
        workspace_id: workspaceId,
        user_id: user.user_id,
        role: user.role
    }));

    const workspace = await db(DBTABLES.WORKSPACE_USERS)
        .insert(usersToInsert)
        .returning('*');

    return NextResponse.json(
        { message: "Users added to workspace", data: workspace },
        { status: 200 }
    );
}

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const { workspaceId } = await params;

    const wu = DBTABLES.WORKSPACE_USERS;
    const u = DBTABLES.USERS;

    const workspaceUsers = await db(wu)
        .join(u, `${wu}.user_id`, '=', `${u}.id`)
        .where(`${wu}.workspace_id`, workspaceId)
        .select(`${wu}.*`, `${u}.username`, `${u}.avatar`, `${u}.last_login`)
        .returning('*');

    return NextResponse.json(
        { message: "Workspace users retrieved", data: workspaceUsers },
        { status: 200 }
    );
}

export async function PUT(request: Request) {
    return inDevelopment();
}

export async function DELETE(request: Request, { params }: { params: { workspaceId: string } }) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const { workspaceId } = await params;

    if (!userId) {
        return NextResponse.json(
            { message: "User ID is required" },
            { status: 400 }
        );
    }

    const deleted = await db(DBTABLES.WORKSPACE_USERS)
        .where('workspace_id', workspaceId)
        .where('user_id', userId)
        .delete()
        .returning('*');

    return NextResponse.json(
        { message: "Users removed from workspace", data: deleted },
        { status: 200 }
    );
}