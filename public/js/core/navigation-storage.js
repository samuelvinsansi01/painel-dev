/* ════════════════════════════
   MODAL LIMPAR EXCLUÍDOS
════════════════════════════ */
function abrirModalLimparExcluidos() {
  document.getElementById('limparExcluidosModal').classList.add('open');
}
function confirmarLimparExcluidos() {
  saveExcludedDomains([]);
  document.getElementById('limparExcluidosModal').classList.remove('open');
  renderExcluidos(); notify('Lista limpa');
}

/* mantém compatibilidade com chamadas antigas */
function limparExcluidos() { abrirModalLimparExcluidos(); }


/* ════════════════════════════
   MODAL CONFIRMAÇÃO GENÉRICA
════════════════════════════ */
let _confirmCallback = null;
function abrirModalConfirm(msg, callback) {
  document.getElementById('confirmModalMsg').innerHTML = msg;
  _confirmCallback = callback;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmModalOk').onclick = () => {
    const cb = _confirmCallback;
    fecharConfirmModal();
    if (cb) cb();
  };
}
function fecharConfirmModal() {
  document.getElementById('confirmModal').classList.remove('open');
  _confirmCallback = null;
}

function notify(msg, type) {
  const el = document.getElementById('notify');
  el.textContent = msg;
  el.className = 'notify show' + (type==='err'?' err':type==='warn'?' warn':'');
  setTimeout(() => el.classList.remove('show'), 3400);
}

/* ════════════════════════════
   SIDEBAR / NAV
════════════════════════════ */
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const open = !s.classList.contains('collapsed');
  s.classList.toggle('collapsed', open);
  localStorage.setItem(SIDEBAR_KEY, open ? '0' : '1');
}
const PANELS = ['audit','conversations','responses','chips','whatsappQueue','evolution','inicio','inbox','importar','validacao','atribuicao','instagram','fila-zap','kanban','followups','acompanhamento','redirecionamentos','configuracoes'];
function switchPanel(name) {
  PANELS.forEach(p => {
    const el = document.getElementById('panel-'+p);
    if (el) el.classList.toggle('active', p===name);
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    const label = el.getAttribute('data-label') || '';
    const panelMap = {'Início':'inicio','Caixa de Entrada':'inbox','Importar':'importar','Validação':'validacao','Atribuição':'atribuicao','WhatsApp':'fila-zap','Instagram':'instagram','Fila WhatsApp':'fila-zap','Conversas':'conversations','Follow-ups':'followups','Kanban':'kanban','Acompanhamento':'acompanhamento','Acompanhamentos':'acompanhamento','Redirecionamentos':'redirecionamentos','Auditoria':'audit','Configurações':'configuracoes'};
    el.classList.toggle('active', panelMap[label] === name);
  });
  if (name==='inicio')         renderInicio();
  if (name==='importar')       renderImportarPanel();
  if (name==='validacao')      renderValidacao();
  if (name==='atribuicao')     { renderAtribuicao(); updateAtribTabCounts(); if (atribActiveTab==='insta') { renderAtribInstaFila(); updateAtribInstaCorteInfo(); } }
  if (name==='instagram')      renderInstagram();
  if (name==='fila-zap')       renderFilaZap();
  if (name==='inbox')          { renderInboxV41(); fetchEvolutionResponsesV34({ silent:true }); }
  if (name==='conversations')  { renderConversationsV38(); fetchEvolutionResponsesV34({ silent:true }); }
  if (name==='responses')      renderResponsesPanelV34();
  if (name==='whatsappQueue')  renderWhatsappQueuePanel();
  if (name==='evolution')      renderEvolutionPanel();
  if (name==='kanban')         renderKanban();
  if (name==='followups')      renderFollowups();
  if (name==='acompanhamento') renderAcompanhamento();
  if (name==='configuracoes')  renderConfiguracoes();
  updateBadges();
}

