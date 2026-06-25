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
  getCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  type CashierData,
} from '@/actions/cashier-actions';
import { switchTeamMemberRole } from '@/actions/team-actions';
import {
  User, Lock, Mail, Phone, MapPin, Save,
  Eye, EyeOff, Users, Plus, Pencil, Trash2,
  X, ShieldCheck, Palette, Wallet, UserCheck, ArrowRightLeft,
} from 'lucide-react';
import { BrandingTab } from '@/components/settings/branding-tab';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'team' | 'branding';

interface ManagerForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const emptyManagerForm: ManagerForm = {
  name: '', phone: '', email: '', password: '', confirmPassword: '',
};

type CashierForm = ManagerForm;
const emptyCashierForm: CashierForm = emptyManagerForm;

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
      ? { name: manager.name, phone: manager.phone, email: manager.email ?? '', password: '', confirmPassword: '' }
      : emptyManagerForm
  );
  const [loading, setLoading] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const { toast } = useToast();

  function set(field: keyof ManagerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(linkExisting = false) {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: 'Nama dan nomor telepon wajib diisi', variant: 'destructive' });
      return;
    }
    if (!isEdit && !linkExisting && form.password.length < 6) {
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
          email: form.email || undefined,
          newPassword: form.password || undefined,
        });
        toast({ title: 'Manager berhasil diperbarui' });
        onSaved();
        onClose();
      } else {
        const result = await createManager({
          name: form.name, phone: form.phone, password: form.password,
          email: form.email || undefined,
        }, linkExisting);

        if (result.success) {
          toast({
            title: result.linked
              ? `${result.existingName} berhasil ditambahkan sebagai Manager`
              : 'Manager berhasil ditambahkan',
          });
          onSaved();
          onClose();
        } else if (result.requiresConfirmation) {
          setExistingName(result.existingName ?? null);
        } else {
          toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const showLinkConfirm = !isEdit && !!existingName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">{isEdit ? 'Edit Manager' : 'Tambah Manager'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {showLinkConfirm ? (
          <div className="p-5">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <UserCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Nomor ini terdaftar atas nama "{existingName}"
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Tambahkan sebagai Manager di toko ini tanpa membuat akun baru? Profil (nama, email, alamat) tetap memakai data akun yang sudah ada.
                </p>
              </div>
            </div>
          </div>
        ) : (
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
              {!isEdit && (
                <p className="text-[11px] text-gray-400">Sudah punya akun di toko lain? Cukup masukkan nomor yang sama, kami akan menawarkan untuk menghubungkannya.</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-email" className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />Email
              </Label>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="manager@example.com" className="h-10 text-sm" />
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
        )}

        <div className="flex justify-end gap-2 p-5 border-t">
          {showLinkConfirm ? (
            <>
              <Button variant="outline" onClick={() => setExistingName(null)} disabled={loading}>Batal</Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
                <UserCheck className="w-4 h-4 mr-2" />{loading ? 'Menambahkan...' : 'Tambahkan sebagai Manager'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
              <Button onClick={() => handleSubmit(false)} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
                <Save className="w-4 h-4 mr-2" />{loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CashierModal({
  cashier, onClose, onSaved,
}: {
  cashier: CashierData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!cashier;
  const [form, setForm] = useState<CashierForm>(
    cashier
      ? { name: cashier.name, phone: cashier.phone, email: cashier.email ?? '', password: '', confirmPassword: '' }
      : emptyCashierForm
  );
  const [loading, setLoading] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const { toast } = useToast();

  function set(field: keyof CashierForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(linkExisting = false) {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: 'Nama dan nomor telepon wajib diisi', variant: 'destructive' });
      return;
    }
    if (!isEdit && !linkExisting && form.password.length < 6) {
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
        await updateCashier(cashier!.id, {
          name: form.name, phone: form.phone,
          email: form.email || undefined,
          newPassword: form.password || undefined,
        });
        toast({ title: 'Kasir berhasil diperbarui' });
        onSaved();
        onClose();
      } else {
        const result = await createCashier({
          name: form.name, phone: form.phone, password: form.password,
          email: form.email || undefined,
        }, linkExisting);

        if (result.success) {
          toast({
            title: result.linked
              ? `${result.existingName} berhasil ditambahkan sebagai Kasir`
              : 'Kasir berhasil ditambahkan',
          });
          onSaved();
          onClose();
        } else if (result.requiresConfirmation) {
          setExistingName(result.existingName ?? null);
        } else {
          toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const showLinkConfirm = !isEdit && !!existingName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">{isEdit ? 'Edit Kasir' : 'Tambah Kasir'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {showLinkConfirm ? (
          <div className="p-5">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <UserCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Nomor ini terdaftar atas nama "{existingName}"
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Tambahkan sebagai Kasir di toko ini tanpa membuat akun baru? Profil (nama, email, alamat) tetap memakai data akun yang sudah ada.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="c-name" className="text-xs font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />Nama <span className="text-red-400">*</span>
              </Label>
              <Input id="c-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nama kasir" className="h-10 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-phone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />No. Telepon <span className="text-red-400">*</span>
              </Label>
              <Input id="c-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08123456789" className="h-10 text-sm" />
              {!isEdit && (
                <p className="text-[11px] text-gray-400">Sudah punya akun di toko lain? Cukup masukkan nomor yang sama, kami akan menawarkan untuk menghubungkannya.</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-email" className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />Email
              </Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="kasir@example.com" className="h-10 text-sm" />
            </div>
            <hr className="border-t border-gray-100" />
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">
                {isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : <span>Password <span className="text-red-400">*</span></span>}
              </Label>
              <PasswordInput id="c-password" value={form.password} onChange={(v) => set('password', v)} placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Min. 6 karakter'} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">
                Konfirmasi Password {!isEdit && <span className="text-red-400">*</span>}
              </Label>
              <PasswordInput id="c-confirm" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} placeholder="Ulangi password" />
              {form.confirmPassword && form.password !== form.confirmPassword && <p className="text-xs text-red-500">Password tidak cocok</p>}
              {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6 && <p className="text-xs text-emerald-600">Password cocok ✓</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 p-5 border-t">
          {showLinkConfirm ? (
            <>
              <Button variant="outline" onClick={() => setExistingName(null)} disabled={loading}>Batal</Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
                <UserCheck className="w-4 h-4 mr-2" />{loading ? 'Menambahkan...' : 'Tambahkan sebagai Kasir'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
              <Button onClick={() => handleSubmit(false)} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
                <Save className="w-4 h-4 mr-2" />{loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ProfileSettingsPageProps {
  storePlan: 'FREE' | 'PRO';
  storeSlug: string;
}

export function ProfileSettingsClient({ storePlan, storeSlug }: ProfileSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [modalManager, setModalManager] = useState<ManagerData | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [cashiers, setCashiers] = useState<CashierData[]>([]);
  const [modalCashier, setModalCashier] = useState<CashierData | null | undefined>(undefined);
  const [deletingCashierId, setDeletingCashierId] = useState<string | null>(null);

  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { loadAdminProfile(); }, []);
  useEffect(() => {
    if (activeTab === 'team') { loadManagers(); loadCashiers(); }
  }, [activeTab]);

  async function loadAdminProfile() {
    try {
      const profile = await getAdminProfile();
      setAdminName(profile.name);
      setAdminEmail(profile.email || '');
      setAdminPhone(profile.phone);
    } catch (error) { console.error(error); }
  }

  async function loadManagers() {
    try { setManagers(await getManagers()); }
    catch (error) { console.error(error); }
  }

  async function loadCashiers() {
    try { setCashiers(await getCashiers()); }
    catch (error) { console.error(error); }
  }

  async function handleSaveProfile() {
    setLoading(true);
    try {
      if (!adminName.trim()) { toast({ title: 'Nama wajib diisi', variant: 'destructive' }); return; }
      if (!adminPhone.trim()) { toast({ title: 'Nomor telepon wajib diisi', variant: 'destructive' }); return; }
      await updateAdminProfile({ name: adminName, email: adminEmail || undefined, phone: adminPhone });
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

  async function handleDeleteCashier(id: string) {
    setDeletingCashierId(id);
    try {
      await deleteCashier(id);
      toast({ title: 'Kasir berhasil dihapus' });
      loadCashiers();
    } catch (err: any) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' });
    } finally { setDeletingCashierId(null); }
  }

  async function handleSwitchRole(id: string, toRole: 'MANAGER' | 'CASHIER') {
    const label = toRole === 'MANAGER' ? 'Manager' : 'Kasir';
    if (!window.confirm(`Pindahkan peran orang ini menjadi ${label}?`)) return;

    setSwitchingId(id);
    try {
      const result = await switchTeamMemberRole(id, toRole);
      if (result.success) {
        toast({ title: `Berhasil dipindah menjadi ${label}` });
        loadManagers();
        loadCashiers();
      } else {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally {
      setSwitchingId(null);
    }
  }

  const initials = adminName
    ? adminName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'profile',   label: 'Profil Admin',    icon: User    },
          { key: 'team',      label: 'Kelola Tim',       icon: Users   },
          { key: 'branding',  label: 'Custom Branding',  icon: Palette },
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
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleSaveProfile} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
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
                <Button onClick={handleChangePassword} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
                  <Lock className="w-4 h-4 mr-2" />Ubah Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Kelola Tim Tab ── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium">Anggota Tim</p>
            <p className="text-xs text-gray-500">
              {managers.length} manager · {cashiers.length} kasir
            </p>
          </div>

          {/* ─ Manager Section ─ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#028697]" />
                <p className="text-sm font-semibold">Manager</p>
              </div>
              <Button onClick={() => setModalManager(null)} variant="outline" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Tambah Manager
              </Button>
            </div>

            {managers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <ShieldCheck className="w-8 h-8" />
                  <p className="text-xs">Belum ada akun manager</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {managers.map((m) => {
                  const mInitials = m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <Card key={m.id}>
                      <CardContent className="py-3.5">
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
                            <Button
                              variant="outline" size="icon"
                              className="h-8 w-8 border-amber-200 text-amber-600 hover:bg-amber-50"
                              disabled={switchingId === m.id}
                              onClick={() => handleSwitchRole(m.id, 'CASHIER')}
                              title="Jadikan Kasir"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </Button>
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

          <hr className="border-t border-gray-100" />

          {/* ─ Kasir Section ─ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-[#028697]" />
                <p className="text-sm font-semibold">Kasir</p>
              </div>
              <Button onClick={() => setModalCashier(null)} variant="outline" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Tambah Kasir
              </Button>
            </div>

            {cashiers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Wallet className="w-8 h-8" />
                  <p className="text-xs">Belum ada akun kasir</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {cashiers.map((c) => {
                  const cInitials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <Card key={c.id}>
                      <CardContent className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#028697]/10 flex items-center justify-center shrink-0">
                            <span className="text-[#028697] text-sm font-bold">{cInitials}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{c.name}</p>
                              <Badge variant="outline" className="text-[10px] text-[#028697] border-[#028697]/30 shrink-0">Kasir</Badge>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {c.phone}{c.email ? ` · ${c.email}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              variant="outline" size="icon"
                              className="h-8 w-8 border-amber-200 text-amber-600 hover:bg-amber-50"
                              disabled={switchingId === c.id}
                              onClick={() => handleSwitchRole(c.id, 'MANAGER')}
                              title="Jadikan Manager"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setModalCashier(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline" size="icon"
                              className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50"
                              disabled={deletingCashierId === c.id}
                              onClick={() => handleDeleteCashier(c.id)}
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
        </div>
      )}

      {/* ── Branding Tab ── */}
      {activeTab === 'branding' && (
        <BrandingTab storeSlug={storeSlug} storePlan={storePlan} />
      )}

      {/* Modal */}
      {modalManager !== undefined && (
        <ManagerModal
          manager={modalManager}
          onClose={() => setModalManager(undefined)}
          onSaved={loadManagers}
        />
      )}
      {modalCashier !== undefined && (
        <CashierModal
          cashier={modalCashier}
          onClose={() => setModalCashier(undefined)}
          onSaved={loadCashiers}
        />
      )}
    </div>
  );
}