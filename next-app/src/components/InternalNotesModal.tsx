'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Pencil, Trash, X } from "lucide-react";
import { useAuthFetch } from "@/hooks/useAuthFetch";

interface InternalNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    signupId: string;
    companyName: string;
    initialNotes?: any[];
    onNotesUpdate?: (notes: any[]) => void;
}

export function InternalNotesModal({ 
    isOpen, 
    onClose, 
    signupId, 
    companyName, 
    initialNotes = [],
    onNotesUpdate
}: InternalNotesModalProps) {
    const { data: session } = useSession();
    const authFetch = useAuthFetch();
    
    const [notes, setNotes] = useState<any[]>(initialNotes);
    const [noteContent, setNoteContent] = useState("");
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editNoteContent, setEditNoteContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNotes(initialNotes);
            // If notes are empty but we have an ID, we might want to fetch just in case they were updated elsewhere
            // but for now we trust initialNotes to keep it snappy.
        }
    }, [isOpen, initialNotes]);

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        Internal Notes for <span className="text-primary">{companyName}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 min-h-[200px]">
                    {notes.length > 0 ? (
                        notes.map((note, idx) => (
                            <div key={note.id || idx} className="bg-muted/30 border rounded-lg p-3 relative group transition-all hover:shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {note.author?.[0]?.toUpperCase() || 'A'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold">{note.author}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {new Date(note.created_at).toLocaleString()}
                                                {note.updated_at && <span className="ml-1">(edited)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN' || session?.user?.name === note.author) && (
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 p-0 hover:text-primary"
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
                                                className="h-6 w-6 p-0 hover:text-destructive"
                                                onClick={() => handleDeleteNote(note.id)}
                                            >
                                                <Trash className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {editingNoteId === note.id ? (
                                    <div className="mt-2 space-y-2">
                                        <Textarea
                                            className="min-h-[60px] text-xs"
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
                                    <p className="text-sm whitespace-pre-wrap pl-8 text-foreground/90">{note.content}</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
                            <p className="text-sm text-muted-foreground font-medium">No notes yet</p>
                            <p className="text-xs text-muted-foreground/70">Team notes will appear here</p>
                        </div>
                    )}
                </div>

                <div className="p-6 pt-2 bg-background border-t">
                    <div className="flex gap-2 items-start bg-muted/40 p-2 rounded-xl border">
                        <Textarea
                            placeholder="Add an internal note..."
                            className="flex-1 min-h-[60px] bg-transparent border-none focus-visible:ring-0 text-sm resize-none"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                        />
                        <Button
                            size="icon"
                            onClick={handleAddNote}
                            disabled={isAddingNote || !noteContent.trim()}
                            className="shrink-0 h-10 w-10"
                        >
                            {isAddingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
