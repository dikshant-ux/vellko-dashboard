'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    LayoutDashboard,
    Users,
    FileText,
    LogOut,
    Settings,
    Menu
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";

export default function MobileNav() {
    const [open, setOpen] = useState(false);
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
        <div className="flex md:hidden items-center justify-between p-4 border-b bg-white">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 min-w-[2rem] rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                    <span className="text-white font-bold text-lg">V</span>
                </div>
                <span className="font-bold text-lg tracking-tight text-gray-900 truncate">Vellko<span className="text-red-600"> Affiliates</span></span>
            </div>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col">
                    <SheetHeader className="p-6 border-b">
                        <SheetTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">V</span>
                            </div>
                            <span>Vellko<span className="text-red-600"> Affiliates</span></span>
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto py-6 px-4">
                        <nav className="space-y-2">
                            {navigation.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 outline-none ring-0",
                                            isActive
                                                ? "bg-red-50 text-red-700"
                                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-colors",
                                            isActive ? "text-red-600" : "text-gray-400 group-hover:text-gray-600"
                                        )} />
                                        <span>{item.name}</span>
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600 shadow-sm shadow-red-500/50" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="border-t p-4 bg-gray-50">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-gray-200 shadow-sm">
                                <AvatarFallback className="bg-gray-900 text-white font-medium text-xs">
                                    {session?.user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-gray-900 truncate tracking-tight">{session?.user?.name}</span>
                                <span className="text-[10px] text-gray-400 truncate uppercase tracking-wider">{session?.user?.role || "USER"}</span>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="ml-auto h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
