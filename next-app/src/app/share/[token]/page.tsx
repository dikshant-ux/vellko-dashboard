"use client"

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Loader2, AlertCircle, ChevronLeft, ChevronRight,
    Search, Mail, Shield, ExternalLink, Tag, TrendingUp, Eye, Lock
} from "lucide-react";

interface Offer {
    site_offer_id: string;
    site_offer_name: string;
    brand_advertiser_id: string;
    brand_advertiser_name: string;
    vertical_name: string;
    status: string;
    hidden: boolean;
    preview_link: string;
    payout: string;
    type: string;
}

/* ─── Top branding bar (matches sidebar accent) ────────────────────── */
function TopBar() {
    return (
        <div className="w-full bg-white border-b border-gray-200 px-4 sm:px-8 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm tracking-tight">Vellko Affiliates</span>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
                <Lock className="h-3 w-3 text-primary" />
                Secure access
            </div>
        </div>
    );
}

/* ─── Auth page wrapper ────────────────────────────────────────────── */
function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <TopBar />
            <div className="flex-1 flex items-center justify-center p-4">
                {children}
            </div>
        </div>
    );
}

/* ─── Step indicator ───────────────────────────────────────────────── */
function StepDots({ current }: { current: 'email' | 'otp' }) {
    return (
        <div className="flex items-center gap-2 mb-5">
            {(['email', 'otp'] as const).map((s) => (
                <div key={s} className={`h-1 rounded-full transition-all duration-300 ${current === s ? 'w-8 bg-primary' : 'w-4 bg-gray-200'}`} />
            ))}
        </div>
    );
}

/* ─── Error banner ─────────────────────────────────────────────────── */
function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{message}</span>
        </div>
    );
}

