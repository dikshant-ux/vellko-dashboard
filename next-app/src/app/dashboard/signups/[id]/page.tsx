'use client';

import { useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Loader2, FileText, Upload, Download, RotateCcw, Pencil, Save, Trash, MapPin } from "lucide-react";
import { COUNTRIES, PAYMENT_MODELS, CATEGORIES, PAYMENT_TO, CURRENCIES, US_STATES, TIMEZONES, IM_SERVICES, TAX_CLASSES, APPLICATION_TYPES } from "@/constants/mappings";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function SignupDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: session } = useSession();
    const router = useRouter();
    const [signup, setSignup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [referrers, setReferrers] = useState<{ id: string, name: string }[]>([]);
    const [isEditingReferral, setIsEditingReferral] = useState(false);
    const [newReferral, setNewReferral] = useState("");
    const [referralLoading, setReferralLoading] = useState(false);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Decision Dialog State
    const [isDecisionOpen, setIsDecisionOpen] = useState(false);
    const [decisionReason, setDecisionReason] = useState("");
    const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'request_approval' | null>(null);
    const [apiSelection, setApiSelection] = useState({ cake: false, ringba: false });
    const [showApiSelection, setShowApiSelection] = useState(false);

    // Document Upload State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // IP Location State
    const [ipLocation, setIpLocation] = useState<string | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Notes State
    const [noteContent, setNoteContent] = useState("");
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editNoteContent, setEditNoteContent] = useState("");

    useEffect(() => {
        if (session?.accessToken && id) {
            // First fetch the signup to get its application type
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                headers: { Authorization: `Bearer ${session.accessToken}` }
            })
                .then(res => res.json())
                .then(signupData => {
                    setSignup(signupData);
                    setNewReferral(signupData.companyInfo?.referral || "");
                    setEditForm(JSON.parse(JSON.stringify(signupData))); // Deep clone for editing

                    // Fetch referrers filtered by the signup's application type
                    const applicationType = signupData.marketingInfo?.applicationType;
                    const referrersUrl = applicationType
                        ? `${process.env.NEXT_PUBLIC_API_URL}/referrers?application_type=${encodeURIComponent(applicationType)}`
                        : `${process.env.NEXT_PUBLIC_API_URL}/referrers`;

                    return fetch(referrersUrl);
                })
                .then(res => res.json())
                .then(referrersData => {
                    setReferrers(referrersData);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [session, id]);

    // Effect to set initial API selection based on permissions when dialog opens
    useEffect(() => {
        if (isDecisionOpen && signup && session?.user) {
            const userPermission = session.user.application_permission;
            const appType = signup.marketingInfo?.applicationType;

            if (appType === 'Both') {
                if (userPermission === 'Web Traffic') {
                    setApiSelection({ cake: true, ringba: false });
                } else if (userPermission === 'Call Traffic') {
                    setApiSelection({ cake: false, ringba: true });
                }

                // If permission is Both, consistent with initiateAction
                if (userPermission === 'Both') {
                    if (signup.cake_affiliate_id && !signup.ringba_affiliate_id) {
                        setApiSelection({ cake: false, ringba: true });
                    } else if (!signup.cake_affiliate_id && signup.ringba_affiliate_id) {
                        setApiSelection({ cake: true, ringba: false });
                    }
                }
            }
        }
    }, [isDecisionOpen, signup, session]);

    const handleUpload = async () => {
        if (!uploadFile) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", uploadFile);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/documents`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: formData
            });
            if (res.ok) {
                setUploadFile(null);
                // reload data
                const updated = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                }).then(r => r.json());
                setSignup(updated);
                const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error uploading");
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure you want to reset this signup to Pending?")) return;
        setActionLoading('reset');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/reset`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });
            if (res.ok) {
                router.refresh();
                setLoading(true);
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                }).then(r => r.json()).then(d => { setSignup(d); setLoading(false); });
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error resetting");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to permanently delete this signup? This action cannot be undone.")) return;
        setActionLoading('delete');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });

            if (res.ok) {
                alert("Signup deleted successfully");
                router.push('/dashboard/signups');
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
                setActionLoading(null);
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting signup");
            setActionLoading(null);
        }
    };

    const handleDownload = async (doc: any) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${doc.path}`);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = doc.filename; // Force download with original filename
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file');
        }
    };

    const handleDeleteDocument = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/documents/${filename}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });

            if (res.ok) {
                // reload data
                const updated = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                }).then(r => r.json());
                setSignup(updated);
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting document");
        }
    };

    const initiateAction = (action: 'approve' | 'reject' | 'request_approval') => {
        setPendingAction(action);
        setDecisionReason("");

        if (action === 'approve' || action === 'request_approval') {
            const appType = signup.marketingInfo?.applicationType;
            const userPermission = session?.user?.application_permission;

            if (appType === 'Call Traffic') {
                setApiSelection({ cake: false, ringba: true });
                setShowApiSelection(false); // Only 1 option, no need to show if we follow existing logic? Wait, existing logic hides it?
                // Actually existing logic showed it only for 'Both'. 
                // Let's refine: For simple types, we auto-select and hide. 
                // For 'Both', we show. 
                // AND for granular control: we might want to show it disabled?
                // Current implementation:
                // Call/Web -> hide
                // Both -> show
                // Let's stick to that for consistent UX.
                setShowApiSelection(false);
            } else if (appType === 'Web Traffic') {
                setApiSelection({ cake: true, ringba: false });
                setShowApiSelection(false);
            } else if (appType === 'Both') {
                // Smart Granular Logic using Boolean Status
                // If Cake is True (Approved) or False (Rejected) -> Don't select it.
                // If Ringba is True or False -> Don't select it.

                const isCakeDone = signup.cake_api_status === true || signup.cake_api_status === false || !!signup.cake_affiliate_id;
                const isRingbaDone = signup.ringba_api_status === true || signup.ringba_api_status === false || !!signup.ringba_affiliate_id;

                if (userPermission === 'Web Traffic') {
                    setApiSelection({ cake: true, ringba: false });
                    setShowApiSelection(false);
                } else if (userPermission === 'Call Traffic') {
                    setApiSelection({ cake: false, ringba: true });
                    setShowApiSelection(false);
                } else {
                    // Both or Super Admin
                    if (isCakeDone && !isRingbaDone) {
                        setApiSelection({ cake: false, ringba: true });
                    } else if (!isCakeDone && isRingbaDone) {
                        setApiSelection({ cake: true, ringba: false });
                    } else {
                        // Both pending or both done (retry?)
                        // Default to both enabled if not done
                        setApiSelection({
                            cake: !isCakeDone,
                            ringba: !isRingbaDone
                        });
                    }
                    setShowApiSelection(true);
                }
            } else {
                setApiSelection({ cake: true, ringba: false });
                setShowApiSelection(false);
            }
        } else {
            setShowApiSelection(false);
        }
        setIsDecisionOpen(true);
    };

    const confirmAction = async () => {
        if (!pendingAction) return;

        // Validation for "Both" scenario
        if ((pendingAction === 'approve' || pendingAction === 'request_approval') && showApiSelection) {
            if (!apiSelection.cake && !apiSelection.ringba) {
                alert("Please select at least one API to trigger/request.");
                return;
            }
        }

        setActionLoading(pendingAction);
        setIsDecisionOpen(false);

        // Map request_approval to approve endpoint (backend handles logic based on permission)
        // OR call a specific endpoint?
        // Backend `approve_signup` logic: checks `can_approve_signups`. If false, status -> REQUESTED_FOR_APPROVAL.
        // So we can still call `/approve`.

        // But wait, if it's "Accepting" a request, we also call `/approve`.
        // So `/approve` is the universal "Move forward" endpoint.
        const endpointAction = pendingAction === 'request_approval' ? 'approve' : pendingAction;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/${endpointAction}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    reason: decisionReason,
                    addToCake: apiSelection.cake,
                    addToRingba: apiSelection.ringba
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (pendingAction === 'approve') {
                    alert(data.message || "Affiliate Added Successfully");
                } else if (pendingAction === 'request_approval') {
                    alert("Approval requested successfully");
                }
                router.refresh();
                setLoading(true);
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                }).then(r => r.json()).then(d => { setSignup(d); setLoading(false); });
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (e) {
            alert('Action failed');
        } finally {
            setActionLoading(null);
            setPendingAction(null);
        }
    };

    const handleUpdateReferral = async () => {
        setReferralLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/referral`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({ referral: newReferral })
            });

            if (res.ok) {
                const data = await res.json();
                setSignup((prev: any) => ({
                    ...prev,
                    companyInfo: {
                        ...prev.companyInfo,
                        referral: newReferral
                    }
                }));
                setIsEditingReferral(false);
                router.refresh(); // Refresh to update listings if needed
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (error) {
            console.error("Error updating referral", error);
            alert("Failed to update referral");
        } finally {
            setReferralLoading(false);
        }
    };

    const handleLocateIp = async (ip: string) => {
        setLoadingLocation(true);
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            const data = await response.json();
            if (data.error) {
                setIpLocation("Location not found");
            } else {
                const location = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
                setIpLocation(location);
            }
        } catch (error) {
            console.error("Error fetching IP location:", error);
            setIpLocation("Error fetching location");
        } finally {
            setLoadingLocation(false);
        }
    };



    const handleAddNote = async () => {
        if (!noteContent.trim()) return;
        setIsAddingNote(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({ note: noteContent })
            });

            if (res.ok) {
                const newNote = await res.json();
                setSignup((prev: { notes: any; }) => ({
                    ...prev,
                    notes: [...(prev.notes || []), newNote]
                }));
                setNoteContent("");
            } else {
                const err = await res.json();
                alert(`Error adding note: ${err.detail}`);
            }
        } catch (error) {
            console.error("Error adding note", error);
            alert("Failed to add note");
        } finally {
            setIsAddingNote(false);
        }
    };

    const handleUpdateNote = async (noteId: string) => {
        if (!editNoteContent.trim()) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({ note: editNoteContent })
            });

            if (res.ok) {
                setSignup((prev: { notes: any[]; }) => ({
                    ...prev,
                    notes: prev.notes.map((n: any) => n.id === noteId ? { ...n, content: editNoteContent, updated_at: new Date().toISOString() } : n)
                }));
                setEditingNoteId(null);
                setEditNoteContent("");
            } else {
                alert("Failed to update note");
            }
        } catch (error) {
            console.error("Error updating note", error);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm("Are you sure you want to delete this note?")) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });

            if (res.ok) {
                setSignup((prev: { notes: any[]; }) => ({
                    ...prev,
                    notes: prev.notes.filter((n: any) => n.id !== noteId)
                }));
            } else {
                alert("Failed to delete note");
            }
        } catch (error) {
            console.error("Error deleting note", error);
        }
    };

    const handleEditChange = (section: string, field: string, value: any) => {
        setEditForm((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    companyInfo: editForm.companyInfo,
                    marketingInfo: editForm.marketingInfo,
                    accountInfo: editForm.accountInfo,
                    paymentInfo: editForm.paymentInfo
                })
            });

            if (res.ok) {
                setSignup(editForm);
                setIsEditing(false);
                alert("Signup updated successfully");
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail}`);
            }
        } catch (error) {
            console.error("Error saving signup", error);
            alert("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleEdit = () => {
        if (isEditing) {
            // Cancel - reset editForm to current signup
            setEditForm(JSON.parse(JSON.stringify(signup)));
        }
        setIsEditing(!isEditing);
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!signup) return <div>Not found</div>;

    const getDisplayStatus = (signup: any) => {
        if (!signup) return 'PENDING';
        const userPermission = session?.user?.application_permission;
        const userRole = session?.user?.role;
        const appType = signup.marketingInfo?.applicationType;

        // If not "Both", rely on global status
        if (appType !== 'Both') return signup.status;

        // If Super Admin or Both, check combined logic
        if (userRole === 'SUPER_ADMIN' || userPermission === 'Both' || !userPermission) {
            const cake = signup.cake_api_status;
            const ringba = signup.ringba_api_status;

            if (cake === true && ringba === true) return 'APPROVED';

            // Refined Partial Logic
            if ((cake === true && ringba === false) || (ringba === true && cake === false)) {
                return 'APPROVED (PARTIAL)';
            }

            if (cake === true || ringba === true) return 'PARTIALLY APPROVED';

            if (cake === false && ringba === false) return 'REJECTED';

            return signup.status;
        }

        // If specific permission, only care about that status
        if (userPermission === 'Web Traffic') {
            if (signup.cake_api_status === true) return 'APPROVED';
            if (signup.cake_api_status === false) return 'REJECTED';
            return 'PENDING';
        }

        if (userPermission === 'Call Traffic') {
            if (signup.ringba_api_status === true) return 'APPROVED';
            if (signup.ringba_api_status === false) return 'REJECTED';
            return 'PENDING';
        }

        return signup.status;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const displayStatus = getDisplayStatus(signup);

        const variants: any = {
            PENDING: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
            APPROVED: "bg-green-100 text-green-800 hover:bg-green-100",
            REJECTED: "bg-red-100 text-red-800 hover:bg-red-100",
            "PARTIALLY APPROVED": "bg-blue-100 text-blue-800 hover:bg-blue-100",
            "APPROVED (PARTIAL)": "bg-orange-100 text-orange-800 hover:bg-orange-100",
        };
        return <Badge className={variants[displayStatus] || variants[status] || ""} variant="secondary">{displayStatus}</Badge>;
    };

    const importIcons = { Pencil: "lucide-react" }; // Just a marker for imports logic if needed, but imports are at top

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Signup Details</h2>
                    <div className="flex items-center gap-4">
                        <p className="text-muted-foreground">Review application for {signup.companyInfo?.companyName}</p>
                        {signup.is_updated && signup.updated_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
                                <RotateCcw className="h-3 w-3" />
                                Edited: {new Date(signup.updated_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={signup.status} />
                        {/* Granular Status Badges (Boolean) */}
                        {/* Granular Status Badges (Boolean) - Always show for Both type users */}
                        {(signup.marketingInfo?.applicationType === 'Both' && ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '')) && (
                            <div className="flex gap-2 text-xs">
                                <Badge variant="outline" className={
                                    signup.cake_api_status === true ? "border-green-500 text-green-600 bg-green-50" :
                                        signup.cake_api_status === false ? "border-red-500 text-red-600 bg-red-50" :
                                            "border-yellow-500 text-yellow-600 bg-yellow-50"
                                }>Cake: {signup.cake_api_status === true ? 'Approved' : signup.cake_api_status === false ? 'Rejected' : 'Pending'}</Badge>

                                <Badge variant="outline" className={
                                    signup.ringba_api_status === true ? "border-green-500 text-green-600 bg-green-50" :
                                        signup.ringba_api_status === false ? "border-red-500 text-red-600 bg-red-50" :
                                            "border-yellow-500 text-yellow-600 bg-yellow-50"
                                }>Ringba: {signup.ringba_api_status === true ? 'Approved' : signup.ringba_api_status === false ? 'Rejected' : 'Pending'}</Badge>
                            </div>
                        )}
                    </div>
                    {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                        <>
                            {isEditing ? (
                                <>
                                    <Button variant="outline" onClick={toggleEdit} disabled={isSaving}>
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save Changes
                                    </Button>
                                </>
                            ) : (
                                <Button variant="outline" onClick={toggleEdit}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Details
                                </Button>
                            )}
                        </>
                    )}
                    {signup.status === 'PENDING' && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => initiateAction('reject')}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                Reject
                            </Button>

                            {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.can_approve_signups) ? (
                                <Button
                                    onClick={() => initiateAction('approve')}
                                    disabled={!!actionLoading}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {actionLoading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Approve
                                </Button>
                            ) : (
                                <Button
                                    variant="secondary"
                                    onClick={() => initiateAction('request_approval')}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === 'request_approval' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                    Request Approval
                                </Button>
                            )}
                        </>

                    )}

                    {/* Partial Approval Logic: Allow action if Both type and one API is missing, even if status is APPROVED or REQUESTED */}
                    {signup.marketingInfo?.applicationType === 'Both' &&
                        (signup.status === 'APPROVED' || signup.status === 'REQUESTED_FOR_APPROVAL') &&
                        (!signup.cake_affiliate_id || !signup.ringba_affiliate_id) && (
                            <>
                                {/* Only show if user has permission to act on the MISSING one */}
                                {/* Logic is a bit complex:
                                 If Cake missing -> Web Traffic OR Both user can act.
                                 If Ringba missing -> Call Traffic OR Both user can act.
                             */}
                                {(
                                    (!signup.cake_affiliate_id && ['Web Traffic', 'Both'].includes(session?.user?.application_permission || '')) ||
                                    (!signup.ringba_affiliate_id && ['Call Traffic', 'Both'].includes(session?.user?.application_permission || ''))
                                ) && (
                                        <>
                                            {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.can_approve_signups) ? (
                                                <>
                                                    {/* Hide Reject Remaining if the remaining item is ALREADY rejected */}
                                                    {
                                                        // If Cake is missing and Cake is NOT rejected -> Show Reject
                                                        // If Ringba is missing and Ringba is NOT rejected -> Show Reject
                                                        ((!signup.cake_affiliate_id && signup.cake_api_status !== false) ||
                                                            (!signup.ringba_affiliate_id && signup.ringba_api_status !== false)) && (
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => initiateAction('reject')}
                                                                disabled={!!actionLoading}
                                                                className="ml-2"
                                                            >
                                                                {actionLoading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                                                Reject Remaining
                                                            </Button>
                                                        )
                                                    }
                                                    <Button
                                                        onClick={() => initiateAction('approve')}
                                                        disabled={!!actionLoading}
                                                        className="bg-green-600 hover:bg-green-700 ml-2"
                                                    >
                                                        {actionLoading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                        {((!signup.cake_affiliate_id && signup.cake_api_status === false) ||
                                                            (!signup.ringba_affiliate_id && signup.ringba_api_status === false)) ? 'Retry Approval' : 'Approve Remaining'}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => initiateAction('request_approval')}
                                                    disabled={!!actionLoading}
                                                    className="ml-2"
                                                >
                                                    {actionLoading === 'request_approval' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                    Request Remaining
                                                </Button>
                                            )}
                                        </>
                                    )}
                            </>
                        )}

                    {signup.status === 'REQUESTED_FOR_APPROVAL' && ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => initiateAction('reject')}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                Reject
                            </Button>
                            <Button
                                onClick={() => initiateAction('approve')}
                                disabled={!!actionLoading}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {actionLoading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Approve
                            </Button>
                        </>
                    )}
                    {signup.status === 'REJECTED' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'reset' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Reset to Pending
                            </Button>
                            <Button
                                onClick={() => initiateAction('approve')}
                                disabled={!!actionLoading}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {actionLoading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Approve
                            </Button>
                        </>
                    )}
                    {session?.user?.role === 'SUPER_ADMIN' && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={isDecisionOpen} onOpenChange={setIsDecisionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAction === 'approve' ? 'Approve Application' :
                                pendingAction === 'reject' ? 'Reject Application' :
                                    'Request Approval'}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingAction === 'request_approval'
                                ? "Submit this application for Admin approval."
                                : "Please provide a reason for this decision. This will be recorded in the system."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {(pendingAction === 'approve' || pendingAction === 'request_approval') && showApiSelection && (
                            <div className="grid gap-4">
                                <Label className="text-base font-semibold">Select APIs to Trigger</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        className={`flex items-center space-x-3 border rounded-lg p-3 transition-colors ${(session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Call Traffic' && signup.marketingInfo?.applicationType === 'Both') || !!signup.cake_affiliate_id
                                            ? 'opacity-50 cursor-not-allowed bg-gray-100'
                                            : (apiSelection.cake ? 'border-primary bg-primary/5 cursor-pointer' : 'border-input hover:bg-accent cursor-pointer')
                                            }`}
                                        onClick={() => {
                                            if (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Call Traffic' && signup.marketingInfo?.applicationType === 'Both') return;
                                            if (signup.cake_affiliate_id) return; // Disable if already approved
                                            setApiSelection(prev => ({ ...prev, cake: !prev.cake }))
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            id="cake"
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={apiSelection.cake}
                                            onChange={() => { }} // Handled by div click
                                            style={{ pointerEvents: 'none' }}
                                            disabled={
                                                (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Call Traffic' && signup.marketingInfo?.applicationType === 'Both') ||
                                                !!signup.cake_affiliate_id // Disable if already approved
                                            }
                                        />
                                        <div className="space-y-0.5">
                                            <Label htmlFor="cake" className={`text-sm font-medium ${(session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Call Traffic' && signup.marketingInfo?.applicationType === 'Both') || !!signup.cake_affiliate_id
                                                ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>Cake API</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {signup.cake_affiliate_id ? '(Already Processed)' : 'Primary Affiliate System'}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex items-center space-x-3 border rounded-lg p-3 transition-colors ${(session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Web Traffic' && signup.marketingInfo?.applicationType === 'Both') || !!signup.ringba_affiliate_id
                                            ? 'opacity-50 cursor-not-allowed bg-gray-100'
                                            : (apiSelection.ringba ? 'border-primary bg-primary/5 cursor-pointer' : 'border-input hover:bg-accent cursor-pointer')
                                            }`}
                                        onClick={() => {
                                            if (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Web Traffic' && signup.marketingInfo?.applicationType === 'Both') return;
                                            if (signup.ringba_affiliate_id) return; // Disable if already approved
                                            setApiSelection(prev => ({ ...prev, ringba: !prev.ringba }))
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            id="ringba"
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={apiSelection.ringba}
                                            onChange={() => { }} // Handled by div click
                                            style={{ pointerEvents: 'none' }}
                                            disabled={
                                                (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Web Traffic' && signup.marketingInfo?.applicationType === 'Both') ||
                                                !!signup.ringba_affiliate_id // Disable if already approved
                                            }
                                        />
                                        <div className="space-y-0.5">
                                            <Label htmlFor="ringba" className={`text-sm font-medium ${(session?.user?.role !== 'SUPER_ADMIN' && session?.user?.application_permission === 'Web Traffic' && signup.marketingInfo?.applicationType === 'Both') || !!signup.ringba_affiliate_id
                                                ? 'cursor-not-allowed text-muted-allowed' : 'cursor-pointer'}`}>Ringba API</Label>
                                            <p className="text-xs text-muted-foreground">Call Tracking System</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {pendingAction === 'approve' && !showApiSelection && (
                            <div className="text-sm text-muted-foreground mb-2">
                                Creating affiliate in: {apiSelection.cake ? <b>Cake</b> : ''} {apiSelection.ringba ? <b>Ringba</b> : ''}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="reason">Reason / Comments</Label>
                            <textarea
                                id="reason"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder={pendingAction === 'request_approval' ? "Add notes for the admin..." : (pendingAction === 'approve' ? "Optional approval notes..." : "Reason for rejection...")}
                                value={decisionReason}
                                onChange={(e) => setDecisionReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDecisionOpen(false)}>Cancel</Button>
                        <Button
                            variant={pendingAction === 'reject' ? "destructive" : "default"}
                            className={pendingAction === 'approve' ? "bg-green-600 hover:bg-green-700" : ""}
                            onClick={confirmAction}
                        >
                            {pendingAction === 'approve' ? 'Confirm Approval' :
                                pendingAction === 'reject' ? 'Confirm Rejection' :
                                    'Submit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Company Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Company Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Name:</span>
                            {isEditing ? (
                                <Input
                                    className="col-span-2 h-8"
                                    value={editForm.companyInfo?.companyName}
                                    onChange={(e) => handleEditChange('companyInfo', 'companyName', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2">{signup.companyInfo?.companyName}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Website:</span>
                            {isEditing ? (
                                <Input
                                    className="col-span-2 h-8"
                                    value={editForm.companyInfo?.corporateWebsite}
                                    onChange={(e) => handleEditChange('companyInfo', 'corporateWebsite', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2 text-blue-600 underline">
                                    {signup.companyInfo?.corporateWebsite ? <a href={signup.companyInfo.corporateWebsite} target="_blank">{signup.companyInfo.corporateWebsite}</a> : '-'}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-start">
                            <span className="font-medium text-muted-foreground pt-2">Address:</span>
                            {isEditing ? (
                                <div className="col-span-2 space-y-2">
                                    <Input
                                        placeholder="Address 1"
                                        className="h-8"
                                        value={editForm.companyInfo?.address}
                                        onChange={(e) => handleEditChange('companyInfo', 'address', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Address 2"
                                        className="h-8"
                                        value={editForm.companyInfo?.address2}
                                        onChange={(e) => handleEditChange('companyInfo', 'address2', e.target.value)}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="City"
                                            className="h-8"
                                            value={editForm.companyInfo?.city}
                                            onChange={(e) => handleEditChange('companyInfo', 'city', e.target.value)}
                                        />
                                        <select
                                            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                            value={editForm.companyInfo?.state}
                                            onChange={(e) => handleEditChange('companyInfo', 'state', e.target.value)}
                                        >
                                            {Object.entries(US_STATES).map(([code, name]) => (
                                                <option key={code} value={code}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            placeholder="Zip"
                                            className="h-8"
                                            value={editForm.companyInfo?.zip}
                                            onChange={(e) => handleEditChange('companyInfo', 'zip', e.target.value)}
                                        />
                                        <select
                                            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                            value={editForm.companyInfo?.country}
                                            onChange={(e) => handleEditChange('companyInfo', 'country', e.target.value)}
                                        >
                                            {Object.entries(COUNTRIES).map(([code, name]) => (
                                                <option key={code} value={code}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <span className="col-span-2">
                                    {signup.companyInfo?.address}
                                    {signup.companyInfo?.address2 && <>, {signup.companyInfo.address2}</>}
                                    <br />
                                    {signup.companyInfo?.city}, {US_STATES[signup.companyInfo?.state] || signup.companyInfo?.state} {signup.companyInfo?.zip}
                                    <br />
                                    {COUNTRIES[signup.companyInfo?.country] || signup.companyInfo?.country}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Referral:</span>
                            <div className="col-span-2 flex items-center gap-2">
                                {isEditingReferral ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <select
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={newReferral}
                                            onChange={(e) => setNewReferral(e.target.value)}
                                            disabled={referralLoading}
                                        >
                                            <option value="">Select Referral</option>
                                            {referrers.map((ref, idx) => (
                                                <option key={idx} value={String(ref.name)}>{String(ref.name)}</option>
                                            ))}
                                            <option value="Other">Other</option>
                                        </select>
                                        <Button size="icon" variant="ghost" onClick={handleUpdateReferral} disabled={referralLoading}>
                                            {referralLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => setIsEditingReferral(false)} disabled={referralLoading}>
                                            <X className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <span>{signup.companyInfo?.referral || '-'}</span>
                                        {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingReferral(true)}>
                                                {/* Requires importing Pencil from lucide-react */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Account Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Contact:</span>
                            {isEditing ? (
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                    <Input
                                        placeholder="First Name"
                                        className="h-8"
                                        value={editForm.accountInfo?.firstName}
                                        onChange={(e) => handleEditChange('accountInfo', 'firstName', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Last Name"
                                        className="h-8"
                                        value={editForm.accountInfo?.lastName}
                                        onChange={(e) => handleEditChange('accountInfo', 'lastName', e.target.value)}
                                    />
                                </div>
                            ) : (
                                <span className="col-span-2 font-medium">{signup.accountInfo?.firstName} {signup.accountInfo?.lastName}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Title:</span>
                            {isEditing ? (
                                <Input
                                    className="col-span-2 h-8"
                                    value={editForm.accountInfo?.title}
                                    onChange={(e) => handleEditChange('accountInfo', 'title', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2">{signup.accountInfo?.title || '-'}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Email:</span>
                            {isEditing ? (
                                <Input
                                    className="col-span-2 h-8"
                                    value={editForm.accountInfo?.email}
                                    onChange={(e) => handleEditChange('accountInfo', 'email', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2">{signup.accountInfo?.email}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Phone:</span>
                            {isEditing ? (
                                <div className="col-span-2 space-y-2">
                                    <Input
                                        placeholder="Work Phone"
                                        className="h-8"
                                        value={editForm.accountInfo?.workPhone}
                                        onChange={(e) => handleEditChange('accountInfo', 'workPhone', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Cell Phone"
                                        className="h-8"
                                        value={editForm.accountInfo?.cellPhone}
                                        onChange={(e) => handleEditChange('accountInfo', 'cellPhone', e.target.value)}
                                    />
                                </div>
                            ) : (
                                <span className="col-span-2">{signup.accountInfo?.workPhone}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">IM:</span>
                            {isEditing ? (
                                <div className="col-span-2 space-y-2">
                                    <div className="text-xs text-muted-foreground mb-1">Editing multiple IMs not yet supported in admin. Modifying primary only.</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                            value={editForm.accountInfo?.imService}
                                            onChange={(e) => handleEditChange('accountInfo', 'imService', e.target.value)}
                                        >
                                            <option value="">None</option>
                                            {Object.entries(IM_SERVICES).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        <Input
                                            placeholder="Handle"
                                            className="h-8"
                                            value={editForm.accountInfo?.imHandle}
                                            onChange={(e) => handleEditChange('accountInfo', 'imHandle', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="col-span-2">
                                    {signup.accountInfo?.additionalImChannels && Object.keys(signup.accountInfo.additionalImChannels).length > 0 ? (
                                        <div className="space-y-1">
                                            {Object.entries(signup.accountInfo.additionalImChannels).map(([service, handle]: any) => (
                                                handle ? (
                                                    <div key={service} className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 min-w-[60px] justify-center">
                                                            {IM_SERVICES[service] || service}
                                                        </Badge>
                                                        <span className="text-sm">
                                                            {handle}
                                                            {service === signup.accountInfo.imService && <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>}
                                                        </span>
                                                    </div>
                                                ) : null
                                            ))}
                                        </div>
                                    ) : (
                                        <span>
                                            {signup.accountInfo?.imService ? (
                                                <>{IM_SERVICES[signup.accountInfo.imService] || signup.accountInfo.imService}: {signup.accountInfo.imHandle}</>
                                            ) : '-'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Timezone:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.accountInfo?.timezone}
                                    onChange={(e) => handleEditChange('accountInfo', 'timezone', e.target.value)}
                                >
                                    {Object.entries(TIMEZONES).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{TIMEZONES[signup.accountInfo?.timezone] || signup.accountInfo?.timezone}</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Marketing Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Marketing Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Application Type:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.marketingInfo?.applicationType}
                                    onChange={(e) => handleEditChange('marketingInfo', 'applicationType', e.target.value)}
                                >
                                    {Object.entries(APPLICATION_TYPES).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{APPLICATION_TYPES[signup.marketingInfo?.applicationType] || signup.marketingInfo?.applicationType || '-'}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Payment Model:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.marketingInfo?.paymentModel}
                                    onChange={(e) => handleEditChange('marketingInfo', 'paymentModel', e.target.value)}
                                >
                                    {Object.entries(PAYMENT_MODELS).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{PAYMENT_MODELS[signup.marketingInfo?.paymentModel] || signup.marketingInfo?.paymentModel}</span>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Primary:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.marketingInfo?.primaryCategory}
                                    onChange={(e) => handleEditChange('marketingInfo', 'primaryCategory', e.target.value)}
                                >
                                    {Object.entries(CATEGORIES).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{CATEGORIES[signup.marketingInfo?.primaryCategory] || signup.marketingInfo?.primaryCategory}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Secondary:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.marketingInfo?.secondaryCategory}
                                    onChange={(e) => handleEditChange('marketingInfo', 'secondaryCategory', e.target.value)}
                                >
                                    <option value="0">None</option>
                                    {Object.entries(CATEGORIES).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{CATEGORIES[signup.marketingInfo?.secondaryCategory] || signup.marketingInfo?.secondaryCategory || 'None'}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-start">
                            <span className="font-medium text-muted-foreground pt-1">Comments:</span>
                            {isEditing ? (
                                <textarea
                                    className="col-span-2 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={editForm.marketingInfo?.comments}
                                    onChange={(e) => handleEditChange('marketingInfo', 'comments', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2 italic text-muted-foreground">"{signup.marketingInfo?.comments || 'No comments'}"</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Pay To:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.paymentInfo?.payTo}
                                    onChange={(e) => handleEditChange('paymentInfo', 'payTo', e.target.value)}
                                >
                                    {Object.entries(PAYMENT_TO).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{PAYMENT_TO[signup.paymentInfo?.payTo] || signup.paymentInfo?.payTo}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Currency:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.paymentInfo?.currency}
                                    onChange={(e) => handleEditChange('paymentInfo', 'currency', e.target.value)}
                                >
                                    {Object.entries(CURRENCIES).map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{CURRENCIES[signup.paymentInfo?.currency] || signup.paymentInfo?.currency}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Tax Class:</span>
                            {isEditing ? (
                                <select
                                    className="col-span-2 flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editForm.paymentInfo?.taxClass}
                                    onChange={(e) => handleEditChange('paymentInfo', 'taxClass', e.target.value)}
                                >
                                    {Object.entries(TAX_CLASSES).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="col-span-2">{TAX_CLASSES[signup.paymentInfo?.taxClass] || signup.paymentInfo?.taxClass}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">SSN/Tax ID:</span>
                            {isEditing ? (
                                <Input
                                    className="col-span-2 h-8"
                                    value={editForm.paymentInfo?.ssnTaxId}
                                    onChange={(e) => handleEditChange('paymentInfo', 'ssnTaxId', e.target.value)}
                                />
                            ) : (
                                <span className="col-span-2">{signup.paymentInfo?.ssnTaxId}</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* System Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>System Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">IP Address:</span>
                            <div className="col-span-2 flex items-center gap-2">
                                <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{signup.ipAddress || 'Not Recorded'}</span>
                                {signup.ipAddress && signup.ipAddress !== "0.0.0.0" && (
                                    <>
                                        {ipLocation ? (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {ipLocation}
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs flex gap-1 items-center"
                                                onClick={() => handleLocateIp(signup.ipAddress)}
                                                disabled={loadingLocation}
                                            >
                                                {loadingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                                Locate
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 items-center">
                            <span className="font-medium text-muted-foreground">Submission Date:</span>
                            <span className="col-span-2">{signup.created_at ? new Date(signup.created_at).toLocaleString() : 'Unknown'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Documents */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {signup.documents && signup.documents.length > 0 ? (
                                <div className="grid gap-2">
                                    {signup.documents.map((doc: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-foreground">
                                                        {doc.filename}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Uploaded by {doc.uploaded_by} on {new Date(doc.uploaded_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownload(doc)}
                                                    className="gap-2 bg-background hover:bg-accent text-primary border-primary/20"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Download
                                                </Button>
                                                {session?.user?.role === 'ADMIN' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteDocument(doc.filename)}
                                                        className="gap-2 hover:bg-red-100 text-red-600"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No documents attached.</p>
                            )}

                            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                                <Input
                                    id="file-upload"
                                    type="file"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="max-w-xs cursor-pointer"
                                />
                                <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
                                    {isUploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                    Upload
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notes Section */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4 pr-1">
                            {signup.notes && signup.notes.length > 0 ? (
                                signup.notes.map((note: any, idx: number) => (
                                    <div key={idx} className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                    {note.author?.[0]?.toUpperCase() || 'A'}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold">{note.author}</p>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN' || session?.user?.name === note.author) && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                            setEditingNoteId(note.id);
                                                            setEditNoteContent(note.content);
                                                        }}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteNote(note.id)}
                                                    >
                                                        <Trash className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {editingNoteId === note.id ? (
                                            <div className="mt-2 space-y-2">
                                                <textarea
                                                    className="w-full text-sm p-2 border rounded-md"
                                                    value={editNoteContent}
                                                    onChange={(e) => setEditNoteContent(e.target.value)}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)} className="h-7">Cancel</Button>
                                                    <Button size="sm" onClick={() => handleUpdateNote(note.id)} className="h-7">Save</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap pl-8">{note.content}</p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/50">
                                    <p className="text-sm text-muted-foreground">No notes found</p>
                                    <p className="text-xs text-muted-foreground/80">Add internal notes for team collaboration</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-start bg-muted/30 p-2 rounded-lg">
                            <textarea
                                className="flex-1 min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y bg-background"
                                placeholder="Type a new note..."
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                            />
                            <Button onClick={handleAddNote} disabled={isAddingNote || !noteContent.trim()} size="icon" className="h-10 w-10 shrink-0">
                                {isAddingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {signup.processed_by && (
                <Card className={signup.status === 'APPROVED' ? "bg-green-500/5 border-green-200" : "bg-red-500/5 border-red-200"}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            Decision Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-1 text-sm">
                            <span className="font-medium text-muted-foreground">Processed By:</span>
                            <span className="col-span-2">{signup.processed_by}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-sm">
                            <span className="font-medium text-muted-foreground">Processed At:</span>
                            <span className="col-span-2">{new Date(signup.processed_at).toLocaleString()}</span>
                        </div>
                        {signup.decision_reason && (
                            <div className="grid grid-cols-3 gap-1 text-sm">
                                <span className="font-medium text-muted-foreground">Reason:</span>
                                <span className="col-span-2 italic text-muted-foreground">"{signup.decision_reason}"</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {signup.cake_affiliate_id && (
                <Card className="bg-blue-500/5 border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">CAKE Integration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-1 text-sm">
                            <span className="font-medium text-blue-900">Affiliate ID:</span>
                            <span className="col-span-2 font-mono text-blue-800">{signup.cake_affiliate_id}</span>
                        </div>
                        {signup.cake_message && (
                            <div className="grid grid-cols-3 gap-1 text-sm">
                                <span className="font-medium text-blue-900">Message:</span>
                                <span className="col-span-2 text-blue-800">{signup.cake_message}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {signup.cake_response && (
                <Card className="md:col-span-2 border-gray-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">CAKE API Raw Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-gray-950 rounded-md p-4 overflow-auto max-h-[300px]">
                            <pre className="text-xs text-gray-300 font-mono">
                                {signup.cake_response}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
