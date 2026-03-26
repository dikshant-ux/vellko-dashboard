'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Pencil, Trash } from "lucide-react";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { cn } from "@/lib/utils";

interface InternalNotesChatProps {
    signupId: string;
    initialNotes?: any[];
    onNotesUpdate?: (notes: any[]) => void;
    maxHeight?: string;
    className?: string;
}

export function InternalNotesChat({ 
    signupId, 
    initialNotes = [],
    onNotesUpdate,
    maxHeight = "400px",
    className
}: InternalNotesChatProps) {
    const { data: session } = useSession();
    const authFetch = useAuthFetch();
    
    const [notes, setNotes] = useState<any[]>(initialNotes);
    const [noteContent, setNoteContent] = useState("");
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editNoteContent, setEditNoteContent] = useState("");
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setNotes(initialNotes);
        setTimeout(scrollToBottom, 100);
    }, [initialNotes]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const handleAddNote = async () => {
        if (!noteContent.trim()) return;
        setIsAddingNote(true);
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${signupId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ note: noteContent })
            });

            if (res && res.ok) {
                const newNote = await res.json();
                const updatedNotes = [...notes, newNote];
                setNotes(updatedNotes);
                setNoteContent("");
                if (onNotesUpdate) onNotesUpdate(updatedNotes);
                setTimeout(scrollToBottom, 100);
            } else if (res) {
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
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${signupId}/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ note: editNoteContent })
            });

            if (res && res.ok) {
                const updatedNotes = notes.map((n: any) => 
                    n.id === noteId ? { ...n, content: editNoteContent, updated_at: new Date().toISOString() } : n
                );
                setNotes(updatedNotes);
                setEditingNoteId(null);
                setEditNoteContent("");
                if (onNotesUpdate) onNotesUpdate(updatedNotes);
            } else if (res) {
                alert("Failed to update note");
            }
        } catch (error) {
            console.error("Error updating note", error);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm("Are you sure you want to delete this note?")) return;
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/signups/${signupId}/notes/${noteId}`, {
                method: 'DELETE',
            });

            if (res && res.ok) {
                const updatedNotes = notes.filter((n: any) => n.id !== noteId);
                setNotes(updatedNotes);
                if (onNotesUpdate) onNotesUpdate(updatedNotes);
            } else if (res) {
                alert("Failed to delete note");
            }
        } catch (error) {
            console.error("Error deleting note", error);
        }
    };

    const isMine = (author: string) => {
        return session?.user?.name === author;
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden border border-slate-200 shadow-sm", className)}>
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
                style={{ maxHeight: maxHeight }}
            >
                {notes.length > 0 ? (
                    notes.map((note, idx) => {
                        const myMessage = isMine(note.author);
                        return (
                            <div 
                                key={note.id || idx} 
                                className={cn(
                                    "flex group animate-in fade-in slide-in-from-bottom-1",
                                    myMessage ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className={cn(
                                    "flex flex-col gap-1 max-w-[85%]",
                                    myMessage ? "items-end" : "items-start"
                                )}>
                                    {!myMessage && (
                                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                                            {note.author}
                                        </span>
                                    )}
                                    <div className={cn(
                                        "relative rounded-2xl px-4 py-2.5 shadow-sm text-sm group-hover:shadow-md transition-all duration-200",
                                        myMessage 
                                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                                            : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                    )}>
                                        {editingNoteId === note.id ? (
                                            <div className="min-w-[200px] space-y-2">
                                                <Textarea
                                                    className="min-h-[60px] text-xs bg-white text-black focus:ring-1 focus:ring-primary/20"
                                                    value={editNoteContent}
                                                    onChange={(e) => setEditNoteContent(e.target.value)}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)} className="h-7 text-xs">
                                                        Cancel
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleUpdateNote(note.id)} className="h-7 text-xs">
                                                        Save
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap leading-relaxed tracking-tight">{note.content}</p>
                                        )}
                                        
                                        {/* Delete/Edit actions on hover */}
                                        {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN' || myMessage) && (
                                            <div className={cn(
                                                "absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1",
                                                myMessage ? "-left-14" : "-right-14"
                                            )}>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full bg-white border border-slate-100 shadow-sm hover:text-primary transition-colors"
                                                    onClick={() => {
                                                        setEditingNoteId(note.id);
                                                        setEditNoteContent(note.content);
                                                    }}
                                                >
                                                    <Pencil className="h-2.5 w-2.5" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full bg-white border border-slate-100 shadow-sm hover:text-destructive transition-colors"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                >
                                                    <Trash className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-medium">
                                        {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {note.updated_at && <span className="ml-1 opacity-70 italic">(edited)</span>}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                        <Send className="h-16 w-16 mb-4 text-slate-400" />
                        <p className="text-base font-semibold text-slate-600">No messages yet</p>
                        <p className="text-sm text-slate-500">Be the first to leave a note.</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-white focus-within:border-primary/20 transition-all duration-300">
                    <Textarea
                        placeholder="Type a message..."
                        className="flex-1 min-h-[44px] max-h-[120px] bg-transparent border-none focus-visible:ring-0 text-sm resize-none py-2.5 px-3 leading-snug"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddNote();
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        onClick={handleAddNote}
                        disabled={isAddingNote || !noteContent.trim()}
                        className="shrink-0 h-10 w-10 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                        {isAddingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
