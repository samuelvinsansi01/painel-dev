const SUPABASE_URL = process.env.SUPABASE_URL || 'https://txyknazfufashgzlxkqh.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizePhone(value = '') {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

function isValidUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function makeExternalId(value = '') {
  const clean = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  return clean || `out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function persistOutgoing(body = {}) {
  const backendKey = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!backendKey) throw new Error('SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente na Vercel');

  const userId = String(body.user_id || body.userId || '').trim();
  if (!isValidUuid(userId)) throw new Error('user_id inválido ou ausente');

  const instance = String(body.instance || '').trim();
  const phone = normalizePhone(body.phone || body.phone_normalized || '');
  const text = String(body.body || body.text || '');
  if (!instance) throw new Error('instance ausente');
  if (!phone) throw new Error('phone ausente');
  if (!text) throw new Error('body/text ausente');

  const record = {
    external_id: makeExternalId(body.external_id || body.id),
    user_id: userId,
    lead_id: body.lead_id || body.leadId || null,
    instance,
    phone,
    phone_normalized: normalizePhone(phone),
    direction: 'out',
    message_type: body.message_type || 'text',
    body: text,
    status: body.status || 'sent',
    occurred_at: body.occurred_at || body.occurredAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_payload: body.raw_payload || body.response || null
  };

  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/whatsapp_messages?on_conflict=instance,external_id`;
  const headers = {
    apikey: backendKey,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation'
  };
  if (!backendKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${backendKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(record)
  });

  const raw = await res.text();
  let data = raw;
  try { data = JSON.parse(raw); } catch(e) {}

  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Method not allowed' });

  try {
    const stored = await persistOutgoing(req.body || {});
    return res.status(200).json({ success:true, stored:true, id:stored?.id || null, external_id:stored?.external_id || null });
  } catch (error) {
    return res.status(500).json({ success:false, error:error?.message || 'Erro ao salvar mensagem enviada' });
  }
}
