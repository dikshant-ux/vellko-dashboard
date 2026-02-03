import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;

    // Define protected routes
    const isDashboard = nextUrl.pathname.startsWith('/dashboard');

    // If trying to access dashboard while not logged in, redirect to home
    if (isDashboard && !isLoggedIn) {
        return NextResponse.redirect(new URL('/', nextUrl));
    }

    // Redirect logged in users away from login page
    if (nextUrl.pathname === "/login" && isLoggedIn) {
        return NextResponse.redirect(new URL("/dashboard/overview", nextUrl));
    }

    return NextResponse.next();
});

export const config = {
    // Match all paths except api, static files, images, and favicon
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
