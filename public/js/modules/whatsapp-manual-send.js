/* ════════════════════════════
   ENVIO MANUAL FIX V40.12
════════════════════════════ */
function getManualSendEvolutionConfigV4012() {
  try {
    const cfg = typeof getEvolutionConfigForChipV405 === 'function'
      ? getEvolutionConfigForChipV405()
      : null;

    if (cfg && cfg.url && cfg.instance && cfg.apiKey) return cfg;
  } catch(e) {}

  try {
    const chip = typeof getAnySavedChipV4010 === 'function' ? getAnySavedChipV4010() : null;
    if (chip) {
      return {
        url: String(chip.url || '').replace(/\/$/, ''),
        instance: chip.instance || '',
        apiKey: chip.key || chip.apiKey || '',
        chip
      };
    }
  } catch(e) {}

  const settings = typeof getEvolutionSettings === 'function' ? getEvolutionSettings() : {};
  return {
    url: String(settings.url || '').replace(/\/$/, ''),
    instance: settings.instance || '',
    apiKey: settings.apiKey || '',
    chip: null
  };
}

async function sendActiveLeadWhatsappMessage() {
  if (!activeLeadDrawerId || !activeLeadDrawerData) return;

  const result = document.getElementById('leadMessageResult');
  const text = (document.getElementById('leadMessageText')?.value || '').trim();
  const phone = normalizePhoneForEvolution(activeLeadDrawerData.whatsapp || activeLeadDrawerData.phone || activeLeadDrawerData.telefone || '');
  const cfg = getManualSendEvolutionConfigV4012();

  if (!cfg.url || !cfg.instance || !cfg.apiKey) {
    notify('Cadastre/conecte um chip antes de enviar.', 'warn');
    if (result) result.textContent = 'Chip/Evolution não configurado.';
    return;
  }

  if (!phone || phone.length < 10) {
    notify('Telefone inválido para envio.', 'warn');
    if (result) result.textContent = 'Telefone inválido.';
    return;
  }

  if (!text) {
    notify('Digite uma mensagem antes de enviar.', 'warn');
    if (result) result.textContent = 'Mensagem vazia.';
    return;
  }

  if (result) result.textContent = 'Enviando mensagem...';

  try {
    const endpoint = `${cfg.url}/message/sendText/${encodeURIComponent(cfg.instance)}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildEvolutionTextPayloadV4013(phone, text))
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      addLeadHistory(activeLeadDrawerId, `WhatsApp: erro ao enviar mensagem (${msg})`, activeLeadDrawerData);
      if (result) result.textContent = `Erro ao enviar: ${msg}`;
      if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
      notify('Erro ao enviar mensagem.', 'err');
      return;
    }

    const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
    crm.lastWhatsappMessage = {
      text,
      phone,
      sentAt: new Date().toISOString(),
      sentAtLabel: crmNowLabel(),
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      instance: cfg.instance,
      response: data
    };

    crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
    crm.messages.push({
      id: 'manual_' + Date.now(),
      direction: 'out',
      text,
      phone,
      at: new Date().toISOString(),
      atLabel: crmNowLabel(),
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      response: data
    });

    saveLeadCrm(activeLeadDrawerId, crm);
    addLeadHistory(activeLeadDrawerId, `Mensagem enviada via WhatsApp por ${cfg.chip?.name || cfg.chip?.nome || cfg.instance}`, activeLeadDrawerData);

    if (result) result.textContent = `Mensagem enviada em ${crmNowLabel()}.`;
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    if (typeof renderConversationsV38 === 'function') renderConversationsV38();

    notify('Mensagem enviada via Evolution.');
  } catch (err) {
    addLeadHistory(activeLeadDrawerId, `WhatsApp: falha ao enviar mensagem (${err?.message || 'erro'})`, activeLeadDrawerData);
    if (result) result.textContent = formatEvolutionErrorV41(err);
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    notify('Falha ao conectar na Evolution.', 'err');
  }
}


/* ════════════════════════════
   EVOLUTION TEXTMESSAGE PAYLOAD V40.13
   Evolution v1.8.2 usa:
   { number, textMessage: { text } }
════════════════════════════ */
function buildEvolutionTextPayloadV4013(number, text) {
  return {
    number: String(number || '').replace(/\D/g, ''),
    textMessage: {
      text: String(text || '')
    }
  };
}

async function sendEvolutionTextV4013({ url, instance, apiKey, number, text }) {
  const endpoint = `${String(url || '').replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance || '')}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildEvolutionTextPayloadV4013(number, text))
  });

  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!res.ok) {
    const msg = data?.message || data?.error || raw || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function sendActiveLeadWhatsappMessage() {
  if (!activeLeadDrawerId || !activeLeadDrawerData) return;

  const result = document.getElementById('leadMessageResult');
  const text = (document.getElementById('leadMessageText')?.value || '').trim();
  const phone = normalizePhoneForEvolution(activeLeadDrawerData.whatsapp || activeLeadDrawerData.phone || activeLeadDrawerData.telefone || '');
  const cfg = getManualSendEvolutionConfigV4012 ? getManualSendEvolutionConfigV4012() : (getEvolutionConfigForChipV405 ? getEvolutionConfigForChipV405() : {});

  if (!cfg.url || !cfg.instance || !cfg.apiKey) {
    notify('Cadastre/conecte um chip antes de enviar.', 'warn');
    if (result) result.textContent = 'Chip/Evolution não configurado.';
    return;
  }

  if (!phone || phone.length < 10) {
    notify('Telefone inválido para envio.', 'warn');
    if (result) result.textContent = 'Telefone inválido.';
    return;
  }

  if (!text) {
    notify('Digite uma mensagem antes de enviar.', 'warn');
    if (result) result.textContent = 'Mensagem vazia.';
    return;
  }

  if (result) result.textContent = 'Enviando mensagem...';

  try {
    const data = await sendEvolutionTextV4013({
      url: cfg.url,
      instance: cfg.instance,
      apiKey: cfg.apiKey,
      number: phone,
      text
    });

    const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
    const sentAt = new Date().toISOString();
    const sentAtLabel = crmNowLabel();

    crm.lastWhatsappMessage = {
      text,
      phone,
      sentAt,
      sentAtLabel,
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      instance: cfg.instance,
      response: data
    };

    const messageId = typeof buildOutgoingWhatsappExternalIdV412 === 'function'
      ? buildOutgoingWhatsappExternalIdV412('manual', data)
      : 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
    crm.messages.push({
      id: messageId,
      direction: 'out',
      text,
      phone,
      at: sentAt,
      atLabel: sentAtLabel,
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      instance: cfg.instance,
      response: data
    });

    saveLeadCrm(activeLeadDrawerId, crm);

    let persistence = { ok:false, pending:false };
    if (typeof persistOutgoingWhatsappMessageV412 === 'function') {
      persistence = await persistOutgoingWhatsappMessageV412({
        id: messageId,
        leadId: activeLeadDrawerId,
        instance: cfg.instance,
        phone,
        text,
        occurredAt: sentAt
      });
    }

    addLeadHistory(activeLeadDrawerId, `Mensagem enviada via WhatsApp por ${cfg.chip?.name || cfg.chip?.nome || cfg.instance}`, activeLeadDrawerData);

    if (result) result.textContent = persistence.ok ? `Mensagem enviada e salva em ${sentAtLabel}.` : `Mensagem enviada em ${sentAtLabel}. Sincronização com banco pendente.`;
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    if (typeof renderConversationsV38 === 'function') renderConversationsV38();

    notify(persistence.ok ? 'Mensagem enviada e salva.' : 'Mensagem enviada. Sincronização com banco pendente.', persistence.ok ? undefined : 'warn');
  } catch (err) {
    addLeadHistory(activeLeadDrawerId, `WhatsApp: falha ao enviar mensagem (${err?.message || 'erro'})`, activeLeadDrawerData);
    if (result) result.textContent = formatEvolutionErrorV41(err);
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    notify(formatEvolutionErrorV41(err), 'err');
  }
}


/* ════════════════════════════
   DRAWER WHATSAPP STATE V40.14
════════════════════════════ */
function markLeadWhatsappSentV4014(leadId, lead, payload = {}) {
  if (!leadId) return;

  const crm = ensureLeadCrm(leadId, lead || {});
  const now = new Date().toISOString();
  const label = crmNowLabel();
  const messageId = typeof buildOutgoingWhatsappExternalIdV412 === 'function'
    ? buildOutgoingWhatsappExternalIdV412('manual', payload.response || {})
    : 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  crm.whatsappStatus = {
    status: 'sent',
    label: 'Mensagem enviada',
    number: payload.phone || '',
    updatedAt: now,
    updatedAtLabel: label
  };

  crm.lastWhatsappMessage = {
    text: payload.text || '',
    phone: payload.phone || '',
    sentAt: now,
    sentAtLabel: label,
    chipName: payload.chipName || payload.instance || '',
    instance: payload.instance || '',
    response: payload.response || null
  };

  crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
  crm.messages.push({
    id: messageId,
    direction: 'out',
    text: payload.text || '',
    phone: payload.phone || '',
    at: now,
    atLabel: label,
    chipName: payload.chipName || payload.instance || '',
    instance: payload.instance || '',
    response: payload.response || null
  });

  crm.pipelineStatus = crm.pipelineStatus || 'contato_enviado';

  saveLeadCrm(leadId, crm);
  if (typeof persistOutgoingWhatsappMessageV412 === 'function') {
    persistOutgoingWhatsappMessageV412({
      id: messageId,
      leadId,
      instance: payload.instance || '',
      phone: payload.phone || '',
      text: payload.text || '',
      occurredAt: now
    }).catch(() => {});
  }

  try {
    addLeadHistory(leadId, `Mensagem enviada via WhatsApp por ${payload.chipName || payload.instance || 'Evolution'}`, lead || {});
  } catch(e) {}

  try { renderLeadWhatsappValidation(); } catch(e) {}
  try { renderLeadQueueBox(); } catch(e) {}
  try { renderLeadTimeline(leadId); } catch(e) {}
  try { renderConversationsV38(); } catch(e) {}
  try { updateConversationsBadgeV38(); } catch(e) {}
  try { renderKanban(); } catch(e) {}
}

function openLeadConversationV4014() {
  if (!activeLeadDrawerId) return;
  activeConversationLeadV38 = activeLeadDrawerId;
  if (typeof switchPanel === 'function') switchPanel('conversations');
  setTimeout(() => {
    try { renderConversationsV38(); } catch(e) {}
  }, 80);
}

async function sendActiveLeadWhatsappMessage() {
  if (!activeLeadDrawerId || !activeLeadDrawerData) return;

  const result = document.getElementById('leadMessageResult');
  const text = (document.getElementById('leadMessageText')?.value || '').trim();
  const phone = normalizePhoneForEvolution(activeLeadDrawerData.whatsapp || activeLeadDrawerData.phone || activeLeadDrawerData.telefone || '');
  const cfg = getManualSendEvolutionConfigV4012 ? getManualSendEvolutionConfigV4012() : (getEvolutionConfigForChipV405 ? getEvolutionConfigForChipV405() : {});

  if (!cfg.url || !cfg.instance || !cfg.apiKey) {
    notify('Cadastre/conecte um chip antes de enviar.', 'warn');
    if (result) result.textContent = 'Chip/Evolution não configurado.';
    return;
  }

  if (!phone || phone.length < 10) {
    notify('Telefone inválido para envio.', 'warn');
    if (result) result.textContent = 'Telefone inválido.';
    return;
  }

  if (!text) {
    notify('Digite uma mensagem antes de enviar.', 'warn');
    if (result) result.textContent = 'Mensagem vazia.';
    return;
  }

  if (result) result.textContent = 'Enviando mensagem...';

  try {
    const data = await sendEvolutionTextV4013({
      url: cfg.url,
      instance: cfg.instance,
      apiKey: cfg.apiKey,
      number: phone,
      text
    });

    markLeadWhatsappSentV4014(activeLeadDrawerId, activeLeadDrawerData, {
      text,
      phone,
      instance: cfg.instance,
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      response: data
    });

    if (result) result.textContent = `Mensagem enviada em ${crmNowLabel()}.`;
    notify('Mensagem enviada via Evolution.');
  } catch (err) {
    try {
      addLeadHistory(activeLeadDrawerId, `WhatsApp: falha ao enviar mensagem (${err?.message || 'erro'})`, activeLeadDrawerData);
      renderLeadTimeline(activeLeadDrawerId);
    } catch(e) {}
    if (result) result.textContent = formatEvolutionErrorV41(err);
    notify(formatEvolutionErrorV41(err), 'err');
  }
}


