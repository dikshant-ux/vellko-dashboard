'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Clock, Activity, Trophy } from "lucide-react";
import { useAuthFetch } from '@/hooks/useAuthFetch';

export default function OverviewPage() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<any>(null);
    const authFetch = useAuthFetch();

    useEffect(() => {
        if (session?.accessToken) {
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`)
                .then(res => res ? res.json() : null)
                .then(data => {
                    if (data) setStats(data);
                })
                .catch(console.error);
        }
    }, [session, authFetch]);

    const StatCard = ({ title, value, icon: Icon, color, description, href }: any) => {
        const CardContentWrapper = () => (
            <Card className="border-none shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <div className={`p-2 rounded-full ${color} bg-opacity-10`}>
                        <Icon className={`h-4 w-4 ${color.replace('bg-', 'text-')}`} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{value ?? "-"}</div>
                    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                </CardContent>
            </Card>
        );

        if (href) {
            return (
                <Link href={href} className="block h-full">
                    <CardContentWrapper />
                </Link>
            );
        }

        return <CardContentWrapper />;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Welcome back, <span className="font-semibold text-primary">{session?.user?.name}</span>.</p>
                </div>
            </div>

            {/* Global Stats Row - Hidden for high-level roles to avoid confusion */}
            {!(session?.user?.role === 'SUPER_ADMIN' ||
                session?.user?.role === 'ADMIN' ||
                session?.user?.application_permission === 'Both') && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                        <StatCard
                            title="Pending Review"
                            value={stats?.pending}
                            icon={Clock}
                            color="bg-yellow-500"
                            description="Requires action"
                            href="/dashboard/signups?status=PENDING"
                        />
                        <StatCard
                            title="Approved"
                            value={stats?.approved}
                            icon={CheckCircle2}
                            color="bg-green-500"
                            description="Active affiliates"
                            href="/dashboard/signups?status=APPROVED"
                        />
                        <StatCard
                            title="Rejected"
                            value={stats?.rejected}
                            icon={XCircle}
                            color="bg-red-500"
                            description="Denied applications"
                            href="/dashboard/signups?status=REJECTED"
                        />
                        <StatCard
                            title="Total Signups"
                            value={stats?.total}
                            icon={Users}
                            color="bg-blue-500"
                            description="All time applications"
                            href="/dashboard/signups?status=ALL"
                        />
                    </div>
                )}

            {/* Application Breakdown - Visible to Admins or 'Both' permission users */}
            {(session?.user?.role === 'SUPER_ADMIN' ||
                session?.user?.role === 'ADMIN' ||
                session?.user?.application_permission === 'Both') && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-l-4 border-l-blue-500 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                                    <span>Cake (Web Traffic)</span>
                                    <div className="p-2 bg-blue-100 rounded-full"><Activity className="h-4 w-4 text-blue-600" /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Approved</p>
                                        <p className="text-xl font-bold text-green-600">{stats?.cake_stats?.approved ?? "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Pending</p>
                                        <p className="text-xl font-bold text-yellow-600">{stats?.cake_stats?.pending ?? "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Rejected</p>
                                        <p className="text-xl font-bold text-red-600">{stats?.cake_stats?.rejected ?? "-"}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Total Applications</span>
                                    <span className="font-bold">{stats?.cake_stats?.total ?? "-"}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                                    <span>Ringba (Call Traffic)</span>
                                    <div className="p-2 bg-purple-100 rounded-full"><Activity className="h-4 w-4 text-purple-600" /></div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Approved</p>
                                        <p className="text-xl font-bold text-green-600">{stats?.ringba_stats?.approved ?? "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Pending</p>
                                        <p className="text-xl font-bold text-yellow-600">{stats?.ringba_stats?.pending ?? "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Rejected</p>
                                        <p className="text-xl font-bold text-red-600">{stats?.ringba_stats?.rejected ?? "-"}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Total Applications</span>
                                    <span className="font-bold">{stats?.ringba_stats?.total ?? "-"}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {/* Global Top Referrers */}
                {/* <Card className="border-none shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Trophy className="h-5 w-5 text-yellow-500" /> Top Referrers (Total)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReferrerList items={stats?.top_referrers} />
                    </CardContent>
                </Card> */}

                {/* Cake Top Referrers */}
                <Card className="border-none shadow-md border-l-4 border-l-blue-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="h-5 w-5 text-blue-500" /> Top Cake Referrers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReferrerList items={stats?.top_cake_referrers} />
                    </CardContent>
                </Card>

                {/* Ringba Top Referrers */}
                <Card className="border-none shadow-md border-l-4 border-l-purple-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="h-5 w-5 text-purple-500" /> Top Ringba Referrers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReferrerList items={stats?.top_ringba_referrers} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const ReferrerList = ({ items }: { items: any[] }) => {
    if (!items || items.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-8">No referral data available.</p>;
    }

    return (
        <div className="space-y-3">
            {items.map((referrer: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {index + 1}
                        </div>
                        <div className="font-medium text-sm truncate max-w-[120px]">{referrer.name}</div>
                    </div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                        {referrer.count} <span className="text-xs text-muted-foreground font-normal">signups</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
