'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    FileText,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Settings
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession, signOut } from 'next-auth/react';
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar"

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();

    const navigation = [
        { name: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
        { name: 'Signups', href: '/dashboard/signups', icon: FileText },
        ...(['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') ? [
            { name: 'Users', href: '/dashboard/users', icon: Users },
        ] : []),
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    return (
        <div
            className={cn(
                "relative flex flex-col border-r border-gray-100 bg-white shadow-xl shadow-gray-200/50 z-20 transition-all duration-300",
                isCollapsed ? "w-20" : "w-72"
            )}
        >
            {/* Header */}
            <div className="flex h-20 items-center justify-between px-6">
                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                            <span className="text-white font-bold text-lg">V</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-gray-900">Vellko<span className="text-red-600"> Affiliates</span></span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                        "text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8 transition-all",
                        !isCollapsed && "ml-auto"
                    )}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-8 px-4">
                <nav className="space-y-2">
                    {navigation.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 outline-none ring-0",
                                    isActive
                                        ? "bg-red-50 text-red-700"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80",
                                    isCollapsed && "justify-center px-2"
                                )}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <Icon className={cn(
                                    "h-[1.15rem] w-[1.15rem] transition-colors",
                                    isActive ? "text-red-600" : "text-gray-400 group-hover:text-gray-600"
                                )} />
                                {!isCollapsed && <span>{item.name}</span>}
                                {isActive && !isCollapsed && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600 shadow-sm shadow-red-500/50" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100/50">
                <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                    <Avatar className="h-9 w-9 border border-gray-200 shadow-sm cursor-pointer transition-transform hover:scale-105">
                        <AvatarFallback className="bg-gray-900 text-white font-medium text-xs">
                            {session?.user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                        </AvatarFallback>
                    </Avatar>

                    {!isCollapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate tracking-tight">{session?.user?.name}</span>
                            <span className="text-[10px] text-gray-400 truncate uppercase tracking-wider">{session?.user?.role || "USER"}</span>
                        </div>
                    )}

                    {!isCollapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="ml-auto h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
