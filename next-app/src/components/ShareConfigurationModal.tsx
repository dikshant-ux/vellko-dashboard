"use client"
// Re-saving to trigger re-index

import React, { useState, useEffect } from 'react';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, Check, Share2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ShareModalProps {
    currentFilters: {
        search: string;
        media_type_id: number;
        vertical_id: number;
    };
    availableColumns: { id: string; label: string }[];
    currentVisibleColumns: Record<string, boolean>;
    editToken?: string;
    open?: boolean;
    setOpen?: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ShareConfigurationModal({
    currentFilters,
    availableColumns,
    currentVisibleColumns,
    editToken,
    open: externalOpen,
    setOpen: setExternalOpen,
    onSuccess
}: ShareModalProps) {
    const authFetch = useAuthFetch();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState("24");
    const [linkName, setLinkName] = useState("");
    const [allowedEmails, setAllowedEmails] = useState("");
    const [generatedLink, setGeneratedLink] = useState("");
    const [selectedColumns, setSelectedColumns] = useState<string[]>(
        Object.keys(currentVisibleColumns).filter(k => currentVisibleColumns[k])
    );
    const [mediaTypes, setMediaTypes] = useState<{ media_type_id: number, media_type_name: string }[]>([]);
    const [selectedMediaTypes, setSelectedMediaTypes] = useState<number[]>(
        currentFilters.media_type_id ? [currentFilters.media_type_id] : []
    );
    const [editFilters, setEditFilters] = useState<any>(null);

    const isEdit = !!editToken;

    useEffect(() => {
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

    useEffect(() => {
        if (isEdit && open) {
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
                    } else {
                        toast.error("Failed to load link configuration");
                    }
                } catch (error) {
                    console.error("Failed to fetch link config", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchConfig();
        }
    }, [isEdit, editToken, open]);

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
                ? { ...editFilters, media_type_ids: selectedMediaTypes }
                : { ...currentFilters, media_type_ids: selectedMediaTypes };

            // Remove the old singular field if it exists
            if ('media_type_id' in filtersToSave) {
                delete (filtersToSave as any).media_type_id;
            }

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: filtersToSave,
                    duration_hours: parseInt(duration),
                    allowed_emails: emailsList,
                    visible_columns: selectedColumns,
                    name: linkName || undefined
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
        setSelectedColumns(Object.keys(currentVisibleColumns).filter(k => currentVisibleColumns[k]));
        setSelectedMediaTypes(currentFilters.media_type_id ? [currentFilters.media_type_id] : []);
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Shared Link" : "Share Offer List"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update configuration for this shared link." : "Configure access settings and generate a secure link."}
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
                                        <ScrollArea className="h-[200px]">
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
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <p className="-mt-2 text-xs text-muted-foreground italic">Restricts shared page to selected media type filters.</p>

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
                            <Label>Visible Columns</Label>
                            <ScrollArea className="h-[100px] w-full rounded-md border p-2">
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
                            </ScrollArea>
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
            </DialogContent>
        </Dialog >
    );
}
