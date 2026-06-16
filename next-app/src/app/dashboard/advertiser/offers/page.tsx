'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    RefreshCw,
    AlertCircle,
    Layers,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    ExternalLink,
    Clock
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Offer {
    _id: string;
    advertiser_id: string;
    advertiser_name: string;
    advertiser_custom_id?: string;
    offer_id: string;
    name: string;
    payout: string;
    vertical: string;
    status: string;
    preview_link: string;
    synced_at: string;
    custom_fields?: Record<string, string>;
}

export default function AdvertiserOfferList() {
    const authFetch = useAuthFetch();
    const { data: session } = useSession();

    // Data states
    const [offers, setOffers] = useState<Offer[]>([]);
    const [customColumns, setCustomColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewValue, setViewValue] = useState<{ title: string; content: string } | null>(null);

    // Pagination & Search & Sort states
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [totalPages, setTotalPages] = useState(0);
    const [rowCount, setRowCount] = useState(0);

    const [sortField, setSortField] = useState('name');
    const [sortDescending, setSortDescending] = useState(false);

    const loadOffers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                sort_field: sortField,
                sort_descending: sortDescending.toString(),
            });
            if (search.trim()) {
                queryParams.append('search', search.trim());
            }

            const res = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/offers?${queryParams.toString()}`
            );

            if (res && res.ok) {
                const data = await res.json();
                setOffers(data.offers || []);
                setCustomColumns(data.custom_columns || []);
                setTotalPages(data.total_pages || 0);
                setRowCount(data.row_count || 0);
            } else {
                setError('Failed to load consolidated offers.');
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred while loading offers.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, sortField, sortDescending, authFetch]);

    useEffect(() => {
        if (session) {
            loadOffers();
        }
    }, [session, loadOffers]);

    // Handle Search Submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    // Reset search
    const handleResetSearch = () => {
        setSearchInput('');
        setSearch('');
        setPage(1);
    };

    // Toggle Sort Field
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDescending(!sortDescending);
        } else {
            setSortField(field);
            setSortDescending(false);
        }
        setPage(1);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        Advertiser Offer List
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Consolidated dashboard displaying offers synced across all external advertiser integrations.
                    </p>
                </div>
                <Button
                    onClick={() => loadOffers()}
                    variant="outline"
                    className="border-gray-200 hover:border-red-600 hover:text-red-600 rounded-lg gap-2 h-9 bg-white shadow-sm shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Offers
                </Button>
            </div>

            {/* Search and Filters card */}
            <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white">
                <CardContent className="p-4">
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search offers by name, ID, advertiser name, or vertical category..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 h-9.5 focus-visible:ring-red-500 border-gray-200 rounded-lg"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg h-9.5 px-4 font-semibold text-sm transition-all"
                        >
                            Search
                        </Button>
                        {search && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleResetSearch}
                                className="border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg h-9.5 text-xs px-3"
                            >
                                Clear
                            </Button>
                        )}
                    </form>
                </CardContent>
            </Card>

            {/* Offers Table */}
            <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white overflow-hidden">
                <CardHeader className="border-b border-gray-50 bg-gray-50/20 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-gray-800">Unified Catalog</CardTitle>
                            <CardDescription className="text-xs">Mapped and normalized database records synced from external custom APIs.</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 py-1 px-2.5 font-semibold text-xs">
                            {rowCount} Total Offers
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-16 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto" />
                            <p className="text-xs text-gray-400 mt-3 font-medium">Loading synced offers catalog...</p>
                        </div>
                    ) : error ? (
                        <div className="p-16 text-center text-red-500 flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 text-red-400" />
                            <span className="text-sm font-medium">{error}</span>
                            <Button variant="outline" size="sm" onClick={() => loadOffers()} className="mt-2 text-xs">
                                Retry
                            </Button>
                        </div>
                    ) : offers.length === 0 ? (
                        <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-2">
                            <Layers className="h-10 w-10 text-gray-200" />
                            <span className="text-sm font-medium">No offers matches.</span>
                            <p className="text-xs text-gray-400 max-w-sm mt-1">
                                Ensure your advertiser configs have response mapping saved and have run synchronization successfully.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-xs font-bold text-gray-700 w-[120px]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('offer_id')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Offer ID <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('name')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Offer Name <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('advertiser_name')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Advertiser <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('advertiser_custom_id')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Adv. ID <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('payout')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Payout <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSort('vertical')}
                                                    className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                >
                                                    Vertical <ArrowUpDown className="h-3 w-3" />
                                                </button>
                                            </TableHead>
                                            {customColumns.map((col) => (
                                                <TableHead key={col} className="text-xs font-bold text-gray-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSort(`custom_fields.${col}`)}
                                                        className="flex items-center gap-1 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                                    >
                                                        {col} <ArrowUpDown className="h-3 w-3" />
                                                    </button>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-xs font-bold text-gray-700 text-center uppercase tracking-wider">Status</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700 text-center uppercase tracking-wider">Preview</TableHead>
                                            <TableHead className="text-xs font-bold text-gray-700 text-right pr-6 uppercase tracking-wider">Synced At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {offers.map((offer) => (
                                            <TableRow key={offer._id} className="hover:bg-gray-50 transition-colors">
                                                <TableCell className="font-mono text-xs font-semibold text-gray-600">
                                                    {offer.offer_id}
                                                </TableCell>
                                                <TableCell 
                                                    className="font-medium text-gray-900 max-w-[200px] truncate cursor-pointer hover:underline hover:text-red-600 transition-colors" 
                                                    title="Click to view full Offer Name"
                                                    onClick={() => setViewValue({ title: "Offer Name", content: offer.name })}
                                                >
                                                    {offer.name}
                                                </TableCell>
                                                <TableCell className="text-gray-900 font-medium">
                                                    {offer.advertiser_name}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-semibold text-gray-600">
                                                    {offer.advertiser_custom_id || offer.advertiser_id}
                                                </TableCell>
                                                <TableCell className="font-bold text-gray-900">
                                                    {offer.payout || 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-gray-500 text-xs">
                                                    {offer.vertical ? (
                                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[10px] py-0.5 px-2 font-medium">
                                                            {offer.vertical}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </TableCell>
                                                {customColumns.map((col) => {
                                                    const val = offer.custom_fields?.[col];
                                                    const hasValue = val !== undefined && val !== "";
                                                    return (
                                                        <TableCell 
                                                            key={col} 
                                                            className={`text-xs text-gray-700 max-w-[150px] truncate ${hasValue ? 'cursor-pointer hover:underline hover:text-red-600 transition-colors' : ''}`}
                                                            onClick={() => hasValue && setViewValue({ title: col, content: val })}
                                                            title={hasValue ? "Click to view full value" : undefined}
                                                        >
                                                            {hasValue ? (
                                                                <span className="font-semibold text-gray-800">{val}</span>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            ['active', '1', 'true', 'public'].includes(offer.status?.toLowerCase())
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0.5 px-2'
                                                                : 'bg-gray-50 text-gray-600 border-gray-200 text-[10px] py-0.5 px-2'
                                                        }
                                                    >
                                                        {offer.status || 'Active'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {offer.preview_link ? (
                                                        <a
                                                            href={offer.preview_link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-red-500 hover:text-red-700 inline-block p-1 hover:bg-red-50 rounded transition-colors"
                                                            title={offer.preview_link}
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-mono text-[10px] text-gray-500">
                                                    <span className="inline-flex items-center gap-1.5 justify-end w-full">
                                                        <Clock className="h-3 w-3 shrink-0 text-gray-300" />
                                                        {new Date(offer.synced_at).toLocaleString([], {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-50 bg-gray-50/20 px-6 py-4">
                                    <div className="text-xs text-gray-500 font-medium">
                                        Showing Page <span className="text-gray-800 font-bold">{page}</span> of{' '}
                                        <span className="text-gray-800 font-bold">{totalPages}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page - 1)}
                                            disabled={page === 1}
                                            className="h-8 w-8 p-0 rounded-lg"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page + 1)}
                                            disabled={page === totalPages}
                                            className="h-8 w-8 p-0 rounded-lg"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Cell Value Dialog */}
            <Dialog open={viewValue !== null} onOpenChange={(open) => !open && setViewValue(null)}>
                <DialogContent className="max-w-lg rounded-xl bg-white border border-gray-100 p-6 shadow-2xl">
                    <DialogHeader className="border-b border-gray-100 pb-3">
                        <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>Viewing Column:</span>
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 py-0.5 px-2 font-bold text-xs uppercase">
                                {viewValue?.title}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 max-h-[300px] overflow-y-auto">
                        <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-words leading-relaxed select-all">
                            {viewValue?.content}
                        </p>
                    </div>
                    <div className="flex justify-end mt-5">
                        <Button 
                            variant="outline" 
                            onClick={() => setViewValue(null)} 
                            className="rounded-lg h-9 font-semibold text-xs border-gray-200 hover:bg-gray-50 px-4"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
