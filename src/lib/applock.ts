// Lightweight on-device app lock. A PIN is stored only as a salted SHA-256
// hash in localStorage — never in plain text. This is a privacy gate over the
// local data on the device, not a substitute for account auth.

const SALT_KEY = 'pa_lock_salt'
const HASH_KEY = 'pa_lock_hash'

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export function hasPin(): boolean {
  return !!localStorage.getItem(SALT_KEY) && !!localStorage.getItem(HASH_KEY)
}

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = toHex(salt.buffer)
  const hash = await hashPin(pin, saltHex)
  localStorage.setItem(SALT_KEY, saltHex)
  localStorage.setItem(HASH_KEY, hash)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const saltHex = localStorage.getItem(SALT_KEY)
  const stored = localStorage.getItem(HASH_KEY)
  if (!saltHex || !stored) return false
  const hash = await hashPin(pin, saltHex)
  return hash === stored
}

export function clearPin(): void {
  localStorage.removeItem(SALT_KEY)
  localStorage.removeItem(HASH_KEY)
}
