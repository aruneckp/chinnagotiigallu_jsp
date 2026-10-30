import { SESSION_KEY } from "../config.js";

// The voter list ships encrypted (see vite.config.js). The user id and password
// are the key: a wrong pair fails to decrypt, so there is nothing to compare against.
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const blob = async () => (await import("virtual:voters")).default;

async function decrypt(key) {
  const { iv, ct } = await blob();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(iv) }, key, b64(ct));
  const text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(text);
}

const store = (remember) => { try { return remember ? localStorage : sessionStorage; } catch { return null; } };

export async function unlock(user, pass, remember) {
  if (!globalThis.crypto?.subtle) throw new Error("insecure");
  const { iter, salt } = await blob();
  const base = await crypto.subtle.importKey("raw",
    new TextEncoder().encode(`${user.trim().toLowerCase()}\n${pass}`), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(salt), iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  const data = await decrypt(key);
  try { store(remember)?.setItem(SESSION_KEY, toB64(await crypto.subtle.exportKey("raw", key))); } catch {}
  return data;
}

// Reopens the list without asking again while the saved key is still valid
// (a new build has a new salt, so everyone signs in again after a deploy).
export async function resume() {
  let saved = null;
  try { saved = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch {}
  if (!saved || !globalThis.crypto?.subtle) return null;
  try {
    return await decrypt(await crypto.subtle.importKey("raw", b64(saved), "AES-GCM", false, ["decrypt"]));
  } catch { lock(); return null; }
}

export function lock() {
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch {}
}
