'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>You're currently offline. Some features may be limited.</span>
    </div>
  );
}
