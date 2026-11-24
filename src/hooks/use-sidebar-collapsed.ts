'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cb:sidebar';
const CHANGE_EVENT = 'cb:sidebar-change';

// Status sidebar disimpan sebagai atribut `data-sidebar="collapsed"` di <html>
// (diset lebih awal oleh skrip kecil di root layout agar tidak berkedip saat load).
// CSS membaca atribut itu lewat variabel --sidebar-w, jadi lebar sidebar, topbar,
// dan margin konten di semua layout ikut berubah tanpa state React bersama.
function applyAttribute(collapsed: boolean) {
  const el = document.documentElement;
  if (collapsed) el.dataset.sidebar = 'collapsed';
  else delete el.dataset.sidebar;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      applyAttribute(e.newValue === 'collapsed'); // sinkron antar tab
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const getSnapshot = () => document.documentElement.dataset.sidebar === 'collapsed';
const getServerSnapshot = () => false;

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCollapsed = useCallback((value: boolean) => {
    applyAttribute(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'collapsed' : 'expanded');
    } catch {
      /* penyimpanan diblokir: tetap berfungsi untuk sesi ini */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(document.documentElement.dataset.sidebar !== 'collapsed');
  }, [setCollapsed]);

  return { collapsed, setCollapsed, toggle };
}
