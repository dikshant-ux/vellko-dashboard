'use client';

import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row">
            <div className="hidden md:block h-full">
                <Sidebar />
            </div>
            <MobileNav />
            <main className="flex-1 overflow-y-auto">
                <div className="container mx-auto p-4 md:p-8 max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