/* ─── Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const isActive = status === 'Active' || status === 'Public';
    const isApply  = status === 'Apply To Run';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-700' :
            isApply  ? 'bg-yellow-100 text-yellow-700' :
                       'bg-gray-100 text-gray-600'
        }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500' : isApply ? 'bg-yellow-500' : 'bg-gray-400'}`} />
            {status}
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function SharePage() {
    const params = useParams();
    const token = params.token as string;

    const [step, setStep] = useState<'email' | 'otp' | 'view'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [accessToken, setAccessToken] = useState('');
    const [error, setError] = useState('');
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [linkName, setLinkName] = useState<string>('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const storedToken = localStorage.getItem(`share_token_${token}`);
        if (storedToken) { setAccessToken(storedToken); setStep('view'); }
    }, [token]);

    useEffect(() => {
        if (accessToken && step === 'view') fetchOffers(accessToken, page, limit, debouncedSearch);
    }, [page, limit, debouncedSearch, accessToken, step]);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault(); setIsLoading(true); setError('');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/otp/request`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
            });
            if (res.ok) { setStep('otp'); toast.success("Verification code sent to your email"); }
            else { const d = await res.json(); setError(d.detail || "Failed to send OTP"); }
        } catch { setError("Something went wrong"); }
        finally { setIsLoading(false); }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault(); setIsLoading(true); setError('');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/otp/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }),
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem(`share_token_${token}`, data.access_token);
                setAccessToken(data.access_token);
                await fetchOffers(data.access_token, 1, 10, '');
            } else { const d = await res.json(); setError(d.detail || "Invalid OTP"); }
        } catch { setError("Something went wrong"); }
        finally { setIsLoading(false); }
    };

    const fetchOffers = async (tokenStr: string, p: number, l: number, s: string) => {
        setIsFetching(true);
        try {
            const query = new URLSearchParams({ access_token: tokenStr, page: p.toString(), limit: l.toString(), search: s });
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/data?${query}`);
            if (res.ok) {
                const data = await res.json();
                setOffers(data.offers || []);
                setVisibleColumns(data.visible_columns || []);
                setLinkName(data.link_name || "Shared Offers");
                setTotalRows(data.row_count || 0);
                setTotalPages(data.total_pages || 1);
                setStep('view');
            } else if (res.status === 401) {
                localStorage.removeItem(`share_token_${token}`);
                setAccessToken(''); setStep('email');
                setError("Session expired. Please verify again.");
                toast.error("Session expired");
            } else { setError("Failed to load offers"); }
        } catch (err) { console.error(err); }
        finally { setIsFetching(false); }
    };

    const isCol = (id: string) => visibleColumns.length === 0 || visibleColumns.includes(id);

    /* ── Email step ─────────────────────────────────────────────────── */
    if (step === 'email') return (
        <AuthShell>
            <Card className="w-full max-w-md shadow-sm border-gray-200">
                <CardContent className="p-8">
                    <StepDots current="email" />
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 mb-4">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900">Access Shared Offers</h1>
                        <p className="text-gray-500 text-sm mt-1">Enter your email to receive a verification code</p>
                    </div>
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                            <Input
                                id="email" type="email" placeholder="name@example.com" required
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        {error && <ErrorBanner message={error} />}
                        <Button type="submit" disabled={isLoading} className="w-full h-10">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Verification Code
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </AuthShell>
    );

    /* ── OTP step ───────────────────────────────────────────────────── */
    if (step === 'otp') return (
        <AuthShell>
            <Card className="w-full max-w-md shadow-sm border-gray-200">
                <CardContent className="p-8">
                    <StepDots current="otp" />
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 mb-4">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900">Check your inbox</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            We sent a 6-digit code to{' '}
                            <span className="text-primary font-medium">{email}</span>
                        </p>
                    </div>
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="otp" className="text-sm font-medium text-gray-700">Verification Code</label>
                            <Input
                                id="otp" type="text" inputMode="numeric" placeholder="••••••" required
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="h-12 text-center text-2xl tracking-[0.4em] font-mono"
                                maxLength={6}
                            />
                        </div>
                        {error && <ErrorBanner message={error} />}
                        <Button type="submit" disabled={isLoading || otp.length < 6} className="w-full h-10">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verify &amp; View Offers
                        </Button>
                        <button type="button"
                            onClick={() => { setStep('email'); setError(''); setOtp(''); }}
                            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">
                            ← Change email address
                        </button>
                    </form>
                </CardContent>
            </Card>
        </AuthShell>
    );

    /* ── View offers ────────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <TopBar />
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{linkName || "Shared Offers"}</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Viewing offers shared via secure link</p>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1.5 w-fit text-xs px-3 py-1 h-auto">
                        <Shield className="h-3 w-3 text-primary" />
                        Verified session
                    </Badge>
                </div>

                {/* ── Stats strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { label: "Total Offers",  value: totalRows,                              icon: <TrendingUp className="h-4 w-4 text-primary" /> },
                        { label: "This Page",     value: offers.length,                         icon: <Eye className="h-4 w-4 text-primary" /> },
                        { label: "Page",          value: `${page} / ${Math.max(1, totalPages)}`, icon: <Tag className="h-4 w-4 text-primary" /> },
                    ].map(s => (
                        <Card key={s.label} className="border-gray-200 shadow-none">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/8">{s.icon}</div>
                                <div>
                                    <p className="text-xs text-gray-500">{s.label}</p>
                                    <p className="text-lg font-semibold text-gray-900">{s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ── Main content card ── */}
                <Card className="border-gray-200 shadow-none">
                    <CardContent className="p-0">

                        {/* Toolbar */}
                        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-center">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    type="search" placeholder="Search offers..."
                                    className="pl-9 h-9"
                                    value={search} onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm text-gray-500 whitespace-nowrap">Rows</span>
                                <Select value={limit.toString()} onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}>
                                    <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        {isCol('id')       && <TableHead className="w-[80px] text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</TableHead>}
                                        {isCol('name')     && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer Name</TableHead>}
                                        {isCol('vertical') && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vertical</TableHead>}
                                        {isCol('status')   && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</TableHead>}
                                        {isCol('type')     && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</TableHead>}
                                        {isCol('payout')   && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payout</TableHead>}
                                        {isCol('preview')  && <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isFetching ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {isCol('id')       && <TableCell><div className="h-4 w-10 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                                {isCol('name')     && <TableCell><div className="h-4 w-48 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                                {isCol('vertical') && <TableCell><div className="h-4 w-24 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                                {isCol('status')   && <TableCell><div className="h-5 w-16 bg-gray-100 animate-pulse rounded-full" /></TableCell>}
                                                {isCol('type')     && <TableCell><div className="h-5 w-16 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                                {isCol('payout')   && <TableCell><div className="h-4 w-14 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                                {isCol('preview')  && <TableCell><div className="h-4 w-14 bg-gray-100 animate-pulse rounded" /></TableCell>}
                                            </TableRow>
                                        ))
                                    ) : offers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-7 w-7 opacity-30" />
                                                    <p className="text-sm">No offers found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        offers.map((offer) => (
                                            <TableRow key={offer.site_offer_id} className="hover:bg-gray-50/80">
                                                {isCol('id')       && <TableCell className="text-gray-400 font-mono text-xs">{offer.site_offer_id}</TableCell>}
                                                {isCol('name')     && <TableCell className="font-medium text-gray-900">{offer.site_offer_name}</TableCell>}
                                                {isCol('vertical') && <TableCell className="text-gray-600 text-sm">{offer.vertical_name}</TableCell>}
                                                {isCol('status')   && <TableCell><StatusBadge status={offer.status} /></TableCell>}
                                                {isCol('type')     && <TableCell>
                                                    <Badge variant="outline" className="text-xs font-normal">{offer.type || 'N/A'}</Badge>
                                                </TableCell>}
                                                {isCol('payout')   && <TableCell className="font-semibold text-green-600">{offer.payout}</TableCell>}
                                                {isCol('preview')  && <TableCell>
                                                    {offer.preview_link
                                                        ? <a href={offer.preview_link} target="_blank" rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                                                            <ExternalLink className="h-3.5 w-3.5" />Preview
                                                          </a>
                                                        : <span className="text-gray-400 text-sm">N/A</span>}
                                                </TableCell>}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {isFetching ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-4 space-y-2 animate-pulse">
                                        <div className="h-4 bg-gray-100 rounded w-3/4" />
                                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                                        <div className="flex gap-2 mt-1">
                                            <div className="h-5 bg-gray-100 rounded-full w-14" />
                                            <div className="h-5 bg-gray-100 rounded w-10" />
                                        </div>
                                    </div>
                                ))
                            ) : offers.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <Search className="h-7 w-7 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No offers found</p>
                                </div>
                            ) : (
                                offers.map((offer) => (
                                    <div key={offer.site_offer_id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0">
                                                {isCol('name')     && <p className="font-medium text-gray-900 text-sm leading-snug">{offer.site_offer_name}</p>}
                                                {isCol('vertical') && <p className="text-xs text-gray-500 mt-0.5">{offer.vertical_name}</p>}
                                            </div>
                                            {isCol('payout') && <span className="font-semibold text-green-600 text-sm shrink-0">{offer.payout}</span>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {isCol('id')     && <span className="text-[10px] font-mono text-gray-400">#{offer.site_offer_id}</span>}
                                            {isCol('status') && <StatusBadge status={offer.status} />}
                                            {isCol('type')   && <Badge variant="outline" className="text-[10px] font-normal h-5 px-1.5">{offer.type || 'N/A'}</Badge>}
                                            {isCol('preview') && offer.preview_link && (
                                                <a href={offer.preview_link} target="_blank" rel="noopener noreferrer"
                                                    className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                                    <ExternalLink className="h-3 w-3" />Preview
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                            <p className="text-sm text-gray-500 order-2 sm:order-1">
                                {totalRows > 0
                                    ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, totalRows)} of ${totalRows} offers`
                                    : "No offers"}
                            </p>
                            <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                <Button variant="outline" size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="h-8 px-2.5">
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="ml-1 hidden sm:inline">Prev</span>
                                </Button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${p === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <Button variant="outline" size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="h-8 px-2.5">
                                    <span className="mr-1 hidden sm:inline">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
