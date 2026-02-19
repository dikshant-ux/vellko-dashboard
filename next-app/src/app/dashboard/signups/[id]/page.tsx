'use client';

import { useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Loader2, FileText, Upload, Download, RotateCcw, Pencil, Save, Trash, MapPin, Clock, User, Calendar, MessageSquare, Send, Eye, HelpCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    const [apiSelection, setApiSelection] = useState({ cake: true, ringba: true });
    const [showApiSelection, setShowApiSelection] = useState(false);

    // Q/A Forms States
    const [cakeQAForm, setCakeQAForm] = useState<any>(null);
    const [ringbaQAForm, setRingbaQAForm] = useState<any>(null);
    const [cakeQAResponses, setCakeQAResponses] = useState<any>({});
    const [ringbaQAResponses, setRingbaQAResponses] = useState<any>({});
    const [isFetchingQA, setIsFetchingQA] = useState(false);

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

        // Client-side validation
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const fileExt = '.' + uploadFile.name.split('.').pop()?.toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            alert(`File type not allowed. Supported types: ${allowedExtensions.join(', ')}`);
            return;
        }

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

    const handleView = (doc: any) => {
        const url = `${process.env.NEXT_PUBLIC_API_URL}${doc.path}`;
        window.open(url, '_blank');
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
            a.download = doc.filename;
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

    const initiateAction = (action: 'approve' | 'reject' | 'request_approval', target?: 'cake' | 'ringba') => {
        setPendingAction(action);
        setDecisionReason("");

        // Reset QA states to avoid showing stale data from previous actions
        setCakeQAForm(null);
        setRingbaQAForm(null);
        setCakeQAResponses({});
        setRingbaQAResponses({});

        if (target) {
            // Granular Action triggered from specific card
            if (target === 'cake') {
                setApiSelection({ cake: true, ringba: false });
            } else {
                setApiSelection({ cake: false, ringba: true });
            }
            setShowApiSelection(false); // Hide selection when specific action is triggered
            setIsDecisionOpen(true);

            // FETCH QA FORMS
            if (['approve', 'request_approval', 'reject'].includes(action)) {
                fetchQAForms();
            }
            return;
        }

        if (['approve', 'request_approval', 'reject'].includes(action)) {
            const appType = signup.marketingInfo?.applicationType;
            const userPermission = session?.user?.application_permission;

            if (appType === 'Call Traffic') {
                setApiSelection({ cake: false, ringba: true });
                setShowApiSelection(false);
            } else if (appType === 'Web Traffic') {
                setApiSelection({ cake: true, ringba: false });
                setShowApiSelection(false);
            } else if (appType === 'Both') {
                // Smart Granular Logic using Boolean Status
                const isCakeDone = signup.cake_api_status === true || signup.cake_api_status === false || !!signup.cake_affiliate_id;
                const isRingbaDone = signup.ringba_api_status === true || signup.ringba_api_status === false || !!signup.ringba_affiliate_id;

                if (userPermission === 'Web Traffic') {
                    setApiSelection({ cake: true, ringba: false });
                    setShowApiSelection(false);
                } else if (userPermission === 'Call Traffic') {
                    setApiSelection({ cake: false, ringba: true });
                    setShowApiSelection(false);
                } else {
                    // Both or Super Admin - Default Smart Selection logic retained for "Global" actions if any
                    setApiSelection({
                        cake: !isCakeDone,
                        ringba: !isRingbaDone
                    });
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

        // Fetch Q/A Forms if it's a qualifying action
        if (['approve', 'request_approval', 'reject'].includes(action)) {
            fetchQAForms();
        }
    };

    const fetchQAForms = async () => {
        setIsFetchingQA(true);
        console.log("Fetching QA forms...");
        try {
            // Fetch both in parallel
            const [cakeRes, ringbaRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/active/CAKE`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/active/RINGBA`, {
                    headers: { Authorization: `Bearer ${session?.accessToken}` }
                })
            ]);

            console.log("CAKE Response:", cakeRes.status, cakeRes.ok);
            console.log("RINGBA Response:", ringbaRes.status, ringbaRes.ok);

            if (cakeRes.ok) {
                const data = await cakeRes.json();
                console.log("CAKE Data:", data);
                if (data && data.questions) {
                    setCakeQAForm(data);
                    // Initialize responses
                    const initial: any = {};
                    data.questions.forEach((q: any) => initial[q.id] = q.field_type === 'Yes/No' ? 'No' : '');
                    setCakeQAResponses(initial);
                } else {
                    setCakeQAForm(null);
                }
            } else {
                setCakeQAForm(null);
            }

            if (ringbaRes.ok) {
                const data = await ringbaRes.json();
                console.log("RINGBA Data:", data);
                if (data && data.questions) {
                    setRingbaQAForm(data);
                    // Initialize responses
                    const initial: any = {};
                    data.questions.forEach((q: any) => initial[q.id] = q.field_type === 'Yes/No' ? 'No' : '');
                    setRingbaQAResponses(initial);
                } else {
                    setRingbaQAForm(null);
                }
            } else {
                setRingbaQAForm(null);
            }
        } catch (error) {
            console.error("Error fetching QA forms:", error);
        } finally {
            setIsFetchingQA(false);
        }
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

        // QA Form Validation
        if (['approve', 'request_approval', 'reject'].includes(pendingAction)) {
            if (apiSelection.cake && cakeQAForm) {
                for (const q of cakeQAForm.questions) {
                    if (q.required && !cakeQAResponses[q.id]) {
                        alert(`Please answer the required question for Cake: "${q.text}"`);
                        return;
                    }
                }
            }
            if (apiSelection.ringba && ringbaQAForm) {
                for (const q of ringbaQAForm.questions) {
                    if (q.required && !ringbaQAResponses[q.id]) {
                        alert(`Please answer the required question for Ringba: "${q.text}"`);
                        return;
                    }
                }
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
                    addToRingba: apiSelection.ringba,
                    cake_qa_responses: apiSelection.cake && cakeQAForm ? cakeQAForm.questions.map((q: any) => ({
                        question_text: q.text,
                        answer: cakeQAResponses[q.id],
                        required: q.required
                    })) : null,
                    ringba_qa_responses: apiSelection.ringba && ringbaQAForm ? ringbaQAForm.questions.map((q: any) => ({
                        question_text: q.text,
                        answer: ringbaQAResponses[q.id],
                        required: q.required
                    })) : null
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

            if (cake === 'APPROVED' && ringba === 'APPROVED') return 'APPROVED';

            // Refined Partial Logic
            if ((cake === 'APPROVED' && ringba === 'REJECTED') || (ringba === 'APPROVED' && cake === 'REJECTED')) {
                return 'APPROVED (PARTIAL)';
            }

            if (cake === 'APPROVED' || ringba === 'APPROVED') return 'PARTIALLY APPROVED';

            // If both failed/pending but admin hasn't rejected, it's still PENDING (but might be failed)
            if ((cake === 'FAILED' || cake == null) && (ringba === 'FAILED' || ringba == null)) {
                if (cake === 'FAILED' || ringba === 'FAILED') return 'FAILED (PENDING)';
                return 'PENDING';
            }

            if (cake === 'REJECTED' && ringba === 'REJECTED') return 'REJECTED';

            return signup.status;
        }

        // If specific permission, only care about that status
        if (userPermission === 'Web Traffic') {
            if (signup.cake_api_status === 'APPROVED') return 'APPROVED';
            if (signup.cake_api_status === 'REJECTED') return 'REJECTED';
            if (signup.cake_api_status === 'FAILED') return 'FAILED (PENDING)';
            return 'PENDING';
        }

        if (userPermission === 'Call Traffic') {
            if (signup.ringba_api_status === 'APPROVED') return 'APPROVED';
            if (signup.ringba_api_status === 'REJECTED') return 'REJECTED';
            if (signup.ringba_api_status === 'FAILED') return 'FAILED (PENDING)';
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
            "FAILED (PENDING)": "bg-red-50 text-red-600 border-red-200 hover:bg-red-50",
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
                        {/* Granular Status Badges (Boolean) - Always show for Both type users */}
                        {(signup.marketingInfo?.applicationType === 'Both' && session?.user?.can_approve_signups) && (
                            <div className="flex gap-2 text-xs">
                                <Badge variant="outline" className={
                                    signup.cake_api_status === 'APPROVED' ? "border-green-500 text-green-600 bg-green-50" :
                                        signup.cake_api_status === 'REJECTED' ? "border-red-500 text-red-600 bg-red-50" :
                                            signup.cake_api_status === 'FAILED' ? "border-red-300 text-red-500 bg-red-50" :
                                                "border-yellow-500 text-yellow-600 bg-yellow-50"
                                }>Cake: {signup.cake_api_status === 'APPROVED' ? 'Approved' : signup.cake_api_status === 'REJECTED' ? 'Rejected' : signup.cake_api_status === 'FAILED' ? 'Failed' : 'Pending'}</Badge>

                                <Badge variant="outline" className={
                                    signup.ringba_api_status === 'APPROVED' ? "border-green-500 text-green-600 bg-green-50" :
                                        signup.ringba_api_status === 'REJECTED' ? "border-red-500 text-red-600 bg-red-50" :
                                            signup.ringba_api_status === 'FAILED' ? "border-red-300 text-red-500 bg-red-50" :
                                                "border-yellow-500 text-yellow-600 bg-yellow-50"
                                }>Ringba: {signup.ringba_api_status === 'APPROVED' ? 'Approved' : signup.ringba_api_status === 'REJECTED' ? 'Rejected' : signup.ringba_api_status === 'FAILED' ? 'Failed' : 'Pending'}</Badge>
                            </div>
                        )}
                    </div>
                    {/* Non-Admin Actions: Request Approval */}
                    {!session?.user?.can_approve_signups && signup.status === 'PENDING' && (
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => initiateAction('request_approval')}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'request_approval' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            Request Approval
                        </Button>
                    )}
                    {session?.user?.can_approve_signups && (
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
                </div>
            </div>

            {/* Decision Cards - Granularity & Actions */}
            {session?.user?.can_approve_signups && (signup.status === 'PENDING' || signup.status === 'APPROVED' || signup.status === 'PARTIALLY APPROVED' || signup.status === 'APPROVED (PARTIAL)' || signup.status === 'REQUESTED_FOR_APPROVAL') && (
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Cake Card */}
                        {(signup.marketingInfo?.applicationType === 'Both' || signup.marketingInfo?.applicationType === 'Web Traffic') && (
                            <Card className={`border-l-4 ${signup.cake_api_status === true ? 'border-l-green-500' : signup.cake_api_status === false ? 'border-l-red-500' : 'border-l-yellow-500'} shadow-sm`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-semibold flex items-center justify-between">
                                        <span>Cake (Web Traffic)</span>
                                        <Badge variant="outline" className={
                                            signup.cake_api_status === 'APPROVED' ? "text-green-600 bg-green-50 border-green-200" :
                                                signup.cake_api_status === 'REJECTED' ? "text-red-700 bg-red-50 border-red-200" :
                                                    signup.cake_api_status === 'FAILED' ? "text-red-500 bg-red-50 border-red-100" :
                                                        "text-yellow-600 bg-yellow-50 border-yellow-200"
                                        }>
                                            {signup.cake_api_status === 'APPROVED' ? 'Approved' : signup.cake_api_status === 'REJECTED' ? 'Rejected' : signup.cake_api_status === 'FAILED' ? 'Failed' : 'Pending'}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                {signup.cake_affiliate_id ? (
                                                    <span className="font-mono bg-muted px-2 py-1 rounded">ID: {signup.cake_affiliate_id}</span>
                                                ) : (
                                                    <span>No Affiliate ID yet</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {session?.user?.can_approve_signups &&
                                                    (['Web Traffic', 'Both'].includes(session?.user?.application_permission || '')) && (
                                                        <>
                                                            {!signup.cake_affiliate_id && (
                                                                <>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => initiateAction('reject', 'cake')}
                                                                        disabled={!!actionLoading}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => initiateAction('approve', 'cake')}
                                                                        disabled={!!actionLoading}
                                                                    >
                                                                        {signup.cake_api_status === 'FAILED' ? 'Retry Approval' : 'Approve'}
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </>
                                                    )
                                                }
                                            </div>
                                        </div>

                                        {(signup.cake_decision_reason || signup.cake_processed_by) && (
                                            <div className="pt-4 border-t space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                    <div className="text-sm">
                                                        <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Decision Reason</p>
                                                        <p className="mt-0.5">{signup.cake_decision_reason || 'No reason provided'}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <div className="text-xs">
                                                            <p className="text-muted-foreground uppercase tracking-wider">Processed By</p>
                                                            <p className="font-medium">{signup.cake_processed_by || 'System'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <div className="text-xs">
                                                            <p className="text-muted-foreground uppercase tracking-wider">Date</p>
                                                            <p className="font-medium">{signup.cake_processed_at ? new Date(signup.cake_processed_at).toLocaleDateString() : 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Ringba Card */}
                        {(signup.marketingInfo?.applicationType === 'Both' || signup.marketingInfo?.applicationType === 'Call Traffic') && (
                            <Card className={`border-l-4 ${signup.ringba_api_status === true ? 'border-l-green-500' : signup.ringba_api_status === false ? 'border-l-red-500' : 'border-l-yellow-500'} shadow-sm`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-semibold flex items-center justify-between">
                                        <span>Ringba (Call Traffic)</span>
                                        <Badge variant="outline" className={
                                            signup.ringba_api_status === 'APPROVED' ? "text-green-600 bg-green-50 border-green-200" :
                                                signup.ringba_api_status === 'REJECTED' ? "text-red-700 bg-red-50 border-red-200" :
                                                    signup.ringba_api_status === 'FAILED' ? "text-red-500 bg-red-50 border-red-100" :
                                                        "text-yellow-600 bg-yellow-50 border-yellow-200"
                                        }>
                                            {signup.ringba_api_status === 'APPROVED' ? 'Approved' : signup.ringba_api_status === 'REJECTED' ? 'Rejected' : signup.ringba_api_status === 'FAILED' ? 'Failed' : 'Pending'}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                {signup.ringba_affiliate_id ? (
                                                    <span className="font-mono bg-muted px-2 py-1 rounded">ID: {signup.ringba_affiliate_id}</span>
                                                ) : (
                                                    <span>No Affiliate ID yet</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {session?.user?.can_approve_signups &&
                                                    (['Call Traffic', 'Both'].includes(session?.user?.application_permission || '')) && (
                                                        <>
                                                            {!signup.ringba_affiliate_id && (
                                                                <>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => initiateAction('reject', 'ringba')}
                                                                        disabled={!!actionLoading}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => initiateAction('approve', 'ringba')}
                                                                        disabled={!!actionLoading}
                                                                    >
                                                                        {signup.ringba_api_status === 'FAILED' ? 'Retry Approval' : 'Approve'}
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </>
                                                    )
                                                }
                                            </div>
                                        </div>

                                        {(signup.ringba_decision_reason || signup.ringba_processed_by) && (
                                            <div className="pt-4 border-t space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                    <div className="text-sm">
                                                        <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Decision Reason</p>
                                                        <p className="mt-0.5">{signup.ringba_decision_reason || 'No reason provided'}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <div className="text-xs">
                                                            <p className="text-muted-foreground uppercase tracking-wider">Processed By</p>
                                                            <p className="font-medium">{signup.ringba_processed_by || 'System'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <div className="text-xs">
                                                            <p className="text-muted-foreground uppercase tracking-wider">Date</p>
                                                            <p className="font-medium">{signup.ringba_processed_at ? new Date(signup.ringba_processed_at).toLocaleDateString() : 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {signup.status === 'REJECTED' && (
                <div className="flex gap-2 justify-end">
                    {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'reset' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                            Reset to Pending
                        </Button>
                    )}
                    {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && (
                        <Button
                            onClick={() => initiateAction('approve')}
                            disabled={!!actionLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {actionLoading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Approve Re-Application
                        </Button>
                    )}
                </div>
            )}
            {session?.user?.role === 'SUPER_ADMIN' && (
                <div className="flex justify-end mt-4">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={!!actionLoading}
                    >
                        {actionLoading === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                        Delete Application
                    </Button>
                </div>
            )}

            <Dialog open={isDecisionOpen} onOpenChange={setIsDecisionOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                            <Label htmlFor="reason" className="text-sm font-medium">Internal Note / Reason</Label>
                            <Textarea
                                id="reason"
                                placeholder={pendingAction === 'request_approval' ? "Add notes for the admin..." : (pendingAction === 'approve' ? "Optional approval notes..." : "Reason for rejection...")}
                                value={decisionReason}
                                onChange={(e) => setDecisionReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>

                        {/* Dynamic QA Forms */}
                        {isFetchingQA ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                                <span className="ml-2 text-sm text-gray-500">Loading Q/A Forms...</span>
                            </div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-6">
                                {apiSelection.cake && cakeQAForm && (
                                    <div className="space-y-4 pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <HelpCircle className="h-4 w-4" />
                                            <h3 className="text-sm font-bold uppercase tracking-wider">{cakeQAForm.name} (Web)</h3>
                                        </div>
                                        <div className="space-y-4 ml-1 pl-3 md:ml-2 md:pl-4 border-l-2 border-red-50">
                                            {cakeQAForm.questions.map((q: any) => (
                                                <div key={q.id} className="space-y-1.5">
                                                    <Label className="text-sm">
                                                        {q.text} {q.required && <span className="text-red-500">*</span>}
                                                    </Label>
                                                    {q.field_type === 'Dropdown' ? (
                                                        <Select
                                                            value={cakeQAResponses[q.id]}
                                                            onValueChange={(val) => setCakeQAResponses({ ...cakeQAResponses, [q.id]: val })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select an option" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {q.options?.map((opt: string) => (
                                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : q.field_type === 'Yes/No' ? (
                                                        <Select
                                                            value={cakeQAResponses[q.id]}
                                                            onValueChange={(val) => setCakeQAResponses({ ...cakeQAResponses, [q.id]: val })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Yes">Yes</SelectItem>
                                                                <SelectItem value="No">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            className="h-9"
                                                            value={cakeQAResponses[q.id]}
                                                            onChange={(e) => setCakeQAResponses({ ...cakeQAResponses, [q.id]: e.target.value })}
                                                            placeholder="Enter answer..."
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {apiSelection.ringba && ringbaQAForm && (
                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <HelpCircle className="h-4 w-4" />
                                            <h3 className="text-sm font-bold uppercase tracking-wider">{ringbaQAForm.name} (Call)</h3>
                                        </div>
                                        <div className="space-y-4 ml-2 pl-4 border-l-2 border-red-50">
                                            {ringbaQAForm.questions.map((q: any) => (
                                                <div key={q.id} className="space-y-1.5">
                                                    <Label className="text-sm">
                                                        {q.text} {q.required && <span className="text-red-500">*</span>}
                                                    </Label>
                                                    {q.field_type === 'Dropdown' ? (
                                                        <Select
                                                            value={ringbaQAResponses[q.id]}
                                                            onValueChange={(val) => setRingbaQAResponses({ ...ringbaQAResponses, [q.id]: val })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select an option" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {q.options?.map((opt: string) => (
                                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : q.field_type === 'Yes/No' ? (
                                                        <Select
                                                            value={ringbaQAResponses[q.id]}
                                                            onValueChange={(val) => setRingbaQAResponses({ ...ringbaQAResponses, [q.id]: val })}
                                                        >
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Yes">Yes</SelectItem>
                                                                <SelectItem value="No">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            className="h-9"
                                                            value={ringbaQAResponses[q.id]}
                                                            onChange={(e) => setRingbaQAResponses({ ...ringbaQAResponses, [q.id]: e.target.value })}
                                                            placeholder="Enter answer..."
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
                                    {signup.companyInfo?.corporateWebsite ? (() => {
                                        // SECURITY FIX: Only render real http/https URLs as clickable links.
                                        // Prevents Stored XSS from javascript: or data: URLs in pre-existing DB records.
                                        const url = signup.companyInfo.corporateWebsite;
                                        const isHttpUrl = /^https?:\/\//i.test(url);
                                        return isHttpUrl
                                            ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                                            : <span className="text-muted-foreground">{url}</span>;
                                    })() : '-'}
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
                    </CardContent >
                </Card >

                {/* Documents */}
                < Card className="md:col-span-2" >
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
                                                    onClick={() => handleView(doc)}
                                                    className="gap-2 bg-background hover:bg-accent text-primary border-primary/20"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    View
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownload(doc)}
                                                    className="gap-2 bg-background hover:bg-accent text-primary border-primary/20"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Download
                                                </Button>
                                                {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') && (
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
                                    accept=".pdf,.doc,.docx,.zip,image/*"
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
                </Card >

                {/* Notes Section */}
                < Card className="md:col-span-2" >
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
                </Card >
            </div >

            {
                signup.processed_by && (
                    <Card className={signup.status === 'APPROVED' ? "bg-emerald-500/5 border-emerald-200" : signup.status === 'REJECTED' ? "bg-red-500/5 border-red-200" : "bg-blue-500/5 border-blue-200"}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                Decision Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Processed By</p>
                                    <p className="text-sm font-semibold">{signup.processed_by}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Processed At</p>
                                    <p className="text-sm font-semibold">{new Date(signup.processed_at).toLocaleString()}</p>
                                </div>
                                {signup.decision_reason && (
                                    <div className="space-y-1 lg:col-span-1">
                                        <p className="text-xs font-medium text-muted-foreground">Internal Note</p>
                                        <p className="text-sm italic">"{signup.decision_reason}"</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Integration Details Grid */}
            {
                (signup.cake_affiliate_id || signup.ringba_affiliate_id || signup.cake_qa_responses || signup.ringba_qa_responses) && (
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Q/A Responses Section */}
                        {signup.cake_qa_responses && signup.cake_qa_responses.length > 0 && (
                            <Card className="border-red-100 bg-red-50/20">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                                        <HelpCircle className="h-4 w-4" />
                                        Cake Approval Q/A
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {signup.cake_qa_responses.map((res: any, idx: number) => (
                                        <div key={idx} className="space-y-1">
                                            <p className="text-xs font-medium text-gray-500">{res.question_text}</p>
                                            <p className="text-sm text-gray-900 border-l-2 border-red-200 pl-3 py-0.5">{res.answer || '-'}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {signup.ringba_qa_responses && signup.ringba_qa_responses.length > 0 && (
                            <Card className="border-red-100 bg-red-50/20">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                                        <HelpCircle className="h-4 w-4" />
                                        Ringba Approval Q/A
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {signup.ringba_qa_responses.map((res: any, idx: number) => (
                                        <div key={idx} className="space-y-1">
                                            <p className="text-xs font-medium text-gray-500">{res.question_text}</p>
                                            <p className="text-sm text-gray-900 border-l-2 border-red-200 pl-3 py-0.5">{res.answer || '-'}</p>
                                        </div>
                                    ))}
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

                        {signup.ringba_affiliate_id && (
                            <Card className="bg-purple-500/5 border-purple-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold">Ringba Integration</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-3 gap-1 text-sm">
                                        <span className="font-medium text-purple-900">Affiliate ID:</span>
                                        <span className="col-span-2 font-mono text-purple-800">{signup.ringba_affiliate_id}</span>
                                    </div>
                                    {signup.ringba_message && (
                                        <div className="grid grid-cols-3 gap-1 text-sm">
                                            <span className="font-medium text-purple-900">Message:</span>
                                            <span className="col-span-2 text-purple-800">{signup.ringba_message}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )
            }

            {/* API Raw Responses Grid */}
            {
                (signup.cake_response || signup.ringba_response) && (
                    <div className="grid gap-6 md:grid-cols-2">
                        {signup.cake_response && (
                            <Card className="border-gray-200">
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

                        {signup.ringba_response && (
                            <Card className="border-gray-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold">Ringba API Raw Response</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-gray-950 rounded-md p-4 overflow-auto max-h-[300px]">
                                        <pre className="text-xs text-gray-300 font-mono">
                                            {signup.ringba_response}
                                        </pre>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )
            }
        </div >
    );
}
