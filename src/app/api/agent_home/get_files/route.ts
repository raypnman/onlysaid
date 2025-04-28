import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Define file/directory type
interface FileNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    extension?: string;
    children?: FileNode[];
}

/**
 * Recursively reads a directory and builds a file tree structure
 */
const readDirectoryRecursive = (dirPath: string, teamId: string, basePath: string = '/agent_home'): FileNode => {
    // Get the name of the current directory/file
    const name = path.basename(dirPath);

    // Construct the relative path correctly
    // First, get the path relative to the agent home directory
    const agentHomePath = process.env.AGENT_HOME_PATH || '/agent_home';
    const teamBasePath = path.join(agentHomePath, teamId);

    // Calculate the path relative to the team's directory
    let relativePath;
    if (dirPath.startsWith(teamBasePath)) {
        // If the path is already within the team directory, create a clean path
        relativePath = `/agent_home/${teamId}/${path.relative(teamBasePath, dirPath)}`;
    } else {
        // Fallback for unexpected paths
        relativePath = path.join(basePath, path.relative(agentHomePath, dirPath));
    }

    // Clean up the path (remove any double slashes)
    relativePath = relativePath.replace(/\/+/g, '/');

    const stats = fs.statSync(dirPath);

    if (stats.isFile()) {
        const extension = path.extname(dirPath).slice(1); // Remove the dot
        return {
            name,
            type: 'file',
            path: relativePath,
            extension
        };
    }

    if (stats.isDirectory()) {
        try {
            const items = fs.readdirSync(dirPath);
            const children = items.map(item => {
                const itemPath = path.join(dirPath, item);
                return readDirectoryRecursive(itemPath, teamId, basePath);
            });

            return {
                name,
                type: 'directory',
                path: relativePath,
                children
            };
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: []
            };
        }
    }

    // Default fallback (shouldn't reach here)
    return {
        name,
        type: 'file',
        path: relativePath
    };
};

export async function GET(req: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the requested path and teamId from query parameters
        const { searchParams } = new URL(req.url);
        const requestedPath = searchParams.get('path') || '';
        const teamId = searchParams.get('teamId');

        // Ensure teamId is provided
        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        // Ensure the agent home path is set in environment variables
        const agentHomePath = process.env.AGENT_HOME_PATH;
        if (!agentHomePath) {
            return NextResponse.json({ error: 'AGENT_HOME_PATH not configured' }, { status: 500 });
        }

        // Create the team-specific path
        const teamBasePath = path.join(agentHomePath, teamId);

        // Create the directory if it doesn't exist
        if (!fs.existsSync(teamBasePath)) {
            try {
                fs.mkdirSync(teamBasePath, { recursive: true });
            } catch (error) {
                console.error(`Error creating team directory ${teamBasePath}:`, error);
                return NextResponse.json({ error: 'Failed to create team directory' }, { status: 500 });
            }
        }

        // Resolve the full path, ensuring it stays within the team's directory
        let fullPath;
        if (requestedPath) {
            fullPath = path.resolve(teamBasePath, requestedPath.replace(/^\/agent_home\/[^/]+/, ''));
        } else {
            fullPath = teamBasePath;
        }

        // Security check: ensure the path is within the team's directory
        if (!fullPath.startsWith(teamBasePath)) {
            return NextResponse.json({ error: 'Access denied: Path outside of allowed directory' }, { status: 403 });
        }

        // Check if path exists
        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: 'Path not found' }, { status: 404 });
        }

        // Get file stats
        const stats = fs.statSync(fullPath);

        let result;
        if (stats.isDirectory()) {
            // Read directory structure
            result = readDirectoryRecursive(fullPath, teamId, `/agent_home/${teamId}`);
        } else {
            // Return file info
            const name = path.basename(fullPath);
            const extension = path.extname(fullPath).slice(1);
            const relativePath = `/agent_home/${teamId}/${path.relative(teamBasePath, fullPath)}`;

            result = {
                name,
                type: 'file',
                path: relativePath,
                extension
            };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in GET /api/agent_home/get_files:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
