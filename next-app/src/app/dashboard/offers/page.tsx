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
    const [selectedMediaType, setSelectedMediaType] = useState<string>("0");

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
        // Fetch media types
        const fetchMediaTypes = async () => {
            try {
                const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/media-types`);
                if (res && res.ok) {
                    const data = await res.json();
                    setMediaTypes(data);
                }
            } catch (error) {
                console.error("Failed to fetch media types", error);
            }
        };
        fetchMediaTypes();
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
    }, [page, limit, sortField, sortDesc, debouncedSearch, selectedMediaType]);

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
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Affiliate Offers</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage and view all available offers from integrated networks.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ShareConfigurationModal
                        currentFilters={{
                            search: search || "",
                            media_type_id: Number(selectedMediaType || 0),
                            vertical_id: 0 // Add vertical filter state later if implemented
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

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <Input
                        placeholder="Search offers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="max-w-sm bg-background shadow-sm"
                    />
                    <Select value={selectedMediaType} onValueChange={(val) => { setSelectedMediaType(val); setPage(1); }}>
                        <SelectTrigger className="w-[180px] bg-background shadow-sm">
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
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground whitespace-nowrap">
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
            </div>

            <div className="rounded-md border bg-card shadow-sm">
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

            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {Math.max(1, totalPages)}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
    );
}
