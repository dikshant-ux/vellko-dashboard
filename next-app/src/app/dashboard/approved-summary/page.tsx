'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Loader2,
    FileText,
    Calendar,
    Building2,
    User as UserIcon,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FilterX
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from 'next/link';

function ApprovedSummaryContent() {
    const { data: session } = useSession();
    const authFetch = useAuthFetch();

    const [signups, setSignups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAppType, setFilterAppType] = useState<string>("all");
    const [referrers, setReferrers] = useState<{ id: string, name: string }[]>([]);
    const [filterReferral, setFilterReferral] = useState("all");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrers`)
            .then(res => res.json())
            .then(data => setReferrers(data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (session?.accessToken) {
            setIsLoading(true);
            let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/signups?status=APPROVED`;
            const params = new URLSearchParams();

            if (filterReferral && filterReferral !== 'all') {
                params.append('referral_id', filterReferral);
            }
            if (filterAppType && filterAppType !== 'all') {
                params.append('application_type', filterAppType);
            }

            params.append('page', currentPage.toString());
            params.append('limit', limit.toString());

            const queryString = params.toString();
            if (queryString) {
                url += `&${queryString}`;
            }

            authFetch(url)
                .then(res => res ? res.json() : null)
                .then(data => {
                    if (data && data.items) {
                        setSignups(data.items);
                        setTotalCount(data.total);
                        setTotalPages(Math.ceil(data.total / limit));
                    } else {
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
    }, [session, filterReferral, filterAppType, currentPage, limit, authFetch]);

    const filteredSignups = signups.filter(signup =>
        signup.companyInfo?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signup.cake_affiliate_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signup.ringba_affiliate_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signup.ringba_assigned_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getDocCount = (signup: any) => {
        let count = 0;
        if (signup.cake_qa_responses) {
            signup.cake_qa_responses.forEach((qa: any) => {
                if (qa.file_path) count++;
                if (qa.files && qa.files.length > 0) count += qa.files.length;
            });
        }
        if (signup.ringba_qa_responses) {
            signup.ringba_qa_responses.forEach((qa: any) => {
                if (qa.file_path) count++;
                if (qa.files && qa.files.length > 0) count += qa.files.length;
            });
        }
        return count;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Approved Summary</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Quick overview of all approved affiliates and their integration IDs.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-red-600 h-9"
                        onClick={() => {
                            setSearchTerm('');
                            setFilterAppType('all');
                            setFilterReferral('all');
                            setCurrentPage(1);
                        }}
                    >
                        <FilterX className="h-4 w-4 mr-2" />
                        Clear Filters
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or Affiliate ID..."
                                    className="pl-10 h-10 bg-muted/30 border-transparent focus:bg-white focus:border-primary/50 transition-all rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="w-full sm:w-48 shrink-0">
                                <Select value={filterAppType} onValueChange={(val) => { setFilterAppType(val); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-10 bg-muted/30 border-transparent focus:ring-primary/20">
                                        <SelectValue placeholder="App Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Traffic</SelectItem>
                                        <SelectItem value="Web Traffic">Web Traffic</SelectItem>
                                        <SelectItem value="Call Traffic">Call Traffic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full sm:w-48 shrink-0">
                                <Select value={filterReferral} onValueChange={(val) => { setFilterReferral(val); setCurrentPage(1); }}>
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
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold text-gray-600 pl-6">Affiliate / Company</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Type</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Cake ID</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Ringba Details</TableHead>
                                    <TableHead className="font-semibold text-gray-600">QA Docs</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Referrer</TableHead>
                                    <TableHead className="font-semibold text-gray-600">Approved Date</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-600 pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="font-medium">Loading approved signups...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSignups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <FileText className="h-10 w-10 text-gray-200" />
                                                <p className="font-medium">No approved signups found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSignups.map((signup) => (
                                        <TableRow
                                            key={signup._id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                                        >
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600 font-bold text-[10px] border border-red-100 uppercase">
                                                        {signup.companyInfo?.companyName?.slice(0, 2) || '??'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900 group-hover:text-red-600 transition-colors text-sm">
                                                            {signup.companyInfo?.companyName}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 transition-colors group-hover:text-red-400">
                                                            {signup.accountInfo?.firstName} {signup.accountInfo?.lastName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${signup.marketingInfo?.applicationType === 'Both'
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                        : signup.marketingInfo?.applicationType === 'Call Traffic'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                    {signup.marketingInfo?.applicationType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {signup.cake_affiliate_id ? (
                                                    <Badge variant="secondary" className="font-mono text-[11px] bg-gray-100 text-gray-700 border-gray-200 px-2 py-0.5">
                                                        {signup.cake_affiliate_id}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {signup.ringba_affiliate_id && (
                                                        <span className="font-mono text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 w-fit">
                                                            ID: {signup.ringba_affiliate_id}
                                                        </span>
                                                    )}
                                                    {signup.ringba_assigned_name && (
                                                        <span className="text-[10px] font-semibold text-gray-600 truncate max-w-[120px]">
                                                            {signup.ringba_assigned_name}
                                                        </span>
                                                    )}
                                                    {!signup.ringba_affiliate_id && !signup.ringba_assigned_name && (
                                                        <span className="text-xs text-gray-400 italic">N/A</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getDocCount(signup) > 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                        }`}>
                                                        {getDocCount(signup)}
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-medium">Files</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs font-medium text-gray-600">
                                                    {typeof signup.companyInfo?.referral === 'object' ? signup.companyInfo?.referral?.name : (signup.companyInfo?.referral || 'Direct')}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-medium text-gray-600 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-gray-400" />
                                                        {signup.processed_at ? new Date(signup.processed_at).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 uppercase tracking-tighter">
                                                        By {signup.processed_by || 'System'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button asChild variant="ghost" size="sm" className="h-8 group-hover:text-red-600 group-hover:bg-red-50 rounded-lg">
                                                    <Link href={`/dashboard/signups/${signup._id}`}>
                                                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                                        View
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-6 py-4 border-t border-gray-50 bg-gray-50/30">
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Rows:</span>
                                <select
                                    className="h-8 w-14 rounded-md border border-gray-200 bg-white px-1 text-xs font-bold shadow-sm focus:ring-1 focus:ring-red-500/20 cursor-pointer text-gray-900"
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
                            <div className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-md shadow-sm">
                                Total: {totalCount}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Page <span className="text-gray-900">{currentPage}</span> of {totalPages || 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ApprovedSummaryPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>}>
            <ApprovedSummaryContent />
        </Suspense>
    );
}
