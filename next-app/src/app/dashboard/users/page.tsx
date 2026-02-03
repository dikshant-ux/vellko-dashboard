'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, User as UserIcon, Eye, EyeOff, Loader2, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', email: '', role: 'USER' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchUsers = () => {
        if (session?.accessToken) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${session.accessToken}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setUsers(data);
                    } else {
                        console.error("Failed to fetch users:", data);
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [session]);

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify(newUser)
        })
            .then(async res => {
                if (res.ok) {
                    setOpen(false);
                    setNewUser({ username: '', password: '', full_name: '', email: '', role: 'USER' });
                    toast.success("User invited successfully!");
                    fetchUsers();
                } else {
                    const err = await res.json();
                    toast.error(err.detail || "Failed to create user");
                }
            })
            .catch(err => toast.error("Error creating user"))
            .finally(() => setIsSubmitting(false));
    };

    const handleDeleteUser = (username: string) => {
        if (!confirm(`Are you sure you want to delete ${username}?`)) return;

        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${username}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session?.accessToken}` }
        })
            .then(res => {
                if (res.ok) {
                    toast.success("User deleted successfully");
                    fetchUsers();
                } else {
                    toast.error("Failed to delete user");
                }
            });
    };

    const handleToggleStatus = (username: string, currentStatus: boolean | undefined) => {
        // currentStatus is 'disabled' (true/false)
        const newDisabledStatus = !currentStatus;
        const action = newDisabledStatus ? 'deactivate' : 'activate';

        if (!confirm(`Are you sure you want to ${action} ${username}?`)) return;

        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${username}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
            },
            body: JSON.stringify({ disabled: newDisabledStatus })
        })
            .then(async res => {
                if (res.ok) {
                    toast.success(`User ${action}d successfully`);
                    fetchUsers();
                } else {
                    const err = await res.json();
                    toast.error(err.detail || `Failed to ${action} user`);
                }
            })
            .catch(() => toast.error(`Error trying to ${action} user`));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1">Manage system access and roles.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white">
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Username</Label>
                                <Input required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="jdoe" />
                            </div>
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input required value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USER">User</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="pt-4 flex justify-end">
                                <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create User
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-none shadow-md">
                <CardHeader>
                    <CardTitle>System Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading users...</TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.username}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                                                    {user.full_name?.charAt(0) || user.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{user.full_name || user.username}</div>
                                                    <div className="text-xs text-muted-foreground">{user.email || user.username}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {user.role === 'ADMIN' ? <Shield className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                                                {user.role}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleToggleStatus(user.username, user.disabled)}
                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${user.disabled
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    }`}
                                            >
                                                {user.disabled ? (
                                                    <><Ban className="h-3 w-3 mr-1" /> Inactive</>
                                                ) : (
                                                    <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {session?.user?.name !== user.username && ( // Prevent deleting self
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                    onClick={() => handleDeleteUser(user.username)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
