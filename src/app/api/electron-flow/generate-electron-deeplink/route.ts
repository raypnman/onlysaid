import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import db from '@/lib/db';

const ELECTRON_PROTOCOL = 'onlysaid-electron';

export async function GET(request: NextRequest) {
    console.log('[App Router API /api/electron-flow/generate-deeplink] GET handler started.');

    try {
        // Get the session using getServerSession
        const session = await getServerSession(authOptions);
        console.log('session', session);

        if (session && session.user?.email) {
            console.log(`[App Router API] User is authenticated with session:`, session);

            // Check if user exists in database
            const user = await db('users').where({ email: session.user.email }).first();

            // If user doesn't exist, create one
            if (!user) {
                console.log(`[App Router API] User not found, creating new user for ${session.user.email}`);

                const userToInsert = {
                    email: session.user.email,
                    username: session.user.name ? session.user.name.split(' ')[0].toLowerCase() : session.user.email.split('@')[0],
                    avatar: session.user.image || null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    active_rooms: [],
                    archived_rooms: [],
                    teams: []
                };

                await db('users').insert(userToInsert);
                console.log(`[App Router API] User created successfully for ${session.user.email}`);
            }

            const sessionCookieName = authOptions.cookies?.sessionToken?.name ||
                (process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token');

            const cookieStore = await cookies();
            const sessionCookie = cookieStore.get(sessionCookieName);
            const sessionCookieValue = sessionCookie?.value;

            // Create a deeplink with the session token
            const deeplinkUrl = `${ELECTRON_PROTOCOL}://auth/callback?token=${encodeURIComponent(sessionCookieValue || '')}&cookieName=${encodeURIComponent(sessionCookieName)}`;
            console.log(`[App Router API] Redirecting to Electron deeplink: ${deeplinkUrl}`);

            return NextResponse.redirect(deeplinkUrl, 302);
        } else {
            console.error(`[App Router API] No session found. User is not authenticated.`);
            const errorDeeplinkUrl = `${ELECTRON_PROTOCOL}://auth/error?message=NoSessionFoundInRedirectAtElectron`;
            return NextResponse.redirect(errorDeeplinkUrl, 302);
        }
    } catch (error) {
        console.error('[App Router API] CRITICAL ERROR in handler:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorDeeplinkUrl = `${ELECTRON_PROTOCOL}://auth/error?message=DeeplinkGeneratorFailed&error=${encodeURIComponent(errorMsg)}`;
        return NextResponse.redirect(errorDeeplinkUrl, 302);
    }
}