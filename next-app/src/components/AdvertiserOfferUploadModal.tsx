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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { AdvertiserCSVMappingModal } from "./AdvertiserCSVMappingModal";

interface AdvertiserOfferUploadModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    advertiserId: string | null;
    advertiserName: string;
    onSuccess: () => void;
}

export function AdvertiserOfferUploadModal({
    open,
    setOpen,
    advertiserId,
    advertiserName,
    onSuccess
}: AdvertiserOfferUploadModalProps) {
    const authFetch = useAuthFetch();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [customFields, setCustomFields] = useState<string[]>([]);

    // Column Mapping states
    const [isMappingOpen, setIsMappingOpen] = useState(false);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);

    const fetchCustomFields = async () => {
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns`);
            if (res && res.ok) {
                const data = await res.json();
                setCustomFields(data.custom_columns || []);
            }
        } catch (err) {
            console.error("Failed to fetch global custom fields:", err);
        }
    };

    // Fetch system-wide custom fields on modal open
    useEffect(() => {
        if (open) {
            fetchCustomFields();
        }
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.name.endsWith('.csv')) {
                const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB
                if (selectedFile.size > MAX_CSV_SIZE) {
                    toast.error("CSV file is too large. Maximum size allowed is 10MB.");
                    return;
                }
                setFile(selectedFile);
            } else {
                toast.error("Please select a CSV file");
            }
        }
    };

    // First step: analyze the CSV columns
    const handleAnalyze = async () => {
        if (!file || !advertiserId) return;

        setIsAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${advertiserId}/analyze-csv`, {
                method: 'POST',
                body: formData,
            });

            if (res && res.ok) {
                const data = await res.json();
                setCsvHeaders(data.headers || []);
                setCsvPreview(data.preview || []);
                
                // Open mapping modal and close the upload modal
                setIsMappingOpen(true);
                setOpen(false);
            } else {
                const errorData = await res?.json().catch(() => ({}));
                toast.error(errorData?.detail || "Failed to analyze CSV file");
            }
        } catch (error) {
            console.error("Analysis error:", error);
            toast.error("An error occurred during file analysis");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Second step: perform the mapped import
    const handleFinalUpload = async (mapping: Record<string, number>) => {
        if (!file || !advertiserId) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mapping_json', JSON.stringify(mapping));

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${advertiserId}/upload-csv`, {
                method: 'POST',
                body: formData,
            });

            if (res && res.ok) {
                const data = await res.json();
                toast.success(data.message || `Successfully imported offers`);
                onSuccess();
                setIsMappingOpen(false);
                setFile(null);
            } else {
                const errorData = await res?.json().catch(() => ({}));
                toast.error(errorData?.detail || "Failed to import mapped offers");
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
                <DialogContent className="sm:max-w-[425px] bg-white rounded-xl border border-gray-100 shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900 font-sans">Smart CSV Import</DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 mt-1 font-sans">
                            Upload a CSV file and map the columns to import offers for <span className="font-semibold text-gray-800">{advertiserName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 transition-all hover:border-red-500/50 hover:bg-red-50/30 group">
                            <Input
                                id="advertiser-csv-upload"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Label
                                htmlFor="advertiser-csv-upload"
                                className="flex flex-col items-center gap-4 cursor-pointer"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-red-100 transition-colors border border-gray-100 shadow-sm">
                                    <Upload className="h-7 w-7 text-gray-400 group-hover:text-red-600 transition-colors" />
                                </div>
                                <div className="text-center font-sans">
                                    <p className="font-bold text-gray-700 text-sm">
                                        {file ? file.name : "Choose CSV File"}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Drag & drop or click to browse
                                    </p>
                                </div>
                            </Label>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs text-gray-500 space-y-2 font-sans">
                            <div className="flex items-center gap-2 font-bold text-gray-700 uppercase tracking-wider">
                                <Sparkles className="h-3 w-3 text-red-500" />
                                Interactive Mapping
                            </div>
                            <p className="leading-relaxed">
                                Our importer matches standard headers automatically, but you will have full control to map non-standard columns or duplicate fields in the next step.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isAnalyzing} className="rounded-lg h-9 text-gray-600 font-sans">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !file}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg px-6 h-9 font-semibold transition-colors font-sans"
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

            <AdvertiserCSVMappingModal
                open={isMappingOpen}
                setOpen={setIsMappingOpen}
                headers={csvHeaders}
                preview={csvPreview}
                customFields={customFields}
                onConfirm={handleFinalUpload}
                isUploading={isUploading}
                onManageChange={fetchCustomFields}
            />
        </>
    );
}
