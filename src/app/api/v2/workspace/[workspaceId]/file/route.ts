import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db, { DBTABLES } from "@/lib/db";
import { inDevelopment } from "@/utils/common";

export async function POST(request: Request) {
    const authenticated = await authenticateRequest(request);
    if (!authenticated) {
        return unauthorized();
    }

    console.log("POST");
}

export async function GET(request: Request) {
    return inDevelopment();
}

export async function PUT(request: Request) {
    return inDevelopment();
}

export async function DELETE(request: Request) {
    return inDevelopment();
}
