const SUPABASE_URL = process.env.SUPABASE_URL || 'https://txyknazfufashgzlxkqh.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function backendHeaders(extra = {}) {
  const backendKey = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!backendKey) throw new Error('SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente na Vercel');
  const headers = { apikey: backendKey, 'Content-Type': 'application/json', ...extra };
  if (!backendKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${backendKey}`;
  return headers;
}

function normalizePhone(value = '') {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

function isValidUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ''));
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
  const res = await fetch(url, { ...options, headers: backendHeaders(options.headers || {}) });
  const raw = await res.text();
  let data = raw;
  try { data = JSON.parse(raw); } catch(e) {}
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function findExistingMap({ userId, instance, lid }) {
  const data = await supabaseFetch(
    `whatsapp_contact_map?select=*&user_id=eq.${encodeURIComponent(userId)}&instance=eq.${encodeURIComponent(instance)}&lid=eq.${encodeURIComponent(lid)}&limit=1`,
    { method:'GET' }
  );
  return Array.isArray(data) ? data[0] || null : null;
}


async function listMaps({ userId }) {
  const data = await supabaseFetch(
    `whatsapp_contact_map?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1000`,
    { method:'GET' }
  );
  return Array.isArray(data) ? data : [];
}

async function saveContactMap({ userId, instance, lid, leadId, phoneReal, pushName }) {
  const now = new Date().toISOString();
  const record = {
    user_id: userId,
    instance,
    lid,
    lead_id: leadId,
    phone_real: phoneReal,
    push_name: pushName || null,
    updated_at: now
  };

  const existing = await findExistingMap({ userId, instance, lid });
  if (existing?.id) {
    const data = await supabaseFetch(
      `whatsapp_contact_map?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method:'PATCH',
        headers:{ Prefer:'return=representation' },
        body: JSON.stringify(record)
      }
    );
    return Array.isArray(data) ? data[0] : data;
  }

  const data = await supabaseFetch('whatsapp_contact_map', {
    method:'POST',
    headers:{ Prefer:'return=representation' },
    body: JSON.stringify({ ...record, created_at: now })
  });
  return Array.isArray(data) ? data[0] : data;
}

async function updateExistingMessages({ userId, instance, lid, leadId, phoneReal }) {
  const data = await supabaseFetch(
    `whatsapp_messages?user_id=eq.${encodeURIComponent(userId)}&instance=eq.${encodeURIComponent(instance)}&phone=eq.${encodeURIComponent(lid)}`,
    {
      method:'PATCH',
      headers:{ Prefer:'return=representation' },
      body: JSON.stringify({
        lead_id: leadId,
        updated_at: new Date().toISOString()
      })
    }
  );
  return Array.isArray(data) ? data.length : 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ success:false, error:'Method not allowed' });

  try {
    if (req.method === 'GET') {
      const userId = String(req.query?.user_id || req.query?.userId || '').trim();
      if (!isValidUuid(userId)) throw new Error('user_id inválido ou ausente');
      const maps = await listMaps({ userId });
      return res.status(200).json({ success:true, maps });
    }

    const body = req.body || {};
    const userId = String(body.user_id || body.userId || '').trim();
    const instance = String(body.instance || '').trim();
    const lid = normalizePhone(body.lid || body.phone_lid || '');
    const leadId = String(body.lead_id || body.leadId || '').trim();
    const phoneReal = normalizePhone(body.phone_real || body.phoneReal || body.phone || '');
    const pushName = String(body.push_name || body.pushName || '').trim();

    if (!isValidUuid(userId)) throw new Error('user_id inválido ou ausente');
    if (!instance) throw new Error('instance ausente');
    if (!lid) throw new Error('lid ausente');
    if (!leadId) throw new Error('lead_id ausente');
    if (!phoneReal) throw new Error('phone_real ausente');

    const map = await saveContactMap({ userId, instance, lid, leadId, phoneReal, pushName });
    const updatedMessages = await updateExistingMessages({ userId, instance, lid, leadId, phoneReal });

    return res.status(200).json({ success:true, map, updatedMessages });
  } catch (error) {
    console.error('[api/whatsapp/contact-map] error', error?.message || error);
    return res.status(500).json({ success:false, error:error?.message || 'Erro ao associar conversa' });
  }
}
