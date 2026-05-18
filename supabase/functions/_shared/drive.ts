// Shared Google Drive helpers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DRIVE_STATE_TTL_MS = 10 * 60 * 1000;

function toBase64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(normalized + padding);
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const bytes = Array.from(new Uint8Array(signature), (byte) => String.fromCharCode(byte)).join("");
  return toBase64Url(bytes);
}

export function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export async function createDriveOAuthState(returnTo: string) {
  const payload = toBase64Url(JSON.stringify({
    returnTo,
    exp: Date.now() + DRIVE_STATE_TTL_MS,
  }));
  const signature = await signValue(payload);
  return `${payload}.${signature}`;
}

export async function verifyDriveOAuthState(state: string): Promise<{ returnTo: string } | null> {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await signValue(payload);
  if (signature !== expectedSignature) return null;

  const parsed = JSON.parse(fromBase64Url(payload));
  if (!parsed?.returnTo || typeof parsed.returnTo !== "string") return null;
  if (!parsed?.exp || Number(parsed.exp) < Date.now()) return null;

  return { returnTo: parsed.returnTo };
}

export async function getDriveSettings() {
  const sb = admin();
  const { data, error } = await sb
    .from("drive_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function refreshAccessTokenIfNeeded(): Promise<string | null> {
  const settings = await getDriveSettings();
  if (!settings?.refresh_token) return null;

  const expiresAt = settings.token_expires_at
    ? new Date(settings.token_expires_at).getTime()
    : 0;
  // Refresh 60 seconds before expiry
  if (settings.access_token && expiresAt > Date.now() + 60_000) {
    return settings.access_token;
  }

  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: settings.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`refresh_token failed: ${JSON.stringify(json)}`);
  }
  const accessToken = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3600;
  const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await admin()
    .from("drive_settings")
    .update({
      access_token: accessToken,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return accessToken;
}

export async function uploadToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  content: Blob | string,
  mimeType = "application/json",
): Promise<{ id: string }> {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType,
  };

  const boundary = "lovable_boundary_" + crypto.randomUUID();
  const delim = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body =
    delim +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delim +
    `Content-Type: ${mimeType}\r\n\r\n` +
    (typeof content === "string" ? content : await content.text()) +
    closeDelim;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Drive upload failed: ${JSON.stringify(json)}`);
  return { id: json.id };
}

export async function completeDriveOAuth(code: string, redirectUri: string) {
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(`token exchange: ${JSON.stringify(tok)}`);

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const userInfo = await userRes.json();
  if (!userRes.ok) throw new Error(`userinfo: ${JSON.stringify(userInfo)}`);

  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();

  await admin().from("drive_settings").upsert({
    id: 1,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    token_expires_at: expiresAt,
    connected_email: userInfo.email,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return { email: userInfo.email as string | null };
}
