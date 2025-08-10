import { b64url } from './crypto.ts';

export async function verifyHS256(jwt: string, secret: string): Promise<any> {
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) throw new Error("Malformed token");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const ok = await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("Invalid signature");
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0))));
  if (payload.exp && payload.exp*1000 < Date.now()) throw new Error("Token expired");
  return payload;
}

export async function signHS256(payload: Record<string,unknown>, secret: string, ttlSeconds=600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const withExp = { iat: now, exp: now + ttlSeconds, ...payload };
  const enc = new TextEncoder();
  const encHeader = b64url(enc.encode(JSON.stringify(header)));
  const encPayload = b64url(enc.encode(JSON.stringify(withExp)));
  const data = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}