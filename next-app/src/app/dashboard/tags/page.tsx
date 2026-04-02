'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash, Tag, RefreshCcw, Pencil, Plus, Palette } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagType {
    name: string;
    color: string;
}

const PREDEFINED_COLORS = [
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Slate', value: '#475569' },
];

export default function TagsPage() {
    const { data: session, status } = useSession();
    const authFetch = useAuthFetch();
    const [tags, setTags] = useState<TagType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editingTag, setEditingTag] = useState<TagType | null>(null);
    const [newTagName, setNewTagName] = useState("");
    const [selectedEditColor, setSelectedEditColor] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const [createTagName, setCreateTagName] = useState("");
    const [createTagColor, setCreateTagColor] = useState("#EF4444");
    const [isCreating, setIsCreating] = useState(false);

    const fetchTags = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags`);
            if (res) {
                const data = await res.json();
                setTags(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching tags:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.accessToken) {
            fetchTags();
        }
    }, [status, session, authFetch]);

    const handleCreateTag = async () => {
        const trimmedName = createTagName.trim();
        if (!trimmedName) return;

        setIsCreating(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName, color: createTagColor })
            });

            if (res && res.ok) {
                setCreateTagName("");
                setCreateTagColor("#EF4444");
                fetchTags(); // Refresh to include new standalone tag
            } else {
                const errorData = await res?.json();
                alert(errorData?.detail || "Failed to create tag.");
            }
        } catch (error) {
            console.error("Error creating tag:", error);
            alert("An error occurred while creating the tag.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTag = async () => {
        if (!editingTag || !newTagName.trim()) {
            setEditingTag(null);
            return;
        }

        setIsRenaming(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags/${encodeURIComponent(editingTag.name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    new_name: newTagName.trim(),
                    color: selectedEditColor
                })
            });

            if (res && res.ok) {
                fetchTags();
                setEditingTag(null);
            } else {
                alert("Failed to update tag.");
            }
        } catch (error) {
            console.error("Error updating tag:", error);
            alert("An error occurred while updating the tag.");
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDeleteTag = async (tagName: string) => {
        if (!confirm(`Are you sure you want to delete the tag "${tagName}" from ALL applications? This action cannot be undone.`)) return;

        setIsDeleting(tagName);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags/${encodeURIComponent(tagName)}`, {
                method: 'DELETE'
            });

            if (res && res.ok) {
                setTags(prev => prev.filter(t => t.name !== tagName));
            } else {
                alert("Failed to delete tag.");
            }
        } catch (error) {
            console.error("Error deleting tag:", error);
            alert("An error occurred while deleting the tag.");
        } finally {
            setIsDeleting(null);
        }
    };

    // Helper to get contrast text color
    const getContrastColor = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1a1a1a' : '#ffffff';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Manage Tags</h1>
                    <p className="text-muted-foreground mt-1 text-sm">View and manage global tags across all applications.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTags} disabled={isLoading} className="w-full sm:w-auto">
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white overflow-hidden mb-6">
                <CardContent className="p-6">
                    <div className="space-y-6">
                        <div>
                            <Label htmlFor="createTag" className="text-sm font-semibold text-foreground mb-3 block">
                                Create New Global Tag
                            </Label>
                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                                <div className="flex-1 relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="createTag"
                                        placeholder="Enter tag name (e.g. High Priority)"
                                        value={createTagName}
                                        onChange={(e) => setCreateTagName(e.target.value)}
                                        className="pl-10 h-11 border-gray-200 focus:border-red-500 focus:ring-red-500 bg-gray-50/30"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateTag();
                                        }}
                                    />
                                </div>
                                <Button
                                    onClick={handleCreateTag}
                                    disabled={isCreating || !createTagName.trim()}
                                    className="h-11 px-8 bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
                                >
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Create Tag
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Select Tag Color</Label>
                                    <div className="flex flex-wrap gap-2.5 items-center">
                                        {PREDEFINED_COLORS.map((c) => (
                                            <button
                                                key={c.name}
                                                onClick={() => setCreateTagColor(c.value)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 shadow-sm ${createTagColor === c.value ? 'border-red-600 ring-2 ring-red-100 scale-110 z-10' : 'border-white hover:border-gray-200'}`}
                                                style={{ backgroundColor: c.value }}
                                                title={c.name}
                                            />
                                        ))}
                                        <div className="h-6 w-px bg-gray-200 mx-1" />
                                        <div className="relative group">
                                            <div 
                                                className="w-10 h-10 rounded-xl shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden hover:border-red-500 transition-colors"
                                                style={{ backgroundColor: createTagColor }}
                                            >
                                                <input 
                                                    type="color" 
                                                    value={createTagColor} 
                                                    onChange={(e) => setCreateTagColor(e.target.value)}
                                                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                                                />
                                                <Palette className="h-4 w-4" style={{ color: getContrastColor(createTagColor) }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center sm:items-end gap-2 group">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Preview</Label>
                                    <div className="bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-200 min-w-[140px] flex items-center justify-center transition-all group-hover:bg-gray-50 group-hover:border-gray-300">
                                        <Badge 
                                            variant="outline" 
                                            className="font-bold px-3 py-1 shadow-sm border-transparent"
                                            style={{ 
                                                backgroundColor: `${createTagColor}15`, 
                                                color: createTagColor,
                                                borderColor: `${createTagColor}40`
                                            }}
                                        >
                                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: createTagColor }} />
                                            {createTagName || 'Target Tag'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Tag className="h-5 w-5 text-red-600" />
                        Available Tags
                    </CardTitle>
                    <CardDescription>
                        Renaming or updating a tag color will update all associated applications globally.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="w-[70%] font-semibold text-gray-600 px-4 sm:px-6">Tag Name</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-600 px-4 sm:px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="font-medium">Loading tags...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : tags.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <Tag className="h-10 w-10 text-gray-200" />
                                                <p className="font-medium">No tags found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tags.map((tag) => (
                                        <TableRow key={tag.name} className="hover:bg-gray-50/50 transition-colors">
                                            <TableCell className="px-4 sm:px-6">
                                                <Badge 
                                                    variant="outline" 
                                                    className="font-bold px-3 py-1 shadow-sm border-transparent"
                                                    style={{ 
                                                        backgroundColor: `${tag.color}15`, 
                                                        color: tag.color,
                                                        borderColor: `${tag.color}40`
                                                    }}
                                                >
                                                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                                                    {tag.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right px-4 sm:px-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 font-bold rounded-lg h-9"
                                                        onClick={() => {
                                                            setEditingTag(tag);
                                                            setNewTagName(tag.name);
                                                            setSelectedEditColor(tag.color);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        <span className="hidden sm:inline">Edit</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg h-9"
                                                        onClick={() => handleDeleteTag(tag.name)}
                                                        disabled={isDeleting === tag.name}
                                                    >
                                                        {isDeleting === tag.name ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Trash className="h-4 w-4 mr-2" />
                                                                <span className="hidden sm:inline">Remove Globally</span>
                                                                <span className="sm:hidden">Remove</span>
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Update Tag</DialogTitle>
                        <DialogDescription>
                            Change the name or color for "{editingTag?.name}". This affects all applications globally.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="tagName">Tag Name</Label>
                            <Input
                                id="tagName"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="col-span-3 h-11"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-3">
                            <Label>Tag Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {PREDEFINED_COLORS.map((c) => (
                                    <button
                                        key={c.name}
                                        onClick={() => setSelectedEditColor(c.value)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${selectedEditColor === c.value ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-gray-100'}`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <Label className="text-xs text-muted-foreground">Custom:</Label>
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-8 h-8 rounded border flex items-center justify-center relative overflow-hidden"
                                        style={{ backgroundColor: selectedEditColor }}
                                    >
                                        <input 
                                            type="color" 
                                            value={selectedEditColor} 
                                            onChange={(e) => setSelectedEditColor(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Palette className="h-3 w-3" style={{ color: getContrastColor(selectedEditColor) }} />
                                    </div>
                                    <span className="text-xs font-mono font-medium">{selectedEditColor.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Preview</p>
                            <Badge 
                                variant="outline" 
                                className="font-bold px-3 py-1 shadow-sm border-transparent"
                                style={{ 
                                    backgroundColor: `${selectedEditColor}15`, 
                                    color: selectedEditColor,
                                    borderColor: `${selectedEditColor}40`
                                }}
                            >
                                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: selectedEditColor }} />
                                {newTagName || 'Tag Preview'}
                            </Badge>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTag(null)} disabled={isRenaming}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleUpdateTag} 
                            disabled={isRenaming || !newTagName.trim() || (newTagName === editingTag?.name && selectedEditColor === editingTag?.color)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold"
                        >
                            {isRenaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                            Update Tag
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
