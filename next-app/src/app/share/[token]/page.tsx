"use client"

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Search, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

    // Pagination & Search State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Check for existing session
    useEffect(() => {
        const storedToken = localStorage.getItem(`share_token_${token}`);
        if (storedToken) {
            setAccessToken(storedToken);
            // Trigger fetch immediately or let the next effect handle it?
            // The next effect depends on `accessToken` and `step`. 
            // If we set accessToken, we also need to set Step to 'view', otherwise the effect won't run or the UI won't show.
            setStep('view');
            // We can let the existing "Fetch on params change" effect handle the actual fetch 
            // because it depends on `accessToken` and `step`.
        }
    }, [token]);

    // Fetch on params change
    useEffect(() => {
        if (accessToken && step === 'view') {
            fetchOffers(accessToken, page, limit, debouncedSearch);
        }
    }, [page, limit, debouncedSearch, accessToken, step]);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/otp/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                setStep('otp');
                toast.success("OTP sent to your email");
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to send OTP");
                toast.error(data.detail || "Failed to send OTP");
            }
        } catch (err) {
            setError("Something went wrong");
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem(`share_token_${token}`, data.access_token);
                setAccessToken(data.access_token);
                // Initial Fetch with defaults
                await fetchOffers(data.access_token, 1, 10, '');
            } else {
                const data = await res.json();
                setError(data.detail || "Invalid OTP");
                toast.error(data.detail || "Invalid OTP");
            }
        } catch (err) {
            setError("Something went wrong");
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOffers = async (tokenStr: string, p: number, l: number, s: string) => {
        setIsFetching(true);
        try {
            // Build query params
            const query = new URLSearchParams({
                access_token: tokenStr,
                page: p.toString(),
                limit: l.toString(),
                search: s,
            });

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}/data?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setOffers(data.offers || []);
                setVisibleColumns(data.visible_columns || []);
                setLinkName(data.link_name || "Shared Offers");
                setTotalRows(data.row_count || 0);
                setTotalPages(data.total_pages || 1);

                setStep('view');
            } else {
                if (res.status === 401) {
                    localStorage.removeItem(`share_token_${token}`);
                    setAccessToken('');
                    setStep('email');
                    setError("Session expired. Please verify again.");
                    toast.error("Session expired");
                } else {
                    setError("Failed to load offers");
                }
            }
        } catch (err) {
            console.error("Failed to load offers", err);
        } finally {
            setIsFetching(false);
        }
    };

    const isColumnVisible = (id: string) => {
        return visibleColumns.length === 0 || visibleColumns.includes(id);
    };

    if (step === 'email') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Access Shared Offers</CardTitle>
                        <CardDescription>Enter your email to receive a verification code.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleRequestOtp}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">Email Address</label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Send Code
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }

    if (step === 'otp') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Verify Email</CardTitle>
                        <CardDescription>Enter the 6-digit code sent to {email}</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleVerifyOtp}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="otp" className="text-sm font-medium">Verification Code</label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="123456"
                                    required
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="text-center text-2xl tracking-widest"
                                    maxLength={6}
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex-col gap-2">
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Verify & View Offers
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setStep('email')} type="button">
                                Change Email
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{linkName || "Shared Offers"}</h1>
                        <p className="text-gray-500 mt-1">Viewing offers shared via secure link.</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {/* Toolbar */}
                        <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search offers..."
                                    className="pl-8"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows</span>
                                    <Select
                                        value={limit.toString()}
                                        onValueChange={(val) => {
                                            setLimit(Number(val));
                                            setPage(1); // Reset to page 1
                                        }}
                                    >
                                        <SelectTrigger className="w-[70px]">
                                            <SelectValue placeholder="Limit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t bg-white">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        {isColumnVisible('id') && <TableHead className="w-[80px]">ID</TableHead>}
                                        {isColumnVisible('name') && <TableHead>Name</TableHead>}
                                        {isColumnVisible('vertical') && <TableHead>Vertical</TableHead>}
                                        {isColumnVisible('status') && <TableHead>Status</TableHead>}
                                        {isColumnVisible('type') && <TableHead>Type</TableHead>}
                                        {isColumnVisible('payout') && <TableHead>Payout</TableHead>}
                                        {isColumnVisible('preview') && <TableHead>Preview</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isFetching ? (
                                        // Skeleton rows
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={`skeleton-${i}`}>
                                                {isColumnVisible('id') && <TableCell><div className="h-4 w-12 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('name') && <TableCell><div className="h-4 w-48 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('vertical') && <TableCell><div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('status') && <TableCell><div className="h-6 w-16 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('type') && <TableCell><div className="h-6 w-16 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('payout') && <TableCell><div className="h-4 w-16 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                                {isColumnVisible('preview') && <TableCell><div className="h-4 w-16 bg-gray-200 animate-pulse rounded"></div></TableCell>}
                                            </TableRow>
                                        ))
                                    ) : offers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                No offers found matching the shared criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        offers.map((offer) => (
                                            <TableRow key={offer.site_offer_id}>
                                                {isColumnVisible('id') && <TableCell className="font-medium">{offer.site_offer_id}</TableCell>}
                                                {isColumnVisible('name') && <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{offer.site_offer_name}</span>
                                                    </div>
                                                </TableCell>}
                                                {isColumnVisible('vertical') && <TableCell>{offer.vertical_name}</TableCell>}
                                                {isColumnVisible('status') && <TableCell>
                                                    <Badge variant={
                                                        offer.status === 'Active' || offer.status === 'Public' ? 'default' :
                                                            offer.status === 'Apply To Run' ? 'secondary' : 'outline'
                                                    }>
                                                        {offer.status}
                                                    </Badge>
                                                </TableCell>}
                                                {isColumnVisible('type') && <TableCell>
                                                    <Badge variant="outline">{offer.type || 'N/A'}</Badge>
                                                </TableCell>}
                                                {isColumnVisible('payout') && <TableCell className="font-medium text-green-600">
                                                    {offer.payout}
                                                </TableCell>}
                                                {isColumnVisible('preview') && <TableCell>
                                                    {offer.preview_link ? (
                                                        <a
                                                            href={offer.preview_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline"
                                                        >
                                                            Preview
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between px-4 py-4 border-t">
                            <div className="text-sm text-gray-500">
                                Max {totalRows} offers found
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <div className="text-sm font-medium">
                                    Page {page} of {Math.max(1, totalPages)}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                >
                                    Next
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
