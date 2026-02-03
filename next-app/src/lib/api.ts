import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper for client-side fetches
export async function fetchWithAuth(endpoint: string, options: any = {}) {
    // Note: getSession works on client side. For server component usage, use 'auth()' from route.ts
    // For now we assume client components usage heavily for dashboard interactivity.
    // However, calling getSession inside a fetch helper might be tricky if not in a component.
    // It's often better to pass the token or use a hook.
    // Let's keep it simple: we assume the caller handles token retrieval for now, 
    // OR we make this a function that accepts options including token.

    // Actually, for client side, we can structure this class/function to be used inside components where session is available.

    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
    }

    return res.json();
}
