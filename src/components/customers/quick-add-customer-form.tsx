'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createNonMemberCustomerAction } from '@/actions/customers';
import { UserPlus, X } from 'lucide-react';

interface QuickAddCustomerFormProps {
  onSuccess: (customer: { id: string; name: string; phone: string; address: string | null }) => void;
  onCancel: () => void;
}

export function QuickAddCustomerForm({ onSuccess, onCancel }: QuickAddCustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const { toast } = useToast();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9+]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setPhone(formatted);
  };

  const toTitleCase = (val: string) => val.replace(/\b\w/g, (c) => c.toUpperCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phone || !address) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('address', address);

      const result = await createNonMemberCustomerAction(formData);
      
      if (result.success && result.data) {
        toast({
          title: 'Success!',
          description: 'Customer added successfully.',
        });
        onSuccess({ ...result.data, address: result.data.address ?? '' });
        // Reset form
        setName('');
        setPhone('');
        setAddress('');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to add customer.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Tambah Pelanggan Baru</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          className="h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="quick-name" className="text-sm">
            Nama <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quick-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Nama Customer"
            required
            disabled={loading}
            maxLength={80}
            className="bg-white"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="quick-phone" className="text-sm">
            Phone/WhatsApp <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quick-phone"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            onKeyDown={(e) => {
              const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
              if (!controlKeys.includes(e.key) && !/^[0-9+]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            placeholder="0812 3456 7890"
            required
            disabled={loading}
            minLength={9}
            maxLength={19}
            inputMode="tel"
            className="bg-white"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="quick-address" className="text-sm">
            Alamat <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="quick-address"
            value={address}
            onChange={(e) => setAddress(toTitleCase(e.target.value))}
            placeholder="Street, City, Postal Code"
            required
            disabled={loading}
            maxLength={250}
            rows={2}
            className="bg-white resize-none"
          />
          <p className="text-xs text-gray-500 text-right">
            {address.length}/250 karakter
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading || !name || !phone || !address}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Menambahkan...' : 'Tambah'}
          </Button>
        </div>
      </form>
    </div>
  );
}