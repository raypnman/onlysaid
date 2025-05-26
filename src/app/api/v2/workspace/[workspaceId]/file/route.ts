import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db, { DBTABLES } from "@/lib/db";
import { createReadStream } from 'fs';
import { IFile } from '@/../../types/File/File';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    // Check content length first
    const contentLength = request.headers.get('content-length');
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (contentLength && parseInt(contentLength) > maxSize) {
        return NextResponse.json(
            { error: "File too large. Maximum size is 100MB." },
            { status: 413 }
        );
    }

    try {
        // For large files, use a try-catch around formData parsing
        let formData;
        try {
            formData = await request.formData();
        } catch (error) {
            // If formData parsing fails due to size, return 413
            return NextResponse.json(
                { error: "File too large. Maximum size is 100MB." },
                { status: 413 }
            );
        }

        console.log("formData", formData);
        const file = formData.get('file') as File;

        // Additional file size check after parsing
        if (file && file.size > maxSize) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 100MB." },
                { status: 413 }
            );
        }

        const metadataStr = formData.get('metadata') as string;
        const frontendMetadata = metadataStr ? JSON.parse(metadataStr) : {};

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        const { workspaceId } = await params;
        const baseStorageDir = path.join(process.cwd(), 'storage', workspaceId);

        const logicalTargetPath = frontendMetadata.targetPath || file.name;
        const logicalTargetDir = path.dirname(logicalTargetPath);
        const fullTargetDir = logicalTargetDir === '.' ? baseStorageDir : path.join(baseStorageDir, logicalTargetDir);
        await fs.mkdir(fullTargetDir, { recursive: true });

        const fileId = uuidv4();
        const originalFileExtension = path.extname(file.name);
        const physicalFileNameWithExtension = fileId + originalFileExtension;
        const physicalStoragePath = path.join(fullTargetDir, physicalFileNameWithExtension);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(physicalStoragePath, buffer);

        const fileRecord = await db(DBTABLES.FILES).insert({
            id: fileId,
            workspace_id: workspaceId,
            name: file.name,
            size: file.size,
            mime_type: file.type,
            path: physicalStoragePath,
            user_id: authenticated.user?.id,
            metadata: frontendMetadata
        }).returning('*');

        return NextResponse.json(
            { message: "File uploaded successfully", data: fileRecord[0] as IFile },
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
        const files: IFile[] = await db(DBTABLES.FILES)
            .where('workspace_id', workspaceId)
            .select('*');

        const filesWithLogicalPath = files.map(f => ({
            ...f,
            logicalPath: f.metadata?.targetPath || null
        }));

        return NextResponse.json(
            { message: "Files retrieved", data: filesWithLogicalPath },
            { status: 200 }
        );
    } else {
        const file: IFile | undefined = await db(DBTABLES.FILES)
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
            // Check if file exists
            await fs.access(file.path);

            // Read the file as a buffer for smaller files, or use streaming for larger files
            const stats = await fs.stat(file.path);

            if (stats.size < 10 * 1024 * 1024) { // Less than 10MB, read into memory
                const fileBuffer = await fs.readFile(file.path);

                return new Response(new Uint8Array(fileBuffer), {
                    headers: {
                        'Content-Type': file.mime_type,
                        'Content-Disposition': `attachment; filename="${file.name}"`,
                        'Content-Length': String(file.size)
                    }
                });
            } else { // Larger files, use streaming
                const nodeStream = createReadStream(file.path);

                // Convert Node.js ReadStream to Web ReadableStream
                const webStream = new ReadableStream({
                    start(controller) {
                        nodeStream.on('data', (chunk) => {
                            const uint8Array = chunk instanceof Buffer ? new Uint8Array(chunk) : new Uint8Array(Buffer.from(chunk as string));
                            controller.enqueue(uint8Array);
                        });

                        nodeStream.on('end', () => {
                            controller.close();
                        });

                        nodeStream.on('error', (error) => {
                            controller.error(error);
                        });
                    },
                    cancel() {
                        nodeStream.destroy();
                    }
                });

                return new Response(webStream, {
                    headers: {
                        'Content-Type': file.mime_type,
                        'Content-Disposition': `attachment; filename="${file.name}"`,
                        'Content-Length': String(file.size)
                    }
                });
            }
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

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
        return NextResponse.json(
            { error: "File ID is required" },
            { status: 400 }
        );
    }

    try {
        const file: IFile | undefined = await db(DBTABLES.FILES)
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

        await fs.unlink(file.path);

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

export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';