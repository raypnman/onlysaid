import { authenticateRequest, unauthorized } from "@/utils/auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { DBTABLES } from "@/lib/db";
import { inDevelopment } from "@/utils/common";

export async function POST(request: Request) {
    return inDevelopment();
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

