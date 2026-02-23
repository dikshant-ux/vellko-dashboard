'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    FileText,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Settings,
    Zap,
    HelpCircle,
    ChevronDown,
    BarChart2
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
    const [isOffersOpen, setIsOffersOpen] = useState(false);
    const [isQAOpen, setIsQAOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();

    useEffect(() => {
        if (pathname.startsWith('/dashboard/offers')) {
            setIsOffersOpen(true);
        }
        if (pathname.startsWith('/dashboard/qa-forms')) {
            setIsQAOpen(true);
        }
    }, [pathname]);

    const navigation = [
        { name: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
        { name: 'Signups', href: '/dashboard/signups', icon: FileText },
        { name: 'Offers', href: '/dashboard/offers', icon: Zap },
        ...(['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') ? [
            { name: 'Users', href: '/dashboard/users', icon: Users },
            { name: 'Q/A Forms', href: '/dashboard/qa-forms', icon: HelpCircle },
        ] : []),
        ...((['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') ||
            ['Web Traffic', 'Both'].includes(session?.user?.application_permission || '')) &&
            session?.user?.application_permission !== 'Call Traffic' ? [
            { name: 'Reports', href: '/dashboard/reports', icon: BarChart2 },
        ] : []),
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    return (
        <div
            className={cn(
                "relative flex flex-col border-r border-gray-100 bg-white shadow-xl shadow-gray-200/50 z-20 transition-all duration-300 h-full",
                isCollapsed ? "w-16" : "w-59"
            )}
        >
            {/* Header */}
            <div className={cn("flex h-20 items-center px-4", isCollapsed ? "justify-center" : "justify-between")}>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 min-w-[2rem] rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                        <span className="text-white font-bold text-lg">V</span>
                    </div>
                    {!isCollapsed && (
                        <span className="font-bold text-lg tracking-tight text-gray-900 truncate">Vellko<span className="text-red-600"> Affiliates</span></span>
                    )}
                </div>
                {!isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8 transition-all shrink-0 ml-auto"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {isCollapsed && (
                <div className="flex justify-center pb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full h-6 w-6 transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-8 px-4">
                <nav className="space-y-2">
                    {navigation.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const isOffers = item.name === 'Offers';
                        const Icon = item.icon;

                        if (isOffers) {
                            return (
                                <div key={item.name} className="space-y-1">
                                    <div
                                        className={cn(
                                            "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 outline-none ring-0 cursor-pointer",
                                            isActive && !pathname.includes('shared')
                                                ? "bg-red-50 text-red-700"
                                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                        onClick={() => setIsOffersOpen(!isOffersOpen)}
                                        title={isCollapsed ? item.name : undefined}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Icon className={cn(
                                                "h-[1.15rem] w-[1.15rem] transition-colors",
                                                isActive && !pathname.includes('shared') ? "text-red-600" : "text-gray-400 group-hover:text-gray-600"
                                            )} />
                                            {!isCollapsed && <span>{item.name}</span>}
                                        </div>

                                        {!isCollapsed && (
                                            <ChevronRight
                                                className={cn(
                                                    "h-4 w-4 transition-transform text-gray-400",
                                                    isOffersOpen && "rotate-90"
                                                )}
                                            />
                                        )}
                                    </div>

                                    {!isCollapsed && isOffersOpen && (
                                        <div className="space-y-1 ml-4 pl-2 border-l border-gray-100">
                                            <Link
                                                href="/dashboard/offers"
                                                className={cn(
                                                    "group flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                                                    pathname === '/dashboard/offers'
                                                        ? "text-red-700 bg-red-50/50"
                                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                                                )}
                                            >
                                                <span>All Offers</span>
                                            </Link>
                                            <Link
                                                href="/dashboard/offers/shared"
                                                className={cn(
                                                    "group flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                                                    pathname.includes('/offers/shared')
                                                        ? "text-red-700 bg-red-50/50"
                                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                                                )}
                                            >
                                                <span>Shared Links</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const isQA = item.name === 'Q/A Forms';
                        if (isQA) {
                            const showWeb = session?.user?.role === 'SUPER_ADMIN' || ['Web Traffic', 'Both'].includes(session?.user?.application_permission || '');
                            const showCall = session?.user?.role === 'SUPER_ADMIN' || ['Call Traffic', 'Both'].includes(session?.user?.application_permission || '');

                            return (
                                <div key={item.name} className="space-y-1">
                                    <div
                                        className={cn(
                                            "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 outline-none ring-0 cursor-pointer",
                                            isActive
                                                ? "bg-red-50 text-red-700"
                                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                        onClick={() => setIsQAOpen(!isQAOpen)}
                                        title={isCollapsed ? item.name : undefined}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Icon className={cn(
                                                "h-[1.15rem] w-[1.15rem] transition-colors",
                                                isActive ? "text-red-600" : "text-gray-400 group-hover:text-gray-600"
                                            )} />
                                            {!isCollapsed && <span>{item.name}</span>}
                                        </div>

                                        {!isCollapsed && (
                                            <ChevronRight
                                                className={cn(
                                                    "h-4 w-4 transition-transform text-gray-400",
                                                    isQAOpen && "rotate-90"
                                                )}
                                            />
                                        )}
                                    </div>

                                    {!isCollapsed && isQAOpen && (
                                        <div className="space-y-1 ml-4 pl-2 border-l border-gray-100">
                                            {showWeb && (
                                                <Link
                                                    href="/dashboard/qa-forms/web"
                                                    className={cn(
                                                        "group flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                                                        pathname === '/dashboard/qa-forms/web'
                                                            ? "text-red-700 bg-red-50/50"
                                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                                                    )}
                                                >
                                                    <span>Web Forms</span>
                                                </Link>
                                            )}
                                            {showCall && (
                                                <Link
                                                    href="/dashboard/qa-forms/call"
                                                    className={cn(
                                                        "group flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                                                        pathname === '/dashboard/qa-forms/call'
                                                            ? "text-red-700 bg-red-50/50"
                                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                                                    )}
                                                >
                                                    <span>Call Forms</span>
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }

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
            <div className={cn("border-t border-gray-100/50 transition-all", isCollapsed ? "p-2" : "p-4")}>
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