function updateBadges() {
  const data = ensureWeekData();
  const flat = flattenWeekData(data);
  document.getElementById('badge-inicio').textContent = flat.filter(e => (e.status||'Não enviada')==='Não enviada').length;
  document.getElementById('badge-importar').textContent = flat.filter(e => e.status === 'Não enviada').length;
  const val = getValData();
  document.getElementById('badge-validacao').textContent = val.length;
  const atribuicaoEl = document.getElementById('badge-atribuicao');
  if (atribuicaoEl) {
    // Atribuição = zap sem dia + insta sem link ainda
    const instaSemLink = getInstaFila().filter(e => !e.instagram).length;
    atribuicaoEl.textContent = getAtribuicaoData().length + instaSemLink;
  }
  const naoEnv = flat.filter(e => (e.status||'Não enviada')==='Não enviada' && e.whatsapp).length;
  document.getElementById('badge-fila-zap').textContent = naoEnv;
  const instaEl = document.getElementById('badge-instagram');
  if (instaEl) {
    const instaWeek = getInstaWeek();
    const totalInsta = Object.values(instaWeek).flat().length;
    // Backlog = insta com link confirmado ainda não alocado em dia
    const instaBacklog = getInstaFila().filter(e => !!e.instagram).length;
    instaEl.textContent = totalInsta + instaBacklog;
  }
  // Atualiza contadores das abas da base de atribuição
  updateAtribTabCounts();
  const fuBadge = document.getElementById('badge-followups');
  if (fuBadge) {
    const todayIso = new Date().toISOString().slice(0,10);
    const crm = getLeadCrmStore ? getLeadCrmStore() : {};
    fuBadge.textContent = Object.values(crm || {}).filter(item => item?.followUpDate && item.followUpDate <= todayIso).length;
  }

  const acompEl = document.getElementById('badge-acompanhamento');
  if (acompEl) {
    const mk = currentMonthKey();
    const acomp = getAcompData();
    acompEl.textContent = (acomp[mk]||[]).length;
  }
}


let _supabaseLeadSyncTimer = null;
function scheduleSupabaseLeadSync() {
  if (!isSupabaseReady()) return;
  clearTimeout(_supabaseLeadSyncTimer);
  _supabaseLeadSyncTimer = setTimeout(() => {
    syncAllLocalLeadsToSupabase();
  }, 800);
}

/* ════════════════════════════
   STORAGE — EMPRESAS
════════════════════════════ */
function getStoredArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function getStoredObject(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
function getWeekData()  {
  try {
    const data = JSON.parse(localStorage.getItem(EMPRESAS_KEY) || 'null');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
function saveWeekData(d){ localStorage.setItem(EMPRESAS_KEY, JSON.stringify(d)); scheduleSupabaseLeadSync(); scheduleLegacyOperationalSyncV36(); }
function ensureWeekData() {
  let d = getWeekData(); const ws = currentWeekStartStr();
  if (!d || d.weekStart !== ws) {
    // Virada de semana detectada
    if (d) {
      const flat = Object.values(d.days||{}).flat();

      // Leads pós-envio (Enviada e além) → migrar para base mensal
      const STATUS_MENSAIS = ['Enviada','Respondida','Não respondida','Recusada','Fechada'];
      const paraMes = flat.filter(e => STATUS_MENSAIS.includes(e.status||''));
      if (paraMes.length) {
        migrarParaMes(paraMes);
      }

      // Leads semanais (Não enviada, Em fila) → devolver para Atribuição automaticamente
      const parmaAtrib = flat.filter(e => !e.status || e.status === 'Não enviada' || e.status === 'Em fila');
      if (parmaAtrib.length) {
        const atrib = getAtribuicaoData();
        const atribIds = new Set(atrib.map(a => a.id));
        const novos = parmaAtrib.filter(e => !atribIds.has(e.id)).map(e => ({ ...e, voltouDaSemana: todayStr(), diaDestino: null }));
        saveAtribuicaoData([...atrib, ...novos]);

        // Limpar esses leads das filas de disparo dos chips
        const idsRetornados = new Set(parmaAtrib.map(e => e.id));
        const chips = getChips();
        chips.forEach(c => {
          if (filaDisparo[c.id]) {
            filaDisparo[c.id] = filaDisparo[c.id].filter(f => !idsRetornados.has(f.id));
          }
        });
        saveFilaDisparo();
      }

      // Salva histórico para compatibilidade
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...d, archivedAt: todayStr() }));

      // ── Virada de semana Instagram: "Não contatado" voltam para fila ──
      const instaWeekData = getInstaWeek();
      const todosInstaLeads = Object.values(instaWeekData).flat();
      if (todosInstaLeads.length) {
        const STATUS_INSTA_MENSAIS = ['DM Enviada','Respondeu','Não respondeu','Fechou','Recusou'];
        const instaParaMes = todosInstaLeads.filter(e => STATUS_INSTA_MENSAIS.includes(e.status||''));
        if (instaParaMes.length) migrarInstaParaMes(instaParaMes);

        const instaNaoContatados = todosInstaLeads.filter(e => !e.status || e.status === 'Não contatado');
        if (instaNaoContatados.length) {
          const filaAtual = getInstaFila();
          const filaIds = new Set(filaAtual.map(f => f.id));
          const voltam = instaNaoContatados
            .filter(e => !filaIds.has(e.id))
            .map(({ status, instagramUrl, atribuidoEm, dmEnviadaEm, ...base }) => ({ ...base, instagram: base.instagram || instagramUrl || '', voltouEm: todayStr() }));
          saveInstaFila([...filaAtual, ...voltam]);
        }
        saveInstaWeek({});
      }
    }
    d = { weekStart: ws, days: {} }; saveWeekData(d);
  }
  if (!d.days || typeof d.days !== 'object' || Array.isArray(d.days)) {
    d.days = {};
    saveWeekData(d);
  }
  return d;
}
function getHistoryData() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    data.days = data.days && typeof data.days === 'object' && !Array.isArray(data.days) ? data.days : {};
    return data;
  } catch {
    return null;
  }
}

