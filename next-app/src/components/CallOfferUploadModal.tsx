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
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/useAuthFetch";

interface CallOfferUploadModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess: () => void;
}

export function CallOfferUploadModal({ open, setOpen, onSuccess }: CallOfferUploadModalProps) {
    const authFetch = useAuthFetch();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

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

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/upload`, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type header, let the browser set it with the boundary
            });

            if (res && res.ok) {
                const data = await res.json();
                toast.success(`Successfully uploaded ${data.count} offers`);
                onSuccess();
                setOpen(false);
            } else {
                const error = await res?.json();
                toast.error(error?.detail || "Failed to upload offers");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("An error occurred during upload");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Call Offers</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file containing call offers. The system will match common headers automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 transition-colors hover:border-red-500/50 hover:bg-red-50/50">
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
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                <Upload className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-gray-900">
                                    {file ? file.name : "Click to upload CSV"}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Maximum file size 10MB
                                </p>
                            </div>
                        </Label>
                    </div>

                    <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 text-sm text-blue-700 space-y-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <FileText className="h-4 w-4" />
                            Expected CSV Headers
                        </div>
                        <p className="text-blue-600/80 leading-relaxed">
                            Verticals, Campaign ID, Campaign Name, Campaign Type, Payout Range, Traffic Allowed, Hours, Target Geo, Capping, Details
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>Cancel</Button>
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading || !file}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            "Start Upload"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
