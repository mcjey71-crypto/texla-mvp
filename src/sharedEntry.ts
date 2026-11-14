import {readShareLink, validAccess, type SharedAccess} from '../shared/collaboration';

const KEY = 'texla-pending-shared-entry';
// Retain only the invitation capability while the browser visits the login provider.
// localStorage also supports opening the email callback in a new tab on this device.
export function rememberSharedEntry() {
  const access = readShareLink(window.location.hash);
  if (access) localStorage.setItem(KEY, JSON.stringify({access, created:Date.now()}));
}
export function pendingSharedEntry(): SharedAccess | null {
  try {
    const item = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (item && Number.isFinite(item.created) && Date.now() - item.created >= 0 && Date.now() - item.created < 3600000 && validAccess(item.access)) return item.access;
  } catch { /* Invalid or unavailable local storage cannot supply an invitation. */ }
  clearSharedEntry(); return null;
}
export function clearSharedEntry() { try { localStorage.removeItem(KEY); } catch { /* The current URL still works. */ } }
