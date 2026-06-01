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


