import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db, { DBTABLES } from "@/lib/db";
import { inDevelopment } from "@/utils/common";
import { IKnowledgeBase, IKnowledgeBaseRegisterArgs } from "@/../../types/KnowledgeBase/KnowledgeBase";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const { workspaceId } = await params;
    console.log("POST request received for workspaceId:", workspaceId);
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    console.log("workspaceId", workspaceId);

    if (!workspaceId) {
        return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    try {
        const body = await request.json() as IKnowledgeBaseRegisterArgs;
        console.log("body", body);

        const dataToInsert = {
            id: body.id,
            name: body.name,
            description: body.description,
            source: body.source,
            url: body.url,
            workspace_id: workspaceId,
            type: body.type,
            embedding_engine: body.embedding_engine,
        };

        const [newKb] = await db(DBTABLES.KNOWLEDGE_BASES)
            .insert(dataToInsert)
            .returning('*');

        return NextResponse.json(newKb as IKnowledgeBase, { status: 201 });

    } catch (error) {
        console.error("Error creating knowledge base:", error);
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: "Invalid JSON in request body" },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: "Failed to create knowledge base" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const { workspaceId } = await params;
    console.log("GET request received for workspace KBs, workspaceId:", workspaceId);

    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated || !authenticated.user?.id) {
        return unauthorized();
    }

    if (!workspaceId) {
        return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    try {
        // TODO: Add validation to ensure the authenticated user has access to this workspaceId
        // For now, we assume if authenticated, they can access any workspace's KBs if they know the ID.
        // This might need to be tied to a user_workspaces table or similar logic.

        const knowledgeBases: IKnowledgeBase[] = await db(DBTABLES.KNOWLEDGE_BASES)
            .where({ workspace_id: workspaceId })
            .select('*');

        if (!knowledgeBases) {
            return NextResponse.json([], { status: 200 });
        }

        return NextResponse.json(knowledgeBases, { status: 200 });

    } catch (error) {
        console.error(`Error fetching knowledge bases for workspace ${workspaceId}:`, error);
        return NextResponse.json(
            { error: "Failed to fetch knowledge bases" },
            { status: 500 }
        );
    }
}