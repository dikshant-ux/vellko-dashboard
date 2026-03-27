"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
    Search, 
    Plus, 
    Upload, 
    Share2, 
    MoreHorizontal, 
    Edit, 
    Trash2, 
    ChevronLeft, 
    ChevronRight,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { CallOfferModal } from "@/components/CallOfferModal";
import { CallOfferUploadModal } from "@/components/CallOfferUploadModal";
import { ShareConfigurationModal } from "@/components/ShareConfigurationModal";
import { toast } from "sonner";

interface CallOffer {
    id: string;
    verticals: string;
    campaign_id: string;
    campaign_name: string;
    campaign_type: string;
    payout_buffer_range: string;
    traffic_allowed: string;
    hours_of_operation: string;
    target_geo: string;
    capping: string;
    details: string;
}

export default function CallOffersPage() {
    const authFetch = useAuthFetch();
    const [offers, setOffers] = useState<CallOffer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [editingOffer, setEditingOffer] = useState<CallOffer | null>(null);

    const fetchOffers = useCallback(async () => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                skip: ((page - 1) * pageSize).toString(),
                limit: pageSize.toString(),
                ...(search && { search })
            });

            const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers?${queryParams.toString()}`);
            if (response && response.ok) {
                const data = await response.json();
                setOffers(data.items.map((item: any) => ({ ...item, id: item._id || item.id })));
                setTotal(data.total);
            }
        } catch (error) {
            console.error("Error fetching call offers:", error);
        } finally {
            setIsLoading(false);
        }
    }, [authFetch, page, search, pageSize]);

    useEffect(() => {
        fetchOffers();
    }, [fetchOffers]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this offer?")) return;

        try {
            const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/${id}`, {
                method: "DELETE"
            });
            if (response && response.ok) {
                toast.success("Offer deleted successfully");
                fetchOffers();
            }
        } catch (error) {
            console.error("Error deleting offer:", error);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Call Offers</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setIsShareModalOpen(true)} className="flex-1 sm:flex-none">
                        <Share2 className="mr-2 h-4 w-4" />
                        <span className="hidden xs:inline">Share</span>
                        <span className="xs:hidden">Share</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsUploadModalOpen(true)} className="flex-1 sm:flex-none">
                        <Upload className="mr-2 h-4 w-4" />
                        <span className="hidden xs:inline">Upload</span>
                        <span className="xs:hidden">Upload</span>
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none px-4" onClick={() => {
                        setEditingOffer(null);
                        setIsAddModalOpen(true);
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Offer
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Offers</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by campaign name, ID or verticals..."
                                value={search}
                                onChange={handleSearch}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    <div className="hidden md:block rounded-md border overflow-x-auto overflow-y-visible">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Verticals</TableHead>
                                    <TableHead>ID</TableHead>
                                    <TableHead className="min-w-[200px]">Campaign Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Payout / Buffer</TableHead>
                                    <TableHead>Traffic Allowed</TableHead>
                                    <TableHead>Geo</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Capping</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Loading offers...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : offers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            No call offers found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    offers.map((offer) => (
                                        <TableRow key={offer.id}>
                                            <TableCell>
                                                <Badge variant="secondary" className="whitespace-nowrap">{offer.verticals}</Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{offer.campaign_id}</TableCell>
                                            <TableCell className="font-medium">{offer.campaign_name}</TableCell>
                                            <TableCell>{offer.campaign_type}</TableCell>
                                            <TableCell>{offer.payout_buffer_range}</TableCell>
                                            <TableCell className="text-xs">{offer.traffic_allowed}</TableCell>
                                            <TableCell>{offer.target_geo}</TableCell>
                                            <TableCell className="text-xs">{offer.hours_of_operation}</TableCell>
                                            <TableCell className="text-xs font-mono">{offer.capping}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => {
                                                            setEditingOffer(offer);
                                                            setIsAddModalOpen(true);
                                                        }}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit Offer
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(offer.id)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Offer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>Loading offers...</p>
                            </div>
                        ) : offers.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                                <p>No call offers found.</p>
                            </div>
                        ) : (
                            offers.map((offer) => (
                                <Card key={offer.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                                        {offer.verticals}
                                                    </Badge>
                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                        #{offer.campaign_id}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-gray-900 leading-tight">
                                                    {offer.campaign_name}
                                                </h3>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingOffer(offer);
                                                        setIsAddModalOpen(true);
                                                    }}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(offer.id)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-muted/30 p-2 rounded-md">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Payout</p>
                                                <p className="font-semibold text-green-700">{offer.payout_buffer_range}</p>
                                            </div>
                                            <div className="bg-muted/30 p-2 rounded-md">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Type</p>
                                                <p className="font-medium">{offer.campaign_type}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-muted-foreground">
                                            <div className="flex justify-between">
                                                <span className="font-medium">Traffic:</span>
                                                <span className="text-gray-900 text-right">{offer.traffic_allowed}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">Geo/Hours:</span>
                                                <span className="text-gray-900 text-right">{offer.target_geo} • {offer.hours_of_operation}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">Capping:</span>
                                                <span className="text-gray-900 font-mono text-right">{offer.capping}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>

                    {total > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t mt-4">
                            <div className="flex items-center gap-4 order-2 sm:order-1">
                                <p className="text-sm text-muted-foreground whitespace-nowrap">
                                    Showing {total === 0 ? 0 : ((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows:</span>
                                    <Select
                                        value={pageSize.toString()}
                                        onValueChange={(val) => {
                                            setPageSize(parseInt(val));
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-[70px]">
                                            <SelectValue placeholder={pageSize.toString()} />
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
                            
                            {totalPages > 1 && (
                                <div className="flex items-center space-x-2 order-1 sm:order-2 w-full sm:w-auto justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="h-8 shadow-sm"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Prev
                                    </Button>
                                    <div className="text-sm font-medium bg-muted/50 px-3 py-1 rounded-md border min-w-[80px] text-center">
                                        {page} / {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="h-8 shadow-sm"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <CallOfferModal
                open={isAddModalOpen}
                setOpen={setIsAddModalOpen}
                offer={editingOffer}
                onSuccess={fetchOffers}
            />

            <CallOfferUploadModal
                open={isUploadModalOpen}
                setOpen={setIsUploadModalOpen}
                onSuccess={fetchOffers}
            />

            <ShareConfigurationModal
                open={isShareModalOpen}
                setOpen={setIsShareModalOpen}
                offerType="call"
                availableColumns={[
                    { id: 'id', label: 'ID' },
                    { id: 'name', label: 'Campaign Name' },
                    { id: 'vertical', label: 'Verticals' },
                    { id: 'type', label: 'Type' },
                    { id: 'payout', label: 'Payout / Buffer' },
                    { id: 'geo', label: 'Geo' },
                    { id: 'hours', label: 'Hours' },
                    { id: 'traffic', label: 'Traffic Allowed' },
                    { id: 'capping', label: 'Capping' }
                ]}
                currentVisibleColumns={['id', 'name', 'vertical', 'type', 'payout', 'geo', 'hours', 'traffic', 'capping']}
            />
        </div>
    );
}
