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
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CSVMappingModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    headers: string[];
    preview: string[][];
    onConfirm: (mapping: Record<string, number>) => void;
    isUploading: boolean;
}

const REQUIRED_FIELDS = [
    { id: "verticals", label: "Verticals", priority: true },
    { id: "campaign_id", label: "Campaign ID", priority: true },
    { id: "campaign_name", label: "Campaign Name", priority: true },
    { id: "campaign_type", label: "Campaign Type" },
    { id: "payout_range", label: "Payout / Buffer Range" },
    { id: "traffic_allowed", label: "Traffic Allowed" },
    { id: "hours_of_operation", label: "Hours of Operation" },
    { id: "target_geo", label: "Target Geo" },
    { id: "capping", label: "Capping" },
    { id: "coverage", label: "Coverage" },
    { id: "details", label: "Details / Notes" },
    { id: "status", label: "Status" },
];

export function CSVMappingModal({ 
    open, 
    setOpen, 
    headers, 
    preview, 
    onConfirm, 
    isUploading 
}: CSVMappingModalProps) {
    const [mapping, setMapping] = useState<Record<string, string>>({});

    // Auto-map based on common names
    useEffect(() => {
        if (open && headers.length > 0) {
            const initialMapping: Record<string, string> = {};
            const usedIndices = new Set<number>();

            // Priority: Explicit matches for priority fields first
            const fieldAliases: Record<string, string[]> = {
                verticals: ["verticals", "vertical", "category"],
                campaign_id: ["campaign id", "campaignid", "id"],
                campaign_name: ["campaign name", "campaignname", "name", "offer"],
                campaign_type: ["campaign type", "campaigntype", "type"],
                payout_range: ["payout", "buffer", "payout range", "payout / b", "payout / b,"],
                traffic_allowed: ["traffic", "traffic allowed", "traffic allo"],
                hours_of_operation: ["hours", "operation", "hours of c"],
                target_geo: ["geo", "target", "geography"],
                capping: ["capping", "caping", "cap", "aping"],
                coverage: ["coverage", "states", "region"],
                details: ["details", "notes", "description"],
                status: ["status"]
            };

            // Intelligent positional handling for "Campaign" headers if duplicates exist
            let campaignCount = 0;
            const campaignIndices = headers
                .map((h, i) => h.toLowerCase() === "campaign" ? i : -1)
                .filter(i => i !== -1);

            if (campaignIndices.length >= 3) {
                initialMapping["campaign_id"] = campaignIndices[0].toString();
                initialMapping["campaign_name"] = campaignIndices[1].toString();
                initialMapping["campaign_type"] = campaignIndices[2].toString();
                campaignIndices.forEach(i => usedIndices.add(i));
            }

            REQUIRED_FIELDS.forEach(field => {
                if (initialMapping[field.id]) return; // Skip if already mapped

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

            setMapping(initialMapping);
        }
    }, [open, headers]);

    const handleConfirm = () => {
        // Validation: Must have at least Campaign Name and Verticals for a good import
        if (!mapping.campaign_name || !mapping.verticals) {
            toast.error("Please map at least 'Campaign Name' and 'Verticals'");
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
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                        <ArrowRight className="h-6 w-6 text-red-600" />
                        Map CSV Columns
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Align your CSV columns with our system fields. We've attempted to match them automatically, but please verify before proceeding.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col px-6 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 flex-1 min-h-0 overflow-hidden">
                        {/* Left: Mapping Controls */}
                        <div className="flex flex-col min-h-0 border-r pr-8 overflow-hidden h-full">
                            <div className="flex items-center gap-2 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <ArrowRight className="h-4 w-4 text-slate-500" />
                                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Column Mapping</span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                <div className="space-y-6 pb-8"> 
                                    {REQUIRED_FIELDS.map((field) => (
                                        <div key={field.id} className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                                    {field.label}
                                                    {field.priority && <span className="text-red-500">*</span>}
                                                </label>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {field.id}
                                                </span>
                                            </div>
                                            <Select
                                                value={mapping[field.id] || "none"}
                                                onValueChange={(val) => setMapping(prev => ({ ...prev, [field.id]: val }))}
                                            >
                                                <SelectTrigger className={cn(
                                                    "h-10 rounded-lg border-slate-200 transition-all focus:ring-red-500",
                                                    mapping[field.id] && mapping[field.id] !== "none" ? "bg-red-50 border-red-200 text-red-900" : "bg-white"
                                                )}>
                                                    <SelectValue placeholder="Skip this field" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <SelectItem value="none" className="text-slate-400 italic">Skip this field</SelectItem>
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
                            <div className="flex items-center justify-between mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Live Preview</span>
                                </div>
                                <div className="text-[10px] bg-white px-2 py-0.5 rounded border font-bold text-slate-400 uppercase">
                                    Top {preview.length} Rows
                                </div>
                            </div>
                            <div className="flex-1 border rounded-xl bg-white shadow-inner overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                <div className="min-w-[600px]">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <TableRow className="hover:bg-transparent">
                                                {REQUIRED_FIELDS.filter(f => mapping[f.id] && mapping[f.id] !== "none").map(f => (
                                                    <TableHead key={f.id} className="text-[10px] font-bold uppercase text-slate-500 px-3 h-10 border-b">
                                                        {f.label}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.map((row, rowIdx) => (
                                                <TableRow key={rowIdx} className="hover:bg-slate-50/50">
                                                    {REQUIRED_FIELDS.filter(f => mapping[f.id] && mapping[f.id] !== "none").map(f => {
                                                        const colIdx = parseInt(mapping[f.id]);
                                                        return (
                                                            <TableCell key={f.id} className="text-xs p-3 border-b max-w-[150px] truncate font-medium text-slate-600">
                                                                {row[colIdx] || "-"}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                            {(preview.length === 0 || REQUIRED_FIELDS.every(f => !mapping[f.id] || mapping[f.id] === "none")) && (
                                                <TableRow>
                                                    <TableCell colSpan={11} className="h-40 text-center text-slate-400 italic">
                                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                                            <Sparkles className="h-6 w-6" />
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
                                <div className="p-1 rounded bg-white shadow-sm shrink-0">
                                    <CheckCircle2 className="h-3 w-3 text-red-600" />
                                </div>
                                <p className="text-[10px] text-red-800 leading-relaxed font-medium">
                                    Verify that each value appears in the correct column. You can import up to 500 records at once.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t items-center sm:justify-between gap-4">
                    <div className="hidden sm:flex items-center gap-2 text-slate-500">
                        <Loader2 className={cn("h-4 w-4 animate-spin", !isUploading && "hidden")} />
                        <span className="text-xs font-medium italic">
                            {isUploading ? "Finalizing import..." : "Ready to import"}
                        </span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            onClick={() => setOpen(false)} 
                            disabled={isUploading}
                            className="flex-1 sm:flex-none border-slate-300 rounded-lg hover:bg-white"
                        >
                            Back to Upload
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isUploading}
                            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md px-8"
                        >
                            Import {preview.length}+ Records
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
