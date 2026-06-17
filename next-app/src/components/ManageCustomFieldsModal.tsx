'use client';

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { Loader2, Plus, Trash2, Edit2, Check, X } from "lucide-react";

interface ManageCustomFieldsModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onChanged?: () => void;
}

export function ManageCustomFieldsModal({
    open,
    setOpen,
    onChanged
}: ManageCustomFieldsModalProps) {
    const authFetch = useAuthFetch();
    const [fields, setFields] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newFieldName, setNewFieldName] = useState("");
    const [isSavingNew, setIsSavingNew] = useState(false);

    // Editing states
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Deleting states
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchFields = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns`);
            if (res && res.ok) {
                const data = await res.json();
                setFields(data.custom_columns || []);
            }
        } catch (err) {
            console.error("Failed to load custom columns:", err);
            toast.error("Failed to load custom columns list");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchFields();
            // Reset edit/add states
            setNewFieldName("");
            setEditingIndex(null);
            setEditingValue("");
            setDeletingIndex(null);
        }
    }, [open]);

    const handleAddField = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newFieldName.trim();
        if (!trimmed) {
            toast.error("Field name cannot be empty");
            return;
        }

        setIsSavingNew(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed })
            });

            if (res && res.ok) {
                toast.success(`Custom field '${trimmed}' added successfully`);
                setNewFieldName("");
                fetchFields();
                if (onChanged) onChanged();
            } else {
                const err = await res?.json().catch(() => ({}));
                toast.error(err.detail || "Failed to add custom field");
            }
        } catch (error) {
            console.error("Add field error:", error);
            toast.error("An error occurred");
        } finally {
            setIsSavingNew(false);
        }
    };

    const handleStartEdit = (index: number, val: string) => {
        setEditingIndex(index);
        setEditingValue(val);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingValue("");
    };

    const handleSaveEdit = async (index: number, oldValue: string) => {
        const trimmed = editingValue.trim();
        if (!trimmed) {
            toast.error("Field name cannot be empty");
            return;
        }

        if (trimmed === oldValue) {
            handleCancelEdit();
            return;
        }

        setIsSavingEdit(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ old_name: oldValue, new_name: trimmed })
            });

            if (res && res.ok) {
                toast.success("Renamed custom field successfully");
                setEditingIndex(null);
                setEditingValue("");
                fetchFields();
                if (onChanged) onChanged();
            } else {
                const err = await res?.json().catch(() => ({}));
                toast.error(err.detail || "Failed to rename custom field");
            }
        } catch (error) {
            console.error("Edit field error:", error);
            toast.error("An error occurred");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDeleteField = async (name: string) => {
        setIsDeleting(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns?name=${encodeURIComponent(name)}`, {
                method: "DELETE"
            });

            if (res && res.ok) {
                toast.success(`Custom field '${name}' deleted successfully`);
                setDeletingIndex(null);
                fetchFields();
                if (onChanged) onChanged();
            } else {
                const err = await res?.json().catch(() => ({}));
                toast.error(err.detail || "Failed to delete custom field");
            }
        } catch (error) {
            console.error("Delete field error:", error);
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white rounded-xl border border-gray-100 shadow-2xl">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        Manage Custom Fields
                    </DialogTitle>
                    <DialogDescription className="text-gray-500 text-xs">
                        Add, edit, or delete custom columns used system-wide across all advertiser offers (e.g. Geos, Capping). Renaming updates all existing offers and mappings automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col py-4 overflow-hidden">
                    {/* Add Custom Field Form */}
                    <form onSubmit={handleAddField} className="flex gap-2 mb-4 shrink-0">
                        <Input
                            placeholder="Add new custom field (e.g. Daily Cap)"
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            disabled={isSavingNew}
                            className="h-10 focus-visible:ring-red-500"
                        />
                        <Button
                            type="submit"
                            disabled={isSavingNew || !newFieldName.trim()}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-10 px-4 flex items-center gap-1.5 shrink-0"
                        >
                            {isSavingNew ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Add
                        </Button>
                    </form>

                    {/* Fields List */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 border border-gray-100 rounded-lg p-2 bg-gray-50/30">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                                <span className="text-xs">Loading custom fields...</span>
                            </div>
                        ) : fields.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-xs italic">
                                No custom fields configured yet. Enter a name above to create one.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {fields.map((field, idx) => {
                                    const isEditing = editingIndex === idx;
                                    const isConfirmDeleting = deletingIndex === idx;

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors shadow-sm gap-2"
                                        >
                                            {isEditing ? (
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <Input
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                        disabled={isSavingEdit}
                                                        className="h-8 text-xs py-1 px-2 focus-visible:ring-red-500 flex-1"
                                                        autoFocus
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        disabled={isSavingEdit}
                                                        onClick={() => handleSaveEdit(idx, field)}
                                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                                    >
                                                        {isSavingEdit ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        disabled={isSavingEdit}
                                                        onClick={handleCancelEdit}
                                                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ) : isConfirmDeleting ? (
                                                <div className="flex items-center justify-between flex-1 gap-2">
                                                    <span className="text-xs text-red-700 font-medium font-sans">
                                                        Are you sure you want to delete this field?
                                                    </span>
                                                    <div className="flex gap-1 shrink-0">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={isDeleting}
                                                            onClick={() => handleDeleteField(field)}
                                                            className="h-7 text-[10px] rounded px-2.5 bg-red-600 font-semibold"
                                                        >
                                                            {isDeleting ? "Deleting..." : "Delete"}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isDeleting}
                                                            onClick={() => setDeletingIndex(null)}
                                                            className="h-7 text-[10px] rounded px-2.5 text-gray-600 bg-white"
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-xs text-gray-800 font-medium px-1">
                                                        {field}
                                                    </span>
                                                    <div className="flex gap-0.5 shrink-0">
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleStartEdit(idx, field)}
                                                            className="h-8 w-8 text-gray-400 hover:text-gray-700"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => setDeletingIndex(idx)}
                                                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
