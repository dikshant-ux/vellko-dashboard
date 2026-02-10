'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Save, Eye, EyeOff, ShieldCheck, Smartphone, CheckCircle, AlertTriangle, Mail, Plus, Trash2, Edit, Check, X } from "lucide-react";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const authFetch = useAuthFetch();
    const [profile, setProfile] = useState({ full_name: '', email: '' });
    const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // 2FA State
    const [is2FAEnabled, setIs2FAEnabled] = useState(false); // Should fetch from profile/session
    const [setupData, setSetupData] = useState<{ secret: string, otpauth_url: string } | null>(null);
    const [otpCode, setOtpCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // SMTP State
    const [smtpConfigs, setSmtpConfigs] = useState<any[]>([]);
    const [isSmtpDialogOpen, setIsSmtpDialogOpen] = useState(false);
    const [currentSmtp, setCurrentSmtp] = useState<any | null>(null);
    const [smtpForm, setSmtpForm] = useState({
        name: '', host: '', port: 587, username: '', password: '', from_email: '', reply_to_email: '', is_active: false
    });

    useEffect(() => {
        if (session?.user?.name) {
            setProfile(p => ({ ...p, full_name: session.user.name || '' }));
        }
        if (session?.user?.email) {
            setProfile(p => ({ ...p, email: session.user.email || '' }));
        }

        if (session?.accessToken) {
            // Fetch 2FA status
            // Fetch 2FA status
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`)
                .then(res => res ? res.json() : null)
                .then(data => {
                    if (data) setIs2FAEnabled(data.is_two_factor_enabled || false);
                });

            // Fetch SMTP Configs if Admin
            if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
                fetchSmtpConfigs();
            }
        }
    }, [session]);

    const fetchSmtpConfigs = () => {
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/smtp`)
            .then(res => res && res.ok ? res.json() : [])
            .then(data => setSmtpConfigs(data || []))
            .catch(err => console.error("Failed to fetch SMTP configs", err));
    };

    const handleProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ full_name: profile.full_name, email: profile.email })
        })
            .then(async res => {
                if (res && res.ok) {
                    alert("Profile updated successfully");
                    // Ideally refresh session here
                } else {
                    alert("Failed to update profile");
                }
            })
            .catch(() => alert("Error updating profile"))
            .finally(() => setLoading(false));
    };

    const handlePasswordUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.new !== password.confirm) {
            alert("New passwords do not match");
            return;
        }

        setLoading(true);
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: password.new })
        })
            .then(async res => {
                if (res && res.ok) {
                    alert("Password updated successfully");
                    setPassword({ current: '', new: '', confirm: '' });
                } else {
                    alert("Failed to update password");
                }
            })
            .catch(() => alert("Error updating password"))
            .finally(() => setLoading(false));
    };

    const start2FASetup = () => {
        setLoading(true);
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/setup`, {
            method: 'POST',
        })
            .then(res => res ? res.json() : null)
            .then(data => {
                if (data) setSetupData(data);
            })
            .catch(() => alert("Failed to start 2FA setup"))
            .finally(() => setLoading(false));
    };

    const confirm2FASetup = () => {
        setIsVerifying(true);
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/enable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: otpCode, secret: setupData?.secret })
        })
            .then(async res => {
                if (res && res.ok) {
                    setIs2FAEnabled(true);
                    setSetupData(null);
                    setOtpCode('');
                    alert("2FA Enabled Successfully!");
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    alert(err.detail || "Invalid Code");
                }
            })
            .finally(() => setIsVerifying(false));
    };

    const disable2FA = () => {
        if (!confirm("Are you sure you want to disable 2FA?")) return;

        // In a real app, we might ask for a code to disable it too
        // For now, let's assume we send a code if we have one or just disable (less secure)
        // Adjusting based on backend 'disable' endpoint which requires a code 
        // We need to implement a UI to ask for code to disable.
        // For simplicity let's assume user is authenticated and we trust them or add a prompt.
        const code = prompt("Enter your 2FA code to disable it:");
        if (!code) return;

        setLoading(true);
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: code })
        })
            .then(async res => {
                if (res && res.ok) {
                    setIs2FAEnabled(false);
                    alert("2FA Disabled");
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    alert(err.detail || "Failed to disable");
                }
            })
            .finally(() => setLoading(false));
    };

    const handleOpenSmtpDialog = (config: any = null) => {
        if (config) {
            setCurrentSmtp(config);
            setSmtpForm({
                name: config.name || '',
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                from_email: config.from_email,
                reply_to_email: config.reply_to_email || '',
                is_active: config.is_active
            });
        } else {
            setCurrentSmtp(null);
            setSmtpForm({
                name: '', host: '', port: 587, username: '', password: '', from_email: '', reply_to_email: '', is_active: false
            });
        }
        setIsSmtpDialogOpen(true);
    };

    const handleSaveSmtp = () => {
        setLoading(true);
        const url = currentSmtp
            ? `${process.env.NEXT_PUBLIC_API_URL}/admin/settings/smtp/${currentSmtp._id}`
            : `${process.env.NEXT_PUBLIC_API_URL}/admin/settings/smtp`;

        const method = currentSmtp ? 'PUT' : 'POST';

        authFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(smtpForm)
        })
            .then(async res => {
                if (res && res.ok) {
                    alert(`SMTP Configuration ${currentSmtp ? 'updated' : 'created'} successfully`);
                    setIsSmtpDialogOpen(false);
                    fetchSmtpConfigs();
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    alert(err.detail || "Failed to save SMTP config");
                }
            })
            .catch(() => alert("Error saving SMTP config"))
            .finally(() => setLoading(false));
    };

    const handleDeleteSmtp = (id: string) => {
        if (!confirm("Are you sure you want to delete this SMTP configuration?")) return;

        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/smtp/${id}`, {
            method: 'DELETE',
        })
            .then(res => {
                if (res && res.ok) {
                    fetchSmtpConfigs();
                } else {
                    alert("Failed to delete config");
                }
            });
    };

    const handleActivateSmtp = (id: string) => {
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/smtp/${id}/activate`, {
            method: 'POST',
        })
            .then(res => {
                if (res && res.ok) {
                    fetchSmtpConfigs();
                } else {
                    alert("Failed to activate config");
                }
            });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="flex flex-wrap h-auto w-full grid-cols-2 md:grid-cols-4 max-w-[550px]">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="2fa">2FA</TabsTrigger>
                    {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') && (
                        <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="profile" className="mt-6">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-[500px]">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            value={profile.full_name}
                                            onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        value={profile.email}
                                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                                    />
                                </div>
                                <div className="pt-2">
                                    <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                                        <Save className="mr-2 h-4 w-4" /> Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>Security</CardTitle>
                            <CardDescription>Update your password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-[500px]">
                                <div className="space-y-2">
                                    <Label>New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type={showNewPassword ? "text" : "password"}
                                            className="pl-9 pr-10"
                                            value={password.new}
                                            onChange={e => setPassword({ ...password, new: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type={showConfirmPassword ? "text" : "password"}
                                            className="pl-9 pr-10"
                                            value={password.confirm}
                                            onChange={e => setPassword({ ...password, confirm: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                                        <Save className="mr-2 h-4 w-4" /> Update Password
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="2fa" className="mt-6">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-red-600" />
                                Two-Factor Authentication
                            </CardTitle>
                            <CardDescription>Add an extra layer of security to your account.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6 max-w-[600px]">
                                {is2FAEnabled ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <div>
                                            <h3 className="font-semibold text-green-900">2FA is Enabled</h3>
                                            <p className="text-sm text-green-700 mt-1">Your account is secured. You will be asked for a code when you log in.</p>
                                            <Button
                                                onClick={disable2FA}
                                                variant="outline"
                                                className="mt-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                            >
                                                Disable 2FA
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <Smartphone className="h-5 w-5 text-gray-600 mt-0.5" />
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">Secure your account</h3>
                                                    <p className="text-sm text-gray-600 mt-1 mb-3">
                                                        Use an authenticator app (like Google Authenticator or Authy) to generate verification codes.
                                                    </p>
                                                    {!setupData && (
                                                        <Button onClick={start2FASetup} disabled={loading}>
                                                            Setup 2FA
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {setupData && (
                                            <div className="border border-gray-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-4">
                                                <h3 className="font-semibold text-lg mb-4">Scan QR Code</h3>
                                                <div className="flex flex-col md:flex-row gap-6 items-center">
                                                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                        <QRCode value={setupData.otpauth_url} size={160} />
                                                    </div>
                                                    <div className="flex-1 space-y-4 w-full">
                                                        <div>
                                                            <Label>1. Scan the code</Label>
                                                            <p className="text-sm text-muted-foreground">Open your authenticator app and scan the image.</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>2. Enter Verification Code</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={otpCode}
                                                                    onChange={(e) => setOtpCode(e.target.value)}
                                                                    placeholder="000 000"
                                                                    className="font-mono tracking-widest text-center text-lg"
                                                                    maxLength={6}
                                                                />
                                                                <Button onClick={confirm2FASetup} disabled={isVerifying || otpCode.length < 6}>
                                                                    {isVerifying ? "Verifying..." : "Verify & Enable"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') && (
                    <TabsContent value="smtp" className="mt-6">
                        <Card className="border-none shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mail className="h-5 w-5 text-red-600" />
                                        SMTP Settings
                                    </CardTitle>
                                    <CardDescription>Manage your email sending configurations.</CardDescription>
                                </div>
                                <Button onClick={() => handleOpenSmtpDialog()} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                                    <Plus className="h-4 w-4 mr-2" /> Add SMTP
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Host</TableHead>
                                                <TableHead>Username</TableHead>
                                                <TableHead>From Email</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {smtpConfigs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                                        No SMTP configurations found. System using defaults (if set).
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                smtpConfigs.map((config) => (
                                                    <TableRow key={config._id}>
                                                        <TableCell className="font-medium">
                                                            {config.name || 'SMTP Configuration'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {config.host}:{config.port}
                                                        </TableCell>
                                                        <TableCell>{config.username}</TableCell>
                                                        <TableCell>{config.from_email}</TableCell>
                                                        <TableCell>
                                                            {config.is_active ? (
                                                                <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {!config.is_active && (
                                                                    <Button variant="ghost" size="icon" onClick={() => handleActivateSmtp(config._id)} title="Activate">
                                                                        <Check className="h-4 w-4 text-green-600" />
                                                                    </Button>
                                                                )}
                                                                <Button variant="ghost" size="icon" onClick={() => handleOpenSmtpDialog(config)}>
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteSmtp(config._id)}>
                                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Dialog open={isSmtpDialogOpen} onOpenChange={setIsSmtpDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{currentSmtp ? 'Edit SMTP Configuration' : 'Add New SMTP Configuration'}</DialogTitle>
                                    <DialogDescription>
                                        Enter your SMTP server details below.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Configuration Name</Label>
                                        <Input id="name" value={smtpForm.name} onChange={e => setSmtpForm({ ...smtpForm, name: e.target.value })} placeholder="e.g. Gmail - Marketing" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="host">Host</Label>
                                            <Input id="host" value={smtpForm.host} onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })} placeholder="smtp.example.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="port">Port</Label>
                                            <Input id="port" type="number" value={smtpForm.port} onChange={e => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) })} placeholder="587" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Username</Label>
                                        <Input id="username" value={smtpForm.username} onChange={e => setSmtpForm({ ...smtpForm, username: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showNewPassword ? "text" : "password"}
                                                value={smtpForm.password}
                                                onChange={e => setSmtpForm({ ...smtpForm, password: e.target.value })}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="from_email">From Email</Label>
                                        <Input id="from_email" value={smtpForm.from_email} onChange={e => setSmtpForm({ ...smtpForm, from_email: e.target.value })} placeholder="noreply@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reply_to_email">Reply-To Email (Optional)</Label>
                                        <Input id="reply_to_email" value={smtpForm.reply_to_email} onChange={e => setSmtpForm({ ...smtpForm, reply_to_email: e.target.value })} placeholder="support@example.com" />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="is_active"
                                            checked={smtpForm.is_active}
                                            onChange={e => setSmtpForm({ ...smtpForm, is_active: e.target.checked })}
                                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                        />
                                        <Label htmlFor="is_active" className="cursor-pointer">Set as Active SMTP</Label>
                                        {smtpForm.is_active && (
                                            <span className="text-xs text-yellow-600 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> Will deactivate others
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsSmtpDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleSaveSmtp} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                                        {loading ? "Saving..." : "Save Configuration"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TabsContent>
                )}

            </Tabs>
        </div>
    );
}
