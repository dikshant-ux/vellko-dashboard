'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Home, ChevronRight, ArrowLeft, LogOut, User as UserIcon, Menu } from 'lucide-react';
import { useBreadcrumbs } from '@/context/BreadcrumbContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MobileNav from './MobileNav';

export default function DashboardHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();
    const { labels } = useBreadcrumbs();

    const pathSegments = pathname.split('/').filter(Boolean);
    
    // Generate breadcrumbs
    const breadcrumbs = pathSegments.map((segment, index) => {
        let href = `/${pathSegments.slice(0, index + 1).join('/')}`;
        if (href === '/dashboard') href = '/dashboard/overview';
        
        const isLast = index === pathSegments.length - 1;
        
        // Lookup label in context, otherwise capitalize segment
        let label = labels[href] || labels[segment] || segment;
        
        // Special case: capitalize and replace hyphens
        if (label === segment) {
            label = segment
                .replace(/-/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        return { href, label, isLast };
    });

    return (
        <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="md:hidden">
                        <MobileNav />
                    </div>
                    
                    <nav className="flex items-center text-xs font-medium text-muted-foreground whitespace-nowrap overflow-hidden">
                        <Link href="/dashboard/overview" className="flex items-center hover:text-primary transition-colors">
                            <Home className="h-3.5 w-3.5" />
                        </Link>
                        
                        {breadcrumbs.length > 0 && <ChevronRight className="h-3.5 w-3.5 mx-1 opacity-50 shrink-0" />}
                        
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={`${crumb.href}-${idx}`}>
                                {crumb.isLast ? (
                                    <span className="text-foreground font-bold truncate max-w-[150px] sm:max-w-[300px]">
                                        {crumb.label}
                                    </span>
                                ) : (
                                    <>
                                        <Link href={crumb.href} className="hover:text-primary transition-colors">
                                            {crumb.label}
                                        </Link>
                                        <ChevronRight className="h-3.5 w-3.5 mx-1 opacity-50 shrink-0" />
                                    </>
                                )}
                            </React.Fragment>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => router.back()}
                        className="h-8 text-muted-foreground hidden sm:flex"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        Back
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Avatar className="h-9 w-9 border border-gray-200 shadow-sm cursor-pointer transition-transform hover:scale-105">
                                <AvatarFallback className="bg-gray-900 text-white font-medium text-xs">
                                    {session?.user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900">{session?.user?.name}</span>
                                    <span className="text-xs text-gray-500 font-normal">{session?.user?.email}</span>
                                    <span className="text-[10px] text-red-600 font-bold uppercase mt-1 tracking-wider">{session?.user?.role || "USER"}</span>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Profile Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} className="text-red-600 focus:bg-red-50 focus:text-red-600">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
