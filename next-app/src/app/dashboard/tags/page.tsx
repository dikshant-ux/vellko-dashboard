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
import { Loader2, Trash, Tag, RefreshCcw, Pencil } from "lucide-react";
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

export default function TagsPage() {
    const { data: session } = useSession();
    const authFetch = useAuthFetch();
    const [tags, setTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

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
        if (session?.accessToken) {
            fetchTags();
        }
    }, [session, authFetch]);

    const handleRenameTag = async () => {
        if (!editingTag || !newTagName.trim() || editingTag === newTagName.trim()) {
            setEditingTag(null);
            return;
        }

        setIsRenaming(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tags/${encodeURIComponent(editingTag)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_name: newTagName.trim() })
            });

            if (res && res.ok) {
                setTags(prev => prev.map(t => t === editingTag ? newTagName.trim() : t).sort());
                setEditingTag(null);
            } else {
                alert("Failed to rename tag.");
            }
        } catch (error) {
            console.error("Error renaming tag:", error);
            alert("An error occurred while renaming the tag.");
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
                setTags(prev => prev.filter(t => t !== tagName));
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

            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3 border-b border-gray-50 px-4 sm:px-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Tag className="h-5 w-5 text-red-600" />
                        Available Tags
                    </CardTitle>
                    <CardDescription>
                        Deleting a tag here will remove it from all applications that currently have it.
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
                                        <TableRow key={tag} className="hover:bg-gray-50/50 transition-colors">
                                            <TableCell className="px-4 sm:px-6">
                                                <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 font-semibold px-3 py-1 shadow-sm">
                                                    {tag}
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
                                                            setNewTagName(tag);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        <span className="hidden sm:inline">Edit</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg h-9"
                                                        onClick={() => handleDeleteTag(tag)}
                                                        disabled={isDeleting === tag}
                                                    >
                                                        {isDeleting === tag ? (
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
                        <DialogTitle>Rename Tag</DialogTitle>
                        <DialogDescription>
                            Enter a new name for the tag "{editingTag}". This will update all applications using this tag.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="tagName" className="text-right">
                                New Name
                            </Label>
                            <Input
                                id="tagName"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="col-span-3"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleRenameTag();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTag(null)} disabled={isRenaming}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameTag} disabled={isRenaming || !newTagName.trim() || newTagName === editingTag}>
                            {isRenaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                            Rename Tag
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
