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
import { Search, ChevronRight, Loader2, FileText, Calendar, Building2, User, ChevronLeft, Trash } from "lucide-react";

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
    const [filterReferral, setFilterReferral] = useState("");
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
        if (session?.accessToken) {
            setIsLoading(true);
            let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/signups`;
            const params = new URLSearchParams();

            if (filterStatus !== 'ALL') {
                params.append('status', filterStatus);
            }
            if (filterReferral) {
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

            if (appType !== 'Both') return s.status;

            if (userRole === 'SUPER_ADMIN' || userPermission === 'Both' || !userPermission) {

                const cake = s.cake_api_status;
                const ringba = s.ringba_api_status;
            
                // Fully approved
                if (cake === true && ringba === true) {
                    return 'APPROVED';
                }
            
                // Fully rejected
                if (cake === false && ringba === false) {
                    return 'REJECTED';
                }
            
                // Partial approval (one approved, one pending/rejected/null)
                if (
                    (cake === true && ringba !== true) ||
                    (ringba === true && cake !== true)
                ) {
                    return 'PARTIALLY APPROVED';
                }
            
                // Both pending/null
                if (cake == null && ringba == null) {
                    return 'PENDING';
                }
            
                return s.status;
            }
            

            if (userPermission === 'Web Traffic') {
                if (s.cake_api_status === true) return 'APPROVED';
                if (s.cake_api_status === false) return 'REJECTED';
                return 'PENDING';
            }

            if (userPermission === 'Call Traffic') {
                if (s.ringba_api_status === true) return 'APPROVED';
                if (s.ringba_api_status === false) return 'REJECTED';
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Signups</h1>
                    <p className="text-muted-foreground mt-1">Manage and review affiliate applications.</p>
                </div>
                {session?.user?.application_permission === 'Both' && (
                    <div className="flex items-center space-x-1 border rounded-lg p-1 bg-muted/40">
                        <Button
                            variant={filterAppType === 'Web Traffic' ? 'secondary' : 'ghost'}
                            size="sm"
                            className={`text-xs h-8 ${filterAppType === 'Web Traffic' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setFilterAppType(filterAppType === 'Web Traffic' ? null : 'Web Traffic')}
                        >
                            Web Traffic
                        </Button>
                        <Button
                            variant={filterAppType === 'Call Traffic' ? 'secondary' : 'ghost'}
                            size="sm"
                            className={`text-xs h-8 ${filterAppType === 'Call Traffic' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setFilterAppType(filterAppType === 'Call Traffic' ? null : 'Call Traffic')}
                        >
                            Call Traffic
                        </Button>
                    </div>
                )}
                {/* <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    <Plus className="mr-2 h-4 w-4" /> Manual Entry
                </Button> */}
            </div>

            <Card className="border-none shadow-md bg-white">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <Tabs defaultValue={filterStatus} value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setCurrentPage(1); }} className="w-full md:w-auto">
                            <TabsList className="bg-muted p-1 rounded-lg">
                                <TabsTrigger value="PENDING" className="data-[state=active]:bg-white data-[state=active]:text-yellow-600 data-[state=active]:shadow-sm rounded-md transition-all">Pending</TabsTrigger>
                                <TabsTrigger value="APPROVED" className="data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-sm rounded-md transition-all">Approved</TabsTrigger>
                                <TabsTrigger value="REJECTED" className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-md transition-all">Rejected</TabsTrigger>
                                <TabsTrigger value="REQUESTED_FOR_APPROVAL" className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-md transition-all">Approval Requests</TabsTrigger>
                                <TabsTrigger value="ALL" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all">All</TabsTrigger>

                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') ? (
                                <select
                                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={filterReferral}
                                    onChange={(e) => { setFilterReferral(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="">All Referrers</option>
                                    {referrers.map((r) => (
                                        <option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>
                                    ))}
                                </select>
                            ) : null}

                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search companies..."
                                    className="pl-9 bg-muted/50 border-transparent focus:bg-white focus:border-primary/50 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-gray-100 overflow-x-auto">
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
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <div className="flex justify-center items-center text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading signups...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSignups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No signups found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSignups.map((signup) => (
                                        <TableRow
                                            key={signup._id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/dashboard/signups/${signup._id}`)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                        {String(signup.companyInfo?.companyName || '').slice(0, 2)}
                                                    </div>
                                                    <div className="font-medium text-foreground">
                                                        {String(signup.companyInfo?.companyName || '')}
                                                        <div className="text-xs text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
                                                            <Building2 className="h-3 w-3" /> {String(signup.companyInfo?.country || '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                                        <User className="h-3 w-3 text-gray-400" />
                                                        {String(signup.accountInfo?.firstName || '')} {String(signup.accountInfo?.lastName || '')}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{String(signup.accountInfo?.email || '')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium text-gray-700">
                                                    {typeof signup.companyInfo?.referral === 'object' && signup.companyInfo?.referral !== null ? (signup.companyInfo.referral as any).name : (signup.companyInfo?.referral || 'None')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge signup={signup} />
                                                    {signup.is_updated && (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] py-0 px-1 font-semibold uppercase">
                                                            Updated
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(signup.created_at).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="ghost" size="sm" className="hover:text-primary hover:bg-primary/5">
                                                    <Link href={`/dashboard/signups/${signup._id}`}>
                                                        View Details <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                {session?.user?.role === 'SUPER_ADMIN' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(signup._id, signup.companyInfo?.companyName);
                                                        }}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                            <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-ring"
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setCurrentPage(1); // Reset to page 1 on limit change
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-muted-foreground ml-2">
                                Total: {totalCount}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground mr-2">
                                Page {currentPage} of {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}

export default function SignupsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>}>
            <SignupsContent />
        </Suspense>
    );
}
