'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Plus,
    Edit2,
    Trash2,
    RefreshCw,
    Globe,
    AlertCircle,
    CheckCircle2,
    Settings,
    FileCode,
    ExternalLink,
    Upload,
    Copy
} from 'lucide-react';
import { AdvertiserOfferUploadModal } from '@/components/AdvertiserOfferUploadModal';
import { ManageCustomFieldsModal } from '@/components/ManageCustomFieldsModal';

interface Advertiser {
    _id: string;
    advertiser_id?: string;
    name: string;
    api_url: string;
    method: string;
    offers_count: number;
    response_mapping?: any;
    sync_status?: string;
    last_sync_error?: string;
    last_synced_at?: string;
    auto_sync_hours?: number;
    updated_at: string;
}

export default function AdvertiserList() {
    const router = useRouter();
    const authFetch = useAuthFetch();
    const { data: session } = useSession();

    const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Operations states
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Delete dialog states
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteName, setDeleteName] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Upload CSV states
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadAdvId, setUploadAdvId] = useState<string | null>(null);
    const [uploadAdvName, setUploadAdvName] = useState('');

    // Manage custom fields states
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Cloning state
    const [isCloningId, setIsCloningId] = useState<string | null>(null);

    const loadAdvertisers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers`);
            if (res && res.ok) {
                const data = await res.json();
                setAdvertisers(data);
            } else {
                setError('Failed to fetch advertisers list.');
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred while loading advertisers.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            loadAdvertisers();
        }
    }, [session]);

    // Triggers background synchronization of offers
    const handleSync = async (id: string) => {
        setSyncingId(id);
        setOperationMessage(null);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${id}/sync`, {
                method: 'POST',
            });
            if (res && res.ok) {
                setOperationMessage({
                    type: 'success',
                    text: `Synchronization started in the background. The list will update automatically.`,
                });
                // Reload list to show SYNCING status
                loadAdvertisers();
            } else {
                const data = res ? await res.json() : null;
                setOperationMessage({
                    type: 'error',
                    text: data?.detail || 'Failed to trigger synchronization.',
                });
            }
        } catch (err: any) {
            setOperationMessage({
                type: 'error',
                text: err.message || 'Connection error during synchronization.',
            });
        } finally {
            setSyncingId(null);
        }
    };

    // Poll for status updates if any advertiser is currently syncing
    useEffect(() => {
        const hasSyncing = advertisers.some(adv => adv.sync_status === "SYNCING");
        if (hasSyncing) {
            const interval = setInterval(() => {
                const silentLoad = async () => {
                    try {
                        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers`);
                        if (res && res.ok) {
                            const data = await res.json();
                            setAdvertisers(data);
                        }
                    } catch (e) {
                        console.error('Silent load failed', e);
                    }
                };
                silentLoad();
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [advertisers, authFetch]);

    // Upload CSV handler
    const handleOpenUploadModal = (id: string, name: string) => {
        setUploadAdvId(id);
        setUploadAdvName(name);
        setUploadModalOpen(true);
    };

    // Delete confirmation handler
    const confirmDelete = (id: string, name: string) => {
        setDeleteId(id);
        setDeleteName(name);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleteLoading(true);
        setOperationMessage(null);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${deleteId}`, {
                method: 'DELETE',
            });
            if (res && res.ok) {
                setOperationMessage({
                    type: 'success',
                    text: `Successfully deleted advertiser "${deleteName}" and cleared all synced offers.`,
                });
                setAdvertisers(advertisers.filter(a => a._id !== deleteId));
            } else {
                const data = await res?.json();
                setOperationMessage({
                    type: 'error',
                    text: data?.detail || 'Failed to delete advertiser.',
                });
            }
        } catch (err: any) {
            setOperationMessage({
                type: 'error',
                text: err.message || 'Connection error during delete.',
            });
        } finally {
            setDeleteLoading(false);
            setDeleteId(null);
            setDeleteName('');
        }
    };

    const handleClone = async (id: string, name: string) => {
        setIsCloningId(id);
        setOperationMessage(null);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${id}/clone`, {
                method: 'POST',
            });
            if (res && res.ok) {
                const data = await res.json();
                router.push(`/dashboard/advertiser/configure?id=${data.id}`);
            } else {
                const data = await res?.json();
                setOperationMessage({
                    type: 'error',
                    text: data?.detail || 'Failed to clone advertiser.',
                });
            }
        } catch (err: any) {
            setOperationMessage({
                type: 'error',
                text: err.message || 'Connection error during cloning.',
            });
        } finally {
            setIsCloningId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        Configured Advertisers
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage advertiser API feeds, response schema mappings, and run offers synchronization.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={() => setIsManageModalOpen(true)}
                        className="border-gray-200 hover:border-gray-400 text-gray-700 bg-white shadow-sm hover:text-gray-900 rounded-lg font-semibold h-10 px-4"
                    >
                        Manage Custom Fields
                    </Button>
                    <Button asChild className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/25 rounded-lg font-bold gap-2 h-10 px-4">
                        <Link href="/dashboard/advertiser/configure">
                            <Plus className="h-4 w-4" /> Add Advertiser API
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Notification Messages */}
            {operationMessage && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                    operationMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : 'bg-red-50 border-red-100 text-red-800'
                }`}>
                    {operationMessage.type === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{operationMessage.text}</span>
                </div>
            )}

            {/* Content Table */}
            <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white overflow-hidden">
                <CardHeader className="border-b border-gray-50 bg-gray-50/20 pb-4">
                    <CardTitle className="text-lg font-bold text-gray-800">Integration Registry</CardTitle>
                    <CardDescription className="text-xs">All active custom offer APIs integrated into Vellko Affiliate platform.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-16 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto" />
                            <p className="text-xs text-gray-400 mt-3 font-medium">Fetching integrated advertisers...</p>
                        </div>
                    ) : error ? (
                        <div className="p-16 text-center text-red-500 flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 text-red-400" />
                            <span className="text-sm font-medium">{error}</span>
                            <Button variant="outline" size="sm" onClick={loadAdvertisers} className="mt-2 text-xs">
                                Retry Loading
                            </Button>
                        </div>
                    ) : advertisers.length === 0 ? (
                        <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-2">
                            <Globe className="h-10 w-10 text-gray-200" />
                            <span className="text-sm font-medium">No advertisers integrated yet.</span>
                            <p className="text-xs text-gray-400 max-w-sm mt-1">
                                Click the &apos;Add Advertiser API&apos; button to create your first connection and map offer fields.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs font-bold text-gray-700">Advertiser Name</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700">API Endpoint URL</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700">Method</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700 text-center">Synced Offers</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700 text-center">Schema Status</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700 text-center">Sync Status</TableHead>
                                        <TableHead className="text-xs font-bold text-gray-700 text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {advertisers.map((adv) => (
                                        <TableRow key={adv._id} className="hover:bg-gray-50 transition-colors">
                                            <TableCell className="font-semibold text-gray-900">
                                                <div className="flex flex-col">
                                                    <span>{adv.name}</span>
                                                    <span className="text-[10px] font-mono text-gray-400 font-normal">ID: {adv.advertiser_id || adv._id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[280px] font-mono text-xs text-gray-500 truncate" title={adv.api_url}>
                                                <span className="flex items-center gap-1">
                                                    {adv.api_url}
                                                    <a href={adv.api_url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-red-500">
                                                        <ExternalLink className="h-3 w-3 inline shrink-0" />
                                                    </a>
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        adv.method === 'POST'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }
                                                >
                                                    {adv.method}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-gray-800">
                                                <div>{adv.offers_count}</div>
                                                <div className="text-[10px] text-gray-400 font-normal">Auto: every {adv.auto_sync_hours || 3}h</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {adv.response_mapping ? (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 py-0.5 px-2">
                                                        Mapped
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 py-0.5 px-2">
                                                        Pending Mapping
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {adv.sync_status === 'SYNCING' && (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse py-0.5 px-2 font-medium inline-flex items-center gap-1.5">
                                                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                                                        Syncing...
                                                    </Badge>
                                                )}
                                                {adv.sync_status === 'SUCCESS' && (
                                                    <div className="flex flex-col items-center">
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-2 font-medium">
                                                            Success
                                                        </Badge>
                                                        {adv.last_synced_at && (
                                                            <span className="text-[9px] text-gray-400 mt-1 font-mono">
                                                                {new Date(adv.last_synced_at).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {adv.sync_status === 'FAILED' && (
                                                    <div className="flex flex-col items-center">
                                                        <Badge 
                                                            variant="outline" 
                                                            className="bg-red-50 text-red-700 border-red-200 py-0.5 px-2 font-medium cursor-help"
                                                            title={adv.last_sync_error || "Unknown Sync Error"}
                                                        >
                                                            Failed
                                                        </Badge>
                                                        <span className="text-[9px] text-red-500 mt-0.5 max-w-[120px] truncate" title={adv.last_sync_error}>
                                                            {adv.last_sync_error}
                                                        </span>
                                                    </div>
                                                )}
                                                {(!adv.sync_status || adv.sync_status === 'IDLE') && (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 py-0.5 px-2 font-medium">
                                                        Idle
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                                                {/* Mapping configuration shortcut */}
                                                {!adv.response_mapping ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                        className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1 rounded-md"
                                                        title="Configure Response Mapping Schema"
                                                    >
                                                        <Link href={`/dashboard/advertiser/configure?id=${adv._id}`}>
                                                            <Settings className="h-3.5 w-3.5" /> Map
                                                        </Link>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSync(adv._id)}
                                                        disabled={syncingId !== null || adv.sync_status === 'SYNCING'}
                                                        className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 rounded-md"
                                                        title="Sync external offers to DB"
                                                    >
                                                        <RefreshCw className={`h-3.5 w-3.5 ${(syncingId === adv._id || adv.sync_status === 'SYNCING') ? 'animate-spin' : ''}`} />
                                                        {(syncingId === adv._id || adv.sync_status === 'SYNCING') ? 'Syncing' : 'Sync'}
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenUploadModal(adv._id, adv.name)}
                                                    className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 rounded-md"
                                                    title="Upload offers via CSV"
                                                >
                                                    <Upload className="h-3.5 w-3.5" /> Upload CSV
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleClone(adv._id, adv.name)}
                                                    disabled={isCloningId !== null}
                                                    className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50 gap-1 rounded-md"
                                                    title="Clone Advertiser API configuration"
                                                >
                                                    <Copy className="h-3.5 w-3.5" /> Clone
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                    className="h-8 text-gray-600 hover:text-red-600 hover:bg-gray-50 rounded-md"
                                                >
                                                    <Link href={`/dashboard/advertiser/configure?id=${adv._id}`} title="Edit Connection API Settings">
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Link>
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => confirmDelete(adv._id, adv.name)}
                                                    className="h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                    title="Delete Advertiser API and clear its offers"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Modal */}
            <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="max-w-md rounded-xl bg-white border border-gray-100">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-gray-900">Delete Advertiser API Connection</DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 mt-2">
                            Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{deleteName}&quot;</span>?
                            This action will permanently delete the advertiser configuration and clear all synced offers from the offers dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-lg h-9">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 font-semibold transition-all"
                        >
                            {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload CSV Modal */}
            <AdvertiserOfferUploadModal
                open={uploadModalOpen}
                setOpen={setUploadModalOpen}
                advertiserId={uploadAdvId}
                advertiserName={uploadAdvName}
                onSuccess={loadAdvertisers}
            />

            {/* Manage Custom Fields Modal */}
            <ManageCustomFieldsModal
                open={isManageModalOpen}
                setOpen={setIsManageModalOpen}
            />
        </div>
    );
}
