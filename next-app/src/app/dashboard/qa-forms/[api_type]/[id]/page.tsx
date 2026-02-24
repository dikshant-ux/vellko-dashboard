'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Trash,
    Save,
    GripVertical,
    Type,
    List,
    ToggleLeft,
    HelpCircle,
    Loader2,
    FileCode2 as File
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function EditQAFormPage() {
    const { api_type, id } = useParams();
    const { data: session } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formName, setFormName] = useState("");
    const [questions, setQuestions] = useState<any[]>([]);

    const display_name = api_type === 'web' ? 'Web Traffic' : 'Call Traffic';

    useEffect(() => {
        const fetchForm = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/${id}`, {
                    headers: {
                        Authorization: `Bearer ${session?.accessToken}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setFormName(data.name);
                    setQuestions((data.questions || []).map((q: any) => ({
                        ...q,
                        options: Array.isArray(q.options) ? q.options.join(", ") : (q.options || "")
                    })));
                } else {
                    alert("Form not found");
                    router.push(`/dashboard/qa-forms/${api_type}`);
                }
            } catch (error) {
                console.error("Failed to fetch form:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (session && id) {
            fetchForm();
        }
    }, [session, id, api_type]);

    const addQuestion = () => {
        setQuestions([...questions, { text: "", field_type: "Text", required: true, options: "" }]);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            alert("Please enter a form name");
            return;
        }
        if (questions.some(q => !q.text.trim())) {
            alert("Please fill in all question text fields");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    name: formName,
                    questions: questions.map(q => ({
                        ...q,
                        options: q.field_type === 'Dropdown' ? (typeof q.options === 'string' ? q.options.split(",").map((s: string) => s.trim()).filter(Boolean) : q.options) : []
                    }))
                })
            });

            if (res.ok) {
                router.push(`/dashboard/qa-forms/${api_type}`);
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to update form");
            }
        } catch (error) {
            alert("Error updating form");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-full h-10 w-10 hover:bg-gray-100 shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </Button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Edit {display_name} Q/A Form</h1>
                        <p className="text-gray-500 text-xs md:text-sm mt-0.5">Update your dynamic questionnaire.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 gap-2 h-11 sm:h-10"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update Form
                </Button>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
                    <div className="space-y-2">
                        <Label htmlFor="form-name" className="text-xs font-bold uppercase tracking-widest text-gray-500">Form Name</Label>
                        <Input
                            id="form-name"
                            placeholder="e.g. Standard Web Approval Form"
                            className="bg-white border-gray-200 h-11 focus:ring-red-500 focus:border-red-500 transition-all text-lg font-medium"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-red-500" />
                            Questions Breakdown
                        </h2>
                        <Button variant="outline" size="sm" onClick={addQuestion} className="bg-red-50 text-red-600 border-red-100 hover:bg-red-100 h-8 gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Add Question
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, idx) => (
                            <Card key={idx} className="border border-gray-100 shadow-none relative overflow-visible group hover:border-red-100 transition-colors">
                                <CardContent className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                        <div className="hidden md:flex md:col-span-1 items-center justify-center h-10">
                                            <span className="text-xs font-bold text-gray-300 bg-gray-50 w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>
                                        </div>
                                        <div className="md:col-span-6 space-y-2">
                                            <div className="flex items-center justify-between md:block">
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Question Text</Label>
                                                <span className="md:hidden text-[10px] font-bold text-gray-300">Question {idx + 1}</span>
                                            </div>
                                            <Input
                                                placeholder="Enter question text..."
                                                className="border-gray-100 focus:border-red-500 h-10 shadow-none transition-all"
                                                value={q.text}
                                                onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-3 space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</Label>
                                            <Select
                                                value={q.field_type}
                                                onValueChange={(val) => updateQuestion(idx, 'field_type', val)}
                                            >
                                                <SelectTrigger className="border-gray-100 h-10 shadow-none">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Text">
                                                        <div className="flex items-center gap-2">
                                                            <Type className="h-3.5 w-3.5 text-gray-400" />
                                                            Text Input
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="Dropdown">
                                                        <div className="flex items-center gap-2">
                                                            <List className="h-3.5 w-3.5 text-gray-400" />
                                                            Dropdown
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="Yes/No">
                                                        <div className="flex items-center gap-2">
                                                            <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />
                                                            Yes / No
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="File">
                                                        <div className="flex items-center gap-2">
                                                            <File className="h-3.5 w-3.5 text-gray-400" />
                                                            File Upload
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2 flex items-center md:flex-col justify-between md:justify-center gap-4 md:gap-2 pt-2 md:pt-2 border-t md:border-t-0 border-gray-50 mt-2 md:mt-0">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Required Field</Label>
                                            <Checkbox
                                                checked={q.required}
                                                onCheckedChange={(val: boolean) => updateQuestion(idx, 'required', val)}
                                                className="h-5 w-5 md:h-4 md:w-4"
                                            />
                                        </div>
                                    </div>

                                    {q.field_type === 'Dropdown' && (
                                        <div className="md:ml-10 pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dropdown Options (Comma Separated)</Label>
                                            <Input
                                                placeholder="Option 1, Option 2, Option 3"
                                                className="border-gray-100 focus:border-red-500 h-9 text-sm"
                                                value={q.options || ""}
                                                onChange={(e) => updateQuestion(idx, 'options', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {questions.length > 1 && (
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeQuestion(idx)}
                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                            >
                                                <Trash className="h-3.5 w-3.5 mr-1.5" />
                                                <span className="text-xs">Remove</span>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Button
                        variant="ghost"
                        onClick={addQuestion}
                        className="w-full border border-dashed border-gray-200 hover:border-red-200 hover:bg-red-50/30 text-gray-400 hover:text-red-600 py-8 rounded-xl transition-all"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Add New Question
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
