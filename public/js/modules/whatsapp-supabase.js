/* ════════════════════════════
   SUPABASE WHATSAPP MESSAGES V41.2
════════════════════════════ */
function normalizeSupabaseWhatsappMessageV412(row = {}) {
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
    read: !!row.read_at
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
    const { data, error } = await sbClient
      .from('whatsapp_messages')
      .select('id,external_id,lead_id,instance,phone,phone_normalized,direction,message_type,body,status,occurred_at,read_at,created_at')
      .eq('user_id', currentUser.id)
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const localMap = new Map(getLocalResponsesV34().map(item => [item.id, item]));
    (data || []).forEach(row => {
      const message = mergeSupabaseWhatsappMessageV412(normalizeSupabaseWhatsappMessageV412(row));
      if (message.direction !== 'in') return;
      localMap.set(message.id, {
        ...(localMap.get(message.id) || {}),
        ...message,
        applied: !!message.leadId
      });
    });

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

async function markConversationReadV412(leadId) {
  if (!leadId) return;
  const now = new Date().toISOString();
  const crm = ensureLeadCrm(leadId, findLeadEverywhere(leadId) || {});
  (crm.messages || []).forEach(item => {
    if (item.direction === 'in') item.read = true;
  });
  saveLeadCrm(leadId, crm);

  const responses = getLocalResponsesV34();
  responses.forEach(item => {
    if (item.leadId === leadId) {
      item.read = true;
      item.readAt = item.readAt || now;
    }
  });
  saveLocalResponsesV34(responses);

  if (sbClient && currentUser?.id) {
    const { error } = await sbClient
      .from('whatsapp_messages')
      .update({ read_at: now, updated_at: now })
      .eq('user_id', currentUser.id)
      .eq('lead_id', leadId)
      .eq('direction', 'in')
      .is('read_at', null);
    if (error) console.warn('[whatsapp_messages] leitura:', error.message);
  }
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
    return `
      <div class="conversation-item-v38 ${active}" onclick="openConversationV38('${escHtml(item.leadId)}')">
        <div class="conversation-item-v38-title">${escHtml(item.lead.nome || item.lead.name || 'Lead')}</div>
        <div class="conversation-item-v38-meta">
          ${escHtml(item.lead.whatsapp || item.lead.phone || item.lead.telefone || '')}<br>
          ${escHtml((last?.text || 'Sem mensagens').slice(0,80))}
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

function getConversationEvolutionConfigV412(leadId) {
  const responses = getLocalResponsesV34()
    .filter(item => item.leadId === leadId && item.instance)
    .sort((a,b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')));
  const crm = getLeadCrmStoreSafeV4015()[leadId] || {};
  const messages = Array.isArray(crm.messages) ? crm.messages.slice().reverse() : [];
  const queue = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];
  const lastQueue = queue.filter(item => item.leadId === leadId && item.chipInstance).slice(-1)[0];
  const instance =
    responses[0]?.instance ||
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

async function persistOutgoingWhatsappMessageV412({ id, leadId, instance, phone, text, occurredAt }) {
  if (!sbClient || !currentUser?.id || !instance) return;
  const { error } = await sbClient
    .from('whatsapp_messages')
    .upsert({
      external_id: id,
      user_id: currentUser.id,
      lead_id: leadId,
      instance: String(instance).trim(),
      phone,
      direction: 'out',
      message_type: 'text',
      body: text,
      status: 'sent',
      occurred_at: occurredAt
    }, { onConflict: 'instance,external_id' });
  if (error) console.warn('[whatsapp_messages] saída:', error.message);
}

async function sendConversationReplyV38() {
  if (!activeConversationLeadV38) return;
  const lead = findLeadEverywhere(activeConversationLeadV38) || {};
  const text = (document.getElementById('conversationReplyTextV38')?.value || '').trim();
  const phone = normalizePhoneForEvolution(lead.whatsapp || lead.phone || lead.telefone || '');
  const cfg = getConversationEvolutionConfigV412(activeConversationLeadV38);

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
    const messageId = 'reply_' + Date.now();
    const occurredAt = new Date().toISOString();
    const crm = ensureLeadCrm(activeConversationLeadV38, lead);
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
    saveLeadCrm(activeConversationLeadV38, crm);
    addLeadHistory(activeConversationLeadV38, 'Resposta enviada pela Central de Conversas', lead);
    persistOutgoingWhatsappMessageV412({
      id: messageId,
      leadId: activeConversationLeadV38,
      instance: cfg.instance,
      phone,
      text,
      occurredAt
    }).catch(() => {});
    renderConversationsV38();
    notify('Resposta enviada.');
  } catch (err) {
    notify('Erro ao responder: ' + formatEvolutionErrorV41(err), 'err');
  }
}

function getInboxItemsV41() {
  const crm = getLeadCrmStoreSafeV4015 ? getLeadCrmStoreSafeV4015() : {};
  const responses = typeof getLocalResponsesV34 === 'function' ? getLocalResponsesV34() : [];
  const items = new Map();

  Object.entries(crm || {}).forEach(([leadId, data]) => {
    const incoming = (Array.isArray(data.messages) ? data.messages : []).filter(message => message.direction === 'in');
    if (!incoming.length) return;
    const last = incoming.slice().sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')))[0];
    const lead = findLeadEverywhere(leadId) || { id:leadId, nome:data.nome || 'Lead' };
    items.set(last.id || `in_${leadId}`, {
      id:last.id || `in_${leadId}`,
      leadId,
      lead,
      text:last.text || '',
      channel:'whatsapp',
      at:last.at || data.lastResponseAt || '',
      unread:!last.read
    });
  });

  responses.forEach(response => {
    if (items.has(response.id)) return;
    const lead = response.leadId
      ? (findLeadEverywhere(response.leadId) || { id:response.leadId, nome:'Lead' })
      : { nome:`Número ${response.phone || 'não identificado'}` };
    items.set(response.id, {
      id:response.id,
      leadId:response.leadId || '',
      lead,
      text:response.text || '',
      channel:'whatsapp',
      at:response.receivedAt || '',
      unread:!response.read,
      pending:!response.leadId
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
        <div class="inbox-v41-meta">${item.pending ? 'lead não identificado · ' : ''}whatsapp · ${item.at ? escHtml(new Date(item.at).toLocaleString('pt-BR')) : ''}</div>
      </div>
      <div class="inbox-v41-actions">
        ${item.leadId ? `<button class="btn btn-primary" onclick="openConversationFromInboxV41('${escHtml(item.leadId)}')">Responder</button><button class="btn btn-ghost" onclick="openLeadDrawer('${escHtml(item.leadId)}')">Ficha</button>` : '<span class="queue-v27-status erro">vinculação pendente</span>'}
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


