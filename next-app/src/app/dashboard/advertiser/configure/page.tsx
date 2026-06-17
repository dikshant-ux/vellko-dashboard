'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Play, CheckCircle2, ChevronRight, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ManageCustomFieldsModal } from '@/components/ManageCustomFieldsModal';

interface HeaderItem {
    key: string;
    value: string;
}

interface CustomMappingItem {
    key: string;
    path: string;
}

interface ResponseMapping {
    offers_path: string;
    offer_id: string;
    offer_name: string;
    payout: string;
    vertical: string;
    status: string;
    preview_link: string;
    tracking_link: string;
    custom_mappings: CustomMappingItem[];
}

// Dotted path resolver helper for client-side live preview
function resolvePath(data: any, path: string): any {
    if (!path || path.trim() === '.' || path.trim() === '$' || path.trim() === '') {
        return data;
    }
    const parts = path.split('.');
    let current = data;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        if (part.includes('[') && part.endsWith(']')) {
            const subParts = part.split('[');
            const key = subParts[0];
            if (key && current[key] !== undefined) {
                current = current[key];
            }
            const indices = subParts.slice(1).map(idx => parseInt(idx.replace(']', ''), 10));
            for (const idx of indices) {
                if (Array.isArray(current) && idx >= 0 && idx < current.length) {
                    current = current[idx];
                } else {
                    return undefined;
                }
            }
        } else {
            if (typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }
    }
    return current;
}

// Helper to recursively extract all paths from a JSON object
function getJsonPaths(data: any, prefix = '', maxDepth = 5): string[] {
    if (data === null || data === undefined || maxDepth <= 0) {
        return [];
    }
    let paths: string[] = [];
    if (Array.isArray(data)) {
        if (data.length > 0) {
            // Recurse into first element of array
            paths = paths.concat(getJsonPaths(data[0], prefix, maxDepth - 1));
        }
    } else if (typeof data === 'object') {
        for (const key of Object.keys(data)) {
            const path = prefix ? `${prefix}.${key}` : key;
            paths.push(path);
            const val = data[key];
            if (val !== null && typeof val === 'object') {
                paths = paths.concat(getJsonPaths(val, path, maxDepth - 1));
            }
        }
    }
    return Array.from(new Set(paths));
}

function ConfigureAdvertiserContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const advertiserId = searchParams.get('id');
    const authFetch = useAuthFetch();
    const { data: session } = useSession();

    // Form fields
    const [name, setName] = useState('');
    const [advertiserCustomId, setAdvertiserCustomId] = useState('');
    const [apiUrl, setApiUrl] = useState('');
    const [method, setMethod] = useState('GET');
    const [headers, setHeaders] = useState<HeaderItem[]>([{ key: '', value: '' }]);
    const [requestPayload, setRequestPayload] = useState('');
    const [autoSyncHours, setAutoSyncHours] = useState(3);

    // Mapping fields
    const [mapping, setMapping] = useState<ResponseMapping>({
        offers_path: '',
        offer_id: '',
        offer_name: '',
        payout: '',
        vertical: '',
        status: '',
        preview_link: '',
        tracking_link: '',
        custom_mappings: [],
    });

    // Test API states
    const [testPayload, setTestPayload] = useState<any>(null);
    const [testLoading, setTestLoading] = useState(false);
    const [testError, setTestError] = useState('');
    const [testSuccess, setTestSuccess] = useState(false);

    // Save states
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [allCustomFields, setAllCustomFields] = useState<string[]>([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    const loadedRef = useRef(false);

    // Fetch global custom columns suggestions
    const fetchCustomFields = async () => {
        if (session) {
            try {
                const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/meta/custom-columns`);
                if (res && res.ok) {
                    const data = await res.json();
                    setAllCustomFields(data.custom_columns || []);
                }
            } catch (e) {
                console.error('Failed to load global custom columns list', e);
            }
        }
    };

    useEffect(() => {
        fetchCustomFields();
    }, [session, authFetch]);

    // Load existing advertiser if editing
    useEffect(() => {
        if (advertiserId && session && !loadedRef.current) {
            const loadAdvertiser = async () => {
                try {
                    const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${advertiserId}`);
                    if (res && res.ok) {
                        const data = await res.json();
                        setName(data.name);
                        setAdvertiserCustomId(data.advertiser_id || '');
                        setApiUrl(data.api_url);
                        setMethod(data.method);
                        setHeaders(data.headers && data.headers.length > 0 ? data.headers : [{ key: '', value: '' }]);
                        setRequestPayload(data.request_payload || '');
                        setAutoSyncHours(data.auto_sync_hours !== undefined ? data.auto_sync_hours : 3);
                        if (data.response_mapping) {
                            setMapping({
                                offers_path: data.response_mapping.offers_path || '',
                                offer_id: data.response_mapping.offer_id || '',
                                offer_name: data.response_mapping.offer_name || '',
                                payout: data.response_mapping.payout || '',
                                vertical: data.response_mapping.vertical || '',
                                status: data.response_mapping.status || '',
                                preview_link: data.response_mapping.preview_link || '',
                                tracking_link: data.response_mapping.tracking_link || '',
                                custom_mappings: data.response_mapping.custom_mappings || [],
                            });
                        }
                        loadedRef.current = true;
                    }
                } catch (e) {
                    console.error('Failed to load advertiser config', e);
                }
            };
            loadAdvertiser();
        }
    }, [advertiserId, session, authFetch]);

    // Handle Headers Key/Value addition/removal
    const addHeaderField = () => {
        setHeaders([...headers, { key: '', value: '' }]);
    };

    const removeHeaderField = (index: number) => {
        const list = [...headers];
        list.splice(index, 1);
        setHeaders(list.length > 0 ? list : [{ key: '', value: '' }]);
    };

    const updateHeaderField = (index: number, field: 'key' | 'value', val: string) => {
        const list = [...headers];
        list[index][field] = val;
        setHeaders(list);
    };

    // Handle Custom Response Mappings addition/removal
    const addCustomMappingField = () => {
        setMapping({
            ...mapping,
            custom_mappings: [...(mapping.custom_mappings || []), { key: '', path: '' }]
        });
    };

    const removeCustomMappingField = (index: number) => {
        const list = [...(mapping.custom_mappings || [])];
        list.splice(index, 1);
        setMapping({ ...mapping, custom_mappings: list });
    };

    const updateCustomMappingField = (index: number, field: 'key' | 'path', val: string) => {
        const list = [...(mapping.custom_mappings || [])];
        list[index] = { ...list[index], [field]: val };
        setMapping({ ...mapping, custom_mappings: list });
    };

    // Test external API
    const testApiConnection = async () => {
        setTestLoading(true);
        setTestError('');
        setTestSuccess(false);
        setTestPayload(null);

        // Filter valid headers
        const validHeaders = headers.filter(h => h.key.trim() && h.value.trim());

        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/test-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_url: apiUrl,
                    method,
                    headers: validHeaders,
                    request_payload: requestPayload || null,
                }),
            });

            if (!res) {
                throw new Error("Unable to reach the server.");
            }

            const data = await res.json();
            if (res.ok && data.success) {
                setTestPayload(data.payload);
                setTestSuccess(true);
            } else {
                setTestError(data.detail || 'Connection test failed. Verify headers and URL.');
            }
        } catch (err: any) {
            setTestError(err.message || 'An error occurred while testing connection.');
        } finally {
            setTestLoading(false);
        }
    };

    // Live preview parsing
    let previewOffers: any[] = [];
    let offersPathError = false;

    if (testPayload) {
        const extracted = resolvePath(testPayload, mapping.offers_path);
        if (extracted) {
            const rawItems = Array.isArray(extracted) ? extracted : typeof extracted === 'object' ? [extracted] : [];
            
            const safeString = (val: any): string => {
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') return '[Object]';
                return String(val);
            };

            previewOffers = rawItems.map((item: any) => {
                const customFields: Record<string, string> = {};
                if (mapping.custom_mappings) {
                    mapping.custom_mappings.forEach((cMap) => {
                        if (cMap.key && cMap.path) {
                            customFields[cMap.key] = safeString(resolvePath(item, cMap.path));
                        }
                    });
                }
                return {
                    id: mapping.offer_id ? (safeString(resolvePath(item, mapping.offer_id)) || 'N/A') : 'N/A',
                    name: mapping.offer_name ? (safeString(resolvePath(item, mapping.offer_name)) || 'N/A') : 'N/A',
                    payout: mapping.payout ? (safeString(resolvePath(item, mapping.payout)) || 'N/A') : 'N/A',
                    vertical: mapping.vertical ? safeString(resolvePath(item, mapping.vertical)) : '',
                    status: mapping.status ? (safeString(resolvePath(item, mapping.status)) || 'Active') : 'Active',
                    preview_link: mapping.preview_link ? safeString(resolvePath(item, mapping.preview_link)) : '',
                    tracking_link: mapping.tracking_link ? safeString(resolvePath(item, mapping.tracking_link)) : '',
                    custom_fields: customFields,
                };
            }).slice(0, 5); // Limit live preview to 5 items for clean layout
        } else if (mapping.offers_path) {
            offersPathError = true;
        }
    }

    // Suggestions computation
    let rootPathSuggestions: string[] = [];
    let offerPathSuggestions: string[] = [];

    if (testPayload) {
        rootPathSuggestions = getJsonPaths(testPayload);
        const resolvedOffers = resolvePath(testPayload, mapping.offers_path);
        if (resolvedOffers) {
            const offersArray = Array.isArray(resolvedOffers)
                ? resolvedOffers
                : typeof resolvedOffers === 'object'
                    ? [resolvedOffers]
                    : [];
            if (offersArray.length > 0) {
                offerPathSuggestions = getJsonPaths(offersArray[0]);
            }
        }
    }

    // Save configuration
    const handleSaveConfig = async () => {
        if (!name.trim() || !apiUrl.trim()) {
            setSaveError('Advertiser Name and API URL are required.');
            return;
        }

        setSaveLoading(true);
        setSaveError('');

        const validHeaders = headers.filter(h => h.key.trim() && h.value.trim());
        const bodyData = {
            name,
            advertiser_id: advertiserCustomId,
            api_url: apiUrl,
            method,
            headers: validHeaders,
            request_payload: requestPayload || null,
            auto_sync_hours: autoSyncHours,
        };

        try {
            let res;
            if (advertiserId) {
                // Update
                res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${advertiserId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData),
                });
            } else {
                // Create
                res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData),
                });
            }

            if (!res) {
                throw new Error("Unable to save advertiser config.");
            }

            const data = await res.json();
            if (res.ok) {
                // Saved advertiser config, now save response mapping
                const savedId = advertiserId || data.id || data._id;
                
                // If mapping has basic paths filled out, write mapping
                if (mapping.offers_path && mapping.offer_id && mapping.offer_name && mapping.payout) {
                    const validCustomMappings = (mapping.custom_mappings || []).filter(item => item.key.trim() && item.path.trim());
                    const finalMapping = {
                        ...mapping,
                        custom_mappings: validCustomMappings
                    };
                    const mappingRes = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/advertisers/${savedId}/save-mapping`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(finalMapping),
                    });
                    
                    if (mappingRes && mappingRes.ok) {
                        router.push('/dashboard/advertiser/list');
                    } else {
                        const mData = await mappingRes?.json();
                        setSaveError(mData?.detail || 'Advertiser config saved, but mapping sync failed.');
                    }
                } else {
                    // Config saved but mapping needs setting
                    router.push('/dashboard/advertiser/list');
                }
            } else {
                setSaveError(data.detail || 'Failed to save configuration details.');
            }
        } catch (err: any) {
            setSaveError(err.message || 'An error occurred while saving.');
        } finally {
            setSaveLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild className="rounded-full shadow-sm">
                        <Link href="/dashboard/advertiser/list">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                            {advertiserId ? 'Edit Advertiser Configuration' : 'Configure Advertiser API'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Set up connection details and response payload extraction rules for integration.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Connection Configuration Form */}
                <div className="lg:col-span-6 space-y-6">
                    <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white">
                        <CardHeader className="border-b border-gray-50 bg-gray-50/50 pb-4">
                            <CardTitle className="text-lg font-bold text-gray-800">1. API Details</CardTitle>
                            <CardDescription className="text-xs">Provide details for reaching the advertiser offer list endpoint.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Advertiser Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Impact Network, CJ Affiliate"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="focus-visible:ring-red-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="advertiserCustomId" className="text-sm font-semibold text-gray-700">Advertiser ID</Label>
                                    <Input
                                        id="advertiserCustomId"
                                        placeholder="e.g. Sneak101, ADV-CAKE"
                                        value={advertiserCustomId}
                                        onChange={(e) => setAdvertiserCustomId(e.target.value)}
                                        className="focus-visible:ring-red-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="autoSyncHours" className="text-sm font-semibold text-gray-700">Auto Sync (Hours)</Label>
                                    <Input
                                        id="autoSyncHours"
                                        type="number"
                                        min="1"
                                        placeholder="3"
                                        value={autoSyncHours}
                                        onChange={(e) => setAutoSyncHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="focus-visible:ring-red-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="apiUrl" className="text-sm font-semibold text-gray-700">API Endpoint URL</Label>
                                <Input
                                    id="apiUrl"
                                    placeholder="https://api.advertiser.com/v1/offers"
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                    className="focus-visible:ring-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1 space-y-2">
                                    <Label htmlFor="method" className="text-sm font-semibold text-gray-700">HTTP Method</Label>
                                    <Select value={method} onValueChange={setMethod}>
                                        <SelectTrigger id="method" className="focus:ring-red-500">
                                            <SelectValue placeholder="GET" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GET">GET</SelectItem>
                                            <SelectItem value="POST">POST</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Headers Configuration */}
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold text-gray-700">Request Headers</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addHeaderField}
                                        className="h-7 text-xs border-dashed border-red-200 hover:border-red-600 hover:text-red-600 gap-1 rounded-md"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Header
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {headers.map((header, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input
                                                placeholder="Key (e.g. Authorization)"
                                                value={header.key}
                                                onChange={(e) => updateHeaderField(index, 'key', e.target.value)}
                                                className="h-9 focus-visible:ring-red-500 flex-1"
                                            />
                                            <Input
                                                placeholder="Value (e.g. Bearer token)"
                                                value={header.value}
                                                onChange={(e) => updateHeaderField(index, 'value', e.target.value)}
                                                className="h-9 focus-visible:ring-red-500 flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeHeaderField(index)}
                                                disabled={headers.length === 1 && !header.key && !header.value}
                                                className="h-9 w-9 text-gray-400 hover:text-red-600 rounded-md shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Request Body Payload */}
                            <div className="space-y-2 pt-2">
                                <Label htmlFor="payload" className="text-sm font-semibold text-gray-700">
                                    Request Parameters / Body Payload
                                </Label>
                                <CardDescription className="text-xs -mt-1">
                                    For POST requests, input request body JSON. For GET, input key-value params as a JSON object (optional).
                                </CardDescription>
                                <Textarea
                                    id="payload"
                                    placeholder={method === 'POST' ? '{\n  "status": "active",\n  "limit": 100\n}' : '{\n  "api_key": "xxx",\n  "format": "json"\n}'}
                                    rows={4}
                                    value={requestPayload}
                                    onChange={(e) => setRequestPayload(e.target.value)}
                                    className="font-mono text-xs focus-visible:ring-red-500"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="border-t border-gray-50 pt-4 flex justify-between items-center bg-gray-50/20">
                            {testSuccess && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-2.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> API Connected
                                </Badge>
                            )}
                            {testError && (
                                <div className="text-xs text-red-600 flex items-center gap-1.5 max-w-[60%] truncate">
                                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                    <span>Connection Error</span>
                                </div>
                            )}
                            {!testSuccess && !testError && <div />}
                            <Button
                                type="button"
                                onClick={testApiConnection}
                                disabled={testLoading || !apiUrl}
                                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md shadow-red-500/20 rounded-lg h-9 gap-1.5 px-4 font-semibold text-sm transition-all"
                            >
                                {testLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Testing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-3.5 w-3.5" /> Test Connection
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Response Payload Mapping Form (shows when tested payload exists or mapping is already configured) */}
                    {(testPayload || mapping.offers_path) && (
                        <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <CardHeader className="border-b border-gray-50 bg-gray-50/50 pb-4">
                                <CardTitle className="text-lg font-bold text-gray-800">2. Response Payload Mapping</CardTitle>
                                <CardDescription className="text-xs">
                                    Define dotted paths (e.g. `data.items`) to extract fields from the API response payload.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <Label htmlFor="offersPath" className="text-sm font-semibold text-gray-700">Offers Array Path</Label>
                                        <Input
                                            id="offersPath"
                                            placeholder="e.g. data.offers, items, or leave blank if root is an array"
                                            value={mapping.offers_path}
                                            onChange={(e) => setMapping({ ...mapping, offers_path: e.target.value })}
                                            className={`focus-visible:ring-red-500 ${offersPathError ? 'border-red-400 bg-red-50/10' : ''}`}
                                            list="root-paths"
                                        />
                                        {offersPathError && (
                                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium">
                                                <AlertCircle className="h-3 w-3 shrink-0" /> Path did not resolve to a list.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="offerIdPath" className="text-sm font-semibold text-gray-700">Offer ID Path</Label>
                                        <Input
                                            id="offerIdPath"
                                            placeholder="e.g. id, campaignId"
                                            value={mapping.offer_id}
                                            onChange={(e) => setMapping({ ...mapping, offer_id: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="offerNamePath" className="text-sm font-semibold text-gray-700">Offer Name Path</Label>
                                        <Input
                                            id="offerNamePath"
                                            placeholder="e.g. name, title, campaignName"
                                            value={mapping.offer_name}
                                            onChange={(e) => setMapping({ ...mapping, offer_name: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="payoutPath" className="text-sm font-semibold text-gray-700">Payout Path</Label>
                                        <Input
                                            id="payoutPath"
                                            placeholder="e.g. payout, payout_amount"
                                            value={mapping.payout}
                                            onChange={(e) => setMapping({ ...mapping, payout: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="verticalPath" className="text-sm font-semibold text-gray-700">Vertical Path <span className="text-gray-400 text-xs">(Optional)</span></Label>
                                        <Input
                                            id="verticalPath"
                                            placeholder="e.g. category, vertical"
                                            value={mapping.vertical}
                                            onChange={(e) => setMapping({ ...mapping, vertical: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="statusPath" className="text-sm font-semibold text-gray-700">Status Path <span className="text-gray-400 text-xs">(Optional)</span></Label>
                                        <Input
                                            id="statusPath"
                                            placeholder="e.g. status, active_status"
                                            value={mapping.status}
                                            onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="previewPath" className="text-sm font-semibold text-gray-700">Preview Link Path <span className="text-gray-400 text-xs">(Optional)</span></Label>
                                        <Input
                                            id="previewPath"
                                            placeholder="e.g. preview_link, url"
                                            value={mapping.preview_link}
                                            onChange={(e) => setMapping({ ...mapping, preview_link: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="trackingPath" className="text-sm font-semibold text-gray-700">Tracking URL Path <span className="text-gray-400 text-xs">(Optional)</span></Label>
                                        <Input
                                            id="trackingPath"
                                            placeholder="e.g. tracking_link, tracking_url, redirect_url"
                                            value={mapping.tracking_link}
                                            onChange={(e) => setMapping({ ...mapping, tracking_link: e.target.value })}
                                            className="focus-visible:ring-red-500"
                                            list="offer-paths"
                                        />
                                    </div>

                                    <div className="col-span-2 border-t border-gray-100 pt-4 mt-2 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label className="text-sm font-bold text-gray-800">Custom Fields Mapping</Label>
                                                <p className="text-xs text-gray-500">Map custom advertiser-specific columns (e.g. Geos, Capping, Traffic Type) to display in the Consolidated Offers list.</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setIsManageModalOpen(true)}
                                                    className="h-8 text-xs border border-gray-200 hover:border-gray-600 hover:text-gray-900 gap-1 rounded-md"
                                                >
                                                    Manage Custom Fields
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addCustomMappingField}
                                                    className="h-8 text-xs border-dashed border-red-200 hover:border-red-600 hover:text-red-600 gap-1 rounded-md"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Add Custom Field
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {mapping.custom_mappings && mapping.custom_mappings.map((item, index) => (
                                                <div key={index} className="flex gap-3 items-center">
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-[10px] uppercase font-bold text-gray-500">Column Header Name</Label>
                                                        <Input
                                                            placeholder="e.g. Geos, Capping"
                                                            value={item.key}
                                                            onChange={(e) => updateCustomMappingField(index, 'key', e.target.value)}
                                                            className="h-9 focus-visible:ring-red-500"
                                                            list="custom-fields-suggestions"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-[10px] uppercase font-bold text-gray-500">JSON path in response</Label>
                                                        <Input
                                                            placeholder="e.g. geo_restriction.allowed_countries, caps.daily"
                                                            value={item.path}
                                                            onChange={(e) => updateCustomMappingField(index, 'path', e.target.value)}
                                                            className="h-9 focus-visible:ring-red-500"
                                                            list="offer-paths"
                                                        />
                                                    </div>
                                                    <div className="pt-5 shrink-0">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeCustomMappingField(index)}
                                                            className="h-9 w-9 text-gray-400 hover:text-red-600 rounded-md"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!mapping.custom_mappings || mapping.custom_mappings.length === 0) && (
                                                <div className="text-center py-4 bg-gray-50/50 border border-dashed border-gray-100 rounded-lg text-xs text-gray-400">
                                                    No custom fields mapped yet. Click &apos;Add Custom Field&apos; to extract extra columns.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t border-gray-50 pt-4 flex flex-col items-stretch gap-2 bg-gray-50/20">
                                {saveError && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                        <span>{saveError}</span>
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    onClick={handleSaveConfig}
                                    disabled={saveLoading || !mapping.offers_path || !mapping.offer_id || !mapping.offer_name || !mapping.payout}
                                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md shadow-red-500/20 rounded-lg w-full h-10 gap-1.5 font-bold transition-all"
                                >
                                    {saveLoading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving & Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" /> Save Advertiser & Sync
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* If mapping is not visible, user can still save advertiser name/endpoints */}
                    {!testPayload && !mapping.offers_path && (
                        <div className="flex flex-col gap-2">
                            {saveError && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                    <span>{saveError}</span>
                                </div>
                            )}
                            <Button
                                type="button"
                                onClick={handleSaveConfig}
                                disabled={saveLoading || !name.trim() || !apiUrl.trim()}
                                className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg h-10 font-bold transition-all"
                            >
                                {saveLoading ? "Saving..." : "Save Connection Parameters"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right Side: Raw Payload Display & Mapped Live Preview */}
                <div className="lg:col-span-6 space-y-6">
                    {/* API response console */}
                    <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-gray-900 text-gray-100 overflow-hidden">
                        <CardHeader className="border-b border-gray-800 bg-gray-950 pb-4">
                            <CardTitle className="text-sm font-bold text-gray-300 font-mono flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> RESPONSE CONSOLE
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {testPayload ? (
                                <pre className="p-4 text-xs font-mono max-h-[300px] overflow-y-auto leading-relaxed overflow-x-auto text-emerald-400 select-all">
                                    {JSON.stringify(testPayload, null, 2)}
                                </pre>
                            ) : testLoading ? (
                                <div className="p-12 text-center text-xs text-gray-400 font-mono">
                                    <div className="animate-pulse flex flex-col items-center gap-3">
                                        <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                        Waiting for server response...
                                    </div>
                                </div>
                            ) : testError ? (
                                <div className="p-6 text-xs font-mono text-red-400 bg-red-950/20 max-h-[300px] overflow-y-auto">
                                    {testError}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-xs text-gray-500 font-mono">
                                    No endpoint loaded. Complete the API details and click &apos;Test Connection&apos; to view payload structure.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Live Preview Table */}
                    {testPayload && (
                        <Card className="border border-gray-100 shadow-xl shadow-gray-200/40 bg-white overflow-hidden animate-in fade-in duration-300">
                            <CardHeader className="border-b border-gray-50 bg-gray-50/50 pb-3">
                                <CardTitle className="text-sm font-bold text-gray-800 flex items-center justify-between">
                                    <span>3. Live Mapping Preview</span>
                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[10px] uppercase font-bold tracking-wider px-2">
                                        Showing first {previewOffers.length} rows
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {previewOffers.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="text-xs font-bold text-gray-700">Offer ID</TableHead>
                                                    <TableHead className="text-xs font-bold text-gray-700">Offer Name</TableHead>
                                                    <TableHead className="text-xs font-bold text-gray-700">Payout</TableHead>
                                                    {mapping.vertical && <TableHead className="text-xs font-bold text-gray-700">Vertical</TableHead>}
                                                    {mapping.custom_mappings && mapping.custom_mappings.map((cMap, cIdx) => (
                                                        cMap.key && <TableHead key={cIdx} className="text-xs font-bold text-gray-700">{cMap.key}</TableHead>
                                                    ))}
                                                    {mapping.status && <TableHead className="text-xs font-bold text-gray-700">Status</TableHead>}
                                                    {mapping.tracking_link && <TableHead className="text-xs font-bold text-gray-700">Tracking URL</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewOffers.map((offer, idx) => (
                                                    <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <TableCell className="text-xs font-mono font-medium text-gray-600">{offer.id}</TableCell>
                                                        <TableCell className="text-xs max-w-[150px] truncate text-gray-800" title={offer.name}>{offer.name}</TableCell>
                                                        <TableCell className="text-xs font-medium text-gray-700">{offer.payout}</TableCell>
                                                        {mapping.vertical && <TableCell className="text-xs text-gray-500">{offer.vertical}</TableCell>}
                                                        {mapping.custom_mappings && mapping.custom_mappings.map((cMap, cIdx) => (
                                                            cMap.key && (
                                                                <TableCell key={cIdx} className="text-xs text-gray-600 font-medium">
                                                                    {offer.custom_fields?.[cMap.key] || ''}
                                                                </TableCell>
                                                            )
                                                        ))}
                                                        {mapping.status && (
                                                            <TableCell className="text-xs">
                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5 font-medium">
                                                                    {offer.status}
                                                                </Badge>
                                                            </TableCell>
                                                        )}
                                                        {mapping.tracking_link && (
                                                            <TableCell className="text-xs font-mono max-w-[150px] truncate text-gray-500" title={offer.tracking_link}>
                                                                {offer.tracking_link || '-'}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-xs text-gray-400">
                                        {mapping.offers_path ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <AlertCircle className="h-6.5 w-6.5 text-gray-300" />
                                                <span>No valid items parsed. Verify the fields configuration.</span>
                                            </div>
                                        ) : (
                                            <span>Enter mapping path details to see live parse results.</span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {testPayload && (
                <>
                    <datalist id="root-paths">
                        {rootPathSuggestions.map((path) => (
                            <option key={path} value={path} />
                        ))}
                    </datalist>
                    <datalist id="offer-paths">
                        {offerPathSuggestions.map((path) => (
                            <option key={path} value={path} />
                        ))}
                    </datalist>
                </>
            )}

            <datalist id="custom-fields-suggestions">
                {allCustomFields.map((field) => (
                    <option key={field} value={field} />
                ))}
            </datalist>

            <ManageCustomFieldsModal
                open={isManageModalOpen}
                setOpen={setIsManageModalOpen}
                onChanged={fetchCustomFields}
            />
        </div>
    );
}

export default function ConfigureAdvertiser() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
        }>
            <ConfigureAdvertiserContent />
        </Suspense>
    );
}
