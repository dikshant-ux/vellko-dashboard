'use client';

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { CSVMappingModal } from "./CSVMappingModal";
import { cn } from "@/lib/utils";

interface CallOfferUploadModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess: () => void;
}

export function CallOfferUploadModal({ open, setOpen, onSuccess }: CallOfferUploadModalProps) {
    const authFetch = useAuthFetch();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Mapping State
    const [isMappingOpen, setIsMappingOpen] = useState(false);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.name.endsWith('.csv')) {
                setFile(selectedFile);
            } else {
                toast.error("Please select a CSV file");
            }
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        console.log("Analyzing file:", file.name, "size:", file.size);
        setIsAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/analyze`, {
                method: 'POST',
                body: formData,
            });

            console.log("Analysis response status:", res?.status);

            if (res && res.ok) {
                const data = await res.json();
                console.log("Analysis data headers:", data.headers);
                setCsvHeaders(data.headers);
                setCsvPreview(data.preview);
                setIsMappingOpen(true);
            } else {
                const errorData = await res?.json().catch(() => ({}));
                console.error("Analysis error response:", errorData);
                toast.error(errorData?.detail || `Error (${res?.status}): Failed to analyze CSV file`);
            }
        } catch (error) {
            console.error("Analysis fetch error:", error);
            toast.error("Network error: Could not connect to the analysis service");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFinalUpload = async (mapping: Record<string, number>) => {
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mapping_json', JSON.stringify(mapping));

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/upload`, {
                method: 'POST',
                body: formData,
            });

            if (res && res.ok) {
                const data = await res.json();
                toast.success(`Successfully imported ${data.count} offers`);
                onSuccess();
                setIsMappingOpen(false);
                setOpen(false);
                setFile(null);
            } else {
                const error = await res?.json();
                toast.error(error?.detail || "Failed to import offers");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("An error occurred during import");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Smart CSV Import</DialogTitle>
                        <DialogDescription>
                            Upload your CSV and map the columns for a perfect import every time.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 transition-all hover:border-red-500/50 hover:bg-red-50/30 group">
                            <Input
                                id="csv-upload"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Label
                                htmlFor="csv-upload"
                                className="flex flex-col items-center gap-4 cursor-pointer"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                    <Upload className="h-7 w-7 text-slate-400 group-hover:text-red-600 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-700">
                                        {file ? file.name : "Choose CSV File"}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Drag & drop or click to browse
                                    </p>
                                </div>
                            </Label>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-500 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider">
                                <Sparkles className="h-3 w-3 text-red-500" />
                                Why Smart Import?
                            </div>
                            <p className="leading-relaxed">
                                Our AI handles simple headers automatically, but you'll have full control to map non-standard columns or duplicate fields in the next step.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isAnalyzing}>Cancel</Button>
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !file}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg px-6"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                "Next: Map Columns"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CSVMappingModal
                open={isMappingOpen}
                setOpen={setIsMappingOpen}
                headers={csvHeaders}
                preview={csvPreview}
                onConfirm={handleFinalUpload}
                isUploading={isUploading}
            />
        </>
    );
}
