/* ════════════════════════════
   CRM — FICHA DO LEAD
   V1: drawer lateral com pipeline, notas e histórico.
   Salva somente metadados no localStorage, sem mexer no fluxo atual.
════════════════════════════ */
const PIPELINE_STEPS = [
  { id: 'contato_enviado', label: 'Contato enviado' },
  { id: 'respondeu', label: 'Respondeu' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' },
];
let activeLeadDrawerId = null;
let activeLeadDrawerData = null;

function getLeadCrmStore() {
  try { return LeadService.getLeadCrmStore(); }
  catch { return {}; }
}

function saveLeadCrmStore(store) {
  localStorage.setItem(LEAD_CRM_KEY, JSON.stringify(store || {}));
}

function crmNowLabel() {
  return new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function todayIsoDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatIsoDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function getFollowUpInfo(dateIso) {
  if (!dateIso) return { className: 'empty', label: '// sem follow-up agendado' };
  const today = todayIsoDate();
  if (dateIso === today) return { className: 'today', label: `Hoje · ${formatIsoDateBR(dateIso)}` };
  if (dateIso < today) return { className: 'late', label: `Atrasado · ${formatIsoDateBR(dateIso)}` };
  return { className: 'future', label: `Futuro · ${formatIsoDateBR(dateIso)}` };
}

function getFollowUpBucket(dateIso) {
  if (!dateIso) return 'none';
  const today = todayIsoDate();
  if (dateIso === today) return 'today';
  if (dateIso < today) return 'late';
  return 'upcoming';
}

function getAllFollowUps() {
  const store = getLeadCrmStore();
  return Object.entries(store)
    .filter(([, crm]) => crm && crm.followUpDate)
    .map(([id, crm]) => {
      const raw = findLeadEverywhere(id) || {};
      const lead = normalizeLeadForDrawer({ id, ...raw });
      const info = getFollowUpInfo(crm.followUpDate);
      return {
        id,
        date: crm.followUpDate,
        bucket: getFollowUpBucket(crm.followUpDate),
        label: info.label,
        className: info.className,
        lead,
        crm
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}


async function loadSupabaseLeadCrmToLocalState() {
  if (!sbClient || !currentUser) return;

  const [notesRes, historyRes, followupsRes] = await Promise.all([
    sbClient.from('lead_notes').select('*').eq('user_id', currentUser.id),
    sbClient.from('lead_history').select('*').eq('user_id', currentUser.id),
    sbClient.from('lead_followups').select('*').eq('user_id', currentUser.id)
  ]);

  if (notesRes.error) console.warn('[supabase] notes:', notesRes.error.message);
  if (historyRes.error) console.warn('[supabase] history:', historyRes.error.message);
  if (followupsRes.error) console.warn('[supabase] followups:', followupsRes.error.message);

  const store = getLeadCrmStore ? getLeadCrmStore() : {};

  (notesRes.data || []).forEach(note => {
    if (!store[note.lead_id]) {
      store[note.lead_id] = {
        pipelineStatus: 'contato_enviado',
        notes: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    store[note.lead_id].notes = Array.isArray(store[note.lead_id].notes) ? store[note.lead_id].notes : [];
    store[note.lead_id].notes.push({
      at: note.created_at ? new Date(note.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : crmNowLabel(),
      text: note.note || ''
    });
  });

  (historyRes.data || []).forEach(item => {
    if (!store[item.lead_id]) {
      store[item.lead_id] = {
        pipelineStatus: 'contato_enviado',
        notes: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    store[item.lead_id].history = Array.isArray(store[item.lead_id].history) ? store[item.lead_id].history : [];
    store[item.lead_id].history.push({
      at: item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : crmNowLabel(),
      text: item.event || ''
    });
  });

  (followupsRes.data || []).forEach(fu => {
    if (!store[fu.lead_id]) {
      store[fu.lead_id] = {
        pipelineStatus: 'contato_enviado',
        notes: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    store[fu.lead_id].followUpDate = fu.followup_date || '';
    store[fu.lead_id].followUpStatus = fu.status || 'future';
  });

  saveLeadCrmStore(store);
  console.log(`[supabase] CRM carregado: ${(notesRes.data || []).length} notas, ${(historyRes.data || []).length} eventos, ${(followupsRes.data || []).length} follow-ups`);
}

async function loadSupabaseLeadsToLocalState({ preserveWorkflow = false } = {}) {
  if (!sbClient || !currentUser) return;

  const { data, error } = await sbClient
    .from('leads')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('[supabase] load leads:', error);
    notify('Erro ao carregar leads do Supabase', 'err');
    return;
  }

  const today = todayStr();

  const leads = (data || []).map(item => ({
    id: item.id,
    nome: item.company_name || 'Lead sem nome',
    whatsapp: item.phone || '',
    instagram: item.instagram || '',
    site: item.website || '',
    googleUrl: item.maps_url || '',
    status: item.status || 'Não enviada',
    criadoEm: item.created_at
      ? new Date(item.created_at).toLocaleDateString('pt-BR')
      : today
  }));

  const localWeek = getWeekData();
  const hasLocalWorkflow = Object.values(localWeek?.days || {}).flat().length > 0
    || getValData().length > 0
    || getAtribuicaoData().length > 0
    || getInstaFila().length > 0
    || getZapBacklog().length > 0;

  if (!preserveWorkflow && !hasLocalWorkflow) {
    const needsValidation = leads.filter(lead =>
      !lead.status || lead.status === 'Não enviada' || lead.status === 'Em fila'
    );
    const processed = leads.filter(lead => !needsValidation.includes(lead));
    const weekData = {
      weekStart: currentWeekStartStr(),
      days: processed.length ? { [today]: processed } : {}
    };

    saveWeekData(weekData);
    saveValData(needsValidation.map(lead => ({
      ...lead,
      canal: 'pendente',
      numStatus: 'pendente',
      status: 'Não enviada',
      importadoEm: lead.criadoEm || today
    })));
  }
  renderInicio();
  updateBadges();
  renderCrmHomeDashboard();
  renderExecutiveDashboard();

  await loadSupabaseLeadCrmToLocalState();

  console.log(`[supabase] Leads carregados: ${leads.length}`);
}

function getTodayFollowUps() {
  return getAllFollowUps().filter(item => item.bucket === 'today');
}

function getLateFollowUps() {
  return getAllFollowUps().filter(item => item.bucket === 'late');
}

function getUpcomingFollowUps() {
  return getAllFollowUps().filter(item => item.bucket === 'upcoming');
}

function renderFollowUpsHome() {
  const box = document.getElementById('followUpsHomeCard');
  if (!box) return;

  const today = getTodayFollowUps();
  const late = getLateFollowUps();
  const upcoming = getUpcomingFollowUps();
  const priority = [...late, ...today, ...upcoming].slice(0, 8);

  const itemHtml = priority.length
    ? priority.map(item => `
      <button class="followup-mini-item ${item.bucket}" onclick="openLeadDrawer('${item.id}')">
        <span>
          <strong>${escHtml(item.lead.nome || 'Lead')}</strong>
          <small>${escHtml(item.lead.whatsapp || item.lead.instagram || item.lead.site || 'sem canal')}</small>
        </span>
        <em>${escHtml(formatIsoDateBR(item.date))}</em>
      </button>
    `).join('')
    : `<div class="followup-empty">// nenhum follow-up agendado</div>`;

  box.innerHTML = `
    <div class="followup-card-head">
      <div>
        <div class="card-title" style="margin-bottom:4px">Follow-ups</div>
        <div class="followup-sub">// próximos contatos agendados</div>
      </div>
      <div class="followup-summary">
        <span class="late">${late.length} atrasado${late.length!==1?'s':''}</span>
        <span class="today">${today.length} hoje</span>
      </div>
    </div>
    <div class="followup-stats-row">
      <div><strong>${today.length}</strong><small>Hoje</small></div>
      <div><strong>${late.length}</strong><small>Atrasados</small></div>
      <div><strong>${upcoming.length}</strong><small>Próximos</small></div>
    </div>
    <div class="followup-mini-list">${itemHtml}</div>
  `;
}



function ensureLeadCrm(id, baseLead = {}) {
  const store = getLeadCrmStore();
  if (!store[id]) {
    store[id] = {
      pipelineStatus: baseLead.pipelineStatus || 'contato_enviado',
      notes: [],
      history: [{ at: crmNowLabel(), text: 'Ficha do lead criada' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveLeadCrmStore(store);
  } else {
    store[id].notes = Array.isArray(store[id].notes) ? store[id].notes : [];
    store[id].history = Array.isArray(store[id].history) ? store[id].history : [];
    store[id].pipelineStatus = store[id].pipelineStatus || 'contato_enviado';
    store[id].followUpDate = store[id].followUpDate || '';
  }
  return store[id];
}

function saveLeadCrm(id, crm) {
  const store = getLeadCrmStore();
  store[id] = { ...crm, updatedAt: new Date().toISOString() };
  saveLeadCrmStore(store);
}

function getLeadForCloud(id, baseLead = {}) {
  const raw = findLeadEverywhere(id) || baseLead || {};
  const lead = normalizeLeadForDrawer({ ...raw, ...baseLead, id });
  const crm = ensureLeadCrm(id, lead);
  return {
    ...lead,
    id,
    pipelineStatus: crm.pipelineStatus || 'contato_enviado'
  };
}

async function syncLeadToCloud(id, baseLead = {}) {
  if (!supabaseDataAdapter || !currentUser || !id) return;
  try {
    await supabaseDataAdapter.saveLead(getLeadForCloud(id, baseLead));
  } catch (error) {
    console.warn('[cloud] saveLead:', error);
  }
}

async function syncLeadNoteToCloud(id, noteText, baseLead = {}) {
  if (!supabaseDataAdapter || !currentUser || !id) return;
  try {
    await supabaseDataAdapter.saveNote(getLeadForCloud(id, baseLead), noteText);
  } catch (error) {
    console.warn('[cloud] saveNote:', error);
  }
}

async function syncLeadHistoryToCloud(id, eventText, baseLead = {}) {
  if (!supabaseDataAdapter || !currentUser || !id) return;
  try {
    await supabaseDataAdapter.saveHistory(getLeadForCloud(id, baseLead), eventText);
  } catch (error) {
    console.warn('[cloud] saveHistory:', error);
  }
}

async function syncLeadFollowUpToCloud(id, dateIso, baseLead = {}) {
  if (!supabaseDataAdapter || !currentUser || !id) return;
  try {
    await supabaseDataAdapter.saveFollowUp(getLeadForCloud(id, baseLead), dateIso);
  } catch (error) {
    console.warn('[cloud] saveFollowUp:', error);
  }
}

async function clearLeadFollowUpFromCloud(id, baseLead = {}) {
  if (!supabaseDataAdapter || !currentUser || !id) return;
  try {
    await supabaseDataAdapter.clearFollowUp(getLeadForCloud(id, baseLead));
  } catch (error) {
    console.warn('[cloud] clearFollowUp:', error);
  }
}

function addLeadHistory(id, text, baseLead = {}) {
  const crm = ensureLeadCrm(id, baseLead);
  crm.history.push({
    at: crmNowLabel(),
    text
  });
  saveLeadCrm(id, crm);
  syncLeadHistoryToCloud(id, text, baseLead);
}


function findLeadEverywhere(id) {
  const data = ensureWeekData();
  const weekLead = Object.values(data.days || {}).flat().find(e => e.id === id);
  if (weekLead) return weekLead;

  const atrib = getAtribuicaoData().find(e => e.id === id);
  if (atrib) return atrib;

  const val = getValData().find(e => e.id === id);
  if (val) return val;

  const insta = getInstaFila().find(e => e.id === id);
  if (insta) return insta;

  const mk = currentMonthKey();
  const acomp = getAcompData();
  const acompLead = (acomp[mk] || []).find(e => e.id === id);
  if (acompLead) return acompLead;

  for (const fila of Object.values(filaDisparo || {})) {
    const f = (fila || []).find(e => e.id === id);
    if (f) return f;
  }
  return null;
}

function normalizeLeadForDrawer(lead = {}) {
  return {
    id: lead.id,
    nome: lead.nome || lead.companyName || lead.title || 'Lead sem nome',
    categoria: lead.categoria || lead.categoryName || lead.ramo || lead.segmento || '',
    cidade: lead.cidade || lead.city || lead.address?.city || '',
    estado: lead.estado || lead.state || lead.address?.state || '',
    whatsapp: lead.whatsapp || lead.phone || lead.telefone || '',
    instagram: lead.instagram || lead.instagramUrl || '',
    site: lead.site || lead.website || '',
    googleUrl: lead.googleUrl || lead.mapsUrl || lead.url || '',
    status: lead.status || 'Não enviada',
    criadoEm: lead.criadoEm || lead.importadoEm || '',
  };
}

function leadDrawerLink(label, value, href, missingText = 'não informado') {
  if (!value) return `<div class="lead-channel missing"><strong>${label}</strong><span>${missingText}</span></div>`;
  return `<a class="lead-channel" href="${escHtml(href || value)}" target="_blank" rel="noopener"><strong>${label}</strong><span>${escHtml(value)}</span></a>`;
}

function renderLeadDrawer() {
  if (!activeLeadDrawerData) return;
  const lead = activeLeadDrawerData;
  const crm = ensureLeadCrm(lead.id, lead);

  const nameEl = document.getElementById('leadDrawerName');
  const metaEl = document.getElementById('leadDrawerMeta');
  const channelsEl = document.getElementById('leadDrawerChannels');
  const pipelineEl = document.getElementById('leadDrawerPipeline');
  const notesEl = document.getElementById('leadNotesList');
  const historyEl = document.getElementById('leadHistoryList');
  const followUpInput = document.getElementById('leadFollowUpDate');
  const followUpStatus = document.getElementById('leadFollowUpStatus');
  if (!nameEl || !metaEl || !channelsEl || !pipelineEl || !notesEl || !historyEl) return;

  const local = [lead.cidade, lead.estado].filter(Boolean).join(' - ');
  nameEl.textContent = lead.nome;
  metaEl.textContent = [lead.categoria, local, `Status: ${lead.status}`].filter(Boolean).join(' · ') || 'sem detalhes adicionais';

  const wa = String(lead.whatsapp || '').replace(/\D/g, '');
  channelsEl.innerHTML = [
    leadDrawerLink('WhatsApp', wa ? `+${wa}` : '', wa ? `https://wa.me/${wa}` : ''),
    leadDrawerLink('Instagram', lead.instagram, lead.instagram),
    leadDrawerLink('Site', lead.site, lead.site),
    leadDrawerLink('Maps', lead.googleUrl, lead.googleUrl),
  ].join('');

  pipelineEl.innerHTML = PIPELINE_STEPS.map(step => `
    <button class="lead-pipeline-step ${crm.pipelineStatus === step.id ? 'active' : ''}" onclick="updateLeadPipeline('${step.id}')">
      ${escHtml(step.label)}
    </button>
  `).join('');

  if (followUpInput) followUpInput.value = crm.followUpDate || '';
  if (followUpStatus) {
    const info = getFollowUpInfo(crm.followUpDate || '');
    followUpStatus.className = `lead-followup-status ${info.className}`;
    followUpStatus.textContent = info.label;
  }

  notesEl.innerHTML = crm.notes.length
    ? crm.notes.slice().reverse().map(note => `
      <div class="lead-note">
        <div class="lead-note-date">${escHtml(note.at)}</div>
        <div class="lead-note-text">${escHtml(note.text)}</div>
      </div>
    `).join('')
    : '<div class="lead-note"><div class="lead-note-text" style="color:var(--muted)">// nenhuma nota ainda</div></div>';

  renderLeadTimeline(activeLeadDrawerId);

  renderLeadPresentations();

  historyEl.innerHTML = crm.history.length
    ? crm.history.slice().reverse().map(item => `
      <div class="lead-history-item">
        <div class="lead-history-date">${escHtml(item.at)}</div>
        <div class="lead-history-text">${escHtml(item.text)}</div>
      </div>
    `).join('')
    : '<div class="lead-history-item"><div class="lead-history-text" style="color:var(--muted)">// sem histórico</div></div>';
}

function openLeadDrawer(id) {
  const raw = findLeadEverywhere(id);
  if (!raw) {
    notify('Lead não encontrado para abrir a ficha.', 'warn');
    return;
  }
  activeLeadDrawerId = id;
  activeLeadDrawerData = normalizeLeadForDrawer(raw);
  ensureLeadCrm(id, activeLeadDrawerData);
  renderLeadDrawer();
  renderLeadWhatsappValidation();
  renderLeadMessageBox();
  const overlay = document.getElementById('leadDrawerOverlay');
  const drawer = document.getElementById('leadDrawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.setAttribute('aria-hidden', 'false');
  renderLeadPresentations();
}

function closeLeadDrawer() {
  const overlay = document.getElementById('leadDrawerOverlay');
  const drawer = document.getElementById('leadDrawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.setAttribute('aria-hidden', 'true');
}

function addLeadNote() {
  if (!activeLeadDrawerId) return;
  const input = document.getElementById('leadNoteInput');
  const text = (input?.value || '').trim();
  if (!text) { notify('Escreva uma nota antes de adicionar.', 'warn'); return; }
  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  crm.notes.push({ at: crmNowLabel(), text });
  saveLeadCrm(activeLeadDrawerId, crm);

  syncLeadNoteToCloud(activeLeadDrawerId, text, activeLeadDrawerData || {});
  addLeadHistory(activeLeadDrawerId, 'Nota adicionada', activeLeadDrawerData || {});
  if (input) input.value = '';
  renderLeadDrawer();
  notify('Nota adicionada ao lead.');
}

function updateLeadPipeline(status) {
  if (!activeLeadDrawerId) return;
  const step = PIPELINE_STEPS.find(s => s.id === status);
  if (!step) return;
  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  const old = PIPELINE_STEPS.find(s => s.id === crm.pipelineStatus)?.label || 'Sem status';
  crm.pipelineStatus = status;
  saveLeadCrm(activeLeadDrawerId, crm);

  syncLeadToCloud(activeLeadDrawerId, activeLeadDrawerData || {});
  addLeadHistory(activeLeadDrawerId, `Pipeline alterado: ${old} → ${step.label}`, activeLeadDrawerData || {});
  renderLeadDrawer();
  notify(`Pipeline: ${step.label}`);
}

function saveLeadFollowUp() {
  if (!activeLeadDrawerId) return;
  const input = document.getElementById('leadFollowUpDate');
  const dateIso = (input?.value || '').trim();
  if (!dateIso) {
    notify('Selecione uma data para o follow-up.', 'warn');
    return;
  }

  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  const oldDate = crm.followUpDate || '';
  crm.followUpDate = dateIso;
  saveLeadCrm(activeLeadDrawerId, crm);

  const message = oldDate
    ? `Follow-up reagendado: ${formatIsoDateBR(oldDate)} → ${formatIsoDateBR(dateIso)}`
    : `Follow-up agendado para ${formatIsoDateBR(dateIso)}`;

  syncLeadFollowUpToCloud(activeLeadDrawerId, dateIso, activeLeadDrawerData || {});
  addLeadHistory(activeLeadDrawerId, message, activeLeadDrawerData || {});
  renderLeadDrawer();
  renderFollowUpsHome();
  if (acompTab === 'lista') renderAcompLista();
  notify('Follow-up salvo.');
}

function clearLeadFollowUp() {
  if (!activeLeadDrawerId) return;
  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  if (!crm.followUpDate) {
    notify('Este lead não possui follow-up agendado.', 'warn');
    return;
  }

  const oldDate = crm.followUpDate;
  crm.followUpDate = '';
  saveLeadCrm(activeLeadDrawerId, crm);
  clearLeadFollowUpFromCloud(activeLeadDrawerId, activeLeadDrawerData || {});
  addLeadHistory(activeLeadDrawerId, `Follow-up removido: ${formatIsoDateBR(oldDate)}`, activeLeadDrawerData || {});
  renderLeadDrawer();
  renderFollowUpsHome();
  if (acompTab === 'lista') renderAcompLista();
  notify('Follow-up removido.');
}


function createDevTestLead() {
  const id = 'dev_test_' + Date.now();
  const lead = {
    id,
    nome: 'Lead Teste DEV',
    site: 'https://exemplo.com.br',
    whatsapp: '5511999999999',
    instagram: 'https://instagram.com/leadteste',
    googleUrl: 'https://maps.google.com',
    categoria: 'Teste / Validação',
    numStatus: 'pendente',
    status: 'Não enviada',
    criadoEm: todayStr(),
    ramoId: null
  };

  saveValData([...getValData(), lead]);
  ensureLeadCrm(id, lead);
  addLeadHistory(id, 'Lead teste criado no ambiente DEV', lead);
  syncLeadToCloud(id, lead);

  renderInicio();
  renderFollowUpsHome();
  updateBadges();
  notify('Lead teste criado em Validação.');

  syncAllLocalLeadsToSupabase();}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLeadDrawer();
});


/* ════════════════════════════
   GLOBAL SEARCH
════════════════════════════ */
function getAllSearchableLeads() {
  const byId = new Map();

  const add = (lead, source) => {
    if (!lead || !lead.id || byId.has(lead.id)) return;
    byId.set(lead.id, { ...normalizeLeadForDrawer(lead), source });
  };

  try {
    const data = ensureWeekData();
    Object.values(data.days || {}).flat().forEach(lead => add(lead, 'Semana'));
  } catch {}

  try { getAtribuicaoData().forEach(lead => add(lead, 'Atribuição')); } catch {}
  try { getValData().forEach(lead => add(lead, 'Validação')); } catch {}
  try { getInstaFila().forEach(lead => add(lead, 'Instagram')); } catch {}
  try { getZapBacklog().forEach(lead => add(lead, 'Fila WhatsApp')); } catch {}

  try {
    const acomp = getAcompData();
    Object.values(acomp || {}).flat().forEach(lead => add(lead, 'Acompanhamento'));
  } catch {}

  try {
    Object.values(filaDisparo || {}).flat().forEach(lead => add(lead, 'Fila WhatsApp'));
  } catch {}

  return [...byId.values()];
}

function openGlobalSearch() {
  const overlay = document.getElementById('globalSearchOverlay');
  const input = document.getElementById('globalSearchInput');
  if (!overlay || !input) return;
  overlay.classList.add('open');
  input.value = '';
  renderGlobalSearchResults();
  setTimeout(() => input.focus(), 50);
}

function closeGlobalSearch(event) {
  if (event && event.target && event.target.id !== 'globalSearchOverlay') return;
  const overlay = document.getElementById('globalSearchOverlay');
  if (overlay) overlay.classList.remove('open');
}

function renderGlobalSearchResults() {
  const input = document.getElementById('globalSearchInput');
  const box = document.getElementById('globalSearchResults');
  if (!input || !box) return;

  const q = normalizeStr(input.value || '');
  if (!q) {
    box.innerHTML = '<div class="global-search-empty">// comece a digitar para pesquisar</div>';
    return;
  }

  const leads = getAllSearchableLeads();
  const results = leads.filter(lead => {
    const haystack = normalizeStr([
      lead.nome,
      lead.categoria,
      lead.cidade,
      lead.estado,
      lead.whatsapp,
      lead.instagram,
      lead.site,
      lead.googleUrl,
      lead.status,
      lead.source
    ].filter(Boolean).join(' '));
    return haystack.includes(q);
  }).slice(0, 30);

  if (!results.length) {
    box.innerHTML = `<div class="global-search-empty">// nenhum resultado para "${escHtml(input.value)}"</div>`;
    return;
  }

  box.innerHTML = results.map(lead => `
    <button class="global-search-result" onclick="openLeadFromGlobalSearch('${escHtml(lead.id)}')">
      <div class="global-search-result-main">
        <div class="global-search-result-name">${escHtml(lead.nome)}</div>
        <div class="global-search-result-meta">
          ${lead.whatsapp ? `<span>📱 ${escHtml(lead.whatsapp)}</span>` : ''}
          ${lead.instagram ? `<span>📸 ${escHtml(lead.instagram)}</span>` : ''}
          ${lead.site ? `<span>🌐 ${escHtml(lead.site)}</span>` : ''}
          ${lead.source ? `<span>${escHtml(lead.source)}</span>` : ''}
        </div>
      </div>
      <span class="global-search-result-status">${escHtml(lead.status || 'sem status')}</span>
    </button>
  `).join('');
}

function openLeadFromGlobalSearch(id) {
  closeGlobalSearch();
  openLeadDrawer(id);
}

document.addEventListener('keydown', (event) => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const cmdK = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';

  if (cmdK) {
    event.preventDefault();
    openGlobalSearch();
    return;
  }

  if (event.key === 'Escape') {
    const searchOverlay = document.getElementById('globalSearchOverlay');
    if (searchOverlay?.classList.contains('open')) {
      closeGlobalSearch();
    }
  }
});


/* ════════════════════════════
   HOME PRO DASHBOARD V12.1
════════════════════════════ */
function getHomeProStats() {
  const data = ensureWeekData();
  const leads = flattenWeekData(data);
  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  const crmItems = Object.values(crm || {});

  const todayIso = new Date().toISOString().slice(0,10);
  const followHoje = crmItems.filter(item => item && item.followUpDate === todayIso).length;
  const followAtrasados = crmItems.filter(item => item && item.followUpDate && item.followUpDate < todayIso).length;

  const pipelineCounts = {
    contato_enviado: 0,
    respondeu: 0,
    reuniao: 0,
    proposta: 0,
    fechado: 0,
    perdido: 0
  };

  crmItems.forEach(item => {
    const key = item?.pipelineStatus || 'contato_enviado';
    if (pipelineCounts[key] !== undefined) pipelineCounts[key]++;
  });

  const aguardandoResposta = leads.filter(l => {
    const st = l.status || 'Não enviada';
    return st === 'Enviada' || st === 'Em fila';
  }).length;

  return {
    totalLeads: leads.length,
    followHoje,
    followAtrasados,
    aguardandoResposta,
    fechados: pipelineCounts.fechado || leads.filter(l => (l.status || '') === 'Fechada').length,
    pipelineCounts
  };
}

function renderHomeProDashboard() {
  const host = document.getElementById('homeProDashboardHost');
  if (!host) return;

  const s = getHomeProStats();
  const max = Math.max(
    s.pipelineCounts.contato_enviado,
    s.pipelineCounts.respondeu,
    s.pipelineCounts.reuniao,
    s.pipelineCounts.proposta,
    s.pipelineCounts.fechado,
    1
  );

  const pct = (n) => Math.max(4, Math.round((n / max) * 100));

  const stages = [
    ['Contato', s.pipelineCounts.contato_enviado],
    ['Respondeu', s.pipelineCounts.respondeu],
    ['Reunião', s.pipelineCounts.reuniao],
    ['Proposta', s.pipelineCounts.proposta],
    ['Fechado', s.pipelineCounts.fechado],
  ];

  host.innerHTML = `
    <div class="home-pro-dashboard">
      <div class="home-pro-card">
        <div class="home-pro-label">Leads ativos</div>
        <div class="home-pro-value acc">${s.totalLeads}</div>
        <div class="home-pro-hint">// base carregada</div>
      </div>
      <div class="home-pro-card">
        <div class="home-pro-label">Follow-ups hoje</div>
        <div class="home-pro-value ${s.followHoje ? 'warn' : ''}">${s.followHoje}</div>
        <div class="home-pro-hint">${s.followAtrasados ? `${s.followAtrasados} atrasado(s)` : '// nada atrasado'}</div>
      </div>
      <div class="home-pro-card">
        <div class="home-pro-label">Aguardando resposta</div>
        <div class="home-pro-value">${s.aguardandoResposta}</div>
        <div class="home-pro-hint">// enviados ou em fila</div>
      </div>
      <div class="home-pro-card">
        <div class="home-pro-label">Fechados</div>
        <div class="home-pro-value ok">${s.fechados}</div>
        <div class="home-pro-hint">// pipeline comercial</div>
      </div>
    </div>

    <div class="home-pro-funnel">
      <div class="home-pro-funnel-head">
        <div class="home-pro-funnel-title">Funil comercial</div>
        <div class="home-pro-funnel-sub">// visão resumida do pipeline</div>
      </div>
      <div class="home-pro-funnel-grid">
        ${stages.map(([label,count]) => `
          <div class="home-pro-stage">
            <div class="home-pro-stage-top">
              <div class="home-pro-stage-name">${escHtml(label)}</div>
              <div class="home-pro-stage-count">${count}</div>
            </div>
            <div class="home-pro-bar">
              <div class="home-pro-bar-fill" style="width:${pct(count)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


/* ════════════════════════════
   HOME CRM CLEAN V12.2
════════════════════════════ */
function getCrmHomeStats() {
  const data = ensureWeekData();
  const leads = flattenWeekData(data);
  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  const crmItems = Object.values(crm || {});
  const todayIso = new Date().toISOString().slice(0,10);

  const pipelineCounts = {
    contato_enviado: 0,
    respondeu: 0,
    reuniao: 0,
    proposta: 0,
    fechado: 0,
    perdido: 0
  };

  crmItems.forEach(item => {
    const key = item?.pipelineStatus || 'contato_enviado';
    if (pipelineCounts[key] !== undefined) pipelineCounts[key]++;
  });

  const followHoje = crmItems.filter(item => item?.followUpDate === todayIso).length;
  const followAtrasados = crmItems.filter(item => item?.followUpDate && item.followUpDate < todayIso).length;
  const aguardandoResposta = leads.filter(lead => ['Enviada','Em fila'].includes(lead.status || '')).length;
  const fechadosStatus = leads.filter(lead => (lead.status || '') === 'Fechada').length;

  return {
    totalLeads: leads.length,
    followHoje,
    followAtrasados,
    aguardandoResposta,
    fechados: Math.max(pipelineCounts.fechado || 0, fechadosStatus),
    pipelineCounts
  };
}

function ensureCrmHomeHost() {
  const panel = document.getElementById('panel-inicio');
  if (!panel) return null;

  let host = document.getElementById('crmHomeDashboardHost');
  if (host) return host;

  const header = panel.querySelector('.page-header');
  if (!header) return null;

  host = document.createElement('div');
  host.id = 'crmHomeDashboardHost';
  host.style.flexShrink = '0';
  header.insertAdjacentElement('afterend', host);
  return host;
}


function getPresentationHomeStats() {
  const presentations = getAllLeadPresentations();
  return {
    sent: presentations.length,
    viewed: presentations.filter(p => Number(p.views || 0) > 0).length,
    views: presentations.reduce((sum, p) => sum + Number(p.views || 0), 0)
  };
}

function renderCrmHomeDashboard() {
  const host = ensureCrmHomeHost();
  if (!host) return;

  const s = getCrmHomeStats();
  const stages = [
    ['Contato', s.pipelineCounts.contato_enviado || 0],
    ['Respondeu', s.pipelineCounts.respondeu || 0],
    ['Reunião', s.pipelineCounts.reuniao || 0],
    ['Proposta', s.pipelineCounts.proposta || 0],
    ['Fechado', s.fechados || 0],
  ];

  const max = Math.max(...stages.map(([, count]) => count), 1);
  const pct = (value) => Math.max(value > 0 ? 8 : 0, Math.round((value / max) * 100));

  host.innerHTML = `
    <div id="devToolsHost" class="crm-home-card dev-tools-card" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;grid-column:1/-1">
      <div><div class="crm-home-card-label">Ambiente DEV</div><div class="crm-home-card-hint">// use apenas para limpeza de testes locais</div></div>
      <button class="btn btn-ghost" onclick="clearDevTestLeads()">Limpar testes locais</button>
    </div>
    <div class="crm-home-summary">
      <div class="crm-home-card"><div class="crm-home-card-label">Leads ativos</div><div class="crm-home-card-value acc">${s.totalLeads}</div><div class="crm-home-card-hint">// base carregada</div></div>
      <div class="crm-home-card"><div class="crm-home-card-label">Follow-ups hoje</div><div class="crm-home-card-value ${s.followHoje ? 'warn' : ''}">${s.followHoje}</div><div class="crm-home-card-hint">${s.followAtrasados ? `${s.followAtrasados} atrasado(s)` : '// nada atrasado'}</div></div>
      <div class="crm-home-card"><div class="crm-home-card-label">Aguardando resposta</div><div class="crm-home-card-value">${s.aguardandoResposta}</div><div class="crm-home-card-hint">// enviados ou em fila</div></div>
      <div class="crm-home-card"><div class="crm-home-card-label">Fechados</div><div class="crm-home-card-value ok">${s.fechados}</div><div class="crm-home-card-hint">// pipeline comercial</div></div>
    </div>
    <div class="crm-funnel-card">
      <div class="crm-funnel-header"><div><div class="crm-funnel-title">Funil comercial</div><div class="crm-funnel-sub">// visão rápida do relacionamento com os leads</div></div></div>
      <div class="crm-funnel-grid">
        ${stages.map(([label, count]) => `
          <div class="crm-funnel-stage">
            <div class="crm-funnel-stage-top"><div class="crm-funnel-stage-name">${escHtml(label)}</div><div class="crm-funnel-stage-count">${count}</div></div>
            <div class="crm-funnel-bar"><div class="crm-funnel-fill" style="width:${pct(count)}%"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


/* ════════════════════════════
   FOLLOWUP CENTER V14
════════════════════════════ */
let followupFilter = 'hoje';

function dateOnlyToday() {
  return new Date().toISOString().slice(0,10);
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function getFollowupStatusInfo(dateIso) {
  const today = dateOnlyToday();
  if (!dateIso) return { key:'none', label:'Sem data', className:'' };
  if (dateIso < today) return { key:'atrasado', label:'Atrasado', className:'overdue' };
  if (dateIso === today) return { key:'hoje', label:'Hoje', className:'today' };
  return { key:'futuro', label:'Futuro', className:'future' };
}

function getAllFollowupItems() {
  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  const items = [];

  Object.entries(crm || {}).forEach(([leadId, data]) => {
    if (!data?.followUpDate) return;
    const lead = findLeadEverywhere(leadId);
    const normalized = lead ? normalizeLeadForDrawer(lead) : {
      id: leadId,
      nome: 'Lead sem nome',
      whatsapp: '',
      instagram: '',
      site: '',
      status: ''
    };

    const info = getFollowupStatusInfo(data.followUpDate);
    items.push({
      leadId,
      lead: normalized,
      date: data.followUpDate,
      info
    });
  });

  return items.sort((a,b) => String(a.date).localeCompare(String(b.date)));
}

function getFilteredFollowups() {
  const items = getAllFollowupItems();
  const today = dateOnlyToday();
  const next7 = addDaysIso(7);

  if (followupFilter === 'hoje') return items.filter(i => i.date === today);
  if (followupFilter === 'atrasados') return items.filter(i => i.date < today);
  if (followupFilter === 'proximos') return items.filter(i => i.date > today && i.date <= next7);
  return items;
}

function renderFollowupDashboard() {
  const box = document.getElementById('followupDashboard');
  if (!box) return;

  const items = getAllFollowupItems();
  const today = dateOnlyToday();
  const next7 = addDaysIso(7);

  const hoje = items.filter(i => i.date === today).length;
  const atrasados = items.filter(i => i.date < today).length;
  const proximos = items.filter(i => i.date > today && i.date <= next7).length;

  box.innerHTML = `
    <div class="followup-stat">
      <div class="followup-stat-label">Hoje</div>
      <div class="followup-stat-value warn">${hoje}</div>
      <div class="followup-stat-hint">// retornos do dia</div>
    </div>
    <div class="followup-stat">
      <div class="followup-stat-label">Atrasados</div>
      <div class="followup-stat-value err">${atrasados}</div>
      <div class="followup-stat-hint">// precisam de atenção</div>
    </div>
    <div class="followup-stat">
      <div class="followup-stat-label">Próximos 7 dias</div>
      <div class="followup-stat-value acc">${proximos}</div>
      <div class="followup-stat-hint">// agenda próxima</div>
    </div>
  `;
}

function renderFollowupList() {
  const list = document.getElementById('followupList');
  if (!list) return;

  document.querySelectorAll('.followup-tab').forEach(btn => btn.classList.remove('active'));
  const map = {
    hoje: 'fuTabHoje',
    atrasados: 'fuTabAtrasados',
    proximos: 'fuTabProximos',
    todos: 'fuTabTodos'
  };
  const active = document.getElementById(map[followupFilter]);
  if (active) active.classList.add('active');

  const items = getFilteredFollowups();

  if (!items.length) {
    list.innerHTML = emptyStatePro('⏰','Nenhum follow-up nesta visão','Quando você agendar retornos na ficha do lead, eles aparecerão aqui.');
    return;
  }

  list.innerHTML = items.map(item => {
    const lead = item.lead;
    return `
      <div class="followup-item ${item.info.className}">
        <div class="followup-item-main">
          <div class="followup-item-name">${escHtml(lead.nome)}</div>
          <div class="followup-item-meta">
            ${lead.whatsapp ? `<span>📱 ${escHtml(lead.whatsapp)}</span>` : ''}
            ${lead.instagram ? `<span>📸 ${escHtml(lead.instagram)}</span>` : ''}
            ${lead.site ? `<span>🌐 ${escHtml(lead.site)}</span>` : ''}
            ${lead.status ? `<span>${escHtml(lead.status)}</span>` : ''}
          </div>
        </div>
        <span class="followup-pill ${item.info.className}">${escHtml(item.info.label)} · ${escHtml(item.date)}</span>
        <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="openLeadDrawer('${escHtml(item.leadId)}')">Abrir ficha</button>
      </div>
    `;
  }).join('');
}

function renderFollowups() {
  renderFollowupDashboard();
  renderFollowupList();
}

function setFollowupFilter(filter) {
  followupFilter = filter;
  renderFollowups();
}


/* ════════════════════════════
   SUPABASE PRIMARY V15
════════════════════════════ */
const SYNC_STATE_KEY = 'vs_supabase_sync_state_v1';

function getSyncState() {
  try {
    const state = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  } catch {
    return {};
  }
}

function setSyncState(data = {}) {
  const prev = getSyncState();
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({
    ...prev,
    ...data,
    updatedAt: new Date().toISOString()
  }));
  renderSyncStatus();
}

function isSupabaseReady() {
  return !!(sbClient && currentUser);
}

function renderSyncStatus() {
  const box = document.getElementById('authSyncStatus');
  if (!box) return;

  if (!currentUser) {
    box.className = 'sync-status warn';
    box.textContent = 'offline';
    return;
  }

  const state = getSyncState();
  const label = state.lastLoadedAt
    ? 'sincronizado'
    : 'conectado';

  box.className = 'sync-status ok';
  box.textContent = label;
}

async function upsertLeadToSupabase(lead = {}) {
  if (!isSupabaseReady() || !lead.id) return { skipped: true };

  const payload = {
    id: lead.id,
    user_id: currentUser.id,
    company_name: lead.nome || lead.companyName || lead.title || 'Lead sem nome',
    phone: lead.whatsapp || lead.phone || lead.telefone || '',
    instagram: lead.instagram || lead.instagramUrl || '',
    website: lead.site || lead.website || '',
    maps_url: lead.googleUrl || lead.mapsUrl || lead.url || '',
    status: lead.status || 'Não enviada',
    pipeline_status: lead.pipelineStatus || 'contato_enviado',
    updated_at: new Date().toISOString()
  };

  const { error } = await sbClient.from('leads').upsert(payload);
  if (error) {
    console.warn('[supabase] upsert lead:', error.message);
    setSyncState({ lastError: error.message });
    return { error };
  }

  return { ok: true };
}

async function syncAllLocalLeadsToSupabase() {
  if (!isSupabaseReady()) return;

  const data = ensureWeekData();
  const weekLeads = Object.values(data.days || {}).flat();

  const extras = [];
  try { extras.push(...getAtribuicaoData()); } catch {}
  try { extras.push(...getValData()); } catch {}
  try { extras.push(...getInstaFila()); } catch {}
  try { extras.push(...getZapBacklog()); } catch {}

  const all = [...weekLeads, ...extras];
  const unique = new Map();
  all.forEach(lead => {
    if (lead?.id) unique.set(lead.id, lead);
  });

  let ok = 0;
  for (const lead of unique.values()) {
    const result = await upsertLeadToSupabase(lead);
    if (result?.ok) ok++;
  }

  setSyncState({
    lastPushedAt: new Date().toISOString(),
    lastPushedCount: ok
  });

  console.log(`[supabase] Leads locais enviados: ${ok}`);
}

async function loadSupabaseAsPrimarySource(options = {}) {
  if (!isSupabaseReady()) return;

  await loadSupabaseLeadsToLocalState(options);

  if (typeof loadSupabaseLeadCrmToLocalState === 'function') {
    await loadSupabaseLeadCrmToLocalState();
  }

  setSyncState({
    lastLoadedAt: new Date().toISOString()
  });

  renderSyncStatus();
}



/* ════════════════════════════
   LEAD PRESENTATIONS V16.1 VISIBILITY FIX
════════════════════════════ */
function ensureLeadPresentationsContainer() {
  if (document.getElementById('leadPresentationsList')) return true;

  const drawer = document.getElementById('leadDrawer');
  if (!drawer) return false;

  const target =
    document.getElementById('leadTimelineList') ||
    document.getElementById('leadNotesList') ||
    document.getElementById('leadHistoryList');

  const block = document.createElement('div');
  block.className = 'lead-presentations-block';
  block.innerHTML = `
    <div class="lead-presentation-title-label">Apresentações</div>
    <div class="lead-presentation-form">
      <input id="leadPresentationTitle" type="text" placeholder="Nome da apresentação. Ex: Site Institucional V1">
      <div class="lead-presentation-row">
        <input id="leadPresentationDeskUrl" type="url" placeholder="URL desktop">
        <input id="leadPresentationMobUrl" type="url" placeholder="URL mobile">
      </div>
      <button class="btn btn-primary" onclick="addLeadPresentation()">+ Vincular apresentação</button>
    </div>
    <div id="leadPresentationsList" class="lead-presentations-list"></div>
  `;

  if (target && target.parentElement) {
    target.parentElement.insertAdjacentElement('beforebegin', block);
  } else {
    drawer.appendChild(block);
  }

  return true;
}

/* ════════════════════════════
   LEAD PRESENTATIONS V16
════════════════════════════ */
function ensureLeadPresentations(id) {
  const crm = ensureLeadCrm(id, activeLeadDrawerData || {});
  crm.presentations = Array.isArray(crm.presentations) ? crm.presentations : [];
  saveLeadCrm(id, crm);
  return crm.presentations;
}

function presentationPublicUrl(presentation) {
  if (presentation.shortUrl) return presentation.shortUrl;
  if (presentation.alias) return `${window.location.origin}/r.html?a=${encodeURIComponent(presentation.alias)}`;
  return presentation.deskUrl || presentation.mobUrl || '';
}

function renderLeadPresentations() {
  ensureLeadPresentationsContainer();
  const list = document.getElementById('leadPresentationsList');
  if (!list || !activeLeadDrawerId) return;

  const presentations = ensureLeadPresentations(activeLeadDrawerId);

  if (!presentations.length) {
    list.innerHTML = renderPresentationMetricsHeader() + '<div class="lead-presentation-empty">// nenhuma apresentação vinculada a este lead</div>';
    return;
  }

  list.innerHTML = renderPresentationMetricsHeader() + presentations.slice().reverse().map(p => {
    const url = presentationPublicUrl(p);
    return `
      <div class="lead-presentation-item">
        <div class="lead-presentation-title">${escHtml(p.title || 'Apresentação')}</div>
        <div class="lead-presentation-meta">
          <span>${escHtml(p.createdAtLabel || p.createdAt || '')}</span>
          ${p.alias ? `<span>alias: ${escHtml(p.alias)}</span>` : ''}
          ${p.views ? `<span>${p.views} visualizações</span>` : '<span>0 visualizações</span>'}${p.lastViewedAtLabel ? `<span>último acesso: ${escHtml(p.lastViewedAtLabel)}</span>` : ''}
        </div>
        ${url ? `<div class="lead-presentation-link">${escHtml(url)}</div>` : ''}
        <div class="lead-presentation-actions">
          ${url ? `<a class="btn btn-ghost" style="font-size:10px;padding:7px 12px;text-decoration:none" href="${escHtml(url)}" target="_blank" rel="noopener">Abrir</a>` : ''}
          ${url ? `<button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="copyLeadPresentationUrl('${escHtml(url)}')">Copiar link</button>` : ''}
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="markLeadPresentationViewed(\'${escHtml(p.id)}\')">Registrar visualização</button>\n          <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeLeadPresentation('${escHtml(p.id)}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

async function addLeadPresentation() {
  if (!activeLeadDrawerId) return;

  const titleEl = document.getElementById('leadPresentationTitle');
  const deskEl = document.getElementById('leadPresentationDeskUrl');
  const mobEl = document.getElementById('leadPresentationMobUrl');

  const title = (titleEl?.value || '').trim();
  const deskUrl = (deskEl?.value || '').trim();
  const mobUrl = (mobEl?.value || '').trim();

  if (!title) {
    notify('Informe um nome para a apresentação.', 'warn');
    return;
  }

  if (!deskUrl && !mobUrl) {
    notify('Informe pelo menos uma URL da apresentação.', 'warn');
    return;
  }

  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  crm.presentations = Array.isArray(crm.presentations) ? crm.presentations : [];

  const leadName = activeLeadDrawerData?.nome || title;
  const safeName = normalizeStr(`${leadName} ${title}`).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  const alias = `${safeName || 'apresentacao'}-${Date.now().toString(36)}`;

  const presentation = {
    id: genId(),
    title,
    deskUrl,
    mobUrl,
    alias,
    views: 0,
    createdAt: new Date().toISOString(),
    createdAtLabel: crmNowLabel()
  };

  crm.presentations.push(presentation);
  saveLeadCrm(activeLeadDrawerId, crm);

  addLeadHistory(activeLeadDrawerId, `Apresentação vinculada: ${title}`, activeLeadDrawerData || {});

  // Tenta aproveitar API existente de encurtamento/redirect sem quebrar se não existir.
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: alias,
        deskUrl: deskUrl || mobUrl,
        mobUrl: mobUrl || deskUrl
      })
    });

    if (res.ok) {
      const data = await res.json();
      const store = getLeadCrmStore();
      const current = store[activeLeadDrawerId];
      const found = current?.presentations?.find(p => p.id === presentation.id);
      if (found) {
        found.shortUrl = data.shortUrl || data.url || data.tinyUrl || found.shortUrl;
        found.redirectUrl = data.redirectUrl || found.redirectUrl;
      }
      saveLeadCrmStore(store);
    }
  } catch (err) {
    console.warn('[presentations] api shorten indisponível:', err?.message || err);
  }

  if (titleEl) titleEl.value = '';
  if (deskEl) deskEl.value = '';
  if (mobEl) mobEl.value = '';

  renderLeadPresentations();
  if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
  notify('Apresentação vinculada ao lead.');
}

function removeLeadPresentation(id) {
  if (!activeLeadDrawerId) return;
  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  const item = (crm.presentations || []).find(p => p.id === id);
  crm.presentations = (crm.presentations || []).filter(p => p.id !== id);
  saveLeadCrm(activeLeadDrawerId, crm);
  addLeadHistory(activeLeadDrawerId, `Apresentação removida${item?.title ? ': ' + item.title : ''}`, activeLeadDrawerData || {});
  renderLeadPresentations();
  if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
  notify('Apresentação removida.');
}

function copyLeadPresentationUrl(url) {
  navigator.clipboard?.writeText(url);
  notify('Link copiado.');
}


/* ════════════════════════════
   EXEC DASHBOARD V17
════════════════════════════ */
function getExecutiveMetrics() {
  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  const items = Object.values(crm || {});

  const contato = items.filter(i => (i.pipelineStatus || 'contato_enviado') === 'contato_enviado').length;
  const respondeu = items.filter(i => i.pipelineStatus === 'respondeu').length;
  const reuniao = items.filter(i => i.pipelineStatus === 'reuniao').length;
  const proposta = items.filter(i => i.pipelineStatus === 'proposta').length;
  const fechado = items.filter(i => i.pipelineStatus === 'fechado').length;

  const base = Math.max(contato + respondeu + reuniao + proposta + fechado, 1);

  return {
    contato,
    respondeu,
    reuniao,
    proposta,
    fechado,
    respostaRate: Math.round((respondeu / base) * 100),
    reuniaoRate: Math.round((reuniao / base) * 100),
    propostaRate: Math.round((proposta / base) * 100),
    fechamentoRate: Math.round((fechado / base) * 100)
  };
}

function renderExecutiveDashboard() {
  const host = document.getElementById('crmHomeDashboardHost');
  if (!host) return;

  const m = getExecutiveMetrics();
  const max = Math.max(m.contato, m.respondeu, m.reuniao, m.proposta, m.fechado, 1);

  host.insertAdjacentHTML('beforeend', `
    <div class="exec-metrics">
      <div class="exec-card"><div class="exec-label">Resposta</div><div class="exec-value">${m.respostaRate}%</div></div>
      <div class="exec-card"><div class="exec-label">Reunião</div><div class="exec-value">${m.reuniaoRate}%</div></div>
      <div class="exec-card"><div class="exec-label">Proposta</div><div class="exec-value">${m.propostaRate}%</div></div>
      <div class="exec-card"><div class="exec-label">Fechamento</div><div class="exec-value">${m.fechamentoRate}%</div></div>
    </div>

    <div class="exec-funnel">
      ${[
        ['Contato',m.contato],
        ['Respondeu',m.respondeu],
        ['Reunião',m.reuniao],
        ['Proposta',m.proposta],
        ['Fechado',m.fechado]
      ].map(([label,val])=>`
        <div class="exec-stage">
          <div class="exec-stage-top"><span>${label}</span><span>${val}</span></div>
          <div class="exec-bar"><div class="exec-fill" style="width:${Math.round((val/max)*100)}%"></div></div>
        </div>
      `).join('')}
    </div>
  `);
}


/* ════════════════════════════
   KANBAN V18
════════════════════════════ */
function findLeadEverywhereSafe(id){
  try { return findLeadEverywhere(id); } catch { return null; }
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const crm = getLeadCrmStore ? getLeadCrmStore() : {};

  const stages = [
    ['contato_enviado','Contato'],
    ['respondeu','Respondeu'],
    ['reuniao','Reunião'],
    ['proposta','Proposta'],
    ['fechado','Fechado'],
    ['perdido','Perdido']
  ];

  board.innerHTML = stages.map(([key,label]) => {
    const items = Object.entries(crm).filter(([_,v]) => (v.pipelineStatus || 'contato_enviado') === key);

    return `
      <div class="kanban-col">
        <div class="kanban-head">
          <span>${label}</span>
          <span>${items.length}</span>
        </div>

        <div class="kanban-list">
          ${items.map(([leadId]) => {
            const lead = findLeadEverywhereSafe(leadId) || {nome:'Lead'};
            return `
              <div class="kanban-card" onclick="openLeadDrawer('${leadId}')">
                <div class="kanban-card-title">${escHtml(lead.nome || 'Lead')}</div>
                <div class="kanban-card-meta">
                  ${(lead.instagram || '')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}


/* ════════════════════════════
   PRESENTATION METRICS V19
════════════════════════════ */
function getAllLeadPresentations() {
  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  const list = [];

  Object.entries(crm || {}).forEach(([leadId, data]) => {
    (data.presentations || []).forEach(p => {
      list.push({ leadId, ...p });
    });
  });

  return list;
}

function getPresentationStatsForLead(leadId) {
  const crm = ensureLeadCrm(leadId, activeLeadDrawerData || {});
  const presentations = Array.isArray(crm.presentations) ? crm.presentations : [];

  const total = presentations.length;
  const viewed = presentations.filter(p => Number(p.views || 0) > 0).length;
  const totalViews = presentations.reduce((sum, p) => sum + Number(p.views || 0), 0);

  return { total, viewed, totalViews };
}

function markLeadPresentationViewed(presentationId) {
  if (!activeLeadDrawerId) return;

  const crm = ensureLeadCrm(activeLeadDrawerId, activeLeadDrawerData || {});
  const p = (crm.presentations || []).find(item => item.id === presentationId);
  if (!p) return;

  p.views = Number(p.views || 0) + 1;
  p.lastViewedAt = new Date().toISOString();
  p.lastViewedAtLabel = crmNowLabel();

  saveLeadCrm(activeLeadDrawerId, crm);
  addLeadHistory(activeLeadDrawerId, `Apresentação visualizada: ${p.title || 'Apresentação'}`, activeLeadDrawerData || {});

  renderLeadPresentations();
  if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
  notify('Visualização registrada.');
}

function renderPresentationMetricsHeader() {
  const list = document.getElementById('leadPresentationsList');
  if (!list || !activeLeadDrawerId) return '';

  const stats = getPresentationStatsForLead(activeLeadDrawerId);

  return `
    <div class="presentation-metrics-mini">
      <div class="presentation-metric">
        <div class="presentation-metric-label">Apresentações</div>
        <div class="presentation-metric-value">${stats.total}</div>
      </div>
      <div class="presentation-metric">
        <div class="presentation-metric-label">Visualizadas</div>
        <div class="presentation-metric-value">${stats.viewed}</div>
      </div>
      <div class="presentation-metric">
        <div class="presentation-metric-label">Acessos</div>
        <div class="presentation-metric-value">${stats.totalViews}</div>
      </div>
    </div>
  `;
}


/* ════════════════════════════
   V20 POLIMENTO FINAL CRM
════════════════════════════ */
function emptyStatePro(icon, title, text) {
  return `
    <div class="empty-state-pro">
      <div class="empty-state-pro-icon">${icon || '∅'}</div>
      <div class="empty-state-pro-title">${escHtml(title || 'Nada por aqui')}</div>
      <div class="empty-state-pro-text">${escHtml(text || 'Quando houver dados, eles aparecerão nesta área.')}</div>
    </div>
  `;
}

function clearDevTestLeads() {
  const data = ensureWeekData();
  const days = data.days || {};

  Object.keys(days).forEach(day => {
    days[day] = (days[day] || []).filter(lead => {
      const id = String(lead.id || '').toLowerCase();
      const nome = String(lead.nome || '').toLowerCase();
      return !id.includes('test') && !nome.includes('teste');
    });
  });

  saveWeekData(data);

  const crm = getLeadCrmStore ? getLeadCrmStore() : {};
  Object.keys(crm).forEach(id => {
    if (String(id).toLowerCase().includes('test')) delete crm[id];
  });

  saveLeadCrmStore(crm);

  if (typeof renderInicio === 'function') renderInicio();
  if (typeof updateBadges === 'function') updateBadges();

  notify('Leads de teste removidos do cache local.');
}

function renderProductionReadyNote() {
  const box = document.getElementById('authUserBox');
  if (!box || document.getElementById('productionReadyNote')) return;
  box.insertAdjacentHTML('beforeend', '<br><span id="productionReadyNote" class="production-ready-note">CRM DEV estável</span>');
}


