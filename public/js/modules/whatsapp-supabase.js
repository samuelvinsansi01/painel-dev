/* ════════════════════════════
   SUPABASE WHATSAPP MESSAGES V41.2
════════════════════════════ */
const WHATSAPP_OUTBOX_V412_KEY = 'vs_whatsapp_outbox_v412';
const WHATSAPP_MESSAGES_CACHE_V412_KEY = 'vs_whatsapp_messages_cache_v412';
const WHATSAPP_MESSAGES_DEBUG_V413 = true;
function debugWhatsappPersistV413(step, data = {}) {
  if (!WHATSAPP_MESSAGES_DEBUG_V413) return;
  try {
    console.groupCollapsed(`[whatsapp_messages][persist] ${step}`);
    console.log(data);
    console.groupEnd();
  } catch (e) {
    console.log(`[whatsapp_messages][persist] ${step}`, data);
  }
}
let supabaseWhatsappMessagesCacheV412 = [];

function normalizeWhatsappDigitsV412(value = '') {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

function getWhatsappConversationKeyV412(message = {}) {
  const leadId = String(message.leadId || message.lead_id || '').trim();
  if (leadId) return leadId;
  const phone = normalizeWhatsappDigitsV412(message.phone_normalized || message.phone || '');
  return phone ? `phone:${phone}` : '';
}

function isPhoneConversationKeyV412(key = '') {
  return String(key || '').startsWith('phone:');
}

function getPhoneFromConversationKeyV412(key = '') {
  return isPhoneConversationKeyV412(key) ? String(key).slice(6) : '';
}

function getFallbackContactIdentityByPhoneV416(phone = '') {
  const normalizedPhone = normalizeWhatsappDigitsV412(phone);
  if (!normalizedPhone) return { name:'', isLid:false, remoteJid:'', subtitle:'' };

  const messages = getSupabaseWhatsappMessagesV412()
    .filter(item => phonesMatchV412(item.phone, normalizedPhone))
    .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')));

  const withPushName = messages.find(item => String(item.pushName || '').trim());
  const anyLid = messages.find(item => item.isLid || /@lid$/i.test(String(item.remoteJid || '')));
  const name = String(withPushName?.pushName || '').trim();
  const isLid = !!anyLid || (!String(normalizedPhone).startsWith('55') && String(normalizedPhone).length > 12);
  return {
    name,
    isLid,
    remoteJid: String(anyLid?.remoteJid || withPushName?.remoteJid || '').trim(),
    subtitle: isLid ? `Identificador WhatsApp: ${normalizedPhone}` : normalizedPhone
  };
}

function loadSupabaseWhatsappMessagesCacheV412() {
  try {
    const data = JSON.parse(localStorage.getItem(WHATSAPP_MESSAGES_CACHE_V412_KEY) || '[]');
    supabaseWhatsappMessagesCacheV412 = Array.isArray(data) ? data : [];
  } catch {
    supabaseWhatsappMessagesCacheV412 = [];
  }
  return supabaseWhatsappMessagesCacheV412;
}

function saveSupabaseWhatsappMessagesCacheV412(messages = []) {
  supabaseWhatsappMessagesCacheV412 = Array.isArray(messages) ? messages.slice(0, 500) : [];
  try { localStorage.setItem(WHATSAPP_MESSAGES_CACHE_V412_KEY, JSON.stringify(supabaseWhatsappMessagesCacheV412)); } catch(e) {}
}

function getSupabaseWhatsappMessagesV412() {
  return supabaseWhatsappMessagesCacheV412.length ? supabaseWhatsappMessagesCacheV412 : loadSupabaseWhatsappMessagesCacheV412();
}


/* Mapeamento manual seguro LID -> Lead/telefone real */
function getAllKnownLeadsForWhatsappMapV417() {
  const map = new Map();
  const add = (lead) => {
    if (!lead || !lead.id) return;
    const normalized = {
      ...lead,
      nome: lead.nome || lead.companyName || lead.company_name || lead.title || 'Lead sem nome',
      whatsapp: normalizeWhatsappDigitsV412(lead.whatsapp || lead.phone || lead.telefone || '')
    };
    if (!map.has(normalized.id)) map.set(normalized.id, normalized);
  };

  try { (typeof getLeadBaseData === 'function' ? getLeadBaseData() : []).forEach(add); } catch(e) {}
  try { (typeof getAtribuicaoData === 'function' ? getAtribuicaoData() : []).forEach(add); } catch(e) {}
  try { (typeof getValData === 'function' ? getValData() : []).forEach(add); } catch(e) {}
  try { (typeof getZapBacklog === 'function' ? getZapBacklog() : []).forEach(add); } catch(e) {}
  try { (typeof getInstaFila === 'function' ? getInstaFila() : []).forEach(add); } catch(e) {}
  try { Object.values(typeof getWeekData === 'function' ? (getWeekData()?.days || {}) : {}).flat().forEach(add); } catch(e) {}
  try { Object.values(typeof filaDisparo !== 'undefined' ? (filaDisparo || {}) : {}).flat().forEach(add); } catch(e) {}
  try { (typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : []).forEach(item => { add(item); if (item.leadId) add(findLeadEverywhere(item.leadId)); }); } catch(e) {}
  return Array.from(map.values());
}

function findWhatsappLeadCandidatesForMapV417(query = '') {
  const q = normalizeStr ? normalizeStr(query || '') : String(query || '').toLowerCase();
  return getAllKnownLeadsForWhatsappMapV417()
    .filter(lead => {
      const haystack = [lead.nome, lead.whatsapp, lead.phone, lead.telefone, lead.site, lead.instagram].filter(Boolean).join(' ');
      const norm = normalizeStr ? normalizeStr(haystack) : haystack.toLowerCase();
      return !q || norm.includes(q) || String(lead.whatsapp || '').includes(String(query || '').replace(/\D/g, ''));
    })
    .slice(0, 20);
}

async function associateLidConversationToLeadV417(conversationKey) {
  const resolved = getConversationLeadFromKeyV412(conversationKey || activeConversationLeadV38);
  const lid = normalizeWhatsappDigitsV412(resolved.phone || getPhoneFromConversationKeyV412(conversationKey || activeConversationLeadV38));
  if (!lid || !(resolved.isLid || resolved.lead?.isLid)) {
    notify('Esta conversa não parece ser um identificador LID.', 'warn');
    return;
  }
  if (!currentUser?.id) { notify('Usuário não autenticado.', 'warn'); return; }

  const query = prompt('Digite parte do nome ou telefone do lead para vincular a esta conversa:');
  if (query === null) return;
  const candidates = findWhatsappLeadCandidatesForMapV417(query);
  if (!candidates.length) {
    notify('Nenhum lead encontrado com esse termo.', 'warn');
    return;
  }

  let selected = candidates[0];
  if (candidates.length > 1) {
    const list = candidates.map((lead, i) => `${i + 1}. ${lead.nome || 'Lead sem nome'} — ${lead.whatsapp || lead.phone || lead.telefone || 'sem telefone'}`).join('\n');
    const picked = prompt(`Escolha o número do lead:\n\n${list}`, '1');
    if (picked === null) return;
    const index = Math.max(0, Math.min(candidates.length - 1, Number(picked) - 1));
    selected = candidates[index];
  }

  const phoneReal = normalizeWhatsappDigitsV412(selected.whatsapp || selected.phone || selected.telefone || '');
  if (!phoneReal) { notify('Lead selecionado está sem telefone.', 'warn'); return; }

  const latestMessage = getSupabaseWhatsappMessagesV412()
    .filter(msg => phonesMatchV412(msg.phone, lid))
    .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')))[0];
  const instance = String(latestMessage?.instance || resolved.instance || '').trim() || 'prospecto';
  const pushName = String(resolved.lead?.nome || latestMessage?.pushName || '').trim();

  try {
    const res = await fetch('/api/whatsapp/contact-map', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        instance,
        lid,
        lead_id: selected.id,
        phone_real: phoneReal,
        push_name: pushName || selected.nome || ''
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);

    activeConversationLeadV38 = selected.id;
    await fetchEvolutionResponsesV34({ silent:true });
    try { renderInboxV41(); } catch(e) {}
    try { renderConversationsV38(); } catch(e) {}
    notify(`Conversa vinculada ao lead ${selected.nome || 'selecionado'}.`);
  } catch (error) {
    notify('Erro ao vincular conversa: ' + (error?.message || error), 'err');
  }
}

window.associateLidConversationToLeadV417 = associateLidConversationToLeadV417;


function getPendingOutgoingWhatsappMessagesV412() {
  try {
    const data = JSON.parse(localStorage.getItem(WHATSAPP_OUTBOX_V412_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function savePendingOutgoingWhatsappMessagesV412(list = []) {
  localStorage.setItem(WHATSAPP_OUTBOX_V412_KEY, JSON.stringify(list.slice(-500)));
}

function queuePendingOutgoingWhatsappMessageV412(message = {}) {
  if (!message.id || !message.instance) return;
  const list = getPendingOutgoingWhatsappMessagesV412();
  const key = `${message.instance}:${message.id}`;
  const pending = {
    ...message,
    userId: message.userId || currentUser?.id || '',
    queuedAt: message.queuedAt || new Date().toISOString()
  };
  const index = list.findIndex(item => `${item.instance}:${item.id}` === key);
  if (index >= 0) list[index] = { ...list[index], ...pending };
  else list.push(pending);
  savePendingOutgoingWhatsappMessagesV412(list);
}

function getEvolutionWhatsappExternalIdV412(response = {}, fallback = '') {
  return String(
    response?.key?.id ||
    response?.id ||
    response?.messageId ||
    response?.message?.key?.id ||
    fallback
  );
}

function buildOutgoingWhatsappExternalIdV412(prefix = 'out', response = {}) {
  const evolutionId = getEvolutionWhatsappExternalIdV412(response, '');
  const safeEvolutionId = String(evolutionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const suffix = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  return [prefix, safeEvolutionId, suffix].filter(Boolean).join('_');
}

function getWhatsappRawPayloadV416(rowOrMessage = {}) {
  const raw = rowOrMessage.raw_payload || rowOrMessage.rawPayload || null;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function getWhatsappPushNameV416(rowOrMessage = {}) {
  const raw = getWhatsappRawPayloadV416(rowOrMessage);
  return String(
    rowOrMessage.pushName ||
    rowOrMessage.push_name ||
    rowOrMessage.pushname ||
    raw?.data?.pushName ||
    raw?.data?.pushname ||
    raw?.pushName ||
    raw?.pushname ||
    ''
  ).trim();
}

function getWhatsappRemoteJidV416(rowOrMessage = {}) {
  const raw = getWhatsappRawPayloadV416(rowOrMessage);
  return String(
    rowOrMessage.remoteJid ||
    rowOrMessage.remote_jid ||
    raw?.data?.key?.remoteJid ||
    raw?.data?.remoteJid ||
    raw?.remoteJid ||
    ''
  ).trim();
}

function isWhatsappLidMessageV416(rowOrMessage = {}) {
  const remoteJid = getWhatsappRemoteJidV416(rowOrMessage);
  return /@lid$/i.test(remoteJid);
}

function normalizeSupabaseWhatsappMessageV412(row = {}) {
  const rawPayload = getWhatsappRawPayloadV416(row);
  return {
    id: row.external_id || row.id,
    dbId: row.id || '',
    leadId: row.lead_id || '',
    instance: String(row.instance || '').trim(),
    phone: row.phone_normalized || row.phone || '',
    direction: row.direction === 'out' ? 'out' : 'in',
    text: row.body || '',
    messageType: row.message_type || 'text',
    status: row.status || '',
    receivedAt: row.occurred_at || row.created_at || '',
    readAt: row.read_at || '',
    read: !!row.read_at,
    rawPayload,
    pushName: getWhatsappPushNameV416(row),
    remoteJid: getWhatsappRemoteJidV416(row),
    isLid: isWhatsappLidMessageV416(row)
  };
}

function phonesMatchV412(a, b) {
  const left = String(a || '').replace(/\D/g, '');
  const right = String(b || '').replace(/\D/g, '');
  if (!left || !right) return false;
  return left.endsWith(right.slice(-8)) || right.endsWith(left.slice(-8));
}

function findLeadByPhoneV412(phone) {
  try {
    const legacy = typeof findLeadByPhoneV34 === 'function' ? findLeadByPhoneV34(phone) : null;
    if (legacy) return legacy;
  } catch(e) {}

  const candidates = [];
  try { candidates.push(...(typeof getAtribuicaoData === 'function' ? getAtribuicaoData() : [])); } catch(e) {}
  try { candidates.push(...(typeof getValData === 'function' ? getValData() : [])); } catch(e) {}
  try { candidates.push(...(typeof getInstaFila === 'function' ? getInstaFila() : [])); } catch(e) {}
  try { candidates.push(...Object.values(filaDisparo || {}).flat()); } catch(e) {}
  try {
    (typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : []).forEach(item => {
      candidates.push(item);
      if (item.leadId) {
        const lead = findLeadEverywhere(item.leadId);
        if (lead) candidates.push(lead);
      }
    });
  } catch(e) {}

  return candidates.find(lead => phonesMatchV412(phone, lead.whatsapp || lead.phone || lead.telefone || '')) || null;
}

async function linkSupabaseWhatsappMessageV412(dbId, leadId) {
  if (!dbId || !leadId || !sbClient || !currentUser?.id) return;
  const { error } = await sbClient
    .from('whatsapp_messages')
    .update({ lead_id: leadId, updated_at: new Date().toISOString() })
    .eq('id', dbId)
    .eq('user_id', currentUser.id);
  if (error) console.warn('[whatsapp_messages] vínculo:', error.message);
}

function mergeSupabaseWhatsappMessageV412(message) {
  const lead = message.leadId
    ? findLeadEverywhere(message.leadId)
    : findLeadByPhoneV412(message.phone);
  const leadId = message.leadId || lead?.id || '';

  if (!message.leadId && leadId) {
    message.leadId = leadId;
    linkSupabaseWhatsappMessageV412(message.dbId, leadId).catch(() => {});
  }

  if (!leadId) return message;

  const crm = ensureLeadCrm(leadId, lead || {});
  crm.messages = Array.isArray(crm.messages) ? crm.messages : [];

  const existing = crm.messages.find(item => item.id === message.id);
  const localMessage = {
    id: message.id,
    dbId: message.dbId,
    direction: message.direction,
    text: message.text,
    phone: message.phone,
    instance: message.instance,
    at: message.receivedAt,
    atLabel: message.receivedAt ? new Date(message.receivedAt).toLocaleString('pt-BR') : crmNowLabel(),
    read: message.read
  };

  if (existing) Object.assign(existing, localMessage);
  else crm.messages.push(localMessage);

  if (message.direction === 'in') {
    crm.pipelineStatus = crm.pipelineStatus === 'contato_enviado' ? 'respondeu' : crm.pipelineStatus;
    crm.lastResponseAt = message.receivedAt || new Date().toISOString();
  }

  saveLeadCrm(leadId, crm);
  return { ...message, leadId, applied: true };
}

async function fetchEvolutionResponsesV34(options = {}) {
  const silent = !!options.silent;
  if (!sbClient || !currentUser?.id) return [];

  try {
    await flushPendingOutgoingWhatsappMessagesV412();
    const { data, error } = await sbClient
      .from('whatsapp_messages')
      .select('id,external_id,lead_id,instance,phone,phone_normalized,direction,message_type,body,status,occurred_at,read_at,created_at,raw_payload')
      .eq('user_id', currentUser.id)
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const localMap = new Map(getLocalResponsesV34().map(item => [item.id, item]));
    const allMessages = [];
    (data || []).forEach(row => {
      const message = mergeSupabaseWhatsappMessageV412(normalizeSupabaseWhatsappMessageV412(row));
      allMessages.push(message);
      if (message.direction !== 'in') return;
      localMap.set(message.id, {
        ...(localMap.get(message.id) || {}),
        ...message,
        applied: !!message.leadId
      });
    });
    saveSupabaseWhatsappMessagesCacheV412(
      allMessages.sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')))
    );

    saveLocalResponsesV34(
      Array.from(localMap.values())
        .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')))
        .slice(0, 500)
    );

    try { renderResponsesV34(); } catch(e) {}
    try { renderInboxV41(); } catch(e) {}
    try { renderConversationsV38(); } catch(e) {}
    try { updateBadges(); } catch(e) {}

    if (!silent) notify('Respostas atualizadas.');
    return data || [];
  } catch (err) {
    console.warn('[whatsapp_messages] sincronização:', err?.message || err);
    if (!silent) notify('Erro ao buscar respostas do Supabase.', 'err');
    return [];
  }
}

async function markConversationReadV412(conversationKey) {
  if (!conversationKey) return;
  const now = new Date().toISOString();
  const resolved = getConversationLeadFromKeyV412(conversationKey);
  const leadId = resolved.leadId || (!isPhoneConversationKeyV412(conversationKey) ? conversationKey : '');
  const phone = resolved.phone;

  if (leadId) {
    const crm = ensureLeadCrm(leadId, findLeadEverywhere(leadId) || {});
    (crm.messages || []).forEach(item => { if (item.direction === 'in') item.read = true; });
    saveLeadCrm(leadId, crm);
  }

  const responses = getLocalResponsesV34();
  responses.forEach(item => {
    const sameLead = leadId && item.leadId === leadId;
    const samePhone = phone && phonesMatchV412(item.phone, phone);
    if (sameLead || samePhone) {
      item.read = true;
      item.readAt = item.readAt || now;
    }
  });
  saveLocalResponsesV34(responses);

  if (sbClient && currentUser?.id) {
    let query = sbClient
      .from('whatsapp_messages')
      .update({ read_at: now, updated_at: now })
      .eq('user_id', currentUser.id)
      .eq('direction', 'in')
      .is('read_at', null);
    if (leadId) query = query.eq('lead_id', leadId);
    else if (phone) query = query.or(`phone.eq.${phone},phone_normalized.eq.${phone}`);
    else return;
    const { error } = await query;
    if (error) console.warn('[whatsapp_messages] leitura:', error.message);
  }
}

function formatConversationListDateV412(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((start(now) - start(date)) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday:'long' });
  return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
}

function renderConversationListV38() {
  const box = document.getElementById('conversationListV38');
  if (!box) return;
  const items = getAllConversationLeadsV38();

  if (!items.length) {
    box.innerHTML = '<div class="conversation-empty-v38">// nenhuma conversa ainda</div>';
    updateConversationsBadgeV38();
    return;
  }

  if (!activeConversationLeadV38) activeConversationLeadV38 = items[0].leadId;

  box.innerHTML = items.map(item => {
    const messages = getConversationMessagesV38(item.leadId);
    const last = messages[messages.length - 1];
    const active = item.leadId === activeConversationLeadV38 ? 'active' : '';
    const title = item.lead.nome || item.lead.name || 'Lead';
    const preview = (last?.text || 'Sem mensagens').replace(/\s+/g, ' ').trim();
    const dateLabel = formatConversationListDateV412(last?.at || item.lastAt || '');
    return `
      <div class="conversation-item-v38 ${active}" onclick="openConversationV38('${escHtml(item.leadId)}')">
        <div class="conversation-item-v38-main">
          <div class="conversation-item-v38-top">
            <div class="conversation-item-v38-title">${escHtml(title)}</div>
            <div class="conversation-item-v38-date">${escHtml(dateLabel)}</div>
          </div>
          <div class="conversation-item-v38-preview">${escHtml(preview)}</div>
        </div>
      </div>
    `;
  }).join('');

  updateConversationsBadgeV38();
}

function openConversationV38(leadId) {
  activeConversationLeadV38 = leadId;
  markConversationReadV412(leadId).catch(() => {});
  renderConversationsV38();
  try { renderInboxV41(); } catch(e) {}
}


/* Fonte principal: Supabase whatsapp_messages para Conversas/Caixa de Entrada */
function getConversationLeadFromKeyV412(key = '') {
  if (!key) return { leadId:'', lead:{ nome:'Lead' }, phone:'' };
  if (isPhoneConversationKeyV412(key)) {
    const phone = getPhoneFromConversationKeyV412(key);
    const lead = findLeadByPhoneV412(phone);
    const fallbackIdentity = getFallbackContactIdentityByPhoneV416(phone);
    return {
      leadId: lead?.id || '',
      lead: lead || {
        id:key,
        nome:fallbackIdentity.name || `Número ${phone}`,
        phone,
        whatsapp:phone,
        isLid:fallbackIdentity.isLid,
        whatsappIdentifier: fallbackIdentity.isLid ? phone : '',
        subtitle: fallbackIdentity.subtitle || phone
      },
      phone,
      isLid: fallbackIdentity.isLid,
      subtitle: fallbackIdentity.subtitle || phone
    };
  }
  const lead = findLeadEverywhere(key) || { id:key, nome:'Lead' };
  const phone = normalizeWhatsappDigitsV412(lead.whatsapp || lead.phone || lead.telefone || '');
  return { leadId:key, lead, phone };
}

function getAllConversationLeadsV38() {
  const crm = typeof getLeadCrmStoreSafeV4015 === 'function'
    ? getLeadCrmStoreSafeV4015()
    : (typeof getLeadCrmStore === 'function' ? getLeadCrmStore() : {});
  const messages = getSupabaseWhatsappMessagesV412();
  const map = new Map();

  messages.forEach(message => {
    const key = getWhatsappConversationKeyV412(message);
    if (!key) return;
    const resolved = getConversationLeadFromKeyV412(key);
    const lastAt = message.receivedAt || message.at || '';
    const current = map.get(key) || { leadId:key, lead:resolved.lead, crm:crm[resolved.leadId] || {}, lastAt:'' };
    current.lead = resolved.lead;
    current.crm = crm[resolved.leadId] || current.crm || {};
    if (String(lastAt).localeCompare(String(current.lastAt || '')) > 0) current.lastAt = lastAt;
    map.set(key, current);
  });

  Object.entries(crm || {}).forEach(([leadId, data]) => {
    const hasMessages = Array.isArray(data.messages) && data.messages.length;
    const hasResponse = !!data.lastResponseAt || data.pipelineStatus === 'respondeu';
    if (!hasMessages && !hasResponse) return;
    const lead = findLeadEverywhere(leadId) || { id: leadId, nome: data.nome || 'Lead' };
    const lastAt = data.lastResponseAt || data.lastWhatsappMessage?.sentAt || '';
    const current = map.get(leadId) || { leadId, lead, crm:data, lastAt:'' };
    current.lead = lead;
    current.crm = data;
    if (String(lastAt).localeCompare(String(current.lastAt || '')) > 0) current.lastAt = lastAt;
    map.set(leadId, current);
  });

  try {
    (typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : []).forEach(item => {
      if (!item.leadId || item.status !== 'Enviado') return;
      const lead = findLeadEverywhere(item.leadId) || { id:item.leadId, nome:item.nome || 'Lead' };
      const crmData = crm[item.leadId] || {};
      const lastAt = item.sentAt || item.updatedAt || item.createdAt || '';
      const current = map.get(item.leadId) || { leadId:item.leadId, lead, crm:crmData, lastAt:'' };
      if (String(lastAt).localeCompare(String(current.lastAt || '')) > 0) current.lastAt = lastAt;
      map.set(item.leadId, current);
    });
  } catch(e) {}

  return Array.from(map.values()).sort((a,b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
}

function getConversationMessagesV38(conversationKey) {
  const resolved = getConversationLeadFromKeyV412(conversationKey);
  const realLeadId = resolved.leadId || (!isPhoneConversationKeyV412(conversationKey) ? conversationKey : '');
  const phone = resolved.phone;
  const messages = [];

  getSupabaseWhatsappMessagesV412().forEach(message => {
    const key = getWhatsappConversationKeyV412(message);
    const sameKey = key === conversationKey;
    const sameLead = realLeadId && message.leadId === realLeadId;
    const samePhone = phone && phonesMatchV412(message.phone, phone);
    if (!sameKey && !sameLead && !samePhone) return;
    messages.push({
      id: message.id,
      dbId: message.dbId,
      direction: message.direction,
      text: message.text,
      phone: message.phone,
      instance: message.instance,
      status: message.status,
      at: message.receivedAt,
      atLabel: message.receivedAt ? new Date(message.receivedAt).toLocaleString('pt-BR') : '',
      read: message.read,
      pushName: message.pushName || '',
      remoteJid: message.remoteJid || '',
      isLid: !!message.isLid
    });
  });

  if (realLeadId) {
    try {
      const crm = ensureLeadCrm(realLeadId, findLeadEverywhere(realLeadId) || {});
      (crm.messages || []).forEach(msg => messages.push(msg));
      if (crm.lastWhatsappMessage) {
        messages.push({
          id:'last_' + realLeadId,
          direction:'out',
          text:crm.lastWhatsappMessage.text || '',
          at:crm.lastWhatsappMessage.sentAt || '',
          atLabel:crm.lastWhatsappMessage.sentAtLabel || '',
          chipName:crm.lastWhatsappMessage.chipName || ''
        });
      }
    } catch(e) {}
    try {
      (typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [])
        .filter(item => item.leadId === realLeadId && item.status === 'Enviado')
        .forEach(item => messages.push({
          id:item.id,
          direction:'out',
          text:item.templateText || item.templateName || 'Mensagem enviada',
          at:item.sentAt || item.updatedAt || item.createdAt || '',
          atLabel:item.sentAtLabel || item.createdAtLabel || '',
          chipName:item.chipName || ''
        }));
    } catch(e) {}
  }

  const unique = new Map();
  messages.forEach(message => {
    const key = message.dbId || message.id || `${message.direction}_${message.at}_${message.text}`;
    unique.set(key, message);
  });

  return Array.from(unique.values()).sort((a,b) => String(a.at || '').localeCompare(String(b.at || '')));
}

function renderConversationChatV38() {
  const box = document.getElementById('conversationChatV38');
  if (!box) return;

  if (!activeConversationLeadV38) {
    box.innerHTML = '<div class="conversation-empty-v38">// selecione uma conversa</div>';
    return;
  }

  const resolved = getConversationLeadFromKeyV412(activeConversationLeadV38);
  const lead = resolved.lead || { nome:'Lead' };
  const messages = getConversationMessagesV38(activeConversationLeadV38);
  const phone = normalizeWhatsappDigitsV412(resolved.phone || lead.whatsapp || lead.phone || lead.telefone || '');
  const canReply = !!phone && !lead.isLid;
  const chatTitle = lead.nome || lead.name || 'Lead';
  const chatMeta = lead.isLid
    ? (lead.subtitle || `Identificador WhatsApp: ${phone}`)
    : (phone ? (resolved.leadId ? `Chip: ${messages.find(m => m.instance)?.instance || 'prospecto'}` : phone) : 'sem telefone');

  const associationButton = lead.isLid && !resolved.leadId
    ? `<button class="btn btn-ghost" onclick="associateLidConversationToLeadV417('${escHtml(activeConversationLeadV38)}')">Associar ao lead</button>`
    : '';

  box.innerHTML = `
    <div class="conversation-chat-header-v38">
      <div>
        <div class="conversation-chat-title-v38">${escHtml(chatTitle)}</div>
        <div class="conversation-chat-meta-v38">${escHtml(chatMeta)}</div>
      </div>
      ${associationButton}
    </div>

    <div class="conversation-messages-v38">
      ${messages.length ? messages.map(msg => `
        <div class="message-bubble-v38 ${msg.direction === 'out' ? 'out' : 'in'}">
          ${escHtml(msg.text || '[mensagem sem texto]')}
          <div class="message-time-v38">${escHtml(msg.atLabel || (msg.at ? new Date(msg.at).toLocaleString('pt-BR') : ''))}${msg.instance ? ' · ' + escHtml(msg.instance) : (msg.chipName ? ' · ' + escHtml(msg.chipName) : '')}</div>
        </div>
      `).join('') : '<div class="conversation-empty-v38">// sem mensagens registradas</div>'}
    </div>

    <div class="conversation-reply-v38">
      <textarea id="conversationReplyTextV38" placeholder="Responder este lead..." ${canReply ? '' : 'disabled'}></textarea>
      <button class="btn btn-primary" onclick="sendConversationReplyV38()" ${canReply ? '' : 'disabled'}>Responder</button>
    </div>
  `;
}

function getConversationEvolutionConfigV412(leadId) {
  const resolved = getConversationLeadFromKeyV412(leadId);
  const realLeadId = resolved.leadId || (!isPhoneConversationKeyV412(leadId) ? leadId : '');
  const phone = resolved.phone;
  const responses = getLocalResponsesV34()
    .filter(item => ((realLeadId && item.leadId === realLeadId) || (phone && phonesMatchV412(item.phone, phone))) && item.instance)
    .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')));
  const crm = realLeadId ? (getLeadCrmStoreSafeV4015()[realLeadId] || {}) : {};
  const messages = Array.isArray(crm.messages) ? crm.messages.slice().reverse() : [];
  const supabaseMessages = getSupabaseWhatsappMessagesV412()
    .filter(item => ((realLeadId && item.leadId === realLeadId) || (phone && phonesMatchV412(item.phone, phone))) && item.instance)
    .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')));
  const queue = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];
  const lastQueue = queue.filter(item => item.leadId === realLeadId && item.chipInstance).slice(-1)[0];
  const instance =
    responses[0]?.instance ||
    supabaseMessages[0]?.instance ||
    messages.find(item => item.instance)?.instance ||
    lastQueue?.chipInstance ||
    '';

  const chips = [
    ...(typeof getChips === 'function' ? getChips() : []),
    ...(typeof getWhatsappChipsV29 === 'function' ? getWhatsappChipsV29() : [])
  ];
  const exactChip = chips.find(chip => String(chip.instance || '').trim() === String(instance).trim());
  if (exactChip) {
    return {
      url: String(exactChip.url || exactChip.baseUrl || exactChip.evolutionUrl || '').replace(/\/$/, ''),
      instance: String(exactChip.instance || '').trim(),
      apiKey: exactChip.key || exactChip.apiKey || exactChip.apikey || '',
      chip: exactChip
    };
  }

  const fallback = typeof getManualSendEvolutionConfigV4012 === 'function'
    ? getManualSendEvolutionConfigV4012()
    : (typeof getEvolutionConfigForChipV405 === 'function' ? getEvolutionConfigForChipV405() : {});

  return instance ? { ...fallback, instance } : fallback;
}

async function getCurrentSupabaseUserIdV412() {
  if (currentUser?.id) return currentUser.id;
  try {
    if (!sbClient?.auth?.getUser) return '';
    const { data } = await sbClient.auth.getUser();
    if (data?.user?.id) {
      currentUser = data.user;
      return data.user.id;
    }
  } catch(e) {}
  return '';
}

async function persistOutgoingWhatsappMessageViaApiV412(payload = {}) {
  debugWhatsappPersistV413('api:start', payload);
  try {
    const res = await fetch('/api/whatsapp/outgoing', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        id: payload.id,
        external_id: payload.id,
        user_id: payload.userId,
        lead_id: payload.leadId || null,
        instance: payload.instance,
        phone: payload.phone,
        body: payload.text,
        text: payload.text,
        status: 'sent',
        occurred_at: payload.occurredAt,
        raw_payload: payload.response || null
      })
    });
    const data = await res.json().catch(() => ({}));
    debugWhatsappPersistV413('api:response', { status: res.status, ok: res.ok, data });
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return { ok:true, pending:false, via:'api', data };
  } catch (error) {
    debugWhatsappPersistV413('api:error', { error: error?.message || error });
    return { ok:false, pending:true, error:error?.message || 'Falha no endpoint de persistência' };
  }
}

async function persistOutgoingWhatsappMessageV412(message = {}, options = {}) {
  debugWhatsappPersistV413('start', { message, options });
  const queueOnFailure = options.queueOnFailure !== false;
  const userId = message.userId || await getCurrentSupabaseUserIdV412();
  const payload = {
    id: String(message.id || '').trim() || buildOutgoingWhatsappExternalIdV412('out', message.response || {}),
    leadId: String(message.leadId || '').trim(),
    instance: String(message.instance || '').trim(),
    phone: String(message.phone || '').replace(/\D/g, ''),
    text: String(message.text || ''),
    occurredAt: message.occurredAt || new Date().toISOString(),
    userId,
    response: message.response || null
  };

  debugWhatsappPersistV413('payload', payload);

  if (!payload.id || !payload.instance || !payload.phone || !payload.text || !payload.userId) {
    debugWhatsappPersistV413('blocked:missing-data', { payload, missing: { id:!payload.id, instance:!payload.instance, phone:!payload.phone, text:!payload.text, userId:!payload.userId } });
    if (queueOnFailure) queuePendingOutgoingWhatsappMessageV412(payload);
    return { ok:false, pending:queueOnFailure, error:'Dados insuficientes para salvar mensagem enviada' };
  }

  if (sbClient && currentUser?.id === payload.userId) {
    debugWhatsappPersistV413('client:insert:start', { external_id: payload.id, user_id: payload.userId, lead_id: payload.leadId || null, instance: payload.instance, phone: payload.phone, body: payload.text, occurred_at: payload.occurredAt });
    const { error } = await sbClient
      .from('whatsapp_messages')
      .insert({
        external_id: payload.id,
        user_id: payload.userId,
        lead_id: payload.leadId || null,
        instance: payload.instance,
        phone: payload.phone,
        direction: 'out',
        message_type: 'text',
        body: payload.text,
        status: 'sent',
        occurred_at: payload.occurredAt,
        updated_at: new Date().toISOString(),
        raw_payload: payload.response || null
      });

    if (!error) {
      debugWhatsappPersistV413('client:insert:success', { external_id: payload.id });
      return { ok:true, pending:false, via:'supabase' };
    }
    debugWhatsappPersistV413('client:insert:error', { error: error.message, details: error });
    console.warn('[whatsapp_messages] saída via client:', error.message);
  }

  const apiResult = await persistOutgoingWhatsappMessageViaApiV412(payload);
  if (apiResult.ok) {
    debugWhatsappPersistV413('success:api', apiResult);
    return apiResult;
  }

  console.warn('[whatsapp_messages] saída via api:', apiResult.error);
  if (queueOnFailure) queuePendingOutgoingWhatsappMessageV412(payload);
  debugWhatsappPersistV413('failed:queued', { queueOnFailure, apiResult });
  return { ok:false, pending:queueOnFailure, error:apiResult.error };
}

async function flushPendingOutgoingWhatsappMessagesV412() {
  if (!sbClient || !currentUser?.id) return { sent:0, pending:getPendingOutgoingWhatsappMessagesV412().length };
  const list = getPendingOutgoingWhatsappMessagesV412();
  const remaining = [];
  let sent = 0;

  for (const message of list) {
    if (message.userId && message.userId !== currentUser.id) {
      remaining.push(message);
      continue;
    }
    const result = await persistOutgoingWhatsappMessageV412(
      { ...message, userId:currentUser.id },
      { queueOnFailure:false }
    );
    if (result.ok) sent++;
    else remaining.push(message);
  }

  savePendingOutgoingWhatsappMessagesV412(remaining);
  return { sent, pending:remaining.length };
}

async function sendConversationReplyV38() {
  if (!activeConversationLeadV38) return;
  const resolved = getConversationLeadFromKeyV412(activeConversationLeadV38);
  const lead = resolved.lead || {};
  const realLeadId = resolved.leadId || (!isPhoneConversationKeyV412(activeConversationLeadV38) ? activeConversationLeadV38 : '');
  const text = (document.getElementById('conversationReplyTextV38')?.value || '').trim();
  const phone = normalizeWhatsappDigitsV412(resolved.phone || lead.whatsapp || lead.phone || lead.telefone || '');
  const cfg = getConversationEvolutionConfigV412(realLeadId || activeConversationLeadV38);

  if (!text) { notify('Digite uma resposta.', 'warn'); return; }
  if (!phone) { notify('Lead sem telefone.', 'warn'); return; }
  if (!cfg.url || !cfg.instance || !cfg.apiKey) {
    notify('Chip da conversa não configurado na plataforma.', 'warn');
    return;
  }

  try {
    const data = await sendEvolutionTextV4013({
      url: cfg.url,
      instance: cfg.instance,
      apiKey: cfg.apiKey,
      number: phone,
      text
    });
    const messageId = buildOutgoingWhatsappExternalIdV412('reply', data);
    const occurredAt = new Date().toISOString();
    if (realLeadId) {
      const crm = ensureLeadCrm(realLeadId, lead);
      crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
      crm.messages.push({
        id: messageId,
        direction: 'out',
        text,
        phone,
        instance: cfg.instance,
        at: occurredAt,
        atLabel: crmNowLabel(),
        chipName: cfg.chip?.nome || cfg.chip?.name || cfg.instance,
        response: data
      });
      saveLeadCrm(realLeadId, crm);
      addLeadHistory(realLeadId, 'Resposta enviada pela Central de Conversas', lead);
    }
    const persistence = await persistOutgoingWhatsappMessageV412({
      id: messageId,
      leadId: realLeadId,
      instance: cfg.instance,
      phone,
      text,
      occurredAt
    });
    renderConversationsV38();
    notify(persistence.ok ? 'Resposta enviada e salva.' : 'Resposta enviada. Sincronização com banco pendente.', persistence.ok ? undefined : 'warn');
  } catch (err) {
    notify('Erro ao responder: ' + formatEvolutionErrorV41(err), 'err');
  }
}

function getInboxItemsV41() {
  const items = new Map();

  getSupabaseWhatsappMessagesV412()
    .filter(message => message.direction === 'in')
    .forEach(message => {
      const conversationKey = getWhatsappConversationKeyV412(message);
      const resolved = getConversationLeadFromKeyV412(conversationKey);
      const id = message.dbId || message.id || conversationKey;
      items.set(id, {
        id,
        conversationKey,
        leadId: resolved.leadId || '',
        lead: resolved.lead,
        text: message.text || '',
        channel:'whatsapp',
        at: message.receivedAt || '',
        unread: !message.read,
        pending: !resolved.leadId
      });
    });

  const responses = typeof getLocalResponsesV34 === 'function' ? getLocalResponsesV34() : [];
  responses.forEach(response => {
    if (items.has(response.id)) return;
    const conversationKey = response.leadId || (response.phone ? `phone:${normalizeWhatsappDigitsV412(response.phone)}` : '');
    const resolved = getConversationLeadFromKeyV412(conversationKey);
    items.set(response.id, {
      id: response.id,
      conversationKey,
      leadId: resolved.leadId || response.leadId || '',
      lead: resolved.lead,
      text: response.text || '',
      channel:'whatsapp',
      at: response.receivedAt || '',
      unread: !response.read,
      pending: !resolved.leadId
    });
  });

  return Array.from(items.values()).sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function renderInboxV41() {
  const list = document.getElementById('inboxListV41');
  if (!list) return;
  const items = getInboxItemsV41();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('inboxUnreadCountV41', items.filter(item => item.unread).length);
  set('inboxWhatsappCountV41', items.length);
  set('inboxInstagramCountV41', 0);

  if (!items.length) {
    list.innerHTML = '<div class="audit-v35-empty">// nenhuma resposta recebida ainda</div>';
    updateInboxBadgeV41();
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="inbox-v41-item">
      <div>
        <div class="inbox-v41-title">${escHtml(item.lead?.nome || 'Lead')}</div>
        <div class="inbox-v41-message">${escHtml(item.text || '[mensagem sem texto]')}</div>
        <div class="inbox-v41-meta">${item.pending ? (item.lead?.isLid ? 'contato via LID · ' : 'lead não identificado · ') : ''}${item.lead?.subtitle ? escHtml(item.lead.subtitle) + ' · ' : ''}whatsapp · ${item.at ? escHtml(new Date(item.at).toLocaleString('pt-BR')) : ''}</div>
      </div>
      <div class="inbox-v41-actions">
        <button class="btn btn-primary" onclick="openConversationFromInboxV41('${escHtml(item.conversationKey || item.leadId)}')">Abrir</button>${item.leadId ? `<button class="btn btn-ghost" onclick="openLeadDrawer('${escHtml(item.leadId)}')">Ficha</button>` : (item.lead?.isLid ? `<button class="btn btn-ghost" onclick="associateLidConversationToLeadV417('${escHtml(item.conversationKey || '')}')">Associar</button>` : '<span class="queue-v27-status erro">sem lead</span>')}
      </div>
    </div>
  `).join('');
  updateInboxBadgeV41();
}

function startWhatsappMessagesSyncV412() {
  setTimeout(() => fetchEvolutionResponsesV34({ silent:true }), 2500);
  setInterval(() => fetchEvolutionResponsesV34({ silent:true }), 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhatsappMessagesSyncV412);
} else {
  startWhatsappMessagesSyncV412();
}



function openConversationFromInboxV41(conversationKey) { activeConversationLeadV38 = conversationKey; if (typeof switchPanel === 'function') switchPanel('conversations'); setTimeout(()=>{ try{renderConversationsV38();}catch(e){} },100); }
