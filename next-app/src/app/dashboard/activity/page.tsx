'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    History,
    Search,
    User as UserIcon,
    Calendar,
    Info,
    Monitor,
    Loader2,
    ArrowUpDown,
    CheckCircle2,
    XCircle,
    UserPlus,
    UserMinus,
    FormInput,
    Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

interface ActivityLog {
    _id: string;
    username: string;
    action: string;
    details: string;
    api_type?: string;
    target_id?: string;
    timestamp: string;
    ip_address?: string;
}

export default function ActivityLogPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const limit = 50;

    const fetchLogs = async (page: number) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/activity?page=${page}&limit=${limit}`, {
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setTotalPages(data.pages);
                setTotalLogs(data.total);
                setCurrentPage(data.page);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Double check permissions (frontend guard)
        if (session && session.user.role !== 'SUPER_ADMIN') {
            router.push('/dashboard/overview');
            return;
        }

        if (session) {
            fetchLogs(currentPage);
        }
    }, [session, router, currentPage]);

    const filteredLogs = logs.filter(log =>
        log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getActionIcon = (action: string) => {
        if (action.includes('Approved')) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        if (action.includes('Rejected')) return <XCircle className="h-4 w-4 text-red-500" />;
        if (action.includes('Created User')) return <UserPlus className="h-4 w-4 text-blue-500" />;
        if (action.includes('Deleted User')) return <UserMinus className="h-4 w-4 text-orange-500" />;
        if (action.includes('QA Form')) return <FormInput className="h-4 w-4 text-purple-500" />;
        if (action.includes('Activated')) return <Play className="h-4 w-4 text-indigo-500" />;
        return <Info className="h-4 w-4 text-gray-400" />;
    };

    const getActionColor = (action: string) => {
        if (action.includes('Approved')) return 'bg-green-50 text-green-700 border-green-100';
        if (action.includes('Rejected')) return 'bg-red-50 text-red-700 border-red-100';
        if (action.includes('Created')) return 'bg-blue-50 text-blue-700 border-blue-100';
        if (action.includes('Deleted')) return 'bg-orange-50 text-orange-700 border-orange-100';
        if (action.includes('QA Form')) return 'bg-purple-50 text-purple-700 border-purple-100';
        return 'bg-gray-50 text-gray-700 border-gray-100';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Activity Log</h1>
                    <p className="text-gray-500 text-sm mt-1">Monitor administrative actions and platform updates.</p>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search on this page..."
                                className="pl-10 bg-white border-gray-200 focus:ring-red-500 focus:border-red-500 transition-all h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                Total {totalLogs} actions
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || isLoading}
                                    className="h-8 w-8 p-0"
                                >
                                    &lt;
                                </Button>
                                <span className="text-xs font-medium px-2">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || isLoading}
                                    className="h-8 w-8 p-0"
                                >
                                    &gt;
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                                <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
                            </div>
                        )}
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Local Time</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">User</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Action</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Details</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <tr key={log._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                        {format(new Date(log.timestamp.endsWith('Z') ? log.timestamp : `${log.timestamp}Z`), 'MMM d, yyyy')}
                                                    </div>
                                                    <div className="text-xs text-gray-500 ml-5">
                                                        {format(new Date(log.timestamp.endsWith('Z') ? log.timestamp : `${log.timestamp}Z`), 'HH:mm:ss')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-bold text-white border border-gray-900 shadow-sm">
                                                        {log.username.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-900">{log.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge variant="outline" className={`font-semibold flex items-center gap-1.5 w-fit ${getActionColor(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                    {log.action}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2 max-w-xl">
                                                    <span className="text-sm text-gray-600 leading-relaxed">{log.details}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-gray-50 w-fit px-2 py-1 rounded border border-gray-100">
                                                    <Monitor className="h-3 w-3" />
                                                    {log.ip_address || 'Unknown'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <History className="h-8 w-8 text-gray-200" />
                                                <p className="text-sm text-gray-500">No activity logs found for this page.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50/30">
                            <div className="text-xs text-gray-500">
                                Showing page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || isLoading}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || isLoading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