/* ════════════════════════════
   STORAGE — ACOMPANHAMENTO MENSAL
════════════════════════════ */
function getAcompData()  { return getStoredObject(ACOMP_KEY); }
function saveAcompData(d){ localStorage.setItem(ACOMP_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
function monthKeyLabel(key) {
  const [y, m] = key.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m,10)-1]}/${y}`;
}
function migrarParaMes(leads) {
  const data = getAcompData();
  const mk = currentMonthKey();
  if (!data[mk]) data[mk] = [];
  const existingIds = new Set(data[mk].map(e => e.id));
  const novos = leads.filter(e => !existingIds.has(e.id)).map(e => ({ ...e, migradoEm: todayStr() }));
  data[mk] = [...data[mk], ...novos];
  saveAcompData(data);
}
function flattenWeekData(d) { return Object.values(d.days||{}).flat(); }
function getAllNomes(d) { return new Set(flattenWeekData(d).map(e => normalizeStr(e.nome))); }
function getAllPhones(d) { return new Set(flattenWeekData(d).map(e => normalizePhone(e.whatsapp||'')).filter(Boolean)); }
function getAllSites(d)  { return new Set(flattenWeekData(d).map(e => extractDomain(e.site||'')).filter(Boolean)); }

/* ════════════════════════════
   STORAGE — VALIDAÇÃO FILA
════════════════════════════ */
function getValData()  { return getStoredArray(VAL_KEY); }
function saveValData(d){ localStorage.setItem(VAL_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }

/* ════════════════════════════
   STORAGE — BASE DE ATRIBUIÇÃO
════════════════════════════ */
function getAtribuicaoData()  { return getStoredArray(ATRIBUICAO_KEY); }
function saveAtribuicaoData(d){ localStorage.setItem(ATRIBUICAO_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }


function getInstaFila()  { return getStoredArray(INSTA_KEY); }
function saveInstaFila(d){ localStorage.setItem(INSTA_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }

function recuperarValidacaoZapDoDia() {
  if (localStorage.getItem(RECUPERAR_VALIDACAO_ZAP_KEY) === '1') return 0;

  const hoje = todayStr();
  const atribuicao = getAtribuicaoData();
  const validacao = getValData();
  const validacaoIds = new Set(validacao.map(lead => lead.id));
  const devemVoltar = atribuicao.filter(lead =>
    lead.canal === 'zap' &&
    lead.validadoEm === hoje &&
    (lead.status || 'Não enviada') === 'Não enviada' &&
    !lead.diaDestino
  );

  if (devemVoltar.length) {
    const recuperados = devemVoltar
      .filter(lead => !validacaoIds.has(lead.id))
      .map(lead => ({
        ...lead,
        canal: 'pendente',
        numStatus: 'pendente',
        importadoEm: lead.importadoEm || lead.criadoEm || hoje,
        diaDestino: null,
        recuperadoDaAtribuicaoEm: hoje,
      }));
    const recuperarIds = new Set(devemVoltar.map(lead => lead.id));
    saveValData([...validacao, ...recuperados]);
    saveAtribuicaoData(atribuicao.filter(lead => !recuperarIds.has(lead.id)));
  }

  localStorage.setItem(RECUPERAR_VALIDACAO_ZAP_KEY, '1');
  return devemVoltar.length;
}

/* ════════════════════════════
   STORAGE — INSTA CRONOGRAMA
════════════════════════════ */
function getInstaSched()  { return getStoredObject(INSTA_SCHED_KEY); }
function saveInstaSched(d){ localStorage.setItem(INSTA_SCHED_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }

/* ════════════════════════════
   STORAGE — CHIPS
════════════════════════════ */
function getChips()  { return getStoredArray(CHIPS_KEY); }
function saveChips(c){ localStorage.setItem(CHIPS_KEY, JSON.stringify(c)); scheduleLegacyOperationalSyncV36(); }
function getChipById(id) { return getChips().find(c => c.id === id); }

/* ════════════════════════════
   STORAGE — RAMOS
════════════════════════════ */
function getRamos()  {
  try {
    const data = JSON.parse(localStorage.getItem(RAMOS_KEY) || 'null');
    return Array.isArray(data) ? data : RAMOS_DEFAULT;
  } catch {
    return RAMOS_DEFAULT;
  }
}
function saveRamos(r){ localStorage.setItem(RAMOS_KEY, JSON.stringify(r)); scheduleLegacyOperationalSyncV36(); }

/* ════════════════════════════
   EXCLUDED DOMAINS
════════════════════════════ */
function getExcludedDomains() { return getStoredArray(EXCLUDED_KEY); }
function saveExcludedDomains(arr) { localStorage.setItem(EXCLUDED_KEY, JSON.stringify(arr)); scheduleLegacyOperationalSyncV36(); }
function extractDomain(site) {
  try { return new URL(site.trim()).hostname.replace(/^www\./,'').toLowerCase(); } catch { return null; }
}
function isExcludedDomain(site) {
  const domain = extractDomain(site);
  if (!domain) return false;
  return getExcludedDomains().includes(domain);
}
function addExcludedDomains(sites) {
  // sites: array de URLs para adicionar à lista de já vistos
  const current = new Set(getExcludedDomains());
  let added = 0;
  sites.forEach(site => {
    const d = extractDomain(site) || site.toLowerCase().trim();
    if (d && !current.has(d)) { current.add(d); added++; }
  });
  if (added) { saveExcludedDomains([...current]); renderExcluidos(); }
  return added;
}

/* ════════════════════════════
   SITE BLOCKLIST
════════════════════════════ */
const SITE_BLOCKLIST_DOMAINS = [
  'google.com','google.com.br','instagram.com','facebook.com','fb.com',
  'twitter.com','x.com','linkedin.com','youtube.com','tiktok.com',
  'whatsapp.com','wa.me','maps.google.com','goo.gl','bit.ly','linktr.ee',
  'wix.com','wordpress.com','blogspot.com','hotmart.com','kiwify.com.br',
  'mercadolivre.com.br','shopify.com','ifood.com.br','booking.com',
  'olx.com.br','gov.br','sebrae.com.br','yelp.com','tripadvisor.com',
  'guiamais.com.br','telelistas.net',
];
function isSiteBlocklisted(site) {
  try {
    const hostname = new URL(site).hostname.replace(/^www\./, '').toLowerCase();
    return SITE_BLOCKLIST_DOMAINS.some(b => hostname === b || hostname.endsWith('.' + b));
  } catch { return false; }
}

