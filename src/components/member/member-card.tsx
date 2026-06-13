'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { User, Mail, Phone, Calendar, CreditCard, Sparkles, X, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MemberCardProps {
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    birthday?: Date | null;
    address?: string | null;
    photoUrl?: string | null;
    points: number;
    createdAt: Date;
  };
  showMembershipId?: boolean;
}

export function MemberCard({ user, showMembershipId = false }: MemberCardProps) {
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Generate initials from name
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Calculate accurate age in years, months, and days
  const birthdayInfo = user.birthday
    ? (() => {
        const bday = new Date(user.birthday);
        const today = new Date();
        let years = today.getFullYear() - bday.getFullYear();
        let months = today.getMonth() - bday.getMonth();
        let days = today.getDate() - bday.getDate();
        if (days < 0) {
          months--;
          days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        }
        if (months < 0) {
          years--;
          months += 12;
        }
        return { years, months, days };
      })()
    : null;

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
      {/* Header with gradient background - Responsive layout */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>

        {/* Content - Stack on mobile, side-by-side on larger screens */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 relative z-10">
          {/* Avatar - Responsive sizing - Rounded rectangle - Clickable */}
          <div className="relative group">
            <button
              onClick={() => user.photoUrl && setShowImagePreview(true)}
              disabled={!user.photoUrl}
              className={`relative ${user.photoUrl ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label="View profile picture"
            >
              <Avatar className="w-48 h-32 sm:w-48 sm:h-32 lg:w-48 lg:h-32 border-4 border-white shadow-lg ring-4 ring-white/20 rounded-2xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                <AvatarImage
                  src={user.photoUrl || undefined}
                  alt={user.name}
                  className="object-cover object-center rounded-2xl"
                />
                <AvatarFallback className="text-xl sm:text-2xl bg-white text-purple-600 font-bold rounded-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {user.photoUrl && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex items-center justify-center">
                  <span className="text-white text-xs font-medium">View</span>
                </div>
              )}
            </button>
          </div>

          {/* User info - Centered on mobile, left-aligned on larger screens */}
          <div className="flex-1 text-center sm:text-left w-full">
            {/* Name - Responsive font size */}
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 drop-shadow-md">
              {user.name}
            </h2>

            {/* Points badge - Prominent and responsive */}
            <div className="inline-flex items-center gap-2 bg-white/25 backdrop-blur-sm rounded-full px-4 sm:px-5 py-2 sm:py-2.5 mb-3 shadow-lg border border-white/30">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              <span className="font-bold text-sm sm:text-base">{user.points.toLocaleString()} Points</span>
            </div>

            {/* Member ID - Responsive */}
            {showMembershipId && (
              <div className="flex items-center justify-center sm:justify-start gap-2 text-white/90 text-xs sm:text-sm">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="font-mono tracking-wider">
                  ID: {user.id.slice(-8).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card body with details - Responsive grid */}
      <CardContent className="p-3 sm:p-3 lg:p-8">
        <div className="grid gap-0 sm:gap-3">

          {/* Phone */}
          {user.phone && (
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
              <div className="p-2 sm:p-2.5 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors duration-200 shrink-0">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-0.5">Phone</p>
                <p className="font-normal text-sm sm:text-base">{user.phone}</p>
              </div>
            </div>
          )}

          {/* Address */}
          {user.address && (
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
              <div className="p-2 sm:p-2.5 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors duration-200 shrink-0">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-0.5">Alamat</p>
                <p className="font-normal text-sm sm:text-base">{user.address}</p>
              </div>
            </div>
          )}

          {/* Email */}
          {user.email && (
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
              <div className="p-2 sm:p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors duration-200 shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-0.5">Email</p>
                <p className="font-normal text-sm sm:text-base break-all">{user.email}</p>
              </div>
            </div>
          )}

          {/* Birthday */}
          {user.birthday && (
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
              <div className="p-2 sm:p-2.5 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors duration-200 shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-0.5">Birthday</p>
                <p className="font-normal text-sm sm:text-base">
                  {formatDate(user.birthday)}
                  {birthdayInfo && (
                    <span className="text-muted-foreground ml-2 text-xs sm:text-sm font-normal">
                      ({birthdayInfo.years} tahun {birthdayInfo.months} bulan {birthdayInfo.days} hari)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Member Since */}
          <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 transition-colors duration-200 group">
            <div className="p-2 sm:p-2.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors duration-200 shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-0.5">Member Since</p>
              <p className="font-normal text-sm sm:text-base">{formatDate(user.createdAt)}</p>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogTitle></DialogTitle>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-0">
          <div className="relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={() => setShowImagePreview(false)}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Image container */}
            <div className="relative w-full min-h-[300px] max-h-[80vh] flex items-center justify-center p-4 sm:p-8">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                    <span className="text-5xl font-bold text-white">{initials}</span>
                  </div>
                  <p className="text-white/70 text-sm">No profile picture available</p>
                </div>
              )}
            </div>

            {/* User info overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg sm:text-xl mb-1">{user.name}</h3>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>{user.points.toLocaleString()} Points</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}