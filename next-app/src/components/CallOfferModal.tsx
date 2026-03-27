'use client';

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthFetch } from "@/hooks/useAuthFetch";

interface CallOffer {
    id?: string;
    _id?: string;
    verticals: string;
    campaign_id: string;
    campaign_name: string;
    campaign_type: string;
    payout_buffer_range: string;
    traffic_allowed: string;
    hours_of_operation: string;
    target_geo: string;
    capping: string;
    coverage?: string;
    details: string;
}

interface CallOfferModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess: () => void;
    offer?: CallOffer | null;
}

export function CallOfferModal({ open, setOpen, onSuccess, offer }: CallOfferModalProps) {
    const authFetch = useAuthFetch();
    const [formData, setFormData] = useState<Partial<CallOffer>>({
        verticals: "",
        campaign_id: "",
        campaign_name: "",
        campaign_type: "",
        payout_buffer_range: "",
        traffic_allowed: "",
        hours_of_operation: "",
        target_geo: "",
        capping: "",
        coverage: "",
        details: "",
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (offer) {
            setFormData(offer);
        } else {
            setFormData({
                verticals: "",
                campaign_id: "",
                campaign_name: "",
                campaign_type: "",
                payout_buffer_range: "",
                traffic_allowed: "",
                hours_of_operation: "",
                target_geo: "",
                capping: "",
                coverage: "",
                details: "",
            });
        }
    }, [offer, open]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const url = offer 
                ? `${process.env.NEXT_PUBLIC_API_URL}/call-offers/${offer.id || (offer as any)._id}`
                : `${process.env.NEXT_PUBLIC_API_URL}/call-offers`;
            
            const payload = {
                verticals: formData.verticals,
                campaign_id: formData.campaign_id,
                campaign_name: formData.campaign_name,
                campaign_type: formData.campaign_type,
                payout_buffer_range: formData.payout_buffer_range,
                traffic_allowed: formData.traffic_allowed,
                hours_of_operation: formData.hours_of_operation,
                target_geo: formData.target_geo,
                capping: formData.capping,
                coverage: formData.coverage || "",
                details: formData.details || "",
            };

            const res = await authFetch(url, {
                method: offer ? "PUT" : "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res && res.ok) {
                onSuccess();
                setOpen(false);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden flex flex-col max-h-[95vh]">
                <DialogHeader className="p-6 border-b shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold">{offer ? 'Edit Call Offer' : 'Create New Call Offer'}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="grid gap-6 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="campaign_id">Campaign ID</Label>
                            <Input
                                id="campaign_id"
                                value={formData.campaign_id || ""}
                                onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                                placeholder="e.g. C12345"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign_name">Campaign Name</Label>
                            <Input
                                id="campaign_name"
                                value={formData.campaign_name || ""}
                                onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                                placeholder="e.g. Solar Leads IVR"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="verticals">Verticals</Label>
                            <Input
                                id="verticals"
                                value={formData.verticals || ""}
                                onChange={(e) => setFormData({ ...formData, verticals: e.target.value })}
                                placeholder="e.g. Solar, Home Improvement"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign_type">Campaign Type</Label>
                            <Input
                                id="campaign_type"
                                value={formData.campaign_type || ""}
                                onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
                                placeholder="e.g. IVR, Warm Transfer"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="payout_buffer_range">Payout / Buffer Range</Label>
                            <Input
                                id="payout_buffer_range"
                                value={formData.payout_buffer_range || ""}
                                onChange={(e) => setFormData({ ...formData, payout_buffer_range: e.target.value })}
                                placeholder="e.g. $15 - $25 (120s)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="traffic_allowed">Traffic Allowed</Label>
                            <Input
                                id="traffic_allowed"
                                value={formData.traffic_allowed || ""}
                                onChange={(e) => setFormData({ ...formData, traffic_allowed: e.target.value })}
                                placeholder="e.g. Search, Social, PPC"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hours_of_operation">Hours of Operation</Label>
                            <Input
                                id="hours_of_operation"
                                value={formData.hours_of_operation || ""}
                                onChange={(e) => setFormData({ ...formData, hours_of_operation: e.target.value })}
                                placeholder="e.g. 9AM - 9PM EST Mon-Fri"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="target_geo">Target Geo</Label>
                            <Input
                                id="target_geo"
                                value={formData.target_geo || ""}
                                onChange={(e) => setFormData({ ...formData, target_geo: e.target.value })}
                                placeholder="e.g. USA (Nationwide)"
                            />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="capping">Capping</Label>
                            <Input
                                id="capping"
                                value={formData.capping || ""}
                                onChange={(e) => setFormData({ ...formData, capping: e.target.value })}
                                placeholder="e.g. 100/day per affiliate"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="coverage">Coverage (Comma separated)</Label>
                            <Input
                                id="coverage"
                                value={formData.coverage || ""}
                                onChange={(e) => setFormData({ ...formData, coverage: e.target.value })}
                                placeholder="e.g. CA, NY, TX, FL"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="details">Details</Label>
                        <Textarea
                            id="details"
                            value={formData.details || ""}
                            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                            placeholder="Additional details, restrictions, etc."
                            rows={3}
                        />
                    </div>
                </div>
            </div>
                <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-end gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => setOpen(false)} 
                        disabled={isSaving}
                        className="rounded-xl font-bold h-11 px-6 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving || !formData.campaign_name}
                        className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/20"
                    >
                        {isSaving ? "Saving..." : (offer ? "Update Offer" : "Create Offer")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
