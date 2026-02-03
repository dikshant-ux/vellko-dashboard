'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Save, Eye, EyeOff, ShieldCheck, Smartphone, CheckCircle, AlertTriangle } from "lucide-react";
import QRCode from "react-qr-code";

export default function SettingsPage() {
    const { data: session, update } = useSession();
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

    useEffect(() => {
        if (session?.user?.name) {
            setProfile(p => ({ ...p, full_name: session.user.name || '' }));
        }
        if (session?.user?.email) {
            setProfile(p => ({ ...p, email: session.user.email || '' }));
        }
        // Ideally checking if 2FA is enabled should come from user profile API
        // For now assuming we can fetch it or it's in session if we added it
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${session?.accessToken}` }
        }).then(res => res.json()).then(data => {
            setIs2FAEnabled(data.is_two_factor_enabled || false);
        });
    }, [session]);

    const handleProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify({ full_name: profile.full_name, email: profile.email })
        })
            .then(async res => {
                if (res.ok) {
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
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify({ password: password.new })
        })
            .then(async res => {
                if (res.ok) {
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
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/setup`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.accessToken}` }
        })
            .then(res => res.json())
            .then(data => {
                setSetupData(data);
            })
            .catch(() => alert("Failed to start 2FA setup"))
            .finally(() => setLoading(false));
    };

    const confirm2FASetup = () => {
        setIsVerifying(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/enable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify({ token: otpCode, secret: setupData?.secret })
        })
            .then(async res => {
                if (res.ok) {
                    setIs2FAEnabled(true);
                    setSetupData(null);
                    setOtpCode('');
                    alert("2FA Enabled Successfully!");
                } else {
                    const err = await res.json();
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
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify({ token: code })
        })
            .then(async res => {
                if (res.ok) {
                    setIs2FAEnabled(false);
                    alert("2FA Disabled");
                } else {
                    const err = await res.json();
                    alert(err.detail || "Failed to disable");
                }
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="2fa">2FA</TabsTrigger>
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

            </Tabs>
        </div>
    );
}
