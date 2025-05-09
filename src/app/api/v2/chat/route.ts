import { authenticateRequest } from "@/utils/auth";
import { NextResponse } from "next/server";
import { ICreateChatRequest, IChatRoom } from "@/../onlysaid-electron/src/types/Chat/Chatroom";
import db from "@/lib/db";
import { DBTABLES } from "@/lib/db";

export async function POST(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return NextResponse.json(
            { error: authenticated.error?.message },
            { status: authenticated.error?.status || 401 }
        );
    }

    const body: ICreateChatRequest = await request.json();
    const chatroom = await db(DBTABLES.CHATROOM)
        .insert(body)
        .returning('*');

    return NextResponse.json(
        { message: "Chatroom created", data: chatroom },
        { status: 200 }
    );

}

export async function GET(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return NextResponse.json(
            { error: authenticated.error?.message },
            { status: authenticated.error?.status || 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('userId');
    const type = searchParams.get('type');

    const chat = await db(DBTABLES.CHATROOM)
        .select('*')
        .where('type', type)
        .whereRaw('? = ANY(active_users)', [id]);

    return NextResponse.json(
        { data: chat },
        { status: 200 }
    );
}

export async function PUT(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return NextResponse.json(
            { error: authenticated.error?.message },
            { status: authenticated.error?.status || 401 }
        );
    }

    const body: IChatRoom = await request.json();

    const chat = await db(DBTABLES.CHATROOM)
        .update(body)
        .where('id', body.id)
        .returning('*');

    return NextResponse.json(
        { message: "Chatroom updated", data: chat },
        { status: 200 }
    );
}

export async function DELETE(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated.isAuthenticated) {
        return NextResponse.json(
            { error: authenticated.error?.message },
            { status: authenticated.error?.status || 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const chat = await db(DBTABLES.CHATROOM)
        .delete()
        .where('id', id);

    return NextResponse.json(
        { message: "Chatroom deleted" },
        { status: 200 }
    );
}
