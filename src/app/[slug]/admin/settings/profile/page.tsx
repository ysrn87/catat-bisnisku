'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
} from '@/actions/settings';
import {
  getManagers,
  createManager,
  updateManager,
  deleteManager,
  type ManagerData,
} from '@/actions/manager-actions';
import {
  User, Lock, Mail, Phone, MapPin, Save,
  Eye, EyeOff, Users, Plus, Pencil, Trash2,
  X, ShieldCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'managers';

interface ManagerForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  confirmPassword: string;
}

const emptyManagerForm: ManagerForm = {
  name: '', phone: '', email: '', address: '', password: '', confirmPassword: '',
};

// ─── Password Input ───────────────────────────────────────────────────────────

function PasswordInput({
  id, value, onChange, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="h-10 text-sm pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Manager Modal ────────────────────────────────────────────────────────────

function ManagerModal({
  manager, onClose, onSaved,
}: {
  manager: ManagerData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!manager;
  const [form, setForm] = useState<ManagerForm>(
    manager
      ? { name: manager.name, phone: manager.phone, email: manager.email ?? '', address: manager.address ?? '', password: '', confirmPassword: '' }
      : emptyManagerForm
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function set(field: keyof ManagerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: 'Nama dan nomor telepon wajib diisi', variant: 'destructive' });
      return;
    }
    if (!isEdit && form.password.length < 6) {
      toast({ title: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateManager(manager!.id, {
          name: form.name, phone: form.phone,
          email: form.email || undefined, address: form.address || undefined,
          newPassword: form.password || undefined,
        });
        toast({ title: 'Manager berhasil diperbarui' });
      } else {
        await createManager({
          name: form.name, phone: form.phone, password: form.password,
          email: form.email || undefined, address: form.address || undefined,
        });
        toast({ title: 'Manager berhasil ditambahkan' });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">{isEdit ? 'Edit Manager' : 'Tambah Manager'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="m-name" className="text-xs font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />Nama <span className="text-red-400">*</span>
            </Label>
            <Input id="m-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nama manager" className="h-10 text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-phone" className="text-xs font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />No. Telepon <span className="text-red-400">*</span>
            </Label>
            <Input id="m-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08123456789" className="h-10 text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-email" className="text-xs font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />Email
            </Label>
            <Input id="m-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="manager@example.com" className="h-10 text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-address" className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />Alamat
            </Label>
            <Input id="m-address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Alamat lengkap" className="h-10 text-sm" />
          </div>
          <hr className="border-t border-gray-100" />
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">
              {isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : <span>Password <span className="text-red-400">*</span></span>}
            </Label>
            <PasswordInput id="m-password" value={form.password} onChange={(v) => set('password', v)} placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Min. 6 karakter'} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">
              Konfirmasi Password {!isEdit && <span className="text-red-400">*</span>}
            </Label>
            <PasswordInput id="m-confirm" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} placeholder="Ulangi password" />
            {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-xs text-red-500">Password tidak cocok</p>}
            {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6 && <p className="text-xs text-emerald-600">Password cocok ✓</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
            <Save className="w-4 h-4 mr-2" />{loading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminAddress, setAdminAddress] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [modalManager, setModalManager] = useState<ManagerData | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { loadAdminProfile(); }, []);
  useEffect(() => { if (activeTab === 'managers') loadManagers(); }, [activeTab]);

  async function loadAdminProfile() {
    try {
      const profile = await getAdminProfile();
      setAdminName(profile.name);
      setAdminEmail(profile.email || '');
      setAdminPhone(profile.phone);
      setAdminAddress(profile.address || '');
    } catch (error) { console.error(error); }
  }

  async function loadManagers() {
    try { setManagers(await getManagers()); }
    catch (error) { console.error(error); }
  }

  async function handleSaveProfile() {
    setLoading(true);
    try {
      if (!adminName.trim()) { toast({ title: 'Nama wajib diisi', variant: 'destructive' }); return; }
      if (!adminPhone.trim()) { toast({ title: 'Nomor telepon wajib diisi', variant: 'destructive' }); return; }
      await updateAdminProfile({ name: adminName, email: adminEmail || undefined, phone: adminPhone, address: adminAddress || undefined });
      toast({ title: 'Profil berhasil disimpan' });
    } catch (error: any) {
      toast({ title: 'Gagal menyimpan profil', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function handleChangePassword() {
    setLoading(true);
    try {
      if (!currentPassword) { toast({ title: 'Password lama wajib diisi', variant: 'destructive' }); return; }
      if (newPassword.length < 6) { toast({ title: 'Password baru minimal 6 karakter', variant: 'destructive' }); return; }
      if (newPassword !== confirmPassword) { toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' }); return; }
      await updateAdminPassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast({ title: 'Password berhasil diubah' });
    } catch (error: any) {
      toast({ title: 'Gagal mengubah password', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function handleDeleteManager(id: string) {
    setDeletingId(id);
    try {
      await deleteManager(id);
      toast({ title: 'Manager berhasil dihapus' });
      loadManagers();
    } catch (err: any) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' });
    } finally { setDeletingId(null); }
  }

  const initials = adminName
    ? adminName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'profile', label: 'Profil Admin', icon: User },
          { key: 'managers', label: 'Kelola Manager', icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-[#028697] text-[#028697]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-[#028697]" />Informasi Profil
              </CardTitle>
              <CardDescription>Perbarui data pribadi akun admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#028697] flex items-center justify-center shadow-md shrink-0">
                  <span className="text-white text-lg font-bold">{initials}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">{adminName || '–'}</p>
                  <p className="text-xs text-gray-500">{adminEmail || 'Belum ada email'}</p>
                </div>
              </div>
              <hr className="border-t border-gray-100" />
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="adminName" className="text-xs font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" />Nama <span className="text-red-400">*</span></Label>
                  <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nama admin" className="h-10 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminEmail" className="text-xs font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />Email</Label>
                  <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="h-10 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminPhone" className="text-xs font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />No. Telepon <span className="text-red-400">*</span></Label>
                  <Input id="adminPhone" type="tel" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="08123456789" className="h-10 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminAddress" className="text-xs font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />Alamat</Label>
                  <Input id="adminAddress" value={adminAddress} onChange={(e) => setAdminAddress(e.target.value)} placeholder="Alamat lengkap" className="h-10 text-sm" />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleSaveProfile} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
                  <Save className="w-4 h-4 mr-2" />Simpan Profil
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="w-5 h-5 text-[#028697]" />Ubah Password
              </CardTitle>
              <CardDescription>Perbarui password untuk keamanan akun</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Password Saat Ini <span className="text-red-400">*</span></Label>
                  <PasswordInput id="currentPassword" value={currentPassword} onChange={setCurrentPassword} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Password Baru <span className="text-red-400">*</span></Label>
                  <PasswordInput id="newPassword" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 karakter" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Konfirmasi Password Baru <span className="text-red-400">*</span></Label>
                  <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} placeholder="Ulangi password baru" />
                  {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-red-500">Password tidak cocok</p>}
                  {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 6 && <p className="text-xs text-emerald-600">Password cocok ✓</p>}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleChangePassword} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
                  <Lock className="w-4 h-4 mr-2" />Ubah Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Manager Tab ── */}
      {activeTab === 'managers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daftar Manager</p>
              <p className="text-xs text-gray-500">{managers.length} akun manager terdaftar</p>
            </div>
            <Button onClick={() => setModalManager(null)} className="bg-[#028697] hover:bg-[#17a8bb] h-9 text-sm">
              <Plus className="w-4 h-4 mr-1.5" />Tambah Manager
            </Button>
          </div>

          {managers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <ShieldCheck className="w-10 h-10" />
                <p className="text-sm">Belum ada akun manager</p>
                <Button variant="outline" size="sm" onClick={() => setModalManager(null)}>
                  <Plus className="w-4 h-4 mr-1.5" />Tambah Manager
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {managers.map((m) => {
                const mInitials = m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <Card key={m.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#028697]/10 flex items-center justify-center shrink-0">
                          <span className="text-[#028697] text-sm font-bold">{mInitials}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{m.name}</p>
                            <Badge variant="outline" className="text-[10px] text-[#028697] border-[#028697]/30 shrink-0">Manager</Badge>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {m.phone}{m.email ? ` · ${m.email}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setModalManager(m)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline" size="icon"
                            className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50"
                            disabled={deletingId === m.id}
                            onClick={() => handleDeleteManager(m.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalManager !== undefined && (
        <ManagerModal
          manager={modalManager}
          onClose={() => setModalManager(undefined)}
          onSaved={loadManagers}
        />
      )}
    </div>
  );
}