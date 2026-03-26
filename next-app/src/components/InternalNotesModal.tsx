'use client';

import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
} from "@/components/ui/dialog";
import { User } from "lucide-react";
import { InternalNotesChat } from "./InternalNotesChat";

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
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                <DialogHeader className="p-4 border-b bg-card shrink-0">
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold leading-none">{companyName}</h3>
                                <p className="text-[10px] text-muted-foreground mt-1">Internal Chat</p>
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <InternalNotesChat 
                        signupId={signupId}
                        initialNotes={initialNotes}
                        onNotesUpdate={onNotesUpdate}
                        className="h-full border-none shadow-none rounded-none"
                        maxHeight="100%"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
