/**
 * Local authentication service.
 *
 * The project is frontend-only (no backend required), so accounts live in the browser's
 * localStorage. Passwords are never stored in plain text: each user gets a random 16-byte
 * salt and the password is stretched with PBKDF2-SHA-256 (120 000 iterations) via the
 * Web Crypto API. Sessions are random 32-byte tokens with a 12-hour expiry.
 *
 * Limitation (documented): localStorage is per-browser and readable by scripts on the same
 * origin, so this is suitable for a local academic demo, not for real multi-user security.
 * The `AuthService` interface lets you swap in a server implementation (e.g. Express + JWT)
 * without touching any page.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: number;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface AuthService {
  register(input: { name: string; email: string; password: string; role?: string }): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): void;
  currentUser(): User | null;
  ensureDemoAccount(): Promise<void>;
}

const USERS_KEY = 'fleetmind.users.v1';
const SESSION_KEY = 'fleetmind.session.v1';
const ITERATIONS = 120_000;
const SESSION_MS = 12 * 60 * 60 * 1000;

export const DEMO_EMAIL = 'demo@fleetmind.dev';
export const DEMO_PASSWORD = 'demo1234';

export class AuthError extends Error {}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a);
}

async function derive(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

/** Constant-time string comparison to avoid leaking hash prefixes through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function publicUser(u: StoredUser): User {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address';
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers';
  return null;
}

export const localAuthService: AuthService = {
  async register({ name, email, password, role }) {
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!n) throw new AuthError('Enter your name');
    const emailErr = validateEmail(e);
    if (emailErr) throw new AuthError(emailErr);
    const pwErr = validatePassword(password);
    if (pwErr) throw new AuthError(pwErr);
    const users = readUsers();
    if (users.some((u) => u.email === e)) throw new AuthError('An account with this email already exists');
    const salt = randomHex(16);
    const hash = await derive(password, salt);
    const user: StoredUser = { id: randomHex(8), name: n, email: e, role: role?.trim() || 'Fleet operator', createdAt: Date.now(), salt, hash };
    writeUsers([...users, user]);
    startSession(user.id);
    return publicUser(user);
  },

  async login(email, password) {
    const e = email.trim().toLowerCase();
    const user = readUsers().find((u) => u.email === e);
    // Derive even when the user does not exist so response time does not reveal it.
    const hash = await derive(password, user?.salt ?? '00'.repeat(16));
    if (!user || !safeEqual(hash, user.hash)) throw new AuthError('Email or password is incorrect');
    startSession(user.id);
    return publicUser(user);
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  currentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      if (s.expiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      const u = readUsers().find((x) => x.id === s.userId);
      return u ? publicUser(u) : null;
    } catch {
      return null;
    }
  },

  async ensureDemoAccount() {
    if (readUsers().some((u) => u.email === DEMO_EMAIL)) return;
    const salt = randomHex(16);
    const hash = await derive(DEMO_PASSWORD, salt);
    writeUsers([
      ...readUsers(),
      { id: randomHex(8), name: 'Demo Operator', email: DEMO_EMAIL, role: 'Fleet operator', createdAt: Date.now(), salt, hash },
    ]);
  },
};

function startSession(userId: string): void {
  const s: Session = { token: randomHex(32), userId, expiresAt: Date.now() + SESSION_MS };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
