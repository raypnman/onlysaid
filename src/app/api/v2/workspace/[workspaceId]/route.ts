import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db, { DBTABLES } from "@/lib/db";
import { IWorkspace } from "@/../../types/Workspace/Workspace"; // Assuming IWorkspace is here
import fs from 'fs';
import path from 'path';

// Define the expected structure for the request body for updates
interface IUpdateWorkspacePayload {
    name?: string;
    image?: string;
    settings?: Record<string, any>;
    // Add other updatable fields as needed
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated || !authenticated.user) { // Ensure userId is present for audit or permissions
        return unauthorized();
    }

    const { workspaceId } = await params;
    if (!workspaceId) {
        // This case should ideally be handled by Next.js routing if the param is missing
        return NextResponse.json({ message: "Workspace ID parameter is missing" }, { status: 400 });
    }

    try {
        const body: IUpdateWorkspacePayload = await request.json();

        if (Object.keys(body).length === 0) {
            return NextResponse.json({ message: "No update data provided" }, { status: 400 });
        }

        // Optional: Permission Check
        // Verify if authenticated.userId has permission to update this workspaceId.
        // This might involve checking their role in the DBTABLES.WORKSPACE_USERS table.
        // Example (conceptual):
        // const userRole = await db(DBTABLES.WORKSPACE_USERS)
        //     .where({ user_id: authenticated.userId, workspace_id: workspaceId })
        //     .first();
        // if (!userRole || !['admin', 'super_admin'].includes(userRole.role)) {
        //     return NextResponse.json({ message: "Forbidden: You don't have permission to update this workspace." }, { status: 403 });
        // }

        const updatePayload: Partial<IWorkspace> = {
            ...body, // Spread the fields from the request body
            updated_at: new Date().toISOString(),
        };

        // Remove workspaceId from payload if it was accidentally sent in the body, as it's from URL param
        if ('workspaceId' in updatePayload) {
            delete (updatePayload as any).workspaceId;
        }
        if ('id' in updatePayload) { // also check for 'id'
            delete (updatePayload as any).id;
        }


        const updatedWorkspaces = await db(DBTABLES.WORKSPACES)
            .where({ id: workspaceId })
            .update(updatePayload)
            .returning('*');

        if (!updatedWorkspaces || updatedWorkspaces.length === 0) {
            return NextResponse.json({ message: "Workspace not found or update failed" }, { status: 404 });
        }

        return NextResponse.json(
            { message: "Workspace updated successfully", data: updatedWorkspaces[0] },
            { status: 200 }
        );

    } catch (error) {
        console.error(`Error updating workspace ${workspaceId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: `Failed to update workspace: ${errorMessage}` },
            { status: 500 }
        );
    }
}

// You can also implement GET (for a single workspace), DELETE (for a single workspace) here.
// For example:
export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }
    const { workspaceId } = await params;
    try {
        const workspace = await db(DBTABLES.WORKSPACES).where({ id: workspaceId }).first();
        if (!workspace) {
            return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
        }
        // Add role if needed by joining with WORKSPACE_USERS
        return NextResponse.json({ message: "Workspace fetched", data: workspace }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching workspace ${workspaceId}:`, error);
        return NextResponse.json({ message: "Failed to fetch workspace" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated || !authenticated.user) {
        return unauthorized();
    }
    const { workspaceId } = await params;

    // Add permission checks here: only admins/owners should delete.

    try {
        // Optional: Clean up storage directory
        const storageDir = path.join(process.cwd(), 'storage', workspaceId);
        // Check if directory exists before attempting to remove
        if (fs.existsSync(storageDir)) {
            await fs.promises.rm(storageDir, { recursive: true, force: true }); // Use with caution
        }


        // Delete related records first (e.g., in WORKSPACE_USERS, FILES, etc.)
        // This depends on your DB schema and cascading rules.
        // Example:
        await db(DBTABLES.WORKSPACE_USERS).where({ workspace_id: workspaceId }).delete();
        await db(DBTABLES.FILES).where({ workspace_id: workspaceId }).delete(); // If you have a FILES table

        const deletedCount = await db(DBTABLES.WORKSPACES).where({ id: workspaceId }).delete();

        if (deletedCount === 0) {
            return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Workspace deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error(`Error deleting workspace ${workspaceId}:`, error);
        return NextResponse.json({ message: "Failed to delete workspace" }, { status: 500 });
    }
}
