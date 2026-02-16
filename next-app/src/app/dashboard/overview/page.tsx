'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Clock, Activity, Trophy } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

            {/* Application Breakdown - Visible only to Super Admin or 'Both' permission users */}
            {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.application_permission === 'Both') && (
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-none shadow-md">
                    <CardHeader>
                        <CardTitle>Signup Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            {stats?.chart_data && stats.chart_data.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={stats.chart_data}
                                        margin={{
                                            top: 10,
                                            right: 30,
                                            left: 0,
                                            bottom: 0,
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="#e0e7ff" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/20 rounded-lg text-sm">
                                    <p>No activity data available yet.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3 border-none shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" /> Top Referrers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.top_referrers && stats.top_referrers.length > 0 ? (
                                stats.top_referrers.map((referrer: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-2 ring-background">
                                                {index + 1}
                                            </div>
                                            <div className="font-medium text-sm">{referrer.name}</div>
                                        </div>
                                        <div className="text-sm font-semibold flex items-center gap-1">
                                            {referrer.count} <span className="text-xs text-muted-foreground font-normal">signups</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">No referral data available.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
