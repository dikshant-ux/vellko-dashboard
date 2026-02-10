
import { useSession, signOut } from "next-auth/react";
import { useCallback } from "react";

export const useAuthFetch = () => {
    const { data: session } = useSession();

    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!session?.accessToken) {
            // No token, maybe redirect or let it fail?
            // Usually if we are here, we expect a token.
            // If we rely on middleware, we might not need this check, but good for safety.
        }

        const headers = {
            ...options.headers,
            Authorization: `Bearer ${session?.accessToken || ''}`,
        };

        try {
            const res = await fetch(url, { ...options, headers });

            if (res.status === 401) {
                console.warn("Unauthorized access - signing out...");
                await signOut({ callbackUrl: '/login' });
                return null; // Return null or throw error to stop processing
            }

            return res;
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }, [session]);

    return authFetch;
};
