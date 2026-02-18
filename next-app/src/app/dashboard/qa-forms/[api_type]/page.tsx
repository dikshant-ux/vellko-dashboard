'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
    Plus,
    Search,
    MoreVertical,
    Trash,
    Eye,
    CheckCircle2,
    XCircle,
    Calendar,
    User,
    ChevronRight,
    HelpCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export default function QAFormsPage() {
    const { api_type } = useParams();
    const { data: session } = useSession();
    const router = useRouter();
    const [forms, setForms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const internal_api_type = api_type === 'web' ? 'CAKE' : 'RINGBA';
    const display_name = api_type === 'web' ? 'Web Traffic' : 'Call Traffic';

    const fetchForms = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms`, {
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                // Filter by type on client side if needed, or update API to accept type param
                const filtered = data.filter((f: any) => f.api_type === internal_api_type);
                setForms(filtered);
            }
        } catch (error) {
            console.error("Failed to fetch forms:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchForms();
        }
    }, [session, api_type]);

    const handleActivate = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/${id}/activate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });
            if (res.ok) {
                fetchForms();
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to activate form");
            }
        } catch (error) {
            alert("Error activating form");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this form?")) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`
                }
            });
            if (res.ok) {
                fetchForms();
            }
        } catch (error) {
            alert("Error deleting form");
        }
    };

    const filteredForms = forms.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <HelpCircle className="h-6 w-6 text-red-600" />
                        {display_name} Q/A Forms
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage dynamic questions for {display_name} application approvals.
                    </p>
                </div>
                <Button
                    onClick={() => router.push(`/dashboard/qa-forms/${api_type}/new`)}
                    className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Form
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-0 pt-6 px-4 md:px-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search forms..."
                                className="pl-10 bg-gray-50 border-gray-100 focus:bg-white transition-all shadow-none h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-6">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="h-8 w-8 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                        </div>
                    ) : filteredForms.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50/50">
                            <HelpCircle className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-gray-900 font-medium">No forms found</h3>
                            <p className="text-gray-500 text-sm mt-1">
                                {searchTerm ? "Try a different search term" : `Create your first ${display_name} Q/A form.`}
                            </p>
                            {!searchTerm && (
                                <Button
                                    variant="outline"
                                    className="mt-6 border-red-100 text-red-600 hover:bg-red-50"
                                    onClick={() => router.push(`/dashboard/qa-forms/${api_type}/new`)}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Form
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-50 bg-gray-50/50">
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">Form Details</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">Status</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">Questions</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">Created</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredForms.map((form) => (
                                            <tr key={form._id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                                                            {form.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400 mt-0.5">ID: {form._id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {form.status === 'Active' ? (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 shadow-none px-3 py-1 gap-1.5 capitalize rounded-full">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-50 shadow-none px-3 py-1 gap-1.5 capitalize rounded-full">
                                                            <XCircle className="h-3 w-3" />
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-medium text-gray-700">{form.questions?.length || 0}</span>
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Items</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <User className="h-3 w-3 text-gray-400" />
                                                            <span className="text-xs font-medium">{form.created_by}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-gray-400">
                                                            <Calendar className="h-3 w-3" />
                                                            <span className="text-[10px]">{new Date(form.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-full">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            {form.status !== 'Active' && (
                                                                <DropdownMenuItem className="gap-2 text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50" onClick={() => handleActivate(form._id)}>
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                    Activate Form
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/dashboard/qa-forms/${api_type}/${form._id}`)}>
                                                                <Eye className="h-4 w-4" />
                                                                View / Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => handleDelete(form._id)}>
                                                                <Trash className="h-4 w-4" />
                                                                Delete Form
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {filteredForms.map((form) => (
                                    <div key={form._id} className="p-4 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-900">{form.name}</span>
                                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">ID: {form._id}</span>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 rounded-full">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    {form.status !== 'Active' && (
                                                        <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => handleActivate(form._id)}>
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Activate Form
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem className="gap-2" onClick={() => router.push(`/dashboard/qa-forms/${api_type}/${form._id}`)}>
                                                        <Eye className="h-4 w-4" />
                                                        View / Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="gap-2 text-red-600" onClick={() => handleDelete(form._id)}>
                                                        <Trash className="h-4 w-4" />
                                                        Delete Form
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <User className="h-3 w-3 text-gray-300" />
                                                    <span className="text-[11px]">{form.created_by}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-gray-400">
                                                    <Calendar className="h-3 w-3" />
                                                    <span className="text-[10px]">{new Date(form.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {form.status === 'Active' ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none px-2 py-0.5 text-[10px] rounded-full">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-gray-50 text-gray-500 border-gray-100 shadow-none px-2 py-0.5 text-[10px] rounded-full">
                                                        Inactive
                                                    </Badge>
                                                )}
                                                <div className="text-[10px] text-gray-400 uppercase tracking-tighter">
                                                    {form.questions?.length || 0} Questions
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
