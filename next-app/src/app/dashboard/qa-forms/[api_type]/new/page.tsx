'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Trash,
    Save,
    GripVertical,
    CheckSquare,
    Type,
    List,
    ToggleLeft,
    HelpCircle,
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
import { Separator } from "@/components/ui/separator";

export default function NewQAFormPage() {
    const { api_type } = useParams();
    const { data: session } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [formName, setFormName] = useState("");
    const [questions, setQuestions] = useState<any[]>([
        { text: "", field_type: "Text", required: true, options: "" }
    ]);

    const display_name = api_type === 'web' ? 'Web Traffic' : 'Call Traffic';
    const internal_api_type = api_type === 'web' ? 'CAKE' : 'RINGBA';

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

        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/qa-forms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    name: formName,
                    api_type: internal_api_type,
                    questions: questions.map(q => ({
                        ...q,
                        options: q.field_type === 'Dropdown' ? (typeof q.options === 'string' ? q.options.split(",").map((s: string) => s.trim()).filter(Boolean) : q.options) : [],
                        file_tags: q.field_type === 'File' ? (typeof q.file_tags === 'string' ? q.file_tags.split(",").map((s: string) => s.trim()).filter(Boolean) : q.file_tags) : []
                    }))
                })
            });

            if (res.ok) {
                router.push(`/dashboard/qa-forms/${api_type}`);
            } else {
                const err = await res.json();
                alert(err.detail || "Failed to save form");
            }
        } catch (error) {
            alert("Error saving form");
        } finally {
            setIsLoading(false);
        }
    };

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
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Create {display_name} Q/A Form</h1>
                        <p className="text-gray-500 text-xs md:text-sm mt-0.5">Design a dynamic questionnaire for approvals.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 gap-2 h-11 sm:h-10"
                >
                    {isLoading ? <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Form
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
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white p-1 rounded border border-gray-200 text-gray-300 cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-4 w-4" />
                                    </div>
                                </div>
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

                                    {q.field_type === 'File' && (
                                        <div className="md:ml-10 pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">File Tags (optional, comma separated - e.g. Front, Back)</Label>
                                            <Input
                                                placeholder="ID Front, ID Back, Business License"
                                                className="border-gray-100 focus:border-red-500 h-9 text-sm"
                                                value={typeof q.file_tags === 'string' ? q.file_tags : (q.file_tags?.join(", ") || "")}
                                                onChange={(e) => updateQuestion(idx, 'file_tags', e.target.value)}
                                            />
                                            <p className="text-[10px] text-gray-400 italic">Leave empty for a single generic upload slot.</p>
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
