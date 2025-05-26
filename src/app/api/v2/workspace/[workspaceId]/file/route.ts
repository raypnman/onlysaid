import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db, { DBTABLES } from "@/lib/db";
import { createReadStream } from 'fs';
import { IFile } from '@/../../types/File/File';
import { backendSocketClient } from '@/lib/socketClient';

// Progress tracking via socket events
const uploadProgress = new Map<string, {
    stage: 'parsing' | 'validating' | 'writing' | 'database' | 'complete';
    progress: number;
    startTime: number;
}>();

// Helper to update progress
function updateProgress(
    operationId: string,
    stage: 'parsing' | 'validating' | 'writing' | 'database' | 'complete',
    progress: number,
    userId: string
) {
    uploadProgress.set(operationId, {
        stage,
        progress,
        startTime: uploadProgress.get(operationId)?.startTime || Date.now()
    });

    console.log(`📊 Upload ${operationId}: ${stage} - ${progress}%`);

    // Use new backend socket client
    backendSocketClient.emit('broadcast:file:progress', {
        operationId,
        progress,
        stage,
        userId
    });

    if (stage === 'complete') {
        backendSocketClient.emit('broadcast:file:completed', {
            operationId,
            userId
        });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const operationId = request.headers.get('x-operation-id') || uuidv4();
    const authenticated = await authenticateRequest(request);

    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

    const userId = authenticated.user?.id;

    // Initialize progress tracking
    updateProgress(operationId, 'parsing', 0, userId);

    // Check content length first
    const contentLength = request.headers.get('content-length');
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (contentLength && parseInt(contentLength) > maxSize) {
        uploadProgress.delete(operationId);
        return NextResponse.json(
            { error: "File too large. Maximum size is 100MB." },
            { status: 413 }
        );
    }

    try {
        updateProgress(operationId, 'parsing', 5, userId);

        let formData;
        try {
            formData = await request.formData();
            updateProgress(operationId, 'parsing', 20, userId);
        } catch (error) {
            uploadProgress.delete(operationId);
            return NextResponse.json(
                { error: "File too large. Maximum size is 100MB." },
                { status: 413 }
            );
        }

        console.log("formData", formData);
        const file = formData.get('file') as File;
        const metadataStr = formData.get('metadata') as string;
        const frontendMetadata = metadataStr ? JSON.parse(metadataStr) : {};

        // Stage 2: Validate File (20-30%)
        updateProgress(operationId, 'validating', 25, userId);

        if (!file) {
            uploadProgress.delete(operationId);
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Additional file size check after parsing
        if (file && file.size > maxSize) {
            uploadProgress.delete(operationId);
            return NextResponse.json(
                { error: "File too large. Maximum size is 100MB." },
                { status: 413 }
            );
        }

        updateProgress(operationId, 'validating', 30, userId);

        const { workspaceId } = await params;
        const baseStorageDir = path.join(process.cwd(), 'storage', workspaceId);

        const logicalTargetPath = frontendMetadata.targetPath || file.name;
        const logicalTargetDir = path.dirname(logicalTargetPath);
        const fullTargetDir = logicalTargetDir === '.' ? baseStorageDir : path.join(baseStorageDir, logicalTargetDir);

        // Stage 3: Prepare Storage (30-40%)
        updateProgress(operationId, 'writing', 35, userId);
        await fs.mkdir(fullTargetDir, { recursive: true });

        const fileId = uuidv4();
        const originalFileExtension = path.extname(file.name);
        const physicalFileNameWithExtension = fileId + originalFileExtension;
        const physicalStoragePath = path.join(fullTargetDir, physicalFileNameWithExtension);

        updateProgress(operationId, 'writing', 40, userId);

        // Stage 4: Write File with Progress (40-80%)
        const bytes = await file.arrayBuffer();
        updateProgress(operationId, 'writing', 60, userId);

        const buffer = Buffer.from(bytes);
        updateProgress(operationId, 'writing', 70, userId);

        await fs.writeFile(physicalStoragePath, buffer);
        updateProgress(operationId, 'writing', 80, userId);

        // Stage 5: Database Operations (80-95%)
        updateProgress(operationId, 'database', 85, userId);

        const fileRecord = await db(DBTABLES.FILES).insert({
            id: fileId,
            workspace_id: workspaceId,
            name: file.name,
            size: file.size,
            mime_type: file.type,
            path: physicalStoragePath,
            user_id: userId,
            metadata: frontendMetadata
        }).returning('*');

        updateProgress(operationId, 'database', 95, userId);

        // Stage 6: Complete (95-100%)
        updateProgress(operationId, 'complete', 100, userId);

        // Clean up progress tracking after a delay
        setTimeout(() => {
            uploadProgress.delete(operationId);
        }, 30000); // Keep for 30 seconds for final status checks

        return NextResponse.json({
            message: "File uploaded successfully",
            data: fileRecord[0] as IFile,
            operationId
        });
    } catch (error) {
        console.error("Error uploading file:", error);

        // Emit error through new socket client
        backendSocketClient.emit('broadcast:file:error', {
            operationId,
            error: (error as Error).message,
            userId
        });

        uploadProgress.delete(operationId);
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
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');

    if (operationId && uploadProgress.has(operationId)) {
        const progress = uploadProgress.get(operationId)!;
        return NextResponse.json({
            operationId,
            stage: progress.stage,
            progress: progress.progress,
            elapsedTime: Date.now() - progress.startTime
        });
    }

    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized();
    }

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