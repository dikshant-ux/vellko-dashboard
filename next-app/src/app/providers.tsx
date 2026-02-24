'use client';

import { SessionProvider } from "next-auth/react";
import { Toaster } from 'sonner';
import { GlobalClickTracker } from "@/components/providers/GlobalClickTracker";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <GlobalClickTracker>
                {children}
            </GlobalClickTracker>
            <Toaster richColors position="top-right" />
        </SessionProvider>
    );
}
