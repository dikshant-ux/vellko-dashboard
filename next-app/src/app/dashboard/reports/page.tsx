'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    BarChart2,
    Download,
    RefreshCw,
    Search,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Loader2,
    TrendingUp,
    MousePointerClick,
    DollarSign,
    Target,
    Settings2,
    Check,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CampaignRow {
    campaign_id?: string;
    campaign_name?: string;
    affiliate_id?: string;
    affiliate_name?: string;
    offer_id?: string;
    offer_name?: string;
    advertiser_id?: string;
    advertiser_name?: string;
    affiliate_manager?: string;
    advertiser_manager?: string;
    price_format?: string;
    media_type?: string;
    views: number;
    clicks: number;
    click_thru_pct: number;
    conversions: number;
    conversion_pct: number;
    micro_events: number;
    paid: number;
    sellable: number;
    pending: number;
    rejected: number;
    approved: number;
    returned: number;
    cost: number;
    average_cost: number;
    epc: number;
    revenue: number;
    revenue_per_transaction: number;
    margin: number;
    profit: number;
    orders: number;
    order_total: number;
    total_paid: number;
}

type SortDir = 'asc' | 'desc' | null;

interface SortState {
    key: keyof CampaignRow | null;
    dir: SortDir;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrency(n: number) {
    return '$' + fmt(n);
}
function fmtPct(n: number) {
    return fmt(n, 2) + '%';
}

function getDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    end.setDate(end.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    return { startDate: fmt(start), endDate: fmt(end) };
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
    return (
        <Card className="border-none shadow-md bg-white">
            <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    </div>
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Searchable Filter ────────────────────────────────────────────────────────

function SearchableFilter({
    label,
    options,
    value,
    onValueChange,
    placeholder = "Search...",
    width = "w-44"
}: {
    label: string,
    options: string[],
    value: string,
    onValueChange: (v: string) => void,
    placeholder?: string,
    width?: string
}) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        return options.filter(opt =>
            opt.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [options, searchQuery]);

    const selectedLabel = value === 'all' ? `All ${label}s` : value;

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("h-10 justify-between bg-gray-50 border-gray-200 text-sm font-normal", width)}
                    >
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 shadow-xl border-gray-100 min-w-[200px]" align="start">
                    <div className="p-2 border-b border-gray-50">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder={placeholder}
                                className="h-8 pl-8 text-xs bg-gray-50/50 border-none focus-visible:ring-1 focus-visible:ring-red-100"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        <button
                            className={cn(
                                "flex w-full items-center px-2 py-2 text-sm rounded-sm transition-colors hover:bg-gray-100 text-left",
                                value === 'all' ? "bg-red-50 text-red-700 font-semibold" : "text-gray-600"
                            )}
                            onClick={() => {
                                onValueChange('all');
                                setOpen(false);
                                setSearchQuery("");
                            }}
                        >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", value === 'all' ? "opacity-100" : "opacity-0")} />
                            <span className="break-words">All {label}s</span>
                        </button>
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-xs text-gray-400">No {label.toLowerCase()} found.</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    className={cn(
                                        "flex w-full items-center px-2 py-2 text-sm rounded-sm transition-colors hover:bg-gray-100 text-left",
                                        value === opt ? "bg-red-50 text-red-700 font-semibold" : "text-gray-600"
                                    )}
                                    onClick={() => {
                                        onValueChange(opt);
                                        setOpen(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{opt}</span>
                                </button>
                            ))
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// ── Sort Icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sort }: { col: keyof CampaignRow; sort: SortState }) {
    if (sort.key !== col) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 text-gray-300 inline" />;
    if (sort.dir === 'asc') return <ChevronUp className="h-3.5 w-3.5 ml-1 text-red-500 inline" />;
    return <ChevronDown className="h-3.5 w-3.5 ml-1 text-red-500 inline" />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignReportPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const authFetch = useAuthFetch();

    // Access control: hide for "Call Traffic" admins
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.application_permission === 'Call Traffic') {
            router.replace('/dashboard/overview');
        }
    }, [session, status, router]);


    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.startDate);
    const [endDate, setEndDate] = useState(defaults.endDate);
    const [dateRangePreset, setDateRangePreset] = useState('last_30_days');
    const [eventType, setEventType] = useState('macro_event_conversions');

    const handlePresetChange = (preset: string) => {
        setDateRangePreset(preset);
        if (preset === 'custom') return;

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const pad = (n: number) => String(n).padStart(2, '0');
        const fmtDate = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;

        if (preset === 'today') {
            end.setDate(end.getDate() + 1);
        } else if (preset === 'yesterday') {
            start.setDate(start.getDate() - 1);
            // end remains today's start
        } else if (preset === 'last_7_days') {
            start.setDate(start.getDate() - 7);
            end.setDate(end.getDate() + 1);
        } else if (preset === 'last_30_days') {
            start.setDate(start.getDate() - 30);
            end.setDate(end.getDate() + 1);
        } else if (preset === 'this_month') {
            start.setDate(1);
            end.setDate(end.getDate() + 1);
        } else if (preset === 'last_month') {
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setDate(1); // First day of this month
        }

        setStartDate(fmtDate(start));
        setEndDate(fmtDate(end));
    };

    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const [search, setSearch] = useState('');
    const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
    const [affiliateManagerFilter, setAffiliateManagerFilter] = useState('all');
    const [advertiserManagerFilter, setAdvertiserManagerFilter] = useState('all');
    const [affiliateIdFilter, setAffiliateIdFilter] = useState('all');
    const [advertiserIdFilter, setAdvertiserIdFilter] = useState('all');
    const [sort, setSort] = useState<SortState>({ key: null, dir: null });

    // ── Resizable Columns ─────────────────────────────────────────────────────
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        campaign_name: 200,
        affiliate_id: 100,
        affiliate_manager: 140,
        offer_name: 180,
        advertiser_id: 100,
        advertiser_manager: 140,
        price_media: 130,
        views: 80,
        clicks: 80,
        click_thru_pct: 80,
        conversions: 80,
        conversion_pct: 80,
        cost: 90,
        revenue: 90,
        profit: 90,
        margin: 90,
        epc: 80,
        paid: 80,
        pending: 80,
        rejected: 80,
        approved: 80,
        average_cost: 100,
        revenue_per_transaction: 100,
    });

    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        campaign_name: true,
        affiliate_id: true,
        affiliate_manager: true,
        offer_name: true,
        advertiser_id: true,
        advertiser_manager: true,
        price_media: true,
        views: true,
        clicks: true,
        click_thru_pct: true,
        conversions: true,
        conversion_pct: true,
        cost: true,
        revenue: true,
        profit: true,
        margin: true,
        epc: true,
        paid: false,
        pending: false,
        rejected: false,
        approved: false,
        average_cost: false,
        revenue_per_transaction: false,
    });

    const [tempVisibleColumns, setTempVisibleColumns] = useState(visibleColumns);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        const savedWidths = localStorage.getItem('reports_column_widths');
        if (savedWidths) {
            try { setColumnWidths(JSON.parse(savedWidths)); } catch (e) { }
        }
        const savedVisibility = localStorage.getItem('reports_visible_columns');
        if (savedVisibility) {
            try {
                const parsed = JSON.parse(savedVisibility);
                setVisibleColumns(parsed);
                setTempVisibleColumns(parsed);
            } catch (e) { }
        }
    }, []);

    const handleApplyColumns = () => {
        setVisibleColumns(tempVisibleColumns);
        localStorage.setItem('reports_visible_columns', JSON.stringify(tempVisibleColumns));
        setIsDropdownOpen(false);
    };

    const toggleTempColumn = (col: string) => {
        setTempVisibleColumns(prev => ({
            ...prev,
            [col]: !prev[col]
        }));
    };

    const resizingColumn = useRef<string | null>(null);
    const startX = useRef<number>(0);
    const startWidth = useRef<number>(0);

    const onMouseDownResize = useCallback((e: React.MouseEvent, col: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingColumn.current = col;
        startX.current = e.pageX;
        startWidth.current = columnWidths[col] || 100;
        document.body.style.cursor = 'col-resize';
    }, [columnWidths]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!resizingColumn.current) return;
            const diff = e.pageX - startX.current;
            const newWidth = Math.max(60, startWidth.current + diff);
            setColumnWidths(prev => ({
                ...prev,
                [resizingColumn.current!]: newWidth
            }));
        };

        const onMouseUp = () => {
            if (resizingColumn.current) {
                // Save final widths after resizing done
                setColumnWidths(prev => {
                    localStorage.setItem('reports_column_widths', JSON.stringify(prev));
                    return prev;
                });
            }
            resizingColumn.current = null;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // Extract unique values from current rows
    const mediaTypes = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.media_type) set.add(r.media_type);
        });
        return Array.from(set).sort();
    }, [rows]);

    const affiliateManagers = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.affiliate_manager) set.add(r.affiliate_manager);
        });
        return Array.from(set).sort();
    }, [rows]);

    const advertiserManagers = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.advertiser_manager) set.add(r.advertiser_manager);
        });
        return Array.from(set).sort();
    }, [rows]);

    const uniqueAffiliateIds = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.affiliate_id) set.add(r.affiliate_id);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [rows]);

    const uniqueAdvertiserIds = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.advertiser_id) set.add(r.advertiser_id);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [rows]);

    // ── Pagination state ──────────────────────────────────────────────────────
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Convert MM/DD/YYYY input to a valid HTML date input value (YYYY-MM-DD) for the date picker
    function toInputDate(mmddyyyy: string) {
        const [m, d, y] = mmddyyyy.split('/');
        return `${y}-${m}-${d}`;
    }
    function fromInputDate(yyyymmdd: string) {
        const [y, m, d] = yyyymmdd.split('-');
        return `${m}/${d}/${y}`;
    }

    const fetchReport = useCallback(async () => {
        if (!session?.accessToken) return;
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            event_type: eventType,
        });

        try {
            const res = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/reports/campaign-summary?${params}`
            );
            if (!res) throw new Error('No response');
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Failed to fetch report');
            }
            const data = await res.json();
            setRows(data.rows || []);
            setHasFetched(true);
        } catch (e: any) {
            setError(e.message || 'Unknown error');
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [session, authFetch, startDate, endDate, eventType]);

    // Auto-fetch on mount
    useEffect(() => {
        if (session?.accessToken && !hasFetched) {
            fetchReport();
        }
    }, [session, hasFetched, fetchReport]);

    // ── Filtering & Sorting ───────────────────────────────────────────────────

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return rows.filter(r => {
            // Search filter
            const matchesSearch = !q ||
                (r.campaign_name || '').toLowerCase().includes(q) ||
                (r.affiliate_manager || '').toLowerCase().includes(q) ||
                (r.offer_name || '').toLowerCase().includes(q) ||
                (r.advertiser_manager || '').toLowerCase().includes(q);

            // Media type filter
            const matchesMediaType = mediaTypeFilter === 'all' || r.media_type === mediaTypeFilter;

            // Manager filters
            const matchesAffManager = affiliateManagerFilter === 'all' || r.affiliate_manager === affiliateManagerFilter;
            const matchesAdvManager = advertiserManagerFilter === 'all' || r.advertiser_manager === advertiserManagerFilter;

            // ID filters
            const matchesAffId = affiliateIdFilter === 'all' || r.affiliate_id === affiliateIdFilter;
            const matchesAdvId = advertiserIdFilter === 'all' || r.advertiser_id === advertiserIdFilter;

            return matchesSearch && matchesMediaType && matchesAffManager && matchesAdvManager && matchesAffId && matchesAdvId;
        });
    }, [rows, search, mediaTypeFilter, affiliateManagerFilter, advertiserManagerFilter, affiliateIdFilter, advertiserIdFilter]);

    const sorted = useMemo(() => {
        if (!sort.key || !sort.dir) return filtered;
        return [...filtered].sort((a, b) => {
            const av = a[sort.key!] ?? '';
            const bv = b[sort.key!] ?? '';
            const cmp = typeof av === 'number'
                ? (av as number) - (bv as number)
                : String(av).localeCompare(String(bv));
            return sort.dir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sort]);

    function toggleSort(key: keyof CampaignRow) {
        setPage(1);
        setSort(prev =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc' }
                : { key, dir: 'asc' }
        );
    }

    function SortableHead({ col, children, customCol }: { col?: keyof CampaignRow; children: React.ReactNode, customCol?: string }) {
        const colKey = (customCol || col) as string;
        if (visibleColumns[colKey] === false) return null;
        return (
            <TableHead
                style={{ width: columnWidths[colKey], minWidth: columnWidths[colKey] }}
                className="relative font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap group"
                onClick={() => col && toggleSort(col)}
            >
                <div className="flex items-center overflow-hidden">
                    <span className="truncate">{children}</span>
                    {col && <SortIcon col={col} sort={sort} />}
                </div>
                {/* Resize Handle */}
                <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-red-400 group-hover:opacity-100 opacity-0 transition-opacity bg-transparent z-10"
                    onMouseDown={(e) => onMouseDownResize(e, colKey)}
                />
            </TableHead>
        );
    }

    // ── Summary Totals ────────────────────────────────────────────────────────

    const totals = useMemo(() => sorted.reduce(
        (acc, r) => ({
            clicks: acc.clicks + r.clicks,
            conversions: acc.conversions + r.conversions,
            revenue: acc.revenue + r.revenue,
            profit: acc.profit + r.profit,
            cost: acc.cost + r.cost,
        }),
        { clicks: 0, conversions: 0, revenue: 0, profit: 0, cost: 0 }
    ), [sorted]);

    // ── Pagination derived ────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(
        () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
        [sorted, safePage, pageSize]
    );

    // Reset to page 1 whenever the result set changes
    useEffect(() => { setPage(1); }, [sorted.length, search, sort.key, sort.dir]);

    // ── CSV Export ────────────────────────────────────────────────────────────
    function exportCSV() {
        // Configuration for all possible columns
        const allCsvColumns = [
            { id: 'campaign_name', label: 'Campaign', getValue: (r: CampaignRow) => r.campaign_name },
            { id: 'affiliate_id', label: 'Aff. ID', getValue: (r: CampaignRow) => r.affiliate_id },
            { id: 'affiliate_manager', label: 'Aff. Manager', getValue: (r: CampaignRow) => r.affiliate_manager },
            { id: 'offer_name', label: 'Offer', getValue: (r: CampaignRow) => r.offer_name },
            { id: 'advertiser_id', label: 'Adv. ID', getValue: (r: CampaignRow) => r.advertiser_id },
            { id: 'advertiser_manager', label: 'Adv. Manager', getValue: (r: CampaignRow) => r.advertiser_manager },
            { id: 'price_media', label: 'Price Format', getValue: (r: CampaignRow) => r.price_format },
            { id: 'media_type', label: 'Media Type', getValue: (r: CampaignRow) => r.media_type },
            { id: 'views', label: 'Views', getValue: (r: CampaignRow) => r.views },
            { id: 'clicks', label: 'Clicks', getValue: (r: CampaignRow) => r.clicks },
            { id: 'click_thru_pct', label: 'CTR%', getValue: (r: CampaignRow) => fmtPct(r.click_thru_pct) },
            { id: 'conversions', label: 'Conversions', getValue: (r: CampaignRow) => r.conversions },
            { id: 'conversion_pct', label: 'CVR%', getValue: (r: CampaignRow) => fmtPct(r.conversion_pct) },
            { id: 'paid', label: 'Paid', getValue: (r: CampaignRow) => r.paid },
            { id: 'pending', label: 'Pending', getValue: (r: CampaignRow) => r.pending },
            { id: 'rejected', label: 'Rejected', getValue: (r: CampaignRow) => r.rejected },
            { id: 'approved', label: 'Approved', getValue: (r: CampaignRow) => r.approved },
            { id: 'cost', label: 'Cost', getValue: (r: CampaignRow) => fmtCurrency(r.cost) },
            { id: 'average_cost', label: 'Avg Cost', getValue: (r: CampaignRow) => fmtCurrency(r.average_cost) },
            { id: 'epc', label: 'EPC', getValue: (r: CampaignRow) => fmtCurrency(r.epc) },
            { id: 'revenue', label: 'Revenue', getValue: (r: CampaignRow) => fmtCurrency(r.revenue) },
            { id: 'revenue_per_transaction', label: 'Rev/Txn', getValue: (r: CampaignRow) => fmtCurrency(r.revenue_per_transaction) },
            { id: 'margin', label: 'Margin', getValue: (r: CampaignRow) => fmtCurrency(r.margin) },
            { id: 'profit', label: 'Profit', getValue: (r: CampaignRow) => fmtCurrency(r.profit) },
        ];

        // Filter based on currently visible columns in UI
        const activeColumns = allCsvColumns.filter(col => visibleColumns[col.id]);

        const headers = activeColumns.map(col => col.label);
        const escapeCSV = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

        const csvRows = [
            headers.join(','),
            ...sorted.map(r =>
                activeColumns.map(col => col.getValue(r)).map(escapeCSV).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvRows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign-report-${startDate.replace(/\//g, '-')}-to-${endDate.replace(/\//g, '-')}.csv`;
        a.click();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    // Don't render anything if unauthorized or still loading session
    if (status === 'loading' || (status === 'authenticated' && session?.user?.application_permission === 'Call Traffic')) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <BarChart2 className="h-7 w-7 text-red-600" />
                        Campaign Report
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Performance summary by campaign from Cake Marketing.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                    disabled={sorted.length === 0}
                    className="hidden sm:flex items-center gap-2 border-gray-200 h-9"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card className="border-none shadow-md bg-white">
                <CardHeader className="pb-3 border-b border-gray-50 px-5 pt-5">
                    <CardTitle className="text-base font-semibold text-gray-800">Filters</CardTitle>
                    <CardDescription className="text-xs text-gray-400">Cake enforces a maximum 1-month date range per request.</CardDescription>
                </CardHeader>
                <CardContent className="px-5 py-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        {/* Date Range Preset */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
                            <Select value={dateRangePreset} onValueChange={handlePresetChange}>
                                <SelectTrigger className="h-10 w-44 bg-gray-50 border-gray-200 text-sm">
                                    <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="yesterday">Yesterday</SelectItem>
                                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                                    <SelectItem value="this_month">This Month</SelectItem>
                                    <SelectItem value="last_month">Last Month</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start date */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</label>
                            <input
                                type="date"
                                className={`h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 ${dateRangePreset !== 'custom' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={toInputDate(startDate)}
                                onChange={e => {
                                    setStartDate(fromInputDate(e.target.value));
                                }}
                                disabled={dateRangePreset !== 'custom'}
                            />
                        </div>

                        {/* End date */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
                            <input
                                type="date"
                                className={`h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 ${dateRangePreset !== 'custom' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={toInputDate(endDate)}
                                onChange={e => {
                                    setEndDate(fromInputDate(e.target.value));
                                }}
                                disabled={dateRangePreset !== 'custom'}
                            />
                        </div>

                        {/* Event type */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</label>
                            <Select value={eventType} onValueChange={setEventType}>
                                <SelectTrigger className="h-10 w-52 bg-gray-50 border-gray-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Events</SelectItem>
                                    <SelectItem value="macro_event_conversions">Macro Conversions</SelectItem>
                                    <SelectItem value="micro_events">Micro Events</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Run button */}
                        <Button
                            onClick={fetchReport}
                            disabled={isLoading}
                            className="h-10 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 mt-auto"
                        >
                            {isLoading ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
                            ) : (
                                <><RefreshCw className="h-4 w-4 mr-2" /> Run Report</>
                            )}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-3 items-end pt-4 mt-4 border-t border-gray-100">
                        {/* Media Type Filter */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Media Type</label>
                            <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                                <SelectTrigger className="h-10 w-44 bg-gray-50 border-gray-200 text-sm">
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Media</SelectItem>
                                    {mediaTypes.map(mt => (
                                        <SelectItem key={mt} value={mt}>{mt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Aff Manager Filter */}
                        <SearchableFilter
                            label="Aff. Manager"
                            options={affiliateManagers}
                            value={affiliateManagerFilter}
                            onValueChange={setAffiliateManagerFilter}
                            placeholder="Search managers..."
                        />

                        {/* Adv Manager Filter */}
                        <SearchableFilter
                            label="Adv. Manager"
                            options={advertiserManagers}
                            value={advertiserManagerFilter}
                            onValueChange={setAdvertiserManagerFilter}
                            placeholder="Search managers..."
                        />

                        {/* Affiliate ID Filter */}
                        <SearchableFilter
                            label="Affiliate ID"
                            options={uniqueAffiliateIds}
                            value={affiliateIdFilter}
                            onValueChange={setAffiliateIdFilter}
                            placeholder="Search IDs..."
                            width="w-40"
                        />

                        {/* Advertiser ID Filter */}
                        <SearchableFilter
                            label="Advertiser ID"
                            options={uniqueAdvertiserIds}
                            value={advertiserIdFilter}
                            onValueChange={setAdvertiserIdFilter}
                            placeholder="Search IDs..."
                            width="w-40"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-sm">Failed to load report</p>
                        <p className="text-xs mt-0.5 text-red-500">{error}</p>
                    </div>
                </div>
            )}

            {/* Summary Stats */}
            {hasFetched && !isLoading && !error && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Clicks" value={totals.clicks.toLocaleString()} icon={MousePointerClick} color="bg-blue-50 text-blue-600" />
                    <StatCard label="Conversions" value={fmt(totals.conversions, 0)} icon={Target} color="bg-green-50 text-green-600" />
                    <StatCard label="Revenue" value={fmtCurrency(totals.revenue)} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
                    <StatCard label="Profit" value={fmtCurrency(totals.profit)} icon={TrendingUp} color={totals.profit >= 0 ? "bg-purple-50 text-purple-600" : "bg-red-50 text-red-600"} />
                </div>
            )}

            {/* Table */}
            {hasFetched && (
                <Card className="border-none shadow-md bg-white overflow-hidden">
                    <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-800">
                                    Results
                                    {!isLoading && <span className="ml-2 text-xs font-normal text-gray-400">({sorted.length} rows)</span>}
                                </CardTitle>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Rows per page */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400 whitespace-nowrap">Rows per page</span>
                                    <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                                        <SelectTrigger className="h-8 w-16 text-xs bg-gray-50 border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 25, 50, 100].map(n => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Column Visibility Toggle */}
                                <DropdownMenu open={isDropdownOpen} onOpenChange={(open) => {
                                    setIsDropdownOpen(open);
                                    if (open) setTempVisibleColumns(visibleColumns);
                                }}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 px-4 flex items-center gap-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-md shadow-sm transition-all ml-auto">
                                            <Settings2 className="h-4 w-4" />
                                            <span>Columns</span>
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[180px] p-0 shadow-2xl border border-gray-100 rounded-xl overflow-hidden bg-white">
                                        <div className="p-3 pb-1">
                                            <h3 className="text-sm font-bold text-gray-900 leading-tight">Toggle Columns</h3>
                                            <p className="text-[10px] text-gray-400 mt-0.5 mb-2">Select columns to display.</p>

                                            <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                                {[
                                                    { id: 'campaign_name', label: 'Campaign' },
                                                    { id: 'affiliate_id', label: 'Aff. ID' },
                                                    { id: 'affiliate_manager', label: 'Aff. Manager' },
                                                    { id: 'offer_name', label: 'Offer' },
                                                    { id: 'advertiser_id', label: 'Adv. ID' },
                                                    { id: 'advertiser_manager', label: 'Adv. Manager' },
                                                    { id: 'price_media', label: 'Price / Media' },
                                                    { id: 'views', label: 'Views' },
                                                    { id: 'clicks', label: 'Clicks' },
                                                    { id: 'click_thru_pct', label: 'CTR%' },
                                                    { id: 'conversions', label: 'Conversions' },
                                                    { id: 'conversion_pct', label: 'CVR%' },
                                                    { id: 'cost', label: 'Cost' },
                                                    { id: 'revenue', label: 'Revenue' },
                                                    { id: 'profit', label: 'Profit' },
                                                    { id: 'margin', label: 'Margin' },
                                                    { id: 'epc', label: 'EPC' },
                                                    { id: 'paid', label: 'Paid' },
                                                    { id: 'pending', label: 'Pending' },
                                                    { id: 'rejected', label: 'Rejected' },
                                                    { id: 'approved', label: 'Approved' },
                                                    { id: 'average_cost', label: 'Avg Cost' },
                                                    { id: 'revenue_per_transaction', label: 'Rev/Txn' },
                                                ].map((col) => (
                                                    <div
                                                        key={col.id}
                                                        className="flex items-center gap-3 cursor-pointer group"
                                                        onClick={() => toggleTempColumn(col.id)}
                                                    >
                                                        <div className={`h-4 w-4 rounded flex items-center justify-center transition-all border-2 ${tempVisibleColumns[col.id] ? 'bg-red-600 border-red-600 shadow-sm' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                                                            {tempVisibleColumns[col.id] && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className={`text-xs font-medium transition-colors ${tempVisibleColumns[col.id] ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                                            {col.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-2 bg-gray-50 mt-1">
                                            <Button
                                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-8 rounded-lg text-xs shadow-md hover:shadow-lg transition-all"
                                                onClick={handleApplyColumns}
                                            >
                                                Apply
                                            </Button>
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <div className="relative w-full sm:w-61">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search campaign, offer…"
                                        className="pl-10 h-10 bg-muted/30 border-transparent focus:bg-white focus:border-primary/50 transition-all rounded-lg text-sm"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportCSV}
                                    disabled={sorted.length === 0}
                                    className="sm:hidden flex items-center gap-2 border-gray-200 h-9"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow>
                                        <SortableHead col="campaign_name">Campaign</SortableHead>
                                        <SortableHead col="affiliate_id">Aff. ID</SortableHead>
                                        <SortableHead col="affiliate_manager">Aff. Manager</SortableHead>
                                        <SortableHead col="offer_name">Offer</SortableHead>
                                        <SortableHead col="advertiser_id">Adv. ID</SortableHead>
                                        <SortableHead col="advertiser_manager">Adv. Manager</SortableHead>
                                        <SortableHead customCol="price_media">Price / Media</SortableHead>
                                        <SortableHead col="views">Views</SortableHead>
                                        <SortableHead col="clicks">Clicks</SortableHead>
                                        <SortableHead col="click_thru_pct">CTR%</SortableHead>
                                        <SortableHead col="conversions">Conv.</SortableHead>
                                        <SortableHead col="conversion_pct">CVR%</SortableHead>
                                        <SortableHead col="cost">Cost</SortableHead>
                                        <SortableHead col="revenue">Revenue</SortableHead>
                                        <SortableHead col="profit">Profit</SortableHead>
                                        <SortableHead col="margin">Margin</SortableHead>
                                        <SortableHead col="epc">EPC</SortableHead>
                                        <SortableHead col="paid">Paid</SortableHead>
                                        <SortableHead col="pending">Pending</SortableHead>
                                        <SortableHead col="rejected">Rejected</SortableHead>
                                        <SortableHead col="approved">Approved</SortableHead>
                                        <SortableHead col="average_cost">Avg Cost</SortableHead>
                                        <SortableHead col="revenue_per_transaction">Rev/Txn</SortableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={23} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                    <p className="font-medium">Fetching from Cake…</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : sorted.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={23} className="py-20 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                    <BarChart2 className="h-10 w-10 text-gray-200" />
                                                    <p className="font-medium text-sm">No data for the selected period & filters.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginated.map((r, i) => (
                                            <TableRow key={i} className="hover:bg-gray-50/50 transition-colors">
                                                {visibleColumns.campaign_name && (
                                                    <TableCell style={{ width: columnWidths.campaign_name, minWidth: columnWidths.campaign_name }} className="overflow-hidden">
                                                        <div className="font-semibold text-gray-900 text-sm truncate">{r.campaign_name || '—'}</div>
                                                        {r.campaign_id && <div className="text-[10px] text-gray-400">ID: {r.campaign_id}</div>}
                                                    </TableCell>
                                                )}
                                                {visibleColumns.affiliate_id && (
                                                    <TableCell style={{ width: columnWidths.affiliate_id, minWidth: columnWidths.affiliate_id }} className="overflow-hidden">
                                                        <div className="text-sm text-gray-600 truncate">{r.affiliate_id || '—'}</div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.affiliate_manager && (
                                                    <TableCell style={{ width: columnWidths.affiliate_manager, minWidth: columnWidths.affiliate_manager }} className="overflow-hidden">
                                                        <div className="text-sm text-gray-600 truncate">{r.affiliate_manager || '—'}</div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.offer_name && (
                                                    <TableCell style={{ width: columnWidths.offer_name, minWidth: columnWidths.offer_name }} className="overflow-hidden">
                                                        <div className="text-sm text-gray-700 truncate" title={r.offer_name}>{r.offer_name || '—'}</div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.advertiser_id && (
                                                    <TableCell style={{ width: columnWidths.advertiser_id, minWidth: columnWidths.advertiser_id }} className="overflow-hidden">
                                                        <div className="text-sm text-gray-600 truncate">{r.advertiser_id || '—'}</div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.advertiser_manager && (
                                                    <TableCell style={{ width: columnWidths.advertiser_manager, minWidth: columnWidths.advertiser_manager }} className="overflow-hidden">
                                                        <div className="text-sm text-gray-600 truncate">{r.advertiser_manager || '—'}</div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.price_media && (
                                                    <TableCell style={{ width: columnWidths.price_media, minWidth: columnWidths.price_media }} className="overflow-hidden">
                                                        <div className="flex flex-col gap-1 truncate text-ellipsis">
                                                            {r.price_format && <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-200 w-fit">{r.price_format}</Badge>}
                                                            {r.media_type && <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-gray-50 text-gray-600 border-gray-200 w-fit">{r.media_type}</Badge>}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.views && (
                                                    <TableCell style={{ width: columnWidths.views, minWidth: columnWidths.views }} className="text-right tabular-nums text-sm text-gray-700 truncate">{r.views.toLocaleString()}</TableCell>
                                                )}
                                                {visibleColumns.clicks && (
                                                    <TableCell style={{ width: columnWidths.clicks, minWidth: columnWidths.clicks }} className="text-right tabular-nums text-sm font-semibold text-gray-800 truncate">{r.clicks.toLocaleString()}</TableCell>
                                                )}
                                                {visibleColumns.click_thru_pct && (
                                                    <TableCell style={{ width: columnWidths.click_thru_pct, minWidth: columnWidths.click_thru_pct }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmtPct(r.click_thru_pct)}</TableCell>
                                                )}
                                                {visibleColumns.conversions && (
                                                    <TableCell style={{ width: columnWidths.conversions, minWidth: columnWidths.conversions }} className="text-right tabular-nums text-sm font-semibold text-gray-800 truncate">{fmt(r.conversions, 2)}</TableCell>
                                                )}
                                                {visibleColumns.conversion_pct && (
                                                    <TableCell style={{ width: columnWidths.conversion_pct, minWidth: columnWidths.conversion_pct }} className="text-right tabular-nums text-sm truncate">
                                                        <span className={r.conversion_pct > 0 ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                                                            {fmtPct(r.conversion_pct)}
                                                        </span>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.cost && (
                                                    <TableCell style={{ width: columnWidths.cost, minWidth: columnWidths.cost }} className="text-right tabular-nums text-sm text-gray-700 truncate">{fmtCurrency(r.cost)}</TableCell>
                                                )}
                                                {visibleColumns.revenue && (
                                                    <TableCell style={{ width: columnWidths.revenue, minWidth: columnWidths.revenue }} className="text-right tabular-nums text-sm font-semibold text-emerald-700 truncate">{fmtCurrency(r.revenue)}</TableCell>
                                                )}
                                                {visibleColumns.profit && (
                                                    <TableCell style={{ width: columnWidths.profit, minWidth: columnWidths.profit }} className="text-right tabular-nums text-sm font-bold truncate">
                                                        <span className={r.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            {fmtCurrency(r.profit)}
                                                        </span>
                                                    </TableCell>
                                                )}
                                                {visibleColumns.margin && (
                                                    <TableCell style={{ width: columnWidths.margin, minWidth: columnWidths.margin }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmtCurrency(r.margin)}</TableCell>
                                                )}
                                                {visibleColumns.epc && (
                                                    <TableCell style={{ width: columnWidths.epc, minWidth: columnWidths.epc }} className="text-right tabular-nums text-sm text-gray-700 truncate">{fmtCurrency(r.epc)}</TableCell>
                                                )}
                                                {visibleColumns.paid && (
                                                    <TableCell style={{ width: columnWidths.paid, minWidth: columnWidths.paid }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmt(r.paid)}</TableCell>
                                                )}
                                                {visibleColumns.pending && (
                                                    <TableCell style={{ width: columnWidths.pending, minWidth: columnWidths.pending }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmt(r.pending)}</TableCell>
                                                )}
                                                {visibleColumns.rejected && (
                                                    <TableCell style={{ width: columnWidths.rejected, minWidth: columnWidths.rejected }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmt(r.rejected)}</TableCell>
                                                )}
                                                {visibleColumns.approved && (
                                                    <TableCell style={{ width: columnWidths.approved, minWidth: columnWidths.approved }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmt(r.approved)}</TableCell>
                                                )}
                                                {visibleColumns.average_cost && (
                                                    <TableCell style={{ width: columnWidths.average_cost, minWidth: columnWidths.average_cost }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmtCurrency(r.average_cost)}</TableCell>
                                                )}
                                                {visibleColumns.revenue_per_transaction && (
                                                    <TableCell style={{ width: columnWidths.revenue_per_transaction, minWidth: columnWidths.revenue_per_transaction }} className="text-right tabular-nums text-sm text-gray-600 truncate">{fmtCurrency(r.revenue_per_transaction)}</TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Footer totals + pagination */}
                        {sorted.length > 0 && !isLoading && (
                            <>
                                <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-3 flex flex-wrap gap-6 text-sm">
                                    <span className="text-gray-500">Totals —</span>
                                    <span><span className="font-semibold text-gray-800">{totals.clicks.toLocaleString()}</span> <span className="text-gray-400 text-xs">clicks</span></span>
                                    <span><span className="font-semibold text-gray-800">{fmt(totals.conversions, 0)}</span> <span className="text-gray-400 text-xs">conv.</span></span>
                                    <span><span className="font-semibold text-emerald-700">{fmtCurrency(totals.revenue)}</span> <span className="text-gray-400 text-xs">revenue</span></span>
                                    <span><span className="font-semibold text-gray-700">{fmtCurrency(totals.cost)}</span> <span className="text-gray-400 text-xs">cost</span></span>
                                    <span><span className={`font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCurrency(totals.profit)}</span> <span className="text-gray-400 text-xs">profit</span></span>
                                </div>

                                {/* Pagination bar */}
                                <div className="border-t border-gray-100 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <p className="text-xs text-gray-400">
                                        Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length} rows
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-gray-200"
                                            onClick={() => setPage(1)}
                                            disabled={safePage === 1}
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                            <ChevronLeft className="h-3.5 w-3.5 -ml-2.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-gray-200"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={safePage === 1}
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </Button>

                                        {/* Page numbers */}
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((p, i) =>
                                                p === '...' ? (
                                                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                                                ) : (
                                                    <Button
                                                        key={p}
                                                        variant={safePage === p ? 'default' : 'outline'}
                                                        size="icon"
                                                        className={`h-8 w-8 text-xs ${safePage === p
                                                            ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white'
                                                            : 'border-gray-200'
                                                            }`}
                                                        onClick={() => setPage(p as number)}
                                                    >
                                                        {p}
                                                    </Button>
                                                )
                                            )
                                        }

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-gray-200"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage === totalPages}
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-gray-200"
                                            onClick={() => setPage(totalPages)}
                                            disabled={safePage === totalPages}
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                            <ChevronRight className="h-3.5 w-3.5 -ml-2.5" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )
            }
        </div>
    );
}
