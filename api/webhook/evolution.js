const SUPABASE_URL = process.env.SUPABASE_URL || 'https://txyknazfufashgzlxkqh.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVOLUTION_WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function stripJid(value = '') {
  return String(value || '').split('@')[0];
}

function pickPhoneSource({ remoteJid = '', from = '', sender = '', participant = '', direction = 'in' } = {}) {
  const remote = String(remoteJid || '');
  const senderValue = String(sender || '');
  const fromValue = String(from || '');
  const participantValue = String(participant || '');

  // Evolution/Baileys can send LID identifiers in remoteJid. In that case,
  // the real WhatsApp phone usually comes in sender as @s.whatsapp.net.
  if (remote.endsWith('@lid') && senderValue.endsWith('@s.whatsapp.net')) {
    return {
      source: 'sender',
      raw: senderValue,
      reason: 'remoteJid_lid_sender_whatsapp'
    };
  }

  if (fromValue && !fromValue.endsWith('@lid')) {
    return {
      source: 'from',
      raw: fromValue,
      reason: 'from_available'
    };
  }

  if (senderValue && !senderValue.endsWith('@lid')) {
    return {
      source: 'sender',
      raw: senderValue,
      reason: 'sender_available'
    };
  }

  if (participantValue && !participantValue.endsWith('@lid')) {
    return {
      source: 'participant',
      raw: participantValue,
      reason: 'participant_available'
    };
  }

  return {
    source: 'remoteJid',
    raw: remote,
    reason: 'fallback_remoteJid'
  };
}

function extractMessage(payload = {}, userId = '') {
  const data = payload.data || payload;
  const key = data.key || {};
  const msg = data.message || data.messageData || {};

  const remoteJid =
    key.remoteJid ||
    data.remoteJid ||
    data.from ||
    data.sender ||
    '';

  const from = data.from || payload.from || '';
  const sender = data.sender || payload.sender || '';
  const participant = key.participant || data.participant || '';
  const direction = Boolean(key.fromMe || data.fromMe) ? 'out' : 'in';
  const phoneSource = pickPhoneSource({ remoteJid, from, sender, participant, direction });
  const phone = normalizePhone(stripJid(phoneSource.raw));

  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    data.text ||
    data.body ||
    data.message?.conversation ||
    '';

  const messageType =
    msg.imageMessage ? 'image' :
    msg.videoMessage ? 'video' :
    msg.audioMessage ? 'audio' :
    msg.documentMessage ? 'document' :
    'text';

  return {
    externalId: key.id || data.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    userId,
    instance: String(payload.instance || data.instance || '').trim(),
    phone,
    leadId: null,
    direction,
    messageType,
    body: text,
    occurredAt: new Date().toISOString(),
    debug: {
      event: payload.event || data.event || payload.type || data.type || '',
      remoteJid,
      from,
      sender,
      participant,
      pushName: data.pushName || data.pushname || payload.pushName || payload.pushname || '',
      phoneSource: phoneSource.source,
      phoneSourceRaw: phoneSource.raw,
      phoneSourceReason: phoneSource.reason,
      phoneExtracted: phone,
      phoneNormalized: phone,
      keyFromMe: key.fromMe,
      dataFromMe: data.fromMe,
      rawInstance: payload.instance || data.instance || '',
      bodyPreview: String(text || '').slice(0, 240)
    }
  };
}

function getUserId(req, payload = {}) {
  return String(
    req.query?.user_id ||
    req.headers['x-supabase-user-id'] ||
    payload.user_id ||
    payload.data?.user_id ||
    ''
  ).trim();
}

function isValidUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getProvidedSecret(req) {
  const authorization = String(req.headers.authorization || '');
  return String(
    req.headers['x-webhook-secret'] ||
    req.query?.secret ||
    authorization.replace(/^Bearer\s+/i, '') ||
    ''
  );
}

