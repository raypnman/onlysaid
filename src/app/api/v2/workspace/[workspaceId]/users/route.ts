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

    const usersToInsert = userRequests.map((user: IAddUserToWorkspaceRequest) => ({
        workspace_id: params.workspaceId,
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

    const wu = DBTABLES.WORKSPACE_USERS;
    const u = DBTABLES.USERS;

    const workspaceUsers = await db(wu)
        .join(u, `${wu}.user_id`, '=', `${u}.id`)
        .where(`${wu}.workspace_id`, params.workspaceId)
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

    const { userIds } = await request.json();

    const deleted = await db(DBTABLES.WORKSPACE_USERS)
        .where('workspace_id', params.workspaceId)
        .whereIn('user_id', userIds)
        .delete()
        .returning('*');

    return NextResponse.json(
        { message: "Users removed from workspace", data: deleted },
        { status: 200 }
    );
}
