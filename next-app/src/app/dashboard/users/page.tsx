'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, User as UserIcon, Eye, EyeOff, Loader2, Ban, CheckCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
    const { data: session } = useSession();
    const authFetch = useAuthFetch();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', email: '', role: 'USER', application_permission: 'Both', can_approve_signups: false, can_view_reports: true, cake_account_manager_id: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', application_permission: '', password: '', can_approve_signups: false, can_view_reports: true, cake_account_manager_id: '' });
    const [showEditPassword, setShowEditPassword] = useState(false);

    const fetchUsers = () => {
        if (session?.accessToken) {
            setLoading(true);
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`)
                .then(res => res ? res.json() : [])
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
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newUser)
        })
            .then(async res => {
                if (res && res.ok) {
                    setOpen(false);
                    setNewUser({ username: '', password: '', full_name: '', email: '', role: 'USER', application_permission: 'Both', can_approve_signups: false, can_view_reports: true, cake_account_manager_id: '' });
                    toast.success("User invited successfully!");
                    fetchUsers();
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    toast.error(err.detail || "Failed to create user");
                }
            })
            .catch(err => toast.error("Error creating user"))
            .finally(() => setIsSubmitting(false));
    };

    const handleDeleteUser = (username: string) => {
        if (!confirm(`Are you sure you want to delete ${username}?`)) return;

        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${username}`, {
            method: 'DELETE',
        })
            .then(res => {
                if (res && res.ok) {
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

        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${username}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ disabled: newDisabledStatus })
        })
            .then(async res => {
                if (res && res.ok) {
                    toast.success(`User ${action}d successfully`);
                    fetchUsers();
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    toast.error(err.detail || `Failed to ${action} user`);
                }
            })
            .catch(() => toast.error(`Error trying to ${action} user`));
    };

    const handleUpdateRole = (username: string, newRole: string) => {
        // Optimistic update or just wait for refresh? Let's wait for refresh to be safe against errors
        // But we need to be careful with the Select UI flickering if we rely solely on fetchUsers.
        // For now, standard fetch.

        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${username}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: newRole })
        })
            .then(async res => {
                if (res && res.ok) {
                    toast.success(`Role updated to ${newRole}`);
                    fetchUsers();
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    toast.error(err.detail || "Failed to update role");
                    // Revert UI if we had local state, but we are refetching so it should correct itself
                    fetchUsers();
                }
            })
            .catch(() => {
                toast.error("Error updating role");
                fetchUsers();
            });
    };

    const handleEditUser = (user: any) => {
        setEditingUser(user);
        setEditForm({
            full_name: user.full_name || '',
            email: user.email || '',
            application_permission: user.application_permission || 'Both',
            can_approve_signups: user.can_approve_signups ?? false,
            can_view_reports: user.can_view_reports ?? true,
            password: '', // Leave empty
            cake_account_manager_id: user.cake_account_manager_id || ''
        });
        setEditOpen(true);
    };

    const handleSaveEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsSubmitting(true);
        const updateData: any = {};
        if (editForm.full_name !== editingUser.full_name) updateData.full_name = editForm.full_name;
        if (editForm.email !== editingUser.email) updateData.email = editForm.email;
        if (editForm.application_permission !== editingUser.application_permission) updateData.application_permission = editForm.application_permission;
        if (editForm.can_approve_signups !== editingUser.can_approve_signups) updateData.can_approve_signups = editForm.can_approve_signups;
        if (editForm.can_view_reports !== editingUser.can_view_reports) updateData.can_view_reports = editForm.can_view_reports;
        if (editForm.cake_account_manager_id !== editingUser.cake_account_manager_id) updateData.cake_account_manager_id = editForm.cake_account_manager_id;
        if (editForm.password) updateData.password = editForm.password; // Only send if changed

        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${editingUser.username}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        })
            .then(async res => {
                if (res && res.ok) {
                    setEditOpen(false);
                    setEditingUser(null);
                    toast.success("User updated successfully!");
                    fetchUsers();
                } else {
                    const err = res ? await res.json() : { detail: "Unknown error" };
                    toast.error(err.detail || "Failed to update user");
                }
            })
            .catch(err => toast.error("Error updating user"))
            .finally(() => setIsSubmitting(false));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage system access and roles.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
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
                            <div className="grid grid-cols-2 gap-4">
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
                                <div className="space-y-2">
                                    <Label>Application Permission</Label>
                                    <Select value={newUser.application_permission} onValueChange={v => setNewUser({ ...newUser, application_permission: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {/* Super admin and Both permission admin can create any user */}
                                            {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.application_permission === 'Both') && (
                                                <>
                                                    <SelectItem value="Web Traffic">Web Traffic</SelectItem>
                                                    <SelectItem value="Call Traffic">Call Traffic</SelectItem>
                                                    <SelectItem value="Both">Both</SelectItem>
                                                </>
                                            )}
                                            {/* Web admin can only create Web users */}
                                            {session?.user?.role === 'ADMIN' && session?.user?.application_permission === 'Web Traffic' && (
                                                <SelectItem value="Web Traffic">Web Traffic</SelectItem>
                                            )}
                                            {/* Call admin can only create Call users */}
                                            {session?.user?.role === 'ADMIN' && session?.user?.application_permission === 'Call Traffic' && (
                                                <SelectItem value="Call Traffic">Call Traffic</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Cake Account Manager ID</Label>
                                <Input value={newUser.cake_account_manager_id} onChange={e => setNewUser({ ...newUser, cake_account_manager_id: e.target.value })} placeholder="e.g. 123" />
                            </div>
                            <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Approval Permission</Label>
                                    <div className="text-xs text-muted-foreground">
                                        Allow user to approve signups
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="new_can_approve"
                                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                        checked={newUser.can_approve_signups}
                                        onChange={(e) => setNewUser({ ...newUser, can_approve_signups: e.target.checked })}
                                    />
                                    <Label htmlFor="new_can_approve" className="text-sm font-normal">
                                        {newUser.can_approve_signups ? "Can Approve" : "Request Only"}
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="new_can_report"
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={newUser.can_view_reports}
                                        onChange={(e) => setNewUser({ ...newUser, can_view_reports: e.target.checked })}
                                    />
                                    <Label htmlFor="new_can_report" className="text-sm font-normal">
                                        Reports Access
                                    </Label>
                                </div>
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
                <CardContent className="p-0 sm:p-6">
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto">
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
                                                {/* Role Display / Editor */}
                                                {session?.user?.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && user.username !== session?.user?.name ? (
                                                    <Select
                                                        value={user.role}
                                                        onValueChange={(val) => handleUpdateRole(user.username, val)}
                                                    >
                                                        <SelectTrigger
                                                            className={`h-6 border-none bg-transparent focus:ring-0 focus:ring-offset-0 px-2 py-0 inline-flex items-center gap-1 rounded-full text-xs font-medium w-auto ${['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}
                                                        >
                                                            <SelectValue>
                                                                <div className="flex items-center">
                                                                    {['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <Shield className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                                                                    <span className="leading-none flex items-center pt-0.5">{user.role}</span>
                                                                </div>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="USER">User</SelectItem>
                                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <Shield className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                                                        {user.role}
                                                    </span>
                                                )}
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
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Web/Call admins cannot edit users with Both permission */}
                                                    {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && session?.user?.name !== user.username && user.role !== 'SUPER_ADMIN' &&
                                                        !(['ADMIN'].includes(session?.user?.role || '') && ['Web Traffic', 'Call Traffic'].includes(session?.user?.application_permission || '') && user.application_permission === 'Both') && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                                onClick={() => handleEditUser(user)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    {/* Web/Call admins cannot delete users with Both permission */}
                                                    {session?.user?.name !== user.username && user.role !== 'SUPER_ADMIN' &&
                                                        !(user.role === 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') && // Only Super Admin can delete Admins
                                                        !(['ADMIN'].includes(session?.user?.role || '') && ['Web Traffic', 'Call Traffic'].includes(session?.user?.application_permission || '') && user.application_permission === 'Both') && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                                onClick={() => handleDeleteUser(user.username)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="md:hidden space-y-4 p-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
                                <p className="text-sm text-muted-foreground font-medium">Loading users...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                No users found.
                            </div>
                        ) : (
                            users.map((user) => (
                                <Card key={user.username} className="border border-gray-100 shadow-sm overflow-hidden bg-white hover:border-red-100 transition-colors">
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold border border-red-100">
                                                    {user.full_name?.charAt(0) || user.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{user.full_name || user.username}</div>
                                                    <div className="text-xs text-muted-foreground">{user.email || user.username}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* Edit User Mobile */}
                                                {['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role || '') && session?.user?.name !== user.username && user.role !== 'SUPER_ADMIN' &&
                                                    !(['ADMIN'].includes(session?.user?.role || '') && ['Web Traffic', 'Call Traffic'].includes(session?.user?.application_permission || '') && user.application_permission === 'Both') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-gray-400 hover:text-blue-600 shrink-0"
                                                            onClick={() => handleEditUser(user)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                {/* Delete User Mobile */}
                                                {session?.user?.name !== user.username && user.role !== 'SUPER_ADMIN' &&
                                                    !(user.role === 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') && // Only Super Admin can delete Admins
                                                    !(['ADMIN'].includes(session?.user?.role || '') && ['Web Traffic', 'Call Traffic'].includes(session?.user?.application_permission || '') && user.application_permission === 'Both') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-gray-400 hover:text-red-600 shrink-0"
                                                            onClick={() => handleDeleteUser(user.username)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Access Level</div>
                                                <div>
                                                    {session?.user?.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && user.username !== session?.user?.name ? (
                                                        <Select
                                                            value={user.role}
                                                            onValueChange={(val) => handleUpdateRole(user.username, val)}
                                                        >
                                                            <SelectTrigger
                                                                className={`h-7 border-none bg-transparent focus:ring-0 focus:ring-offset-0 px-2 py-0 inline-flex items-center gap-1 rounded-full text-xs font-semibold w-auto ${['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}
                                                            >
                                                                <SelectValue>
                                                                    <div className="flex items-center">
                                                                        {['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <Shield className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                                                                        <span>{user.role}</span>
                                                                    </div>
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="USER">User</SelectItem>
                                                                <SelectItem value="ADMIN">Admin</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                                                            }`}>
                                                            {['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? <Shield className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                                                            {user.role}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status</div>
                                                <div>
                                                    <button
                                                        onClick={() => handleToggleStatus(user.username, user.disabled)}
                                                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${user.disabled
                                                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                            }`}
                                                    >
                                                        {user.disabled ? (
                                                            <><Ban className="h-3 w-3 mr-1.5" /> Deactivated</>
                                                        ) : (
                                                            <><CheckCircle className="h-3 w-3 mr-1.5" /> Active</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {user.application_permission && (
                                            <div className="pt-3 mt-3 border-t border-gray-50 flex items-center justify-between">
                                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Permissions</div>
                                                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                                    {user.application_permission}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveEdit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={editForm.full_name}
                                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Application Permission</Label>
                            <Select value={editForm.application_permission} onValueChange={v => setEditForm({ ...editForm, application_permission: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Super admin and Both permission admin can assign any permission */}
                                    {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.application_permission === 'Both') && (
                                        <>
                                            <SelectItem value="Web Traffic">Web Traffic</SelectItem>
                                            <SelectItem value="Call Traffic">Call Traffic</SelectItem>
                                            <SelectItem value="Both">Both</SelectItem>
                                        </>
                                    )}
                                    {/* Web admin can only assign Web Traffic */}
                                    {session?.user?.role === 'ADMIN' && session?.user?.application_permission === 'Web Traffic' && (
                                        <SelectItem value="Web Traffic">Web Traffic</SelectItem>
                                    )}
                                    {/* Call admin can only assign Call Traffic */}
                                    {session?.user?.role === 'ADMIN' && session?.user?.application_permission === 'Call Traffic' && (
                                        <SelectItem value="Call Traffic">Call Traffic</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Cake Account Manager ID</Label>
                            <Input value={editForm.cake_account_manager_id} onChange={e => setEditForm({ ...editForm, cake_account_manager_id: e.target.value })} placeholder="e.g. 123" />
                        </div>
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                            <div className="space-y-0.5">
                                <Label className="text-base">Approval Permission</Label>
                                <div className="text-xs text-muted-foreground">
                                    Allow user to approve signups
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="edit_can_approve"
                                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                    checked={editForm.can_approve_signups ?? true}
                                    onChange={(e) => setEditForm({ ...editForm, can_approve_signups: e.target.checked })}
                                />
                                <Label htmlFor="edit_can_approve" className="text-sm font-normal">
                                    {(editForm.can_approve_signups ?? true) ? "Can Approve" : "Request Only"}
                                </Label>
                            </div>
                        </div>
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                            <div className="space-y-0.5">
                                <Label className="text-base">Reports Access</Label>
                                <div className="text-xs text-muted-foreground">
                                    Allow user to view reports
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="edit_can_report"
                                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                                    checked={editForm.can_view_reports ?? true}
                                    onChange={(e) => setEditForm({ ...editForm, can_view_reports: e.target.checked })}
                                />
                                <Label htmlFor="edit_can_report" className="text-sm font-normal">
                                    {(editForm.can_view_reports ?? true) ? "Enabled" : "Disabled"}
                                </Label>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>New Password (leave empty to keep current)</Label>
                            <div className="relative">
                                <Input
                                    type={showEditPassword ? "text" : "password"}
                                    value={editForm.password}
                                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                    className="pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowEditPassword(!showEditPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div >
    );
}
