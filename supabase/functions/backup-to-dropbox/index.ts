// ════════════════════════════════════════════════════════════════════
//  backup-to-dropbox — Edge function สำหรับ snapshot Supabase → Dropbox
//
//  Endpoint:  POST https://<project>.supabase.co/functions/v1/backup-to-dropbox
//  Returns:   { ok, filename, size_kb, tables: {name: count} }
//
//  Flow:
//   1. ดึงข้อมูลทุก table ใน thira + public schemas
//   2. ประกอบเป็น JSON snapshot เดียว (snapshot_YYYY-MM-DD_HH-mm.json)
//   3. อัพโหลดไป Dropbox path /THIRA_BACKUP/<filename>
//   4. คืนผลให้ frontend
//
//  Env vars (มีอยู่แล้วจาก line-webhook):
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   - DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN
//
//  Deploy: supabase functions deploy backup-to-dropbox --no-verify-jwt
// ════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DBX_KEY = Deno.env.get("DROPBOX_APP_KEY")!;
const DBX_SEC = Deno.env.get("DROPBOX_APP_SECRET")!;
const DBX_REFRESH = Deno.env.get("DROPBOX_REFRESH_TOKEN")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

// Tables ที่จะ backup — schema.table
const TABLES: Array<{ schema: string; name: string }> = [
  { schema: "thira", name: "outcomes" },
  { schema: "thira", name: "incomes" },
  { schema: "thira", name: "extra_trips" },
  { schema: "thira", name: "fuel_periods" },
  { schema: "thira", name: "trucks" },
  { schema: "thira", name: "prices" },
  { schema: "thira", name: "prefix_factory_map" },
  { schema: "thira", name: "line_pending_bills" },
  { schema: "public", name: "freight_price_sets" },
];

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    // 1. ดึงข้อมูลทุก table ขนานกัน
    const snapshot: any = {
      meta: {
        created_at: new Date().toISOString(),
        source: "supabase",
        project: "eurnevjtzxansothqney",
      },
      tables: {},
    };
    const counts: Record<string, number> = {};

    const fetches = TABLES.map(async (t) => {
      const { data, error } = await sb.schema(t.schema).from(t.name).select("*");
      if (error) {
        console.warn(`fetch ${t.schema}.${t.name} failed:`, error.message);
        snapshot.tables[`${t.schema}.${t.name}`] = { error: error.message, rows: [] };
        counts[`${t.schema}.${t.name}`] = 0;
        return;
      }
      snapshot.tables[`${t.schema}.${t.name}`] = { rows: data || [] };
      counts[`${t.schema}.${t.name}`] = data?.length || 0;
    });
    await Promise.all(fetches);

    // 2. แปลงเป็น JSON string
    const jsonStr = JSON.stringify(snapshot);
    const sizeKB = Math.round(new Blob([jsonStr]).size / 1024);

    // 3. ตั้งชื่อไฟล์ snapshot_2026-05-25_15-30.json (Bangkok time)
    const bkkOffset = 7 * 60;
    const now = new Date(Date.now() + bkkOffset * 60 * 1000);
    const stamp = now.toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 16);
    const filename = `snapshot_${stamp}.json`;
    const dbxPath = `/THIRA_BACKUP/${filename}`;

    // 4. แลก access token จาก refresh token
    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: DBX_REFRESH,
        client_id: DBX_KEY,
        client_secret: DBX_SEC,
      }),
    });
    if (!tokenRes.ok) {
      return json({ error: "Dropbox token refresh failed: " + (await tokenRes.text()) }, 500);
    }
    const { access_token: dbxAccess } = await tokenRes.json();

    // 5. Upload to Dropbox
    const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${dbxAccess}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dbxPath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: jsonStr,
    });
    if (!uploadRes.ok) {
      const errTxt = await uploadRes.text();
      return json({ error: "Dropbox upload failed: " + errTxt }, 500);
    }

    return json({
      ok: true,
      filename,
      path: dbxPath,
      size_kb: sizeKB,
      tables: counts,
      total_rows: Object.values(counts).reduce((s, n) => s + n, 0),
    });
  } catch (e) {
    console.error("backup error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(obj: any, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