async function findLeadByPhoneForDebug(userId, phone) {
  const backendKey = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!backendKey || !phone) {
    return {
      query: null,
      lead: null,
      error: !backendKey ? 'SUPABASE_SECRET_KEY ausente' : 'phone ausente'
    };
  }

  const baseUrl = SUPABASE_URL.replace(/\/$/, '');
  const encodedPhone = encodeURIComponent(phone);
  const encodedUserId = encodeURIComponent(userId || '');
  const query = `${baseUrl}/rest/v1/leads?select=id,company_name,phone,user_id&phone=eq.${encodedPhone}&user_id=eq.${encodedUserId}&limit=1`;
  const headers = {
    apikey: backendKey,
    'Content-Type': 'application/json'
  };
  if (!backendKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${backendKey}`;
  }

  try {
    const res = await fetch(query, { method: 'GET', headers });
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { data = raw; }
    if (!res.ok) {
      return {
        query: `leads phone=eq.${phone} user_id=eq.${userId}`,
        lead: null,
        error: `Supabase HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
      };
    }
    return {
      query: `leads phone=eq.${phone} user_id=eq.${userId}`,
      lead: Array.isArray(data) ? data[0] || null : null,
      error: null
    };
  } catch (error) {
    return {
      query: `leads phone=eq.${phone} user_id=eq.${userId}`,
      lead: null,
      error: error?.message || 'lead lookup error'
    };
  }
}

async function persistMessage(message) {
  const backendKey = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!backendKey) {
    throw new Error('SUPABASE_SECRET_KEY ausente na Vercel');
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/whatsapp_messages?on_conflict=instance,external_id`;
  const headers = {
    apikey: backendKey,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation'
  };
  if (!backendKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${backendKey}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      external_id: message.externalId,
      user_id: message.userId,
      lead_id: message.leadId || null,
      instance: message.instance,
      phone: message.phone,
      direction: message.direction,
      message_type: message.messageType,
      body: message.body,
      status: message.direction === 'in' ? 'received' : 'sent',
      occurred_at: message.occurredAt
    })
  });

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { data = raw; }

  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Consulta pública desativada. Use o CRM autenticado.'
    });
  }

  const receivedSecret = getProvidedSecret(req);
  const expectedSecret = EVOLUTION_WEBHOOK_SECRET;
  const receivedUserIdForLog = String(
    req.query?.user_id ||
    req.headers['x-supabase-user-id'] ||
    req.body?.user_id ||
    req.body?.data?.user_id ||
    ''
  ).trim();

  if (expectedSecret && receivedSecret !== expectedSecret) {
    console.error('[webhook/evolution][401]', {
      reason: 'secret_mismatch',
      expectedSecret,
      receivedSecret,
      receivedUserId: receivedUserIdForLog,
      resolvedUserId: receivedUserIdForLog,
      hasExpectedSecret: Boolean(expectedSecret),
      hasReceivedSecret: Boolean(receivedSecret),
      method: req.method,
      url: req.url
    });

    return res.status(401).json({
      success: false,
      error: 'Webhook não autorizado',
      reason: 'secret_mismatch'
    });
  }

  try {
    const userId = getUserId(req, req.body || {});
    if (!isValidUuid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Webhook sem user_id válido. Copie novamente a URL exibida no CRM.'
      });
    }

    const message = extractMessage(req.body || {}, userId);

    if (!message.phone || !message.instance) {
      return res.status(200).json({
        success: true,
        stored: false,
        ignored: 'Evento sem telefone ou instância'
      });
    }

    const leadDebug = await findLeadByPhoneForDebug(userId, message.phone);
    message.leadId = leadDebug.lead?.id || null;

    console.log('[webhook/evolution][incoming-debug]', {
      instance: message.instance,
      event: message.debug?.event || '',
      remoteJid: message.debug?.remoteJid || '',
      from: message.debug?.from || '',
      sender: message.debug?.sender || '',
      participant: message.debug?.participant || '',
      phoneSource: message.debug?.phoneSource || '',
      phoneSourceRaw: message.debug?.phoneSourceRaw || '',
      phoneSourceReason: message.debug?.phoneSourceReason || '',
      phoneExtracted: message.debug?.phoneExtracted || message.phone,
      phoneNormalized: message.debug?.phoneNormalized || message.phone,
      pushName: message.debug?.pushName || '',
      body: message.debug?.bodyPreview || '',
      direction: message.direction,
      leadIdFound: leadDebug.lead?.id || null,
      leadNameFound: leadDebug.lead?.company_name || null,
      leadPhoneFound: leadDebug.lead?.phone || null,
      leadLookupQuery: leadDebug.query,
      leadLookupError: leadDebug.error
    });

    const stored = await persistMessage(message);

    return res.status(200).json({
      success: true,
      stored: true,
      id: stored?.id || null,
      externalId: message.externalId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Webhook error'
    });
  }
}
