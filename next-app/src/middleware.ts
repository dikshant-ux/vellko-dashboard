import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const session = req.auth;

    // Define protected routes
    const isDashboard = nextUrl.pathname.startsWith('/dashboard');

    // If trying to access dashboard while not logged in, redirect to home
    if (isDashboard && !isLoggedIn) {
        return NextResponse.redirect(new URL('/', nextUrl));
    }

    // Role-based redirects for ANALYTIC users
    if (isLoggedIn && session?.user?.role === 'ANALYTIC') {
        // Redirect away from overview to reports
        if (nextUrl.pathname === '/dashboard/overview' || nextUrl.pathname === '/dashboard') {
            return NextResponse.redirect(new URL('/dashboard/reports', nextUrl));
        }
    }

    // Redirect logged in users away from login page
    if (nextUrl.pathname === "/login" && isLoggedIn) {
        const redirectUrl = session?.user?.role === 'ANALYTIC' ? '/dashboard/reports' : '/dashboard/overview';
        return NextResponse.redirect(new URL(redirectUrl, nextUrl));
    }

    return NextResponse.next();
});

export const config = {
    // Match all paths except api, static files, images, and favicon
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
