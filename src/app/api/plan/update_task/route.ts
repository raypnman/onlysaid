import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { TaskStatus } from '@/types/plan';

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        // Extract all possible fields from the request body
        const {
            id,
            plan_id,
            task_name,
            task_explanation,
            expected_result,
            mcp_server,
            status,
            start_time,
            skills,
            logs,
            step_number,
            reset_tasks
        } = body;

        // Handle batch reset of tasks by plan_id
        if (reset_tasks && plan_id) {
            console.log('Resetting all tasks for plan:', plan_id);

            // Reset all tasks for this plan
            const updatedCount = await db('task')
                .where({ plan_id: plan_id })
                .update({
                    status: 'not_started',
                    start_time: null,
                    completed_at: null,
                    updated_at: new Date()
                });

            return NextResponse.json({
                message: `${updatedCount} tasks reset successfully`,
            }, { status: 200 });
        }

        // Validate required fields for single task update
        if (!id) {
            return NextResponse.json({
                error: 'Missing required field: id'
            }, { status: 400 });
        }

        // Check if at least one field to update is provided
        if (!status &&
            start_time === undefined &&
            skills === undefined &&
            task_name === undefined &&
            task_explanation === undefined &&
            expected_result === undefined &&
            mcp_server === undefined &&
            logs === undefined &&
            step_number === undefined) {
            return NextResponse.json({
                error: 'No fields to update provided'
            }, { status: 400 });
        }

        // Validate status if provided
        if (status && !['pending', 'running', 'success', 'failure', 'denied', 'not_started'].includes(status)) {
            return NextResponse.json({
                error: 'Invalid status value. Must be one of: pending, running, success, failure, denied, not_started'
            }, { status: 400 });
        }

        // Check if task exists
        const task = await db('task').where('id', id).first();
        if (!task) {
            return NextResponse.json({
                error: 'Task not found'
            }, { status: 404 });
        }

        // Prepare update data
        const updateData: any = {};

        // Add new fields to updateData
        if (task_name !== undefined) {
            updateData.task_name = task_name;
        }

        if (task_explanation !== undefined) {
            updateData.task_explanation = task_explanation;
        }

        if (expected_result !== undefined) {
            updateData.expected_result = expected_result;
        }

        if (mcp_server !== undefined) {
            updateData.mcp_server = mcp_server;
        }

        if (status) {
            updateData.status = status;

            // If status is changed to 'running' and no start_time is provided, set it
            if (status === 'running' && !task.start_time && start_time === undefined) {
                updateData.start_time = new Date();
            }

            // If status is changed to 'success' or 'failure', set completed_at
            if ((status === 'success' || status === 'failure') && !task.completed_at) {
                updateData.completed_at = new Date();
            }
        }

        if (start_time !== undefined) {
            updateData.start_time = start_time ? new Date(start_time) : null;
        }

        // Handle skills update if provided
        if (skills !== undefined) {
            try {
                // For PostgreSQL JSONB, we'll use a raw query with proper JSON casting
                // This ensures the JSON is properly formatted for PostgreSQL
                const skillsJson = JSON.stringify(skills);

                // We'll handle the update separately for the skills field
                await db.raw(
                    `UPDATE task SET skills = ?::jsonb WHERE id = ?`,
                    [skillsJson, id]
                );

                // Remove skills from updateData since we've handled it separately
                delete updateData.skills;
            } catch (error) {
                console.error('Error processing skills JSON:', error);
                return NextResponse.json({
                    error: 'Invalid JSON format for skills field',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }, { status: 400 });
            }
        }

        // Handle logs update if provided
        if (logs !== undefined) {
            try {
                // Get the current logs from the database
                const currentTask = await db('task').where('id', id).first('logs');
                let currentLogs = {};

                // Parse current logs if they exist
                if (currentTask.logs) {
                    try {
                        currentLogs = typeof currentTask.logs === 'string'
                            ? JSON.parse(currentTask.logs)
                            : currentTask.logs;
                    } catch (e) {
                        // If parsing fails, start with empty object
                        currentLogs = {};
                    }
                }

                // Use step_number from request body if provided, otherwise use a default key
                const logKey = step_number !== undefined ? step_number.toString() : 'latest';

                // Update logs with the new data for this step
                const updatedLogs = {
                    ...currentLogs,
                    [logKey]: logs
                };

                const logsJson = JSON.stringify(updatedLogs);

                // Update logs in the database
                await db.raw(
                    `UPDATE task SET logs = ?::jsonb WHERE id = ?`,
                    [logsJson, id]
                );

                // Remove logs from updateData since we've handled it separately
                delete updateData.logs;
            } catch (error) {
                console.error('Error processing logs JSON:', error);
                return NextResponse.json({
                    error: 'Invalid JSON format for logs field',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }, { status: 400 });
            }
        }

        // Update task in database
        const updatedTask = await db('task')
            .where('id', id)
            .update(updateData)
            .returning('*');

        // Format the response - handle both string and object cases for skills and logs
        const formattedTask = updatedTask[0];
        let parsedSkills = null;
        if (formattedTask.skills) {
            try {
                parsedSkills = typeof formattedTask.skills === 'string' ?
                    JSON.parse(formattedTask.skills) : formattedTask.skills;
            } catch (e) {
                parsedSkills = formattedTask.skills;
            }
        }

        let parsedLogs = {};
        if (formattedTask.logs) {
            try {
                parsedLogs = typeof formattedTask.logs === 'string' ?
                    JSON.parse(formattedTask.logs) : formattedTask.logs;
            } catch (e) {
                parsedLogs = formattedTask.logs;
            }
        }

        return NextResponse.json({
            message: 'Task updated successfully',
            task: {
                ...formattedTask,
                skills: parsedSkills,
                logs: parsedLogs
            }
        }, { status: 200 });
    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}