"use client"

import { useState, useEffect } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Copy, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShareConfigurationModal } from '@/components/ShareConfigurationModal';
import { Pencil } from 'lucide-react';

interface SharedLink {
    token: string;
    name: string | null;
    created_at: string;
    expires_at: string;
    active: boolean;
    views: number;
}

export default function SharedLinksPage() {
    const authFetch = useAuthFetch();
    const [links, setLinks] = useState<SharedLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedToken, setSelectedToken] = useState<string | undefined>(undefined);

    const fetchLinks = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/list`);
            if (res && res.ok) {
                const data = await res.json();
                setLinks(data);
            } else {
                toast.error("Failed to load shared links");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error loading links");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLinks();
    }, []);

    const handleDelete = async (token: string) => {
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/offers/share/${token}`, {
                method: 'DELETE'
            });
            if (res && res.ok) {
                toast.success("Link deleted");
                fetchLinks();
            } else {
                toast.error("Failed to delete link");
            }
        } catch (error) {
            toast.error("Error deleting link");
        }
    };

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/share/${token}`;
        navigator.clipboard.writeText(link);
        toast.success("Link copied");
    };

    const handleEdit = (token: string) => {
        setSelectedToken(token);
        setIsEditModalOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Shared Links</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your active shared offer lists.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchLinks} disabled={isLoading}>
                    Refresh
                </Button>
            </div>

            <div className="rounded-md border bg-card text-card-foreground shadow-md">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Name / Token</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Views</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : links.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No shared links found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            links.map((link) => (
                                <TableRow key={link.token}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{link.name || "Untitled Share"}</span>
                                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                                                {link.token}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(new Date(link.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                                    <TableCell>{format(new Date(link.expires_at), "MMM d, yyyy HH:mm")}</TableCell>
                                    <TableCell>{link.views}</TableCell>
                                    <TableCell>
                                        {link.active && new Date(link.expires_at) > new Date() ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                                                <XCircle className="mr-1 h-3 w-3" /> Expired
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => copyLink(link.token)} title="Copy Link">
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(link.token)} title="Edit Link">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <a
                                                href={`/share/${link.token}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                                                title="Open Link"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Revoke Link?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete the shared link. Users will no longer be able to access it.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(link.token)} className="bg-red-600 hover:bg-red-700">
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ShareConfigurationModal
                open={isEditModalOpen}
                setOpen={setIsEditModalOpen}
                editToken={selectedToken}
                onSuccess={fetchLinks}
                currentFilters={{ search: "", media_type_id: 0, vertical_id: 0 }}
                availableColumns={[
                    { id: "id", label: "ID" },
                    { id: "name", label: "Name" },
                    { id: "vertical", label: "Vertical" },
                    { id: "status", label: "Status" },
                    { id: "type", label: "Type" },
                    { id: "payout", label: "Payout" },
                    { id: "preview", label: "Preview" },
                ]}
                currentVisibleColumns={{}}
            />
        </div>
    );
}
