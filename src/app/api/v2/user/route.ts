import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { DBTABLES } from "@/lib/db";
import { inDevelopment } from "@/utils/common";


export async function POST(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized(authenticated.error);
    }

    const body = await request.json();
    const ids = body.ids;

    const users = await db(DBTABLES.USERS)
        .whereIn('id', ids)
        .select('*')
        .returning('*');

    return NextResponse.json(
        { data: users },
        { status: 200 }
    );
}

export async function GET(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return unauthorized(authenticated.error);
    }

}

export async function PUT(request: Request) {
    return inDevelopment();
}

export async function DELETE(request: Request) {
    return inDevelopment();
}

