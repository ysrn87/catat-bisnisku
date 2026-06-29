'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getAdminProfile, updateAdminProfile, updateAdminPassword } from '@/actions/settings';
import {
  inviteStaffAction,
  removeStaffAction,
  switchTeamMemberRole,
  cancelInvitationAction,
} from '@/actions/team-actions';
import { requireStoreAccess } from '@/lib/store-context';
import {
  User, Lock, Mail, Phone, Save,
  Eye, EyeOff, Users, Plus, Trash2,
  X, ShieldCheck, Palette, Wallet, ArrowRightLeft,
  Send, Clock, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { BrandingTab } from '@/components/settings/branding-tab';
import { db } from '@/lib/db';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'team' | 'branding';

interface StaffMember {
  userId:   string;
  name:     string;
  email:    string;
  role:     'MANAGER' | 'CASHIER';
  joinedAt: Date;
}

interface PendingInvitation {
  id:        string;
  email:     string;
  role:      'MANAGER' | 'CASHIER';
  expiresAt: Date;
  createdAt: Date;
}

// ─── Password Input ─────────────────────────────────────────────────────────────

function PasswordInput({
  id, value, onChange, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id} type={show ? 'text' : 'password'}
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="h-10 text-sm pr-10"
      />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({
  role, onClose, onSaved,
}: {
  role:    'MANAGER' | 'CASHIER';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const { toast }             = useToast();
  const roleLabel             = role === 'MANAGER' ? 'Manager' : 'Kasir';

  async function handleSubmit() {
    if (!email.trim()) {
      toast({ title: 'Email wajib diisi', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await inviteStaffAction(email.trim(), role);
    setLoading(false);

    if (result.success) {
      toast({ title: `Undangan ${roleLabel} berhasil dikirim ke ${email}` });
      onSaved();
      onClose();
    } else {
      toast({ title: 'Gagal mengirim undangan', description: result.error, variant: 'destructive' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">Undang {roleLabel}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">
            Masukkan email calon {roleLabel.toLowerCase()}. Mereka akan menerima undangan via email untuk bergabung ke toko ini.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email" className="text-xs font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="invite-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`email@contoh.com`}
              className="h-10 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-[#028697] hover:bg-[#0fa8be]">
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
              : <><Send className="w-4 h-4 mr-2" />Kirim Undangan</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

interface Props {
  storePlan: 'FREE' | 'PRO';
  storeSlug: string;
  storeId:   string;
}

export function ProfileSettingsClient({ storePlan, storeSlug, storeId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading]     = useState(false);

  // Profile fields
  const [adminName, setAdminName]           = useState('');
  const [adminEmail, setAdminEmail]         = useState('');
  const [adminPhone, setAdminPhone]         = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Team
  const [managers, setManagers]             = useState<StaffMember[]>([]);
  const [cashiers, setCashiers]             = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [inviteModal, setInviteModal]       = useState<'MANAGER' | 'CASHIER' | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [switchingId, setSwitchingId]       = useState<string | null>(null);
  const [cancellingId, setCancellingId]     = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { loadAdminProfile(); }, []);
  useEffect(() => {
    if (activeTab === 'team') loadTeam();
  }, [activeTab]);

  async function loadAdminProfile() {
    try {
      const profile = await getAdminProfile();
      setAdminName(profile.name);
      setAdminEmail(profile.email || '');
      setAdminPhone(profile.phone || '');
    } catch (error) { console.error(error); }
  }

  async function loadTeam() {
    try {
      const res = await fetch(`/api/store/${storeId}/team`);
      if (!res.ok) return;
      const data = await res.json();
      setManagers(data.managers ?? []);
      setCashiers(data.cashiers ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } catch (error) { console.error(error); }
  }

  async function handleSaveProfile() {
    setLoading(true);
    try {
      if (!adminName.trim()) { toast({ title: 'Nama wajib diisi', variant: 'destructive' }); return; }
      await updateAdminProfile({ name: adminName, email: adminEmail || undefined, phone: adminPhone || undefined });
      toast({ title: 'Profil berhasil disimpan' });
    } catch (error: any) {
      toast({ title: 'Gagal menyimpan profil', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function handleChangePassword() {
    setLoading(true);
    try {
      if (!currentPassword) { toast({ title: 'Password lama wajib diisi', variant: 'destructive' }); return; }
      if (newPassword.length < 8) { toast({ title: 'Password baru minimal 8 karakter', variant: 'destructive' }); return; }
      if (newPassword !== confirmPassword) { toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' }); return; }
      await updateAdminPassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast({ title: 'Password berhasil diubah' });
    } catch (error: any) {
      toast({ title: 'Gagal mengubah password', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function handleRemoveStaff(userId: string, name: string) {
    if (!window.confirm(`Hapus ${name} dari tim toko ini?`)) return;
    setDeletingId(userId);
    try {
      const result = await removeStaffAction(userId);
      if (result.success) {
        toast({ title: `${name} berhasil dihapus dari tim` });
        loadTeam();
      } else {
        toast({ title: 'Gagal menghapus', description: result.error, variant: 'destructive' });
      }
    } finally { setDeletingId(null); }
  }

  async function handleSwitchRole(userId: string, toRole: 'MANAGER' | 'CASHIER') {
    const label = toRole === 'MANAGER' ? 'Manager' : 'Kasir';
    if (!window.confirm(`Pindahkan peran orang ini menjadi ${label}?`)) return;
    setSwitchingId(userId);
    try {
      const result = await switchTeamMemberRole(userId, toRole);
      if (result.success) {
        toast({ title: `Berhasil dipindah menjadi ${label}` });
        loadTeam();
      } else {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      }
    } finally { setSwitchingId(null); }
  }

  async function handleCancelInvitation(id: string, email: string) {
    if (!window.confirm(`Batalkan undangan untuk ${email}?`)) return;
    setCancellingId(id);
    try {
      const result = await cancelInvitationAction(id);
      if (result.success) {
        toast({ title: 'Undangan dibatalkan' });
        loadTeam();
      } else {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      }
    } finally { setCancellingId(null); }
  }

  const initials = adminName
    ? adminName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const StaffCard = ({ member, onSwitch, onRemove }: {
    member:   StaffMember;
    onSwitch: () => void;
    onRemove: () => void;
  }) => {
    const mi = member.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const switchLabel = member.role === 'MANAGER' ? 'Jadikan Kasir' : 'Jadikan Manager';
    return (
      <Card>
        <CardContent className="py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#028697]/10 flex items-center justify-center shrink-0">
              <span className="text-[#028697] text-sm font-bold">{mi}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{member.name}</p>
                <Badge variant="outline" className="text-[10px] text-[#028697] border-[#028697]/30 shrink-0">
                  {member.role === 'MANAGER' ? 'Manager' : 'Kasir'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 truncate">{member.email}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                variant="outline" size="icon"
                className="h-8 w-8 border-amber-200 text-amber-600 hover:bg-amber-50"
                disabled={switchingId === member.userId}
                onClick={onSwitch}
                title={switchLabel}
              >
                {switchingId === member.userId
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ArrowRightLeft className="w-3.5 h-3.5" />
                }
              </Button>
              <Button
                variant="outline" size="icon"
                className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50"
                disabled={deletingId === member.userId}
                onClick={onRemove}
              >
                {deletingId === member.userId
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'profile',  label: 'Profil Admin',   icon: User    },
          { key: 'team',     label: 'Kelola Tim',      icon: Users   },
          { key: 'branding', label: 'Custom Branding', icon: Palette },
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
            <Icon className="w-4 h-4" />{label}
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
              <CardDescription>Perbarui data pribadi akun kamu</CardDescription>
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
                  <Label htmlFor="adminName" className="text-xs font-medium flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />Nama <span className="text-red-400">*</span>
                  </Label>
                  <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nama admin" className="h-10 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminEmail" className="text-xs font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />Email
                  </Label>
                  <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="h-10 text-sm" disabled />
                  <p className="text-xs text-gray-400">Email tidak bisa diubah dari sini karena dipakai untuk login.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminPhone" className="text-xs font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />No. WhatsApp
                  </Label>
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
                  <PasswordInput id="newPassword" value={newPassword} onChange={setNewPassword} placeholder="Min. 8 karakter" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Konfirmasi Password Baru <span className="text-red-400">*</span></Label>
                  <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} placeholder="Ulangi password baru" />
                  {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-red-500">Password tidak cocok</p>}
                  {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 8 && <p className="text-xs text-emerald-600">Password cocok ✓</p>}
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
              {pendingInvites.length > 0 && ` · ${pendingInvites.length} undangan menunggu`}
            </p>
          </div>

          {/* ─ Manager Section ─ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#028697]" />
                <p className="text-sm font-semibold">Manager</p>
              </div>
              <Button onClick={() => setInviteModal('MANAGER')} variant="outline" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Undang Manager
              </Button>
            </div>

            {managers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <ShieldCheck className="w-8 h-8" />
                  <p className="text-xs">Belum ada manager</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {managers.map((m) => (
                  <StaffCard
                    key={m.userId}
                    member={m}
                    onSwitch={() => handleSwitchRole(m.userId, 'CASHIER')}
                    onRemove={() => handleRemoveStaff(m.userId, m.name)}
                  />
                ))}
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
              <Button onClick={() => setInviteModal('CASHIER')} variant="outline" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Undang Kasir
              </Button>
            </div>

            {cashiers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Wallet className="w-8 h-8" />
                  <p className="text-xs">Belum ada kasir</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {cashiers.map((c) => (
                  <StaffCard
                    key={c.userId}
                    member={c}
                    onSwitch={() => handleSwitchRole(c.userId, 'MANAGER')}
                    onRemove={() => handleRemoveStaff(c.userId, c.name)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─ Undangan Pending ─ */}
          {pendingInvites.length > 0 && (
            <>
              <hr className="border-t border-gray-100" />
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-700">Undangan Menunggu</p>
                </div>
                <div className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <Card key={inv.id} className="border-amber-100 bg-amber-50/50">
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <Send className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{inv.email}</p>
                            <p className="text-xs text-gray-500">
                              {inv.role === 'MANAGER' ? 'Manager' : 'Kasir'} · Kedaluwarsa{' '}
                              {new Date(inv.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-500"
                            disabled={cancellingId === inv.id}
                            onClick={() => handleCancelInvitation(inv.id, inv.email)}
                            title="Batalkan undangan"
                          >
                            {cancellingId === inv.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <X className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Branding Tab ── */}
      {activeTab === 'branding' && (
        <BrandingTab storeSlug={storeSlug} storePlan={storePlan} />
      )}

      {/* Invite Modal */}
      {inviteModal && (
        <InviteModal
          role={inviteModal}
          onClose={() => setInviteModal(null)}
          onSaved={loadTeam}
        />
      )}
    </div>
  );
}
