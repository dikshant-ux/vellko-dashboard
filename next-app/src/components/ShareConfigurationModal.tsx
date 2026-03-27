"use client"
// Re-saving to trigger re-index

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check, Share2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ShareModalProps {
    currentFilters?: {
        search?: string;
        media_type_id?: number;
        vertical_id?: number;
        site_offer_status_id?: number;
    };
    availableColumns: { id: string; label: string }[];
    currentVisibleColumns?: any;
    editToken?: string;
    open?: boolean;
    setOpen?: (open: boolean) => void;
    onSuccess?: () => void;
    offerType?: "web" | "call";
}

export function ShareConfigurationModal({
    currentFilters = {},
    availableColumns,
    currentVisibleColumns = [],
    editToken,
    open: externalOpen,
    setOpen: setExternalOpen,
    onSuccess,
    offerType = "web"
}: ShareModalProps) {
    const { data: session, status } = useSession();
    const authFetch = useAuthFetch();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = (val: boolean) => {
        if (setExternalOpen) setExternalOpen(val);
        setInternalOpen(val);
    };

    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState("24");
    const [linkName, setLinkName] = useState("");
    const [allowedEmails, setAllowedEmails] = useState("");
    const [generatedLink, setGeneratedLink] = useState("");
    const [selectedColumns, setSelectedColumns] = useState<string[]>(
        Array.isArray(currentVisibleColumns)
            ? [...currentVisibleColumns]
            : Object.keys(currentVisibleColumns || {}).filter(k => (currentVisibleColumns as any)[k] === true)
    );
    const [mediaTypes, setMediaTypes] = useState<{ media_type_id: number, media_type_name: string }[]>([]);
    const [statuses, setStatuses] = useState<{ status_id: number, status_name: string }[]>([]);
    const [verticals, setVerticals] = useState<{ vertical_id: number, vertical_name: string }[]>([]);
    const [selectedMediaTypes, setSelectedMediaTypes] = useState<number[]>(
        currentFilters?.media_type_id ? [currentFilters.media_type_id] : []
    );
    const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>(
        currentFilters?.site_offer_status_id ? [currentFilters.site_offer_status_id] : []
    );
    const [selectedVerticalIds, setSelectedVerticalIds] = useState<number[]>(
        currentFilters?.vertical_id ? [currentFilters.vertical_id] : []
    );
    const [editFilters, setEditFilters] = useState<any>(null);
    const [verticalSearch, setVerticalSearch] = useState("");

    // Call Offer Specific Filters
    const [callFilterOptions, setCallFilterOptions] = useState<{
        verticals: string[],
        campaign_types: string[],
        traffic_allowed: string[],
        target_geos: string[]
    }>({
        verticals: [],
        campaign_types: [],
        traffic_allowed: [],
        target_geos: []
    });
    const [selectedCallVerticals, setSelectedCallVerticals] = useState<string[]>([]);
    const [selectedCallTypes, setSelectedCallTypes] = useState<string[]>([]);
    const [selectedCallTraffic, setSelectedCallTraffic] = useState<string[]>([]);
    const [selectedCallGeos, setSelectedCallGeos] = useState<string[]>([]);

    const isEdit = !!editToken;

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                if (offerType === "web") {
                    const [mediaRes, statusRes, verticalRes] = await Promise.all([
                        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/media-types`),
                        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/statuses`),
                        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/verticals`)
                    ]);
                    if (mediaRes?.ok) setMediaTypes(await mediaRes.json());
                    if (statusRes?.ok) setStatuses(await statusRes.json());
                    if (verticalRes?.ok) setVerticals(await verticalRes.json());
                } else {
                    const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/filters`);
                    if (res?.ok) {
                        const data = await res.json();
                        setCallFilterOptions(data);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch filters", error);
            }
        };

        if (status === 'authenticated' && session?.accessToken) {
            fetchFilters();
        }
    }, [offerType, status, session, authFetch]);

    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoading(true);
            try {
                const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${editToken}/config`);
                if (res && res.ok) {
                    const data = await res.json();
                    setLinkName(data.name || "");
                    setDuration(data.duration_hours.toString());
                    setAllowedEmails(data.allowed_emails.join(", "));
                    setSelectedColumns(data.visible_columns || []);
                    setEditFilters(data.filters);
                    if (data.filters && data.filters.media_type_ids) {
                        setSelectedMediaTypes(data.filters.media_type_ids);
                    } else if (data.filters && data.filters.media_type_id) {
                        setSelectedMediaTypes([data.filters.media_type_id]);
                    }

                    if (data.filters && data.filters.site_offer_status_ids) {
                        setSelectedStatusIds(data.filters.site_offer_status_ids);
                    } else if (data.filters && data.filters.site_offer_status_id) {
                        setSelectedStatusIds([data.filters.site_offer_status_id]);
                    }

                    if (data.filters && data.filters.vertical_ids) {
                        setSelectedVerticalIds(data.filters.vertical_ids);
                    } else if (data.filters && data.filters.vertical_id) {
                        setSelectedVerticalIds([data.filters.vertical_id]);
                    }

                    // Call specific filters
                    if (data.filters && data.filters.call_verticals) setSelectedCallVerticals(data.filters.call_verticals);
                    if (data.filters && data.filters.call_types) setSelectedCallTypes(data.filters.call_types);
                    if (data.filters && data.filters.call_traffic) setSelectedCallTraffic(data.filters.call_traffic);
                    if (data.filters && data.filters.call_geos) setSelectedCallGeos(data.filters.call_geos);
                } else {
                    toast.error("Failed to load link configuration");
                }
            } catch (error) {
                console.error("Failed to fetch link config", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (isEdit && open && status === 'authenticated' && session?.accessToken) {
            fetchConfig();
        }
    }, [isEdit, editToken, open, status, session, authFetch]);

    const handleCreateOrUpdateLink = async () => {
        setIsLoading(true);
        try {
            const emailsList = allowedEmails
                .split(',')
                .map(e => e.trim())
                .filter(e => e.length > 0);

            const url = isEdit
                ? `${process.env.NEXT_PUBLIC_API_URL}/offers/share/${editToken}`
                : `${process.env.NEXT_PUBLIC_API_URL}/offers/share`;

            const method = isEdit ? 'PATCH' : 'POST';

            const filtersToSave = isEdit && editFilters
                ? {
                    ...editFilters,
                    media_type_ids: selectedMediaTypes,
                    site_offer_status_ids: selectedStatusIds,
                    vertical_ids: selectedVerticalIds,
                    call_verticals: selectedCallVerticals,
                    call_types: selectedCallTypes,
                    call_traffic: selectedCallTraffic,
                    call_geos: selectedCallGeos
                }
                : {
                    ...currentFilters,
                    media_type_ids: selectedMediaTypes,
                    site_offer_status_ids: selectedStatusIds,
                    vertical_ids: selectedVerticalIds,
                    call_verticals: selectedCallVerticals,
                    call_types: selectedCallTypes,
                    call_traffic: selectedCallTraffic,
                    call_geos: selectedCallGeos
                };

            // Remove old singular fields if they exist
            if ('media_type_id' in filtersToSave) {
                delete (filtersToSave as any).media_type_id;
            }
            if ('site_offer_status_id' in filtersToSave) {
                delete (filtersToSave as any).site_offer_status_id;
            }
            if ('vertical_id' in filtersToSave) {
                delete (filtersToSave as any).vertical_id;
            }

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: filtersToSave,
                    duration_hours: parseInt(duration),
                    allowed_emails: emailsList,
                    visible_columns: selectedColumns,
                    name: linkName || undefined,
                    offer_type: offerType
                })
            });

            if (res && res.ok) {
                const data = await res.json();
                if (!isEdit) {
                    setGeneratedLink(data.link);
                    toast.success("Share link created successfully!");
                } else {
                    toast.success("Share link updated successfully!");
                    if (onSuccess) onSuccess();
                    resetAndClose();
                }
            } else {
                toast.error(isEdit ? "Failed to update share link" : "Failed to create share link");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        toast.success("Copied to clipboard");
    };

    const resetAndClose = () => {
        setOpen(false);
        setGeneratedLink("");
        setLinkName("");
        setAllowedEmails("");
        setDuration("24");
        setSelectedColumns(
            Array.isArray(currentVisibleColumns)
                ? [...currentVisibleColumns]
                : Object.keys(currentVisibleColumns || {}).filter(k => (currentVisibleColumns as any)[k] === true)
        );
        setSelectedMediaTypes(currentFilters?.media_type_id ? [currentFilters.media_type_id] : []);
        setSelectedStatusIds(currentFilters?.site_offer_status_id ? [currentFilters.site_offer_status_id] : []);
        setSelectedVerticalIds(currentFilters?.vertical_id ? [currentFilters.vertical_id] : []);
        setSelectedCallVerticals([]);
        setSelectedCallTypes([]);
        setSelectedCallTraffic([]);
        setSelectedCallGeos([]);
        setEditFilters(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isEdit && (
                <DialogTrigger asChild>
                    <Button variant="outline" className="bg-background shadow-sm">
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
                <div className="max-h-[min(90vh,900px)] overflow-y-auto p-6 pt-12 md:pt-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle>{isEdit ? "Update Shared Link" : "Share Selected Columns"}</DialogTitle>
                        <DialogDescription>
                            Generate a secure link to share specific offer data with affiliates.
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedLink ? (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Link Name (Optional)</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Q1 Campaign Offers for Partner X"
                                    value={linkName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkName(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="duration">Duration</Label>
                                    <Select value={duration} onValueChange={setDuration}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select duration" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 Hour</SelectItem>
                                            <SelectItem value="24">24 Hours</SelectItem>
                                            <SelectItem value="48">48 Hours</SelectItem>
                                            <SelectItem value="168">7 Days</SelectItem>
                                            <SelectItem value="720">30 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {offerType === "web" && (
                                    <div className="grid gap-2">
                                        <Label>Media Types</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal">
                                                    {selectedMediaTypes.length === 0 ? "All Media Types" :
                                                        selectedMediaTypes.length === 1 ? mediaTypes.find(m => m.media_type_id === selectedMediaTypes[0])?.media_type_name :
                                                            `${selectedMediaTypes.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div
                                                    className="h-[200px] overflow-y-auto"
                                                    onWheel={(e) => e.stopPropagation()}
                                                >
                                                    <div className="p-2 space-y-2">
                                                        <div className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                            onClick={() => setSelectedMediaTypes([])}>
                                                            <Checkbox
                                                                id="mt-all"
                                                                checked={selectedMediaTypes.length === 0}
                                                                onCheckedChange={() => setSelectedMediaTypes([])}
                                                            />
                                                            <Label htmlFor="mt-all" className="text-sm cursor-pointer flex-1">All Media Types</Label>
                                                        </div>
                                                        {mediaTypes.map((mt) => (
                                                            <div key={mt.media_type_id}
                                                                className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => {
                                                                    if (selectedMediaTypes.includes(mt.media_type_id)) {
                                                                        setSelectedMediaTypes(selectedMediaTypes.filter(id => id !== mt.media_type_id));
                                                                    } else {
                                                                        setSelectedMediaTypes([...selectedMediaTypes, mt.media_type_id]);
                                                                    }
                                                                }}>
                                                                <Checkbox
                                                                    id={`mt-${mt.media_type_id}`}
                                                                    checked={selectedMediaTypes.includes(mt.media_type_id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedMediaTypes([...selectedMediaTypes, mt.media_type_id]);
                                                                        } else {
                                                                            setSelectedMediaTypes(selectedMediaTypes.filter(id => id !== mt.media_type_id));
                                                                        }
                                                                    }}
                                                                />
                                                                <Label htmlFor={`mt-${mt.media_type_id}`} className="text-sm cursor-pointer flex-1">
                                                                    {mt.media_type_name}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>)}
                            </div>

                            {offerType === "web" && (
                                <div className="grid grid-cols-2 gap-4 -mt-2">
                                    <div className="grid gap-2">
                                        <Label>Statuses</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedStatusIds.length === 0 ? "All Statuses" :
                                                        selectedStatusIds.length === 1 ? statuses.find(s => s.status_id === selectedStatusIds[0])?.status_name :
                                                            `${selectedStatusIds.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div
                                                    className="h-[200px] overflow-y-auto"
                                                    onWheel={(e) => e.stopPropagation()}
                                                >
                                                    <div className="p-2 space-y-2">
                                                        <div className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                            onClick={() => setSelectedStatusIds([])}>
                                                            <Checkbox
                                                                id="st-all"
                                                                checked={selectedStatusIds.length === 0}
                                                                onCheckedChange={() => setSelectedStatusIds([])}
                                                            />
                                                            <Label htmlFor="st-all" className="text-sm cursor-pointer flex-1">All Statuses</Label>
                                                        </div>
                                                        {statuses.map((s) => (
                                                            <div key={s.status_id}
                                                                className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => {
                                                                    if (selectedStatusIds.includes(s.status_id)) {
                                                                        setSelectedStatusIds(selectedStatusIds.filter(id => id !== s.status_id));
                                                                    } else {
                                                                        setSelectedStatusIds([...selectedStatusIds, s.status_id]);
                                                                    }
                                                                }}>
                                                                <Checkbox
                                                                    id={`st-${s.status_id}`}
                                                                    checked={selectedStatusIds.includes(s.status_id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedStatusIds([...selectedStatusIds, s.status_id]);
                                                                        } else {
                                                                            setSelectedStatusIds(selectedStatusIds.filter(id => id !== s.status_id));
                                                                        }
                                                                    }}
                                                                />
                                                                <Label htmlFor={`st-${s.status_id}`} className="text-sm cursor-pointer flex-1">
                                                                    {s.status_name}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Verticals</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedVerticalIds.length === 0 ? "All Verticals" :
                                                        selectedVerticalIds.length === 1 ? verticals.find(v => v.vertical_id === selectedVerticalIds[0])?.vertical_name :
                                                            `${selectedVerticalIds.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
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
                                                <div
                                                    className="h-[300px] overflow-y-auto"
                                                    onWheel={(e) => e.stopPropagation()}
                                                >
                                                    <div className="p-2 space-y-2">
                                                        <div className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                            onClick={() => setSelectedVerticalIds([])}>
                                                            <Checkbox
                                                                id="v-all"
                                                                checked={selectedVerticalIds.length === 0}
                                                                onCheckedChange={() => setSelectedVerticalIds([])}
                                                            />
                                                            <Label htmlFor="v-all" className="text-sm cursor-pointer flex-1">All Verticals</Label>
                                                        </div>
                                                        {verticals
                                                            .filter(v => v.vertical_name.toLowerCase().includes(verticalSearch.toLowerCase()))
                                                            .slice(0, 100)
                                                            .map((v) => (
                                                                <div key={v.vertical_id}
                                                                    className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                    onClick={() => {
                                                                        if (selectedVerticalIds.includes(v.vertical_id)) {
                                                                            setSelectedVerticalIds(selectedVerticalIds.filter(id => id !== v.vertical_id));
                                                                        } else {
                                                                            setSelectedVerticalIds([...selectedVerticalIds, v.vertical_id]);
                                                                        }
                                                                    }}>
                                                                    <Checkbox
                                                                        id={`v-${v.vertical_id}`}
                                                                        checked={selectedVerticalIds.includes(v.vertical_id)}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) {
                                                                                setSelectedVerticalIds([...selectedVerticalIds, v.vertical_id]);
                                                                            } else {
                                                                                setSelectedVerticalIds(selectedVerticalIds.filter(id => id !== v.vertical_id));
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Label htmlFor={`v-${v.vertical_id}`} className="text-sm cursor-pointer flex-1">
                                                                        {v.vertical_name}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        {verticals.filter(v => v.vertical_name.toLowerCase().includes(verticalSearch.toLowerCase())).length > 100 && (
                                                            <div className="p-2 text-xs text-muted-foreground text-center border-t mt-1">
                                                                Showing first 100 matches. Please search to refine.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            )}

                            {offerType === "call" && (
                                <div className="grid grid-cols-2 gap-4 -mt-2">
                                    <div className="grid gap-2">
                                        <Label>Verticals</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedCallVerticals.length === 0 ? "All Verticals" :
                                                        selectedCallVerticals.length === 1 ? selectedCallVerticals[0] :
                                                            `${selectedCallVerticals.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div className="h-[200px] overflow-y-auto">
                                                    <div className="p-2 space-y-1">
                                                        {callFilterOptions.verticals.map((v) => (
                                                            <div key={v} className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => setSelectedCallVerticals(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v])}>
                                                                <Checkbox checked={selectedCallVerticals.includes(v)} />
                                                                <Label className="text-sm cursor-pointer flex-1">{v}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Campaign Types</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedCallTypes.length === 0 ? "All Types" :
                                                        selectedCallTypes.length === 1 ? selectedCallTypes[0] :
                                                            `${selectedCallTypes.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div className="h-[200px] overflow-y-auto">
                                                    <div className="p-2 space-y-1">
                                                        {callFilterOptions.campaign_types.map((v) => (
                                                            <div key={v} className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => setSelectedCallTypes(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v])}>
                                                                <Checkbox checked={selectedCallTypes.includes(v)} />
                                                                <Label className="text-sm cursor-pointer flex-1">{v}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Traffic Allowed</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedCallTraffic.length === 0 ? "All Traffic" :
                                                        selectedCallTraffic.length === 1 ? selectedCallTraffic[0] :
                                                            `${selectedCallTraffic.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div className="h-[200px] overflow-y-auto">
                                                    <div className="p-2 space-y-1">
                                                        {callFilterOptions.traffic_allowed.map((v) => (
                                                            <div key={v} className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => setSelectedCallTraffic(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v])}>
                                                                <Checkbox checked={selectedCallTraffic.includes(v)} />
                                                                <Label className="text-sm cursor-pointer flex-1">{v}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Target Geo</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal text-xs md:text-sm">
                                                    {selectedCallGeos.length === 0 ? "All Geos" :
                                                        selectedCallGeos.length === 1 ? selectedCallGeos[0] :
                                                            `${selectedCallGeos.length} Selected`}
                                                    <Plus className="ml-2 h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <div className="h-[200px] overflow-y-auto">
                                                    <div className="p-2 space-y-1">
                                                        {callFilterOptions.target_geos.map((v) => (
                                                            <div key={v} className="flex items-center space-x-2 p-1 hover:bg-muted rounded-sm cursor-pointer"
                                                                onClick={() => setSelectedCallGeos(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v])}>
                                                                <Checkbox checked={selectedCallGeos.includes(v)} />
                                                                <Label className="text-sm cursor-pointer flex-1">{v}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            )}
                            {offerType === "web" && <p className="-mt-2 text-xs text-muted-foreground italic">Restricts shared page to selected Type and Status filters.</p>}
                            {offerType === "call" && <p className="-mt-2 text-xs text-muted-foreground italic">Restricts shared page to selected Call Offer filters.</p>}

                            <div className="grid gap-2">
                                <Label htmlFor="emails">Allowed Emails (Optional, Comma Separated)</Label>
                                <Textarea
                                    id="emails"
                                    placeholder="partner@example.com, admin@vellko.com"
                                    value={allowedEmails}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAllowedEmails(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">If empty, any email can request OTP.</p>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>Visible Columns</Label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedColumns(availableColumns.map(c => c.id))}
                                            className="text-[10px] text-primary hover:underline font-medium"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-[10px] text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedColumns([])}
                                            className="text-[10px] text-gray-500 hover:underline font-medium"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div
                                    className="h-[120px] w-full rounded-md border p-2 overflow-y-auto bg-background"
                                    onWheel={(e) => e.stopPropagation()}
                                >
                                    <div className="space-y-2">
                                        {availableColumns.map((col) => (
                                            <div key={col.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`col-${col.id}`}
                                                    checked={selectedColumns.includes(col.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedColumns([...selectedColumns, col.id]);
                                                        } else {
                                                            setSelectedColumns(selectedColumns.filter(id => id !== col.id));
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor={`col-${col.id}`} className="text-sm font-normal cursor-pointer">
                                                    {col.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <div className="rounded-full bg-green-100 p-3">
                                <Check className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-lg">Link Generated!</h3>
                                <p className="text-sm text-muted-foreground">Share this link with your partners.</p>
                            </div>
                            <div className="flex w-full items-center space-x-2 mt-2">
                                <Input readOnly value={generatedLink} className="font-mono text-sm bg-muted" />
                                <Button size="icon" onClick={copyToClipboard}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!generatedLink ? (
                            <Button type="submit" onClick={handleCreateOrUpdateLink} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? "Save Changes" : "Generate Link"}
                            </Button>
                        ) : (
                            <Button type="button" variant="outline" onClick={resetAndClose}>
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
