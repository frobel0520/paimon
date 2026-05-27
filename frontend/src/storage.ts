const KEY = "paimon_user_id";

export function getStoredUserId(): number | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function setStoredUserId(id: number): void {
  localStorage.setItem(KEY, String(id));
}

export function clearStoredUserId(): void {
  localStorage.removeItem(KEY);
}
