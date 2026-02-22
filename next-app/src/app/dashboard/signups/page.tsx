'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Loader2, FileText, Calendar, Building2, User, ChevronLeft, Trash, Smartphone } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function SignupsContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');
    const authFetch = useAuthFetch();

    const [signups, setSignups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>(statusParam || 'PENDING');
    const [searchTerm, setSearchTerm] = useState('');
    const [referrers, setReferrers] = useState<{ id: string, name: string }[]>([]);
    const [filterReferral, setFilterReferral] = useState("all");
    const [filterAppType, setFilterAppType] = useState<string | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        // referrers is public or requires auth? Public router has /referrers
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrers`)
            .then(res => res.json())
            .then(data => setReferrers(data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (session?.user?.application_permission && filterAppType === null) {
            const permission = session.user.application_permission;
            if (permission === 'Call Traffic') {
                setFilterAppType('Call Traffic');
            } else {
                // Default to Web Traffic for Both or Web Traffic admins
                setFilterAppType('Web Traffic');
            }
        }
    }, [session, filterAppType]);

    useEffect(() => {
        if (session?.accessToken && filterAppType !== null) {
            setIsLoading(true);
            let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/signups`;
            const params = new URLSearchParams();

            if (filterStatus !== 'ALL') {
                params.append('status', filterStatus);
            }
            if (filterReferral && filterReferral !== 'all') {
                params.append('referral_id', filterReferral);
            }
            if (filterAppType) {
                params.append('application_type', filterAppType);
            }

            params.append('page', currentPage.toString());
            params.append('limit', limit.toString());

            const queryString = params.toString();
            if (queryString) {
                url += `?${queryString}`;
            }

            authFetch(url)
                .then(res => res ? res.json() : null)
                .then(data => {
                    if (data && data.items) {
                        setSignups(data.items);
                        setTotalCount(data.total);
                        setTotalPages(Math.ceil(data.total / limit));
                    } else {
                        // Fallback for non-paginated or error
                        setSignups(Array.isArray(data) ? data : []);
                        setTotalCount(0);
                        setTotalPages(1);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setIsLoading(false);
                });
        }
    }, [session, filterStatus, filterReferral, filterAppType, currentPage, limit, authFetch]);

    const filteredSignups = signups.filter(signup =>
        signup.companyInfo?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signup.accountInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatusBadge = ({ signup }: { signup: any }) => {
        const getDisplayStatus = (s: any) => {
            if (!s) return 'PENDING';
            const userPermission = session?.user?.application_permission;
            const userRole = session?.user?.role;
            const appType = s.marketingInfo?.applicationType;

            // If a specific traffic filter is active, show status for that integration
            if (filterAppType === 'Web Traffic') {
                if (s.status === 'REJECTED') return 'REJECTED';
                if (s.cake_api_status === 'APPROVED') return 'APPROVED';
                if (s.cake_api_status === 'REJECTED') return 'REJECTED';
                if (s.cake_api_status === 'FAILED') return 'FAILED (PENDING)';
                if (s.requested_cake_approval === true) return 'REQUESTED_FOR_APPROVAL';
                return 'PENDING';
            }

            if (filterAppType === 'Call Traffic') {
                if (s.status === 'REJECTED') return 'REJECTED';
                if (s.ringba_api_status === 'APPROVED') return 'APPROVED';
                if (s.ringba_api_status === 'REJECTED') return 'REJECTED';
                if (s.ringba_api_status === 'FAILED') return 'FAILED (PENDING)';
                if (s.requested_ringba_approval === true) return 'REQUESTED_FOR_APPROVAL';
                return 'PENDING';
            }

            if (appType !== 'Both') return s.status;

            if (userRole === 'SUPER_ADMIN' || userPermission === 'Both' || !userPermission) {

                const cake = s.cake_api_status;
                const ringba = s.ringba_api_status;

                // Fully approved
                if (cake === 'APPROVED' && ringba === 'APPROVED') {
                    return 'APPROVED';
                }

                // Fully rejected
                if (cake === 'REJECTED' && ringba === 'REJECTED') {
                    return 'REJECTED';
                }

                // Partial approval (one approved, one pending/rejected/failed/null)
                if (
                    (cake === 'APPROVED' && ringba !== 'APPROVED') ||
                    (ringba === 'APPROVED' && cake !== 'APPROVED')
                ) {
                    return 'PARTIALLY APPROVED';
                }

                // Both pending/null/failed
                if ((cake == null || cake === 'FAILED') && (ringba == null || ringba === 'FAILED')) {
                    if (cake === 'FAILED' || ringba === 'FAILED') return 'FAILED (PENDING)';
                    return 'PENDING';
                }

                return s.status;
            }


            if (userPermission === 'Web Traffic') {
                if (s.status === 'REJECTED') return 'REJECTED';
                if (s.cake_api_status === 'APPROVED') return 'APPROVED';
                if (s.cake_api_status === 'REJECTED') return 'REJECTED';
                if (s.cake_api_status === 'FAILED') return 'FAILED (PENDING)';
                if (s.requested_cake_approval === true) return 'REQUESTED_FOR_APPROVAL';
                return 'PENDING';
            }

            if (userPermission === 'Call Traffic') {
                if (s.status === 'REJECTED') return 'REJECTED';
                if (s.ringba_api_status === 'APPROVED') return 'APPROVED';
                if (s.ringba_api_status === 'REJECTED') return 'REJECTED';
                if (s.ringba_api_status === 'FAILED') return 'FAILED (PENDING)';
                if (s.requested_ringba_approval === true) return 'REQUESTED_FOR_APPROVAL';
                return 'PENDING';
            }

            return s.status;
        };

        const status = getDisplayStatus(signup);

        const variants: any = {
            PENDING: "bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 border-yellow-200",
            APPROVED: "bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200",
            REJECTED: "bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200",
            REQUESTED_FOR_APPROVAL: "bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-200",
            "PARTIALLY APPROVED": "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-200",
            "APPROVED (PARTIAL)": "bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 border-orange-200",
            "FAILED (PENDING)": "bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200",
        };
        return <Badge variant="outline" className={`${variants[status] || variants[signup.status] || ""} border font-medium whitespace-nowrap`}>{status}</Badge>;
    };

    const handleDelete = async (signupId: string, companyName: string) => {
        if (!confirm(`Are you sure you want to permanently delete the signup for "${companyName}"? This action cannot be undone.`)) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${signupId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });

            if (res.ok) {
                // Remove from state
                setSignups(prev => prev.filter(s => s._id !== signupId));
                setTotalCount(prev => prev - 1);
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting signup");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Signups</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage and review affiliate applications.</p>
                </div>
                {session?.user?.application_permission === 'Both' && (
                    <div className="flex items-center space-x-1 border rounded-xl p-1 bg-muted/40 w-full sm:w-auto overflow-hidden">
                        <Button
                            variant={filterAppType === 'Web Traffic' ? 'default' : 'ghost'}
                            size="sm"
                            className={`flex-1 sm:flex-none text-xs h-9 px-4 transition-all duration-200 rounded-lg ${filterAppType === 'Web Traffic' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-muted-foreground hover:bg-muted font-medium'}`}
                            onClick={() => {
                                setFilterAppType(filterAppType === 'Web Traffic' ? null : 'Web Traffic');
                                setCurrentPage(1);
                            }}
                        >
                            <Building2 className="h-3.5 w-3.5 mr-2 hidden sm:inline" />
                            Web Traffic
                        </Button>
                        <Button
                            variant={filterAppType === 'Call Traffic' ? 'default' : 'ghost'}
                            size="sm"
                            className={`flex-1 sm:flex-none text-xs h-9 px-4 transition-all duration-200 rounded-lg ${filterAppType === 'Call Traffic' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-muted-foreground hover:bg-muted font-medium'}`}
                            onClick={() => {
                                setFilterAppType(filterAppType === 'Call Traffic' ? null : 'Call Traffic');
                                setCurrentPage(1);
                            }}
                        >
                            <Smartphone className="h-3.5 w-3.5 mr-2 hidden sm:inline" />
                            Call Traffic
                        </Button>
                    </div>
                )}
            </div>

            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 min-w-0">
                        <Tabs defaultValue={filterStatus} value={filterStatus} onValueChange={(val: string) => { setFilterStatus(val); setCurrentPage(1); }} className="w-full xl:w-auto min-w-0">
                            <TabsList className="bg-muted/50 p-1 rounded-xl w-full flex overflow-x-auto justify-start h-auto no-scrollbar min-w-0">
                                <TabsTrigger value="PENDING" className="data-[state=active]:bg-white data-[state=active]:text-yellow-600 data-[state=active]:shadow-sm rounded-lg py-2 px-4 transition-all text-xs sm:text-sm">Pending</TabsTrigger>
                                <TabsTrigger value="APPROVED" className="data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-sm rounded-lg py-2 px-4 transition-all text-xs sm:text-sm">Approved</TabsTrigger>
                                <TabsTrigger value="REJECTED" className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg py-2 px-4 transition-all text-xs sm:text-sm">Rejected</TabsTrigger>
                                <TabsTrigger value="REQUESTED_FOR_APPROVAL" className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg py-2 px-4 transition-all text-xs sm:text-sm">Approvals</TabsTrigger>
                                <TabsTrigger value="ALL" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg py-2 px-4 transition-all text-xs sm:text-sm">All</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto min-w-0">
                            {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                                <div className="w-full sm:w-48 shrink-0">
                                    <Select value={filterReferral} onValueChange={(val: string) => { setFilterReferral(val); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-10 bg-muted/30 border-transparent focus:ring-primary/20">
                                            <SelectValue placeholder="All Referrers" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Referrers</SelectItem>
                                            {referrers.map((r) => (
                                                <SelectItem key={String(r.id)} value={String(r.id)}>{String(r.name)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search companies..."
                                    className="pl-10 h-10 bg-muted/30 border-transparent focus:bg-white focus:border-primary/50 transition-all rounded-lg"
                                    value={searchTerm}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {/* Desktop View Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold text-gray-600">Company</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Contact</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Referrer</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Date</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-600">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="font-medium">Loading applications...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSignups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <FileText className="h-10 w-10 text-gray-200" />
                                                <p className="font-medium">No signups found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSignups.map((signup) => (
                                        <TableRow
                                            key={signup._id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                            onClick={() => router.push(`/dashboard/signups/${signup._id}`)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-xs border border-red-100 uppercase overflow-hidden">
                                                        {signup.companyInfo?.companyName?.slice(0, 2) || '??'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                                                            {String(signup.companyInfo?.companyName || '')}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                            <Building2 className="h-3 w-3" /> {String(signup.companyInfo?.country || 'Unknown')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                                        <User className="h-3.5 w-3.5 text-gray-400" />
                                                        {String(signup.accountInfo?.firstName || '')} {String(signup.accountInfo?.lastName || '')}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground mt-0.5">{String(signup.accountInfo?.email || '')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 w-fit">
                                                    {typeof signup.companyInfo?.referral === 'object' && signup.companyInfo?.referral !== null ? (signup.companyInfo.referral as any).name : (signup.companyInfo?.referral || 'Direct')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge signup={signup} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                                    <Calendar className="h-4 w-4 text-gray-400" />
                                                    {new Date(signup.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50">
                                                        <Link href={`/dashboard/signups/${signup._id}`}>
                                                            <ChevronRight className="h-5 w-5" />
                                                        </Link>
                                                    </Button>
                                                    {session?.user?.role === 'SUPER_ADMIN' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-gray-400 hover:text-red-700 hover:bg-red-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(signup._id, signup.companyInfo?.companyName);
                                                            }}
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="lg:hidden space-y-4 p-2 sm:p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                <p className="text-sm font-medium text-muted-foreground">Loading applications...</p>
                            </div>
                        ) : filteredSignups.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 text-muted-foreground flex flex-col items-center gap-3">
                                <FileText className="h-12 w-12 text-gray-200" />
                                <p className="font-semibold">No applications found</p>
                            </div>
                        ) : (
                            filteredSignups.map((signup) => (
                                <Card
                                    key={signup._id}
                                    className="border border-gray-100 shadow-sm overflow-hidden bg-white hover:border-primary/20 transition-all cursor-pointer active:scale-[0.98]"
                                    onClick={() => router.push(`/dashboard/signups/${signup._id}`)}
                                >
                                    <CardContent className="p-4 sm:p-5 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm uppercase shadow-lg shadow-red-200 flex-shrink-0">
                                                    {signup.companyInfo?.companyName?.slice(0, 2) || '??'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-gray-900 leading-tight truncate text-sm sm:text-base">
                                                        {signup.companyInfo?.companyName}
                                                    </div>
                                                    <div className="text-[10px] sm:text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1 sm:mt-1.5 whitespace-nowrap">
                                                        <Calendar className="h-3 w-3 flex-shrink-0" />
                                                        {new Date(signup.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <StatusBadge signup={signup} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div className="space-y-1 min-w-0">
                                                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">Contact Person</div>
                                                <div className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                                                    {signup.accountInfo?.firstName} {signup.accountInfo?.lastName}
                                                </div>
                                                <div className="text-[10px] sm:text-[11px] text-gray-500 truncate">{signup.accountInfo?.email}</div>
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">Referrer</div>
                                                <div className="text-xs sm:text-sm font-semibold text-gray-700 truncate pt-0.5">
                                                    {typeof signup.companyInfo?.referral === 'object' && signup.companyInfo?.referral !== null ? (signup.companyInfo.referral as any).name : (signup.companyInfo?.referral || 'Direct')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-2">
                                            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-gray-500 truncate mr-2">
                                                <Building2 className="h-3 sm:h-3.5 w-3 sm:w-3.5 flex-shrink-0" />
                                                <span className="truncate">{signup.companyInfo?.country || 'Unknown'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {session?.user?.role === 'SUPER_ADMIN' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 sm:h-9 sm:w-9 text-gray-400 hover:text-red-700 hover:bg-red-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(signup._id, signup.companyInfo?.companyName);
                                                        }}
                                                    >
                                                        <Trash className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="secondary" className="bg-gray-50 hover:bg-gray-100 text-gray-900 border-none font-bold rounded-lg h-8 sm:h-9 text-[10px] sm:text-xs px-2 sm:px-3">
                                                    Details
                                                    <ChevronRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-8 p-4 bg-muted/20 rounded-2xl">
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Rows:</span>
                                <select
                                    className="h-9 w-16 rounded-lg border-none bg-white px-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 cursor-pointer text-gray-900"
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                                Total: {totalCount}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Page <span className="text-gray-900">{currentPage}</span> of {totalPages || 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl border-none bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl border-none bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SignupsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>}>
            <SignupsContent />
        </Suspense>
    );
}
