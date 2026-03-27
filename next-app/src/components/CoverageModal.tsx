'use client';

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Globe, Edit2, Trash2, Check } from "lucide-react";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface CoverageModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    offerId: string;
    campaignName: string;
    initialCoverage: string;
    onSuccess: () => void;
    readOnly?: boolean;
}

export function CoverageModal({ 
    open, 
    setOpen, 
    offerId, 
    campaignName, 
    initialCoverage, 
    onSuccess,
    readOnly = false
}: CoverageModalProps) {
    const authFetch = useAuthFetch();
    const [tags, setTags] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // Editing state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");

    useEffect(() => {
        if (open) {
            const initialTags = initialCoverage
                ? Array.from(new Set(initialCoverage.split(",").map(t => t.trim()).filter(t => t !== "")))
                : [];
            setTags(initialTags);
            setInputValue("");
        }
    }, [open, initialCoverage]);

    const handleAddTag = () => {
        const val = inputValue.trim();
        if (!val) return;
        
        // Split by comma in case user pastes multiple and ensure uniqueness
        const newItems = val.split(",").map(t => t.trim()).filter(t => t !== "");
        const combined = Array.from(new Set([...tags, ...newItems]));
        
        setTags(combined);
        setInputValue("");
    };

    const handleRemoveTag = (idxToRemove: number) => {
        setTags(tags.filter((_, idx) => idx !== idxToRemove));
    };

    const startEditing = (idx: number, val: string) => {
        setEditingIndex(idx);
        setEditingValue(val);
    };

    const saveEdit = () => {
        if (editingIndex === null) return;
        const newVal = editingValue.trim();
        if (!newVal) return;

        const newTags = [...tags];
        newTags[editingIndex] = newVal;
        // Ensure uniqueness after edit
        setTags(Array.from(new Set(newTags)));
        setEditingIndex(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const coverageStr = tags.join(", ");
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/call-offers/${offerId}`, {
                method: "PUT",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coverage: coverageStr })
            });

            if (res && res.ok) {
                toast.success("Coverage updated successfully");
                onSuccess();
                setOpen(false);
            } else {
                toast.error("Failed to update coverage");
            }
        } catch (error) {
            console.error("Error updating coverage:", error);
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 text-left">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                                <Globe className="h-5 w-5 text-primary" />
                                {readOnly ? "View Coverage" : "Manage Coverage"}
                            </DialogTitle>
                            <p className="text-sm text-slate-500 mt-1 font-medium">{campaignName}</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 bg-white flex-1 overflow-y-auto min-h-[min(300px,50vh)]">
                    {!readOnly && (
                        <div className="space-y-3">
                            <Label htmlFor="tag-input" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Add State / Region
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="tag-input"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    placeholder="Enter value (e.g. CA, NY)"
                                    className="h-11 rounded-xl focus:ring-primary/20"
                                />
                                <Button 
                                    type="button" 
                                    onClick={handleAddTag}
                                    className="h-11 w-11 p-0 rounded-xl shrink-0"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">Separate multiple values with commas.</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Current Coverage ({tags.length})
                        </Label>
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[200px] max-h-[350px] overflow-y-auto">
                            {tags.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
                                    <Globe className="h-8 w-8 mb-2 stroke-[1.5px]" />
                                    <p className="text-sm font-medium">No coverage areas defined</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-100/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10">Region / State</TableHead>
                                            {!readOnly && <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider h-10 w-[100px]">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tags.map((tag, idx) => (
                                            <TableRow key={`${tag}-${idx}`} className="group hover:bg-white transition-colors">
                                                <TableCell className="py-2.5">
                                                    {editingIndex === idx && !readOnly ? (
                                                        <Input
                                                            value={editingValue}
                                                            onChange={(e) => setEditingValue(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                            autoFocus
                                                            className="h-8 text-sm focus-visible:ring-1"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium text-slate-700">{tag}</span>
                                                    )}
                                                </TableCell>
                                                {!readOnly && (
                                                    <TableCell className="py-2.5 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {editingIndex === idx ? (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={saveEdit}
                                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => startEditing(idx, tag)}
                                                                    className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                onClick={() => handleRemoveTag(idx)}
                                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t gap-2 sm:gap-0">
                    <Button 
                        variant={readOnly ? "default" : "ghost"}
                        onClick={() => setOpen(false)} 
                        disabled={isSaving}
                        className={readOnly ? "w-full rounded-xl font-bold h-11" : "rounded-xl font-bold h-11"}
                    >
                        {readOnly ? "Close" : "Cancel"}
                    </Button>
                    {!readOnly && (
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/20"
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
