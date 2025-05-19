import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db, { DBTABLES } from "@/lib/db";
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const metadataStr = formData.get('metadata') as string;
        const metadata = metadataStr ? JSON.parse(metadataStr) : {};

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Create workspace storage directory if it doesn't exist
        const { workspaceId } = await params;
        const storageDir = path.join(process.cwd(), 'storage', workspaceId);
        await fs.mkdir(storageDir, { recursive: true });

        // Generate unique filename
        const fileId = uuidv4();
        const fileExt = path.extname(file.name);
        const storagePath = path.join(storageDir, `${fileId}${fileExt}`);

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(storagePath, buffer);

        // Save file metadata to database
        const fileRecord = await db(DBTABLES.FILES).insert({
            id: fileId,
            workspace_id: workspaceId,
            name: file.name,
            size: file.size,
            mime_type: file.type,
            storage_path: storagePath,
            user_id: authenticated.userId,
            ...metadata
        }).returning('*');

        return NextResponse.json(
            { message: "File uploaded successfully", data: fileRecord[0] },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const { workspaceId } = await params;

    if (!fileId) {
        // List files in workspace
        const files = await db(DBTABLES.FILES)
            .where('workspace_id', workspaceId)
            .select('*');

        return NextResponse.json(
            { message: "Files retrieved", data: files },
            { status: 200 }
        );
    } else {
        // Get specific file
        const file = await db(DBTABLES.FILES)
            .where({
                id: fileId,
                workspace_id: workspaceId
            })
            .first();

        if (!file) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        try {
            const fileStream = createReadStream(file.storage_path);
            const readable = Readable.fromWeb(fileStream as any);

            return new Response(readable, {
                headers: {
                    'Content-Type': file.mime_type,
                    'Content-Disposition': `attachment; filename="${file.name}"`,
                    'Content-Length': String(file.size)
                }
            });
        } catch (error) {
            console.error("Error streaming file:", error);
            return NextResponse.json(
                { error: "Failed to read file" },
                { status: 500 }
            );
        }
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
        return NextResponse.json(
            { error: "File ID is required" },
            { status: 400 }
        );
    }

    try {
        // Get file details
        const file = await db(DBTABLES.FILES)
            .where({
                id: fileId,
                workspace_id: params.workspaceId
            })
            .first();

        if (!file) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        // Delete from filesystem
        await fs.unlink(file.storage_path);

        // Delete from database
        await db(DBTABLES.FILES)
            .where('id', fileId)
            .delete();

        return NextResponse.json(
            { message: "File deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error deleting file:", error);
        return NextResponse.json(
            { error: "Failed to delete file" },
            { status: 500 }
        );
    }
}