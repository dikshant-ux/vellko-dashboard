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
import { Loader2, Trash, Tag as TagIcon, RefreshCcw, Pencil, Plus, Check } from "lucide-react";
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

interface Tag {
    name: string;
    color?: string;
    created_at?: string;
}

const PREDEFINED_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Gray', value: '#6b7280' },
];

export default function TagsPage() {
    const { data: session, status } = useSession();
    const authFetch = useAuthFetch();
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [createTagName, setCreateTagName] = useState("");
    const [createTagColor, setCreateTagColor] = useState("#ec4899"); // Default pink
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

            if (res && (res.ok || res.status === 200)) {
                setCreateTagName("");
                setCreateTagColor("#ec4899");
                fetchTags();
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
        if (!editingTag || (!newTagName.trim() && !newTagColor)) {
            setEditingTag(null);
            return;
        }

        const nameToUse = newTagName.trim() || editingTag.name;
        
        setIsUpdating(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags/${encodeURIComponent(editingTag.name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    new_name: nameToUse !== editingTag.name ? nameToUse : undefined,
                    new_color: newTagColor !== editingTag.color ? newTagColor : undefined
                })
            });

            if (res && res.ok) {
                setTags(prev => prev.map(t => t.name === editingTag.name ? { ...t, name: nameToUse, color: newTagColor } : t).sort((a, b) => a.name.localeCompare(b.name)));
                setEditingTag(null);
            } else {
                const errorData = await res?.json();
                alert(errorData?.detail || "Failed to update tag.");
            }
        } catch (error) {
            console.error("Error updating tag:", error);
            alert("An error occurred while updating the tag.");
        } finally {
            setIsUpdating(false);
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

    const TagBadge = ({ name, color }: { name: string, color?: string }) => {
        const style = color ? {
            backgroundColor: `${color}15`, // 15 is hex for ~8% opacity
            color: color,
            borderColor: `${color}30`,
        } : {};

        return (
            <Badge 
                variant="outline" 
                className="font-semibold px-3 py-1 shadow-sm uppercase text-[10px]"
                style={style}
            >
                {name}
            </Badge>
        );
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
                <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col xl:flex-row items-start gap-6">
                        <div className="flex-1 w-full space-y-4">
                            <div>
                                <Label htmlFor="createTag" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    Tag Name
                                </Label>
                                <div className="relative">
                                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="createTag"
                                        placeholder="Enter tag name (e.g. High Priority)"
                                        value={createTagName}
                                        onChange={(e) => setCreateTagName(e.target.value)}
                                        className="pl-10 h-11 border-gray-200 focus:border-red-500 focus:ring-red-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateTag();
                                        }}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    Pick a Color
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {PREDEFINED_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            onClick={() => setCreateTagColor(c.value)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${createTagColor === c.value ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                                            style={{ backgroundColor: c.value }}
                                            title={c.name}
                                        >
                                            {createTagColor === c.value && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
                                        </button>
                                    ))}
                                    <div className="flex items-center gap-2 ml-2">
                                        <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden relative">
                                            <input 
                                                type="color" 
                                                value={createTagColor} 
                                                onChange={(e) => setCreateTagColor(e.target.value)}
                                                className="absolute inset-0 w-[150%] h-[150%] -translate-x-[20%] -translate-y-[20%] cursor-pointer"
                                            />
                                        </div>
                                        <Input 
                                            value={createTagColor} 
                                            onChange={(e) => setCreateTagColor(e.target.value)}
                                            className="h-8 w-24 text-xs font-mono"
                                            placeholder="#HEX"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Button 
                            onClick={handleCreateTag} 
                            disabled={isCreating || !createTagName.trim()}
                            className="h-11 px-8 bg-red-600 hover:bg-red-700 text-white font-bold w-full xl:w-auto xl:mt-6"
                        >
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Create Tag
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TagIcon className="h-5 w-5 text-red-600" />
                        Available Tags
                    </CardTitle>
                    <CardDescription>
                        Updating or deleting a tag here will update all associated applications globally.
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
                                                <TagIcon className="h-10 w-10 text-gray-200" />
                                                <p className="font-medium">No tags found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tags.map((tag) => (
                                        <TableRow key={tag.name} className="hover:bg-gray-50/50 transition-colors">
                                            <TableCell className="px-4 sm:px-6">
                                                <TagBadge name={tag.name} color={tag.color} />
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
                                                            setNewTagColor(tag.color || "#ec4899");
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Tag</DialogTitle>
                        <DialogDescription>
                            Update the name or color for the tag "{editingTag?.name}". This will affect all associated applications.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tagName">Tag Name</Label>
                            <Input
                                id="tagName"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="w-full"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleUpdateTag();
                                    }
                                }}
                            />
                        </div>
                        
                        <div className="grid gap-2">
                            <Label>Tag Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {PREDEFINED_COLORS.map((c) => (
                                    <button
                                        key={c.value}
                                        onClick={() => setNewTagColor(c.value)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${newTagColor === c.value ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    >
                                        {newTagColor === c.value && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
                                    </button>
                                ))}
                                <div className="flex items-center gap-2 ml-2">
                                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden relative">
                                        <input 
                                            type="color" 
                                            value={newTagColor} 
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="absolute inset-0 w-[150%] h-[150%] -translate-x-[20%] -translate-y-[20%] cursor-pointer"
                                        />
                                    </div>
                                    <Input 
                                        value={newTagColor} 
                                        onChange={(e) => setNewTagColor(e.target.value)}
                                        className="h-8 w-24 text-xs font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTag(null)} disabled={isUpdating}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateTag} disabled={isUpdating || !newTagName.trim() || (newTagName === editingTag?.name && newTagColor === editingTag?.color)}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                            Update Tag
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
