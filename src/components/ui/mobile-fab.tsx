'use client';

interface MobileFabProps {
  onPress: () => void;
  label?: string;
}

export function MobileFab({ onPress, label = 'Tambah' }: MobileFabProps) {
  return (
    <div className="sm:hidden fixed bottom-24 right-6 z-50">
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        className="w-12 h-12 rounded-full bg-[#00a090] text-white shadow-lg
                   flex items-center justify-center
                   hover:bg-[#007868] active:scale-95 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5"  y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
