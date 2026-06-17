'use client';

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, CheckCircle2, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ManageCustomFieldsModal } from "./ManageCustomFieldsModal";

interface AdvertiserCSVMappingModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    headers: string[];
    preview: string[][];
    customFields: string[];
    onConfirm: (mapping: Record<string, number>) => void;
    isUploading: boolean;
    onManageChange?: () => void;
}

const REQUIRED_FIELDS = [
    { id: "offer_id", label: "Offer ID", priority: true },
    { id: "name", label: "Offer Name", priority: true },
    { id: "payout", label: "Payout" },
    { id: "vertical", label: "Vertical" },
    { id: "status", label: "Status" },
    { id: "preview_link", label: "Preview Link" },
    { id: "tracking_link", label: "Tracking URL" },
];

export function AdvertiserCSVMappingModal({ 
    open, 
    setOpen, 
    headers, 
    preview, 
    customFields = [],
    onConfirm, 
    isUploading,
    onManageChange
}: AdvertiserCSVMappingModalProps) {
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Merge standard system fields and custom fields
    const allFields = [
        ...REQUIRED_FIELDS.map(f => ({ ...f, isCustom: false })),
        ...customFields.map(field => ({
            id: field,
            label: field,
            priority: false,
            isCustom: true
        }))
    ];

    // Intelligent auto-mapping based on common column names
    useEffect(() => {
        if (open && headers.length > 0) {
            const initialMapping: Record<string, string> = {};
            const usedIndices = new Set<number>();

            const fieldAliases: Record<string, string[]> = {
                offer_id: ["offer id", "offerid", "id", "site offer id", "siteofferid", "offernumber"],
                name: ["offer name", "offername", "name", "title", "site offer name", "siteoffername"],
                payout: ["payout", "amount", "price", "rate"],
                vertical: ["vertical", "category", "vertical name", "niche"],
                status: ["status", "state"],
                preview_link: ["preview link", "link", "url", "preview url", "offer link"],
                tracking_link: ["tracking link", "tracking url", "track url", "track link", "trackinglink", "trackingurl", "redirect link", "redirect url"]
            };

            // 1. Auto-map standard fields
            REQUIRED_FIELDS.forEach(field => {
                const aliases = fieldAliases[field.id] || [];
                const matchIndex = headers.findIndex((h, i) => {
                    if (usedIndices.has(i)) return false;
                    const cleanH = h.toLowerCase().trim();
                    return aliases.some(alias => cleanH.includes(alias) || alias.includes(cleanH));
                });

                if (matchIndex !== -1) {
                    initialMapping[field.id] = matchIndex.toString();
                    usedIndices.add(matchIndex);
                }
            });

            // 2. Auto-map advertiser custom fields
            customFields.forEach(field => {
                const cleanField = field.toLowerCase().trim();
                const matchIndex = headers.findIndex((h, i) => {
                    if (usedIndices.has(i)) return false;
                    const cleanH = h.toLowerCase().trim();
                    return cleanH === cleanField || cleanH.includes(cleanField) || cleanField.includes(cleanH);
                });

                if (matchIndex !== -1) {
                    initialMapping[field] = matchIndex.toString();
                    usedIndices.add(matchIndex);
                }
            });

            setMapping(initialMapping);
        }
    }, [open, headers, customFields]);

    const handleConfirm = () => {
        // Validation: Must have at least Offer ID and Offer Name mapped
        if (!mapping.offer_id || !mapping.name) {
            toast.error("Please map at least 'Offer ID' and 'Offer Name' fields.");
            return;
        }

        const finalMapping: Record<string, number> = {};
        Object.entries(mapping).forEach(([field, indexStr]) => {
            if (indexStr !== "none") {
                finalMapping[field] = parseInt(indexStr);
            }
        });
        
        onConfirm(finalMapping);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-xl border border-gray-100 shadow-2xl">
                <DialogHeader className="p-6 pb-2 font-sans">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                        <ArrowRight className="h-6 w-6 text-red-600" />
                        Map CSV Columns
                    </DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Align your CSV columns with our system fields. We've matched standard fields automatically, but please review and customize column mapping before importing.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col px-6 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 flex-1 min-h-0 overflow-hidden font-sans">
                        {/* Left: Mapping Controls */}
                        <div className="flex flex-col min-h-0 border-r pr-8 overflow-hidden h-full border-gray-100">
                            <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Field Mapping</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsManageModalOpen(true)}
                                    className="h-7 text-[10px] border border-gray-200 hover:border-gray-400 text-gray-600 bg-white hover:text-gray-900 px-2 rounded-md font-semibold"
                                >
                                    Manage List
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                                <div className="space-y-6 pb-8"> 
                                    {allFields.map((field) => (
                                        <div key={field.id} className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                                    {field.label}
                                                    {field.priority && <span className="text-red-500">*</span>}
                                                    {field.isCustom && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                                            Custom Field
                                                        </span>
                                                    )}
                                                </label>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {field.id}
                                                </span>
                                            </div>
                                            <Select
                                                value={mapping[field.id] || "none"}
                                                onValueChange={(val) => setMapping(prev => ({ ...prev, [field.id]: val }))}
                                            >
                                                <SelectTrigger className={cn(
                                                    "h-10 rounded-lg border-gray-200 transition-all focus:ring-red-500 bg-white",
                                                    mapping[field.id] && mapping[field.id] !== "none" ? "bg-red-50/50 border-red-200 text-red-950 font-medium" : "bg-white text-gray-700"
                                                )}>
                                                    <SelectValue placeholder="Skip this field" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px] bg-white border border-gray-100">
                                                    <SelectItem value="none" className="text-gray-400 italic">Skip this field</SelectItem>
                                                    {headers.map((header, idx) => (
                                                        <SelectItem key={idx} value={idx.toString()}>
                                                            Column {idx + 1}: {header}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Live Preview */}
                        <div className="flex flex-col min-h-0 overflow-hidden h-full">
                            <div className="flex items-center justify-between mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Live Preview</span>
                                </div>
                                <div className="text-[10px] bg-white px-2 py-0.5 rounded border border-gray-100 font-bold text-gray-400 uppercase">
                                    Top {preview.length} Rows
                                </div>
                            </div>
                            <div className="flex-1 border border-gray-100 rounded-xl bg-white shadow-inner overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-200">
                                    <div className="min-w-[450px]">
                                        <Table>
                                            <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-100">
                                                <TableRow className="hover:bg-transparent">
                                                    {allFields.filter(f => mapping[f.id] && mapping[f.id] !== "none").map(f => (
                                                        <TableHead key={f.id} className="text-[10px] font-bold uppercase text-gray-500 px-3 h-10 border-b border-gray-100">
                                                            {f.label}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {preview.map((row, rowIdx) => (
                                                    <TableRow key={rowIdx} className="hover:bg-gray-50/50 border-b border-gray-50">
                                                        {allFields.filter(f => mapping[f.id] && mapping[f.id] !== "none").map(f => {
                                                            const colIdx = parseInt(mapping[f.id]);
                                                            return (
                                                                <TableCell key={f.id} className="text-xs p-3 border-b border-gray-50 max-w-[150px] truncate font-medium text-gray-600">
                                                                    {row[colIdx] || "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                                {(preview.length === 0 || allFields.every(f => !mapping[f.id] || mapping[f.id] === "none")) && (
                                                    <TableRow>
                                                        <TableCell colSpan={allFields.length || 1} className="h-40 text-center text-gray-400 italic">
                                                            <div className="flex flex-col items-center gap-2 text-gray-300">
                                                                <Sparkles className="h-6 w-6 text-gray-300" />
                                                                Select columns on the left to see preview...
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                                <div className="p-1 rounded bg-white shadow-sm shrink-0 border border-red-100">
                                    <CheckCircle2 className="h-3 w-3 text-red-600" />
                                </div>
                                <p className="text-[10px] text-red-800 leading-relaxed font-medium">
                                    Note: Any columns that are skipped or not mapped to system fields will not be imported.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 items-center sm:justify-between gap-4 font-sans">
                    <div className="hidden sm:flex items-center gap-2 text-gray-500">
                        <Loader2 className={cn("h-4 w-4 animate-spin text-red-600", !isUploading && "hidden")} />
                        <span className="text-xs font-medium italic text-gray-500">
                            {isUploading ? "Finalizing import..." : "Ready to import"}
                        </span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            onClick={() => setOpen(false)} 
                            disabled={isUploading}
                            className="flex-1 sm:flex-none border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isUploading}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md px-8 h-9 font-semibold"
                        >
                            Import {preview.length}+ Records
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
            <ManageCustomFieldsModal
                open={isManageModalOpen}
                setOpen={setIsManageModalOpen}
                onChanged={onManageChange}
            />
        </Dialog>
    );
}
