"use client"

import { useState, useEffect } from 'react';
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
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, Loader2, ArrowUpDown, ChevronLeft, ChevronRight, Settings2, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShareConfigurationModal } from "@/components/ShareConfigurationModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Offer {
    site_offer_id: string;
    site_offer_name: string;
    third_party_name: string;
    brand_advertiser_name: string;
    vertical_name: string;
    status: string;
    hidden: boolean;
    preview_link: string;
    payout: string;
    price_format: string;
    brand_advertiser_id: string;
    description: string;
}

export default function OffersPage() {
    const authFetch = useAuthFetch();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10); // Standard row limit per user request
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortField, setSortField] = useState("offer_id");
    const [sortDesc, setSortDesc] = useState(false);
    const [mediaTypes, setMediaTypes] = useState<{ media_type_id: number, media_type_name: string }[]>([]);
    const [statuses, setStatuses] = useState<{ status_id: number, status_name: string }[]>([]);
    const [selectedMediaType, setSelectedMediaType] = useState<string>("0");
    const [selectedStatus, setSelectedStatus] = useState<string>("0");
    const [verticals, setVerticals] = useState<{ vertical_id: number, vertical_name: string }[]>([]);
    const [selectedVertical, setSelectedVertical] = useState<string>("0");
    const [verticalSearch, setVerticalSearch] = useState("");

    // Column Visibility State
    const [columnVisibility, setColumnVisibility] = useState({
        id: true,
        name: true,
        vertical: true,
        status: true,
        payout: true,
        type: true,
        preview: true
    });

    const [tempColumnVisibility, setTempColumnVisibility] = useState(columnVisibility);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);

    // Load column visibility from local storage on mount
    useEffect(() => {
        const savedVisibility = localStorage.getItem('offersColumnVisibility');
        if (savedVisibility) {
            try {
                const parsed = JSON.parse(savedVisibility);
                setColumnVisibility(parsed);
                setTempColumnVisibility(parsed);
            } catch (e) {
                console.error("Failed to parse saved column visibility", e);
            }
        }
    }, []);

    // Sync temp visibility when selector opens
    useEffect(() => {
        if (isColumnSelectorOpen) {
            setTempColumnVisibility(columnVisibility);
        }
    }, [isColumnSelectorOpen, columnVisibility]);

    const handleApplyColumns = () => {
        setColumnVisibility(tempColumnVisibility);
        localStorage.setItem('offersColumnVisibility', JSON.stringify(tempColumnVisibility));
        setIsColumnSelectorOpen(false);
    };

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [mediaRes, statusRes, verticalRes] = await Promise.all([
                    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/media-types`),
                    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/statuses`),
                    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/verticals`)
                ]);

                if (mediaRes?.ok) setMediaTypes(await mediaRes.json());
                if (statusRes?.ok) setStatuses(await statusRes.json());
                if (verticalRes?.ok) setVerticals(await verticalRes.json());
            } catch (error) {
                console.error("Failed to fetch filters", error);
            }
        };
        fetchFilters();
    }, []);

    const fetchOffers = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                sort_field: sortField,
                sort_descending: sortDesc.toString(),
                media_type_id: selectedMediaType,
                site_offer_status_id: selectedStatus,
                vertical_id: selectedVertical,
                ...(debouncedSearch && { search: debouncedSearch })
            });

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers?${params}`);
            if (res && res.ok) {
                const data = await res.json();
                setOffers(data.offers || []);
                setTotalRows(data.row_count || 0);
                setTotalPages(data.total_pages || 0);
            } else {
                console.error("Failed to fetch offers");
            }
        } catch (error) {
            console.error("Error fetching offers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOffers();
    }, [page, limit, sortField, sortDesc, debouncedSearch, selectedMediaType, selectedStatus, selectedVertical]);

    // Prepare available columns for the modal

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(false);
        }
    };
    // Prepare available columns for the modal
    const availableColumns = [
        { id: "id", label: "ID" },
        { id: "name", label: "Name" },
        { id: "vertical", label: "Vertical" },
        { id: "status", label: "Status" },
        { id: "type", label: "Type" },
        { id: "payout", label: "Payout" },
        { id: "preview", label: "Preview" },
    ];

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Affiliate Offers</h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">
                        Manage and view all available offers from integrated networks.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ShareConfigurationModal
                        currentFilters={{
                            search: search || "",
                            media_type_id: Number(selectedMediaType || 0),
                            vertical_id: Number(selectedVertical || 0),
                            site_offer_status_id: Number(selectedStatus || 0)
                        }}
                        availableColumns={availableColumns}
                        currentVisibleColumns={columnVisibility}
                    />
                    <Popover open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="ml-auto bg-background shadow-sm">
                                <Settings2 className="mr-2 h-4 w-4" />
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[200px] p-0">
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Toggle Columns</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Select columns to display.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-id"
                                            checked={tempColumnVisibility.id}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, id: !!c })}
                                        />
                                        <Label htmlFor="col-id">ID</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-name"
                                            checked={tempColumnVisibility.name}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, name: !!c })}
                                        />
                                        <Label htmlFor="col-name">Offer Name</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-vertical"
                                            checked={tempColumnVisibility.vertical}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, vertical: !!c })}
                                        />
                                        <Label htmlFor="col-vertical">Vertical</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-status"
                                            checked={tempColumnVisibility.status}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, status: !!c })}
                                        />
                                        <Label htmlFor="col-status">Status</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-payout"
                                            checked={tempColumnVisibility.payout}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, payout: !!c })}
                                        />
                                        <Label htmlFor="col-payout">Payout</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-type"
                                            checked={tempColumnVisibility.type}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, type: !!c })}
                                        />
                                        <Label htmlFor="col-type">Type</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="col-preview"
                                            checked={tempColumnVisibility.preview}
                                            onCheckedChange={(c) => setTempColumnVisibility({ ...tempColumnVisibility, preview: !!c })}
                                        />
                                        <Label htmlFor="col-preview">Preview</Label>
                                    </div>
                                </div>
                                <Button className="w-full" onClick={handleApplyColumns}>Apply</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full flex-1">
                    <Input
                        placeholder="Search offers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:max-w-sm bg-background shadow-sm"
                    />
                    <Select value={selectedMediaType} onValueChange={(val) => { setSelectedMediaType(val); setPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[150px] bg-background shadow-sm">
                            <SelectValue placeholder="Media Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">All Media Types</SelectItem>
                            {mediaTypes.map((mt) => (
                                <SelectItem key={mt.media_type_id} value={mt.media_type_id.toString()}>
                                    {mt.media_type_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[150px] bg-background shadow-sm">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">All Statuses</SelectItem>
                            {statuses.map((s) => (
                                <SelectItem key={s.status_id} value={s.status_id.toString()}>
                                    {s.status_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[200px] justify-between font-normal bg-background shadow-sm">
                                <span className="truncate">
                                    {selectedVertical === "0"
                                        ? "All Verticals"
                                        : verticals.find(v => v.vertical_id.toString() === selectedVertical)?.vertical_name || "Vertical"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <div className="p-2 border-b">
                                <Input
                                    placeholder="Search verticals..."
                                    value={verticalSearch}
                                    onChange={(e) => setVerticalSearch(e.target.value)}
                                    className="h-8"
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1">
                                <div
                                    className={`flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-sm ${selectedVertical === "0" ? "bg-muted font-medium" : ""}`}
                                    onClick={() => {
                                        setSelectedVertical("0");
                                        setPage(1);
                                    }}
                                >
                                    All Verticals
                                </div>
                                {verticals
                                    .filter(v =>
                                        v.vertical_name.toLowerCase().includes(verticalSearch.toLowerCase())
                                    )
                                    .slice(0, 100) // Performance hack: only show first 100 matches
                                    .map((v) => (
                                        <div
                                            key={v.vertical_id}
                                            className={`flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-sm ${selectedVertical === v.vertical_id.toString() ? "bg-muted font-medium" : ""}`}
                                            onClick={() => {
                                                setSelectedVertical(v.vertical_id.toString());
                                                setPage(1);
                                            }}
                                        >
                                            {v.vertical_name}
                                        </div>
                                    ))
                                }
                                {verticals.filter(v => v.vertical_name.toLowerCase().includes(verticalSearch.toLowerCase())).length > 100 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center border-t mt-1">
                                        Showing first 100 matches. Please search to refine.
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="hidden md:block rounded-md border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            {columnVisibility.id && (
                                <TableHead className="w-[80px] cursor-pointer" onClick={() => handleSort('offer_id')}>
                                    <div className="flex items-center">
                                        ID {sortField === 'offer_id' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                    </div>
                                </TableHead>
                            )}
                            {columnVisibility.name && (
                                <TableHead className="cursor-pointer" onClick={() => handleSort('offer_name')}>
                                    <div className="flex items-center">
                                        Name {sortField === 'offer_name' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                    </div>
                                </TableHead>
                            )}
                            {columnVisibility.vertical && <TableHead>Vertical</TableHead>}
                            {columnVisibility.status && <TableHead>Status</TableHead>}
                            {columnVisibility.type && <TableHead>Type</TableHead>}
                            {columnVisibility.payout && <TableHead>Payout</TableHead>}
                            {columnVisibility.preview && <TableHead>Preview</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        <span>Loading offers...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : offers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No offers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            offers.map((offer) => (
                                <TableRow key={offer.site_offer_id}>
                                    {columnVisibility.id && <TableCell className="font-medium">{offer.site_offer_id}</TableCell>}
                                    {columnVisibility.name && (
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{offer.site_offer_name}</span>
                                                <span className="text-xs text-muted-foreground">{offer.third_party_name}</span>
                                            </div>
                                        </TableCell>
                                    )}
                                    {columnVisibility.vertical && <TableCell>{offer.vertical_name}</TableCell>}
                                    {columnVisibility.status && (
                                        <TableCell>
                                            <Badge variant={offer.status === 'Public' ? 'secondary' : 'outline'}>
                                                {offer.status}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {columnVisibility.type && <TableCell>{offer.price_format}</TableCell>}
                                    {columnVisibility.payout && <TableCell className="font-medium text-green-600">{offer.payout}</TableCell>}
                                    {columnVisibility.preview && (
                                        <TableCell>
                                            {offer.preview_link && (
                                                <Button variant="ghost" size="sm" asChild>
                                                    <a href={offer.preview_link} target="_blank" rel="noopener noreferrer">
                                                        Preview
                                                    </a>
                                                </Button>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <Card>
                        <CardContent className="h-24 flex justify-center items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span>Loading offers...</span>
                        </CardContent>
                    </Card>
                ) : offers.length === 0 ? (
                    <Card>
                        <CardContent className="h-24 flex justify-center items-center">
                            No offers found.
                        </CardContent>
                    </Card>
                ) : (
                    offers.map((offer) => (
                        <Card key={offer.site_offer_id} className="overflow-hidden shadow-sm">
                            <CardHeader className="bg-muted/30 pb-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex flex-col">
                                        <CardTitle className="text-base leading-tight">
                                            {offer.site_offer_name}
                                        </CardTitle>
                                        <span className="text-xs text-muted-foreground mt-1">
                                            ID: {offer.site_offer_id} • {offer.third_party_name}
                                        </span>
                                    </div>
                                    <Badge variant={offer.status === 'Public' ? 'secondary' : 'outline'} className="shrink-0">
                                        {offer.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vertical</p>
                                    <p className="mt-0.5 font-medium">{offer.vertical_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Payout</p>
                                    <p className="mt-0.5 font-bold text-green-600">{offer.payout}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</p>
                                    <p className="mt-0.5">{offer.price_format}</p>
                                </div>
                                <div className="col-span-2 pt-2 border-t">
                                    {offer.preview_link && (
                                        <Button className="w-full" variant="outline" size="sm" asChild>
                                            <a href={offer.preview_link} target="_blank" rel="noopener noreferrer">
                                                Preview Offer
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2 border-t mt-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-muted-foreground order-2 md:order-1">
                    <div className="flex items-center gap-2">
                        <span>Rows per page</span>
                        <Select value={limit.toString()} onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}>
                            <SelectTrigger className="h-8 w-[70px] bg-background shadow-sm">
                                <SelectValue placeholder={limit.toString()} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span>Showing {offers.length} of {totalRows} offers</span>
                </div>
                <div className="flex items-center gap-2 order-1 md:order-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                        className="h-8 shadow-sm"
                    >
                        <ChevronLeft className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <div className="text-sm font-medium px-3 h-8 flex items-center bg-muted/30 rounded-md border">
                        Page {page} of {Math.max(1, totalPages)}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || isLoading}
                        className="h-8 shadow-sm"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4 sm:ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
