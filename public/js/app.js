/* ════════════════════════════
   INIT
════════════════════════════ */
(function() {
  const s = document.getElementById('sidebar');
  if (localStorage.getItem(SIDEBAR_KEY)==='1') s.classList.remove('collapsed');

  // Inicializa login Google sem interferir nos dados atuais.
  initAuth();

  const cfg = loadEvoConfig() || {};
  if (cfg.delayMin)      (document.getElementById('delayMin')||{}).value      = cfg.delayMin; else (document.getElementById('delayMin')||{}).value = 120;
  if (cfg.delayMax)      (document.getElementById('delayMax')||{}).value      = cfg.delayMax; else (document.getElementById('delayMax')||{}).value = 120;
  // Parâmetros fixos da operação: 4 lotes de 30, com espera de 1h entre lotes.
  (document.getElementById('loteTamanho')||{}).value   = 30;
  (document.getElementById('loteEsperaMin')||{}).value = 60;
  if (cfg.horarioInicio) (document.getElementById('horarioInicio')||{}).value = cfg.horarioInicio;

  if (typeof atualizarStatsDisparo === 'function') atualizarStatsDisparo();

  // init chips — prioridade chip 2 com final 8457
  const chips = getChips();
  if (chips.length) {
    const chipPriority = chips.find(c => c.nome && c.nome.includes('8457')) || chips.find(c => c.nome && c.nome.toLowerCase().includes('ativação')) || chips[1] || chips[0];
    disparoChipId = chipPriority.id;
    activeChipId = chipPriority.id;
  }
  checkHorarioDisparo(new Date());
  setInterval(() => checkHorarioDisparo(new Date()), 30000);

  renderRamoSelect();
  ensureWeekData();
  migrarChavesInstaWeek();
  sincronizarFilaComEnviados();
  const recuperadosValidacao = recuperarValidacaoZapDoDia();
  renderInicio();
  renderExcluidos();
  updateBadges();
  if (recuperadosValidacao) {
    setTimeout(() => notify(`↩ ${recuperadosValidacao} lead(s) voltaram para Validação`), 0);
  }
  // Migrar imagens antigas do localStorage para o IDB (executa uma vez)
  try {
    const oldCfg = JSON.parse(localStorage.getItem(LOTE_CFG_KEY)||'{}')||{};
    const migrKeys = Object.keys(oldCfg).filter(k => oldCfg[k] && oldCfg[k].imagem2Base64);
    if (migrKeys.length) {
      migrKeys.forEach(k => {
        const b64 = oldCfg[k].imagem2Base64;
        idbSet(k, b64).catch(()=>{});
        delete oldCfg[k].imagem2Base64;
        delete oldCfg[k].imagem2Nome;
      });
      localStorage.setItem(LOTE_CFG_KEY, JSON.stringify(oldCfg));
      console.log('[migrar] ' + migrKeys.length + ' imagem(ns) movida(s) do localStorage para o IDB');
    }
  } catch(e) {}
  // ── Migração v2: move leads INSTA de ATRIBUICAO_KEY para INSTA_KEY ──
  // O campo canal foi corrigido na v1, mas os leads ficaram na lista errada.
  // Leads com canal 'insta' (ou sem canal e sem whatsapp) devem estar em INSTA_KEY.
  try {
    const atribRaw = JSON.parse(localStorage.getItem(ATRIBUICAO_KEY) || '[]');
    const instaRaw = JSON.parse(localStorage.getItem(INSTA_KEY) || '[]');
    const instaIds = new Set(instaRaw.map(i => i.id));

    // Determina canal correto para cada lead (incluindo legados sem canal)
    const atribComCanal = atribRaw.map(a => ({
      ...a,
      canal: (a.canal && a.canal !== 'pendente') ? a.canal : (a.whatsapp ? 'zap' : 'insta')
    }));

    const ficamNoZap  = atribComCanal.filter(a => a.canal === 'zap');
    const vaoParaInsta = atribComCanal.filter(a => a.canal === 'insta');

    if (vaoParaInsta.length > 0) {
      // Adiciona na INSTA_KEY (sem duplicar)
      const novosInsta = vaoParaInsta
        .filter(a => !instaIds.has(a.id))
        .map(a => ({
          id: a.id,
          nome: a.nome || '',
          whatsapp: a.whatsapp || '',
          instagram: a.instagram || '',
          googleUrl: a.googleUrl || '',
          categoria: a.categoria || '',
          totalScore: a.totalScore || null,
          reviewsCount: a.reviewsCount || null,
          criadoEm: a.criadoEm || a.validadoEm || '',
          canal: 'insta',
        }));

      localStorage.setItem(INSTA_KEY, JSON.stringify([...instaRaw, ...novosInsta]));
      localStorage.setItem(ATRIBUICAO_KEY, JSON.stringify(ficamNoZap));
      console.log(`[migração v2] ${novosInsta.length} leads → INSTA_KEY · ${ficamNoZap.length} ficam em ATRIBUICAO_KEY (ZAP)`);
    }
  } catch(e) { console.warn('[migração v2] erro:', e); }

  // Limpeza de imagens de lotes obsoletos no IDB
  setTimeout(limparImagensOlfas, 2000);
  // Abrir o primeiro chip por padrão
  setTimeout(() => {
    const chips = getChips();
    if (chips.length) {
      const acc = document.getElementById('chipAccordion0');
      if (acc) acc.classList.add('open');
    }
  }, 50);
})();


function getPipelineStats() {
  const store = getLeadCrmStore();
  const stats = {};
  LEAD_PIPELINE_STEPS.forEach(s => stats[s.key]=0);
  Object.values(store).forEach(crm => {
    const k = crm.pipelineStatus || LEAD_PIPELINE_STEPS[0].key;
    if (stats[k] !== undefined) stats[k]++;
  });
  return stats;
}


function getPipelineConversionMetrics() {
  const stats = getPipelineStats();
  const total = Object.values(stats).reduce((a,b)=>a+b,0);
  return {
    total,
    responded: stats.responded || 0,
    meetings: stats.meeting || 0,
    proposals: stats.proposal || 0,
    closed: stats.closed || 0
  };
}


async function loadLeadsFromSupabase() {
  try {
    if (!window.supabaseAdapter || !window.sbClient) return;
    const userRes = await sbClient.auth.getUser();
    const user = userRes?.data?.user;
    if (!user) return;

    const { data, error } = await sbClient
      .from('leads')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro carregando leads', error);
      return;
    }

    window.__supabaseLeads = data || [];
    console.log('Leads carregados do Supabase:', window.__supabaseLeads.length);
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    loadLeadsFromSupabase();
  }, 1500);
});


/* ===== V13 TIMELINE ===== */

function getLeadTimelineEvents(leadId){
  const store = (typeof getLeadCrmStore === 'function') ? getLeadCrmStore() : {};
  const crm = store[leadId] || {};
  const events = [];

  (crm.history || []).forEach(h => events.push({
    type:'history',
    icon:'🧭',
    at:h.at || '',
    text:h.text || ''
  }));

  (crm.notes || []).forEach(n => events.push({
    type:'note',
    icon:'📝',
    at:n.at || '',
    text:n.text || ''
  }));

  (crm.presentations || []).forEach(p => events.push({
    type:'presentation',
    icon:'🔗',
    at:p.createdAtLabel || p.createdAt || '',
    text:`Apresentação vinculada: ${p.title || 'Apresentação'}`
  }));

  if (crm.followUpDate) {
    events.push({
      type:'followup',
      icon:'⏰',
      at:crm.followUpDate,
      text:'Follow-up agendado'
    });
  }

  return events.reverse();
}

function renderLeadTimeline(leadId){
  const box = document.getElementById('leadTimelineList');
  if (!box || !leadId) return;

  const events = getLeadTimelineEvents(leadId);

  if (!events.length) {
    box.innerHTML = '<div class="lead-timeline-empty">// nenhuma atividade registrada ainda</div>';
    return;
  }

  box.innerHTML = events.map(ev => `
    <div class="lead-timeline-item">
      <div class="lead-timeline-icon">${ev.icon || '•'}</div>
      <div>
        <div class="lead-timeline-date">${escHtml(ev.at || '')}</div>
        <div class="lead-timeline-text">${escHtml(ev.text || '')}</div>
      </div>
    </div>
  `).join('');
}



function authGateSelfTest() {
  const gate = document.getElementById('authGate');
  return {
    hasGate: !!gate,
    gateOpen: !!gate?.classList.contains('open'),
    bodyLocked: document.body.classList.contains('auth-locked'),
    currentUser: currentUser ? { id: currentUser.id, email: currentUser.email } : null
  };
}

// V27 panel hook fallback

// chips panel fallback


/* CONFIG DISPARO V33 */
function getDispatchConfigTextV33() {
  return {
    dailyLimitTitle: 'LIMITE DIÁRIO POR CHIP',
    dailyLimitValue: '120 msg',
    dailyLimitHint: '4 lotes × 30 · espera 1h',
    batchValue: '30 msg',
    batchHint: 'por chip · 4 lotes por dia',
    intervalValue: '2 min',
    intervalHint: '120 seg fixo entre cada lead',
    blocks: ['08:00', '10:00', '12:00', '14:00']
  };
}

// audit panel fallback

document.addEventListener('DOMContentLoaded', () => { try { updateAuditBadgeV35(); } catch(e){} });


/* V37 MOBILE MENU */
function setupMobileMenuV37(){
 const sidebar=document.querySelector('.sidebar');
 const overlay=document.getElementById('mobileMenuOverlayV37');
 if(!sidebar||!overlay) return;

 let btn=document.getElementById('mobileMenuBtnV37');
 if(!btn){
   btn=document.createElement('button');
   btn.id='mobileMenuBtnV37';
   btn.innerHTML='☰';
   btn.setAttribute('aria-label','Abrir menu');
   btn.className='mobile-menu-trigger-v37';
   document.body.appendChild(btn);
 }

 function closeMenu(){
   sidebar.classList.remove('mobile-open');
   overlay.classList.remove('active');
   document.body.style.overflow='';
   document.body.classList.remove('mobile-menu-open');
 }
 function openMenu(){
   try { cleanupSidebarMenuV39(); } catch(e){}
   sidebar.classList.add('mobile-open');
   overlay.classList.add('active');
   document.body.style.overflow='hidden';
   document.body.classList.add('mobile-menu-open');
 }

 btn.onclick=()=> sidebar.classList.contains('mobile-open')?closeMenu():openMenu();
 overlay.onclick=closeMenu;

 document.querySelectorAll('.sidebar .nav-item').forEach(el=>{
   el.addEventListener('click',()=>{ if(window.innerWidth<=980) closeMenu();});
 });
}
document.addEventListener('DOMContentLoaded',setupMobileMenuV37);

// conversations fallback


/* ════════════════════════════
   MENU CLEANUP V39
════════════════════════════ */
function cleanupSidebarMenuV39(){
  try {
    if (typeof rebuildSidebarV40 === 'function') rebuildSidebarV40();
  } catch(e) {
    console.warn('cleanupSidebarMenuV39 protegido:', e?.message || e);
  }
}

document.addEventListener('DOMContentLoaded', cleanupSidebarMenuV39);
setTimeout(() => { try { cleanupSidebarMenuV39(); } catch(e){} }, 600);
setTimeout(() => { try { cleanupSidebarMenuV39(); } catch(e){} }, 1500);


/* ════════════════════════════
   SIDEBAR FINAL V40
════════════════════════════ */
function createNavItemV40(panel, icon, label, badge = '') {
  const item = document.createElement('div');
  item.className = 'nav-item';
  item.setAttribute('onclick', `switchPanel('${panel}')`);
  item.setAttribute('data-label', label);
  item.innerHTML = `
    <div class="nav-icon">${icon}</div>
    <span class="nav-label">${label}</span>
    ${badge ? `<span class="nav-badge" id="${badge.id}">${badge.text}</span>` : ''}
  `;
  return item;
}

function findSidebarSectionTitleV40(sidebar, text) {
  return Array.from(sidebar.querySelectorAll('*')).find(el => {
    const t = (el.textContent || '').trim().toLowerCase();
    return t === text.toLowerCase();
  });
}

function ensureSidebarItemV40(sidebar, panel, icon, label, badge) {
  let item = sidebar.querySelector(`[data-label="${label}"]`);
  if (!item) item = createNavItemV40(panel, icon, label, badge);
  return item;
}

function rebuildSidebarV40() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.v411Grouped === 'true') return;

  const authBox =
    sidebar.querySelector('#authUserBox') ||
    Array.from(sidebar.children).find(el => {
      const t = (el.textContent || '').toLowerCase();
      return t.includes('conectado') && t.includes('sair');
    });

  // Remove relógio/data soltos
  Array.from(sidebar.querySelectorAll('*')).forEach(el => {
    const txt = (el.textContent || '').trim().toLowerCase();
    if (/^\d{1,2}:\d{2}$/.test(txt) || /sexta|segunda|terça|terca|quarta|quinta|sábado|sabado|domingo/.test(txt)) {
      el.remove();
    }
  });

  // Garante seção Ferramentas
  let toolsTitle = findSidebarSectionTitleV40(sidebar, 'Ferramentas');
  if (!toolsTitle) {
    toolsTitle = document.createElement('div');
    toolsTitle.className = 'nav-section-title';
    toolsTitle.textContent = 'Ferramentas';
    const config = sidebar.querySelector('[data-label="Configurações"]');
    if (config) sidebar.insertBefore(toolsTitle, config);
    else sidebar.appendChild(toolsTitle);
  }

  let toolsGroup = document.getElementById('sidebarToolsV40');
  if (!toolsGroup) {
    toolsGroup = document.createElement('div');
    toolsGroup.id = 'sidebarToolsV40';
    toolsTitle.insertAdjacentElement('afterend', toolsGroup);
  }

  const redirects = sidebar.querySelector('[data-label="Redirecionamentos"]');
  const audit = ensureSidebarItemV40(sidebar, 'audit', '📊', 'Auditoria', { id:'badge-audit', text:'LOG' });
  const responses = ensureSidebarItemV40(sidebar, 'responses', '💬', 'Respostas', { id:'badge-responses', text:'0' });
  const conversations = ensureSidebarItemV40(sidebar, 'conversations', '🗨️', 'Conversas', { id:'badge-conversations', text:'0' });
  const config = sidebar.querySelector('[data-label="Configurações"]');

  [redirects, audit, responses, conversations, config].forEach(el => {
    if (el) toolsGroup.appendChild(el);
  });

  // Move conectado para rodapé
  let footer = document.getElementById('sidebarAuthFooterV40');
  if (!footer) {
    footer = document.createElement('div');
    footer.id = 'sidebarAuthFooterV40';
    sidebar.appendChild(footer);
  }

  if (authBox && !footer.contains(authBox)) {
    footer.appendChild(authBox);
  }

  // Fecha menu mobile ao clicar item
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    if (item.__v40Bound) return;
    item.__v40Bound = true;
    item.addEventListener('click', () => {
      if (window.innerWidth <= 980) {
        const overlay = document.getElementById('mobileMenuOverlayV37');
        sidebar.classList.remove('mobile-open');
        overlay?.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
        document.body.style.overflow = '';
      }
    });
  });

  if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
  if (typeof updateResponsesBadgeV34 === 'function') updateResponsesBadgeV34();
  if (typeof updateConversationsBadgeV38 === 'function') updateConversationsBadgeV38();
}

document.addEventListener('DOMContentLoaded', rebuildSidebarV40);
setTimeout(rebuildSidebarV40, 300);
setTimeout(rebuildSidebarV40, 1000);
setTimeout(rebuildSidebarV40, 2000);


/* SIDEBAR FINAL V40.4 SAFE */
(function(){
  const originalRebuildSidebarV40 = typeof rebuildSidebarV40 === 'function' ? rebuildSidebarV40 : null;

  window.rebuildSidebarV40 = function(){
    try {
      if (originalRebuildSidebarV40) originalRebuildSidebarV40();
    } catch(e) {
      console.warn('rebuildSidebarV40 protegido:', e?.message || e);
    }

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.dataset.v411Grouped === 'true') return;

    const authBox = sidebar.querySelector('#authUserBox');
    let footer = document.getElementById('sidebarAuthFooterV40');

    if (!footer) {
      footer = document.createElement('div');
      footer.id = 'sidebarAuthFooterV40';
      sidebar.appendChild(footer);
    }

    if (authBox && authBox.parentElement !== footer) {
      footer.appendChild(authBox);
    }

    let toolsGroup = document.getElementById('sidebarToolsV40');
    if (!toolsGroup) {
      toolsGroup = document.createElement('div');
      toolsGroup.id = 'sidebarToolsV40';

      const toolsTitle = Array.from(sidebar.querySelectorAll('*'))
        .find(el => (el.textContent || '').trim().toLowerCase() === 'ferramentas');

      if (toolsTitle && toolsTitle.parentElement) {
        toolsTitle.insertAdjacentElement('afterend', toolsGroup);
      } else if (footer.parentElement === sidebar) {
        sidebar.insertBefore(toolsGroup, footer);
      } else {
        sidebar.appendChild(toolsGroup);
      }
    }

    ['Redirecionamentos','Auditoria','Respostas','Conversas','Configurações'].forEach(label => {
      const item = sidebar.querySelector(`[data-label="${label}"]`);
      if (item && item.parentElement !== toolsGroup) {
        toolsGroup.appendChild(item);
      }
    });

    if (typeof updateResponsesBadgeV34 === 'function') updateResponsesBadgeV34();
    if (typeof updateConversationsBadgeV38 === 'function') updateConversationsBadgeV38();
    if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
  };

  document.addEventListener('DOMContentLoaded', () => { try { window.rebuildSidebarV40(); } catch(e){} });
  setTimeout(() => { try { window.rebuildSidebarV40(); } catch(e){} }, 1200);
})();


/* V40.4 NotFoundError guard */
window.addEventListener('error', function(e){
  if (String(e.message || '').includes("insertBefore") || String(e.message || '').includes("NotFoundError")) {
    console.warn('Erro de menu protegido:', e.message);
    e.preventDefault?.();
    try { rebuildSidebarV40(); } catch(err){}
  }
});


/* Override seguro V40.6 */
async function validateEvolutionNumber() {
  const result = document.getElementById('evoTestResult');
  const number = (document.getElementById('evoNumberTest')?.value || '').replace(/\D/g,'');

  if (result) result.textContent = 'Validando número...';

  try {
    const r = await validateNumberByChipV406(number);
    if (!r.ok) {
      if (result) result.textContent = `Erro: ${r.error}`;
      notify('Erro ao validar número.', 'warn');
      return;
    }

    if (result) {
      result.textContent = r.exists
        ? `✅ Número existe no WhatsApp: ${number}`
        : `⚠️ Número não confirmado: ${number}`;
    }
  } catch(err) {
    if (result) result.textContent = `Erro: ${err?.message || 'falha desconhecida'}`;
  }
}


/* ════════════════════════════
   CHIP DEBUG + FIX V40.7
════════════════════════════ */
function setChipDebugV407(text, type='') {
  const el = document.getElementById('chipDebugV407');
  if (!el) return;
  el.classList.remove('ok','err');
  if (type) el.classList.add(type);
  el.textContent = text;
}

function getChipFormValuesV407() {
  const byId = id => document.getElementById(id);
  const findInput = terms => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.find(input => {
      const hay = `${input.id||''} ${input.name||''} ${input.placeholder||''}`.toLowerCase();
      return terms.some(t => hay.includes(t));
    });
  };

  const nameEl = byId('chipName') || findInput(['nome do chip','nome']);
  const urlEl = byId('chipUrl') || byId('evoUrl') || findInput(['url da evolution','url evolution','url']);
  const instanceEl = byId('chipInstance') || byId('evoInstance') || findInput(['instância','instancia','instance']);
  const keyEl = byId('chipApiKey') || byId('evoApiKey') || byId('evoKey') || findInput(['api key','apikey','chave']);

  return {
    name: String(nameEl?.value || '').trim(),
    url: String(urlEl?.value || '').trim().replace(/\/$/, ''),
    instance: String(instanceEl?.value || '').trim(),
    key: String(keyEl?.value || '').trim(),
    dailyLimit: Number(document.getElementById('chipDailyLimit')?.value || 120),
    blockSize: Number(document.getElementById('chipBlockSize')?.value || 30),
    intervalSeconds: Number(document.getElementById('chipInterval')?.value || 120),
    blocks: (document.getElementById('chipBlocks')?.value || '08:00,10:00,12:00,14:00').split(',').map(v=>v.trim()).filter(Boolean),
    found: {
      name: !!nameEl,
      url: !!urlEl,
      instance: !!instanceEl,
      key: !!keyEl
    }
  };
}

async function testEvolutionChipConnectionV407(form=null) {
  const f = form || getChipFormValuesV407();

  const missing = [];
  if (!f.name) missing.push('nome');
  if (!f.url) missing.push('url');
  if (!f.instance) missing.push('instância');
  if (!f.key) missing.push('api key');

  if (missing.length) {
    const msg = `Campos ausentes: ${missing.join(', ')}\nEncontrados no DOM: ${JSON.stringify(f.found)}\nValores lidos:\nURL=${f.url}\nInstância=${f.instance}\nNome=${f.name}\nAPI Key=${f.key ? 'preenchida' : 'vazia'}`;
    setChipDebugV407(msg, 'err');
    notify('Preencha todos os campos obrigatórios.', 'warn');
    return { ok:false, error:msg };
  }

  const endpoint = `${f.url}/instance/connectionState/${encodeURIComponent(f.instance)}`;
  setChipDebugV407(`Testando conexão...\nGET ${endpoint}\nHeader apikey: ${f.key ? 'preenchido' : 'vazio'}`);

  try {
    const res = await fetch(endpoint, {
      method:'GET',
      headers:{ apikey:f.key }
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw:text }; }

    const state = data?.instance?.state || data?.state || '';

    if (!res.ok) {
      const msg = `Falha HTTP ${res.status}\n${text}`;
      setChipDebugV407(msg, 'err');
      return { ok:false, error:msg, data };
    }

    const ok = state === 'open' || state === 'connected' || !!state;
    setChipDebugV407(`Conexão OK\nState: ${state || 'sem state'}\nResposta: ${JSON.stringify(data, null, 2)}`, ok ? 'ok' : 'err');
    return { ok, state, data };
  } catch(err) {
    const msg = `Erro fetch: ${err?.message || err}`;
    setChipDebugV407(msg, 'err');
    return { ok:false, error:msg };
  }
}

async function saveChipWithConnectionTestV407() {
  const f = getChipFormValuesV407();
  const test = await testEvolutionChipConnectionV407(f);
  if (!test.ok) return;

  const chips = getWhatsappChipsV29();
  const existing = chips.find(chip => chip.name === f.name || chip.instance === f.instance);

  const payload = {
    id: existing?.id || 'chip_' + Date.now(),
    name: f.name,
    url: f.url,
    instance: f.instance,
    key: f.key,
    apiKey: f.key,
    dailyLimit: f.dailyLimit,
    blockSize: f.blockSize,
    intervalSeconds: f.intervalSeconds,
    blocks: f.blocks,
    status:'active',
    paused:false,
    connectionState:test.state || 'open',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) Object.assign(existing, payload);
  else chips.push(payload);

  saveWhatsappChipsV29(chips);
  if (typeof renderChipsPanel === 'function') renderChipsPanel();
  setChipDebugV407(`Chip salvo com sucesso:\n${f.name}\n${f.url}\n${f.instance}`, 'ok');
  notify('Chip salvo e conectado.');
}

function addWhatsappChip(){
  return saveChipWithConnectionTestV407();
}

function testEvolutionChipConnectionV406(){
  return testEvolutionChipConnectionV407();
}


/* ════════════════════════════
   CHIP IDS FIX V40.8
   Corrige campos duplicados:
   chipNome, chipUrl, chipLegacyInstance preenchido, chipKey
════════════════════════════ */
function getInputValueSmartV408(candidates = [], terms = []) {
  const inputs = Array.from(document.querySelectorAll('input'));

  for (const id of candidates) {
    const matches = inputs.filter(i => i.id === id);
    const filled = matches.find(i => String(i.value || '').trim());
    if (filled) return String(filled.value || '').trim();
  }

  const termFilled = inputs.find(input => {
    const hay = `${input.id||''} ${input.name||''} ${input.placeholder||''}`.toLowerCase();
    return terms.some(t => hay.includes(t)) && String(input.value || '').trim();
  });
  if (termFilled) return String(termFilled.value || '').trim();

  for (const id of candidates) {
    const el = inputs.find(i => i.id === id);
    if (el) return String(el.value || '').trim();
  }

  return '';
}

function getChipFormValuesV407() {
  const name = getInputValueSmartV408(['chipNome', 'chipName'], ['nome do chip', 'nome']);
  const url = getInputValueSmartV408(['chipUrl', 'evoUrl'], ['url da evolution', 'url evolution', 'url']);
  const instance = getInputValueSmartV408(['chipLegacyInstance', 'chipInstance', 'evoInstance'], ['instância', 'instancia', 'instance']);
  const key = getInputValueSmartV408(['chipKey', 'chipApiKey', 'evoApiKey', 'evoKey'], ['api key', 'apikey', 'chave']);

  return {
    name,
    url: String(url || '').trim().replace(/\/$/, ''),
    instance,
    key,
    dailyLimit: Number(document.getElementById('chipDailyLimit')?.value || 120),
    blockSize: Number(document.getElementById('chipBlockSize')?.value || 30),
    intervalSeconds: Number(document.getElementById('chipInterval')?.value || 120),
    blocks: (document.getElementById('chipBlocks')?.value || '08:00,10:00,12:00,14:00').split(',').map(v=>v.trim()).filter(Boolean),
    found: {
      name: !!document.querySelector('#chipNome, #chipName'),
      url: !!document.querySelector('#chipUrl, #evoUrl'),
      instance: !!document.querySelector('#chipLegacyInstance, #chipInstance, #evoInstance'),
      key: !!document.querySelector('#chipKey, #chipApiKey, #evoApiKey, #evoKey')
    }
  };
}


/* ════════════════════════════
   CHIP UNIFICADO V40.9
   Salva chip no modelo antigo e no novo.
════════════════════════════ */
function getLegacyChipFormV409() {
  const smart = (ids) => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const id of ids) {
      const filled = inputs.filter(i => i.id === id).find(i => String(i.value || '').trim());
      if (filled) return String(filled.value || '').trim();
    }
    for (const id of ids) {
      const el = inputs.find(i => i.id === id);
      if (el) return String(el.value || '').trim();
    }
    return '';
  };

  return {
    nome: smart(['chipNome', 'chipName']),
    url: smart(['chipUrl', 'evoUrl']).replace(/\/$/, ''),
    instance: smart(['chipLegacyInstance', 'chipInstance', 'evoInstance']),
    key: smart(['chipKey', 'chipApiKey', 'evoApiKey'])
  };
}

async function testarChipLegacyV409(chip) {
  const endpoint = `${chip.url}/instance/connectionState/${encodeURIComponent(chip.instance)}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { apikey: chip.key }
  });

  const data = await res.json().catch(() => ({}));
  const state = data?.instance?.state || data?.state || '';

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!state) throw new Error('Evolution respondeu sem estado');

  return { state, data };
}

function syncLegacyChipToV29V409(legacyChip) {
  if (typeof getWhatsappChipsV29 !== 'function' || typeof saveWhatsappChipsV29 !== 'function') return;

  const chipsV29 = getWhatsappChipsV29();
  const existing = chipsV29.find(c => c.instance === legacyChip.instance || c.name === legacyChip.nome);

  const mapped = {
    id: existing?.id || legacyChip.id || 'chip_' + Date.now(),
    name: legacyChip.nome,
    nome: legacyChip.nome,
    url: legacyChip.url,
    instance: legacyChip.instance,
    key: legacyChip.key,
    apiKey: legacyChip.key,
    dailyLimit: 120,
    blockSize: 30,
    intervalSeconds: 120,
    blocks: ['08:00','10:00','12:00','14:00'],
    status: 'active',
    paused: false,
    connectionState: legacyChip.status || 'open',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) Object.assign(existing, mapped);
  else chipsV29.push(mapped);

  saveWhatsappChipsV29(chipsV29);
}

async function salvarChip() {
  const form = getLegacyChipFormV409();

  if (!form.nome || !form.url || !form.instance || !form.key) {
    notify('// preencha todos os campos', 'err');
    console.warn('[chip v40.9] campos lidos:', form);
    return;
  }

  try {
    notify('// testando conexão do chip...', 'warn');
    const test = await testarChipLegacyV409(form);

    const chips = typeof getChips === 'function' ? getChips() : [];
    const existing = chips.find(c => c.instance === form.instance || c.nome === form.nome);

    const chipPayload = {
      id: existing?.id || (typeof genId === 'function' ? genId() : 'chip_' + Date.now()),
      nome: form.nome,
      url: form.url,
      instance: form.instance,
      key: form.key,
      status: test.state === 'open' ? 'conectado' : test.state
    };

    if (existing) Object.assign(existing, chipPayload);
    else {
      chips.push(chipPayload);
    }

    if (typeof saveChips === 'function') saveChips(chips);
    syncLegacyChipToV29V409(chipPayload);

    if (typeof fecharChipModal === 'function') fecharChipModal();
    if (typeof renderConfiguracoes === 'function') renderConfiguracoes();
    if (typeof renderChipsPanel === 'function') renderChipsPanel();
    if (typeof updateBadges === 'function') updateBadges();

    notify(`✓ Chip salvo e conectado: ${test.state}`);
  } catch (err) {
    console.error('[chip v40.9] erro ao salvar:', err);
    notify('// erro ao conectar chip: ' + (err?.message || 'falha'), 'err');
  }
}

function addWhatsappChip() {
  return salvarChip();
}


/* ════════════════════════════
   FIX VALIDAÇÃO + DASHBOARD V40.10
════════════════════════════ */
function getAnySavedChipV4010() {
  try {
    const chipsNew = typeof getWhatsappChipsV29 === 'function' ? getWhatsappChipsV29() : [];
    const activeNew = chipsNew.find(c => c && c.status !== 'disabled' && !c.paused) || chipsNew[0];
    if (activeNew) return activeNew;
  } catch(e) {}

  try {
    const chipsOld = typeof getChips === 'function' ? getChips() : [];
    const activeOld = chipsOld.find(c => c && c.status !== 'desconectado') || chipsOld[0];
    if (activeOld) {
      return {
        name: activeOld.nome || activeOld.name,
        url: activeOld.url,
        instance: activeOld.instance,
        key: activeOld.key,
        apiKey: activeOld.key,
        status: 'active'
      };
    }
  } catch(e) {}

  return null;
}

function getEvolutionConfigForChipV405(chip = null) {
  const global = typeof getEvolutionSettings === 'function' ? getEvolutionSettings() : {};
  const selected = chip || getAnySavedChipV4010() || {};

  return {
    url: normalizeEvolutionBaseUrlV405(selected.url || selected.baseUrl || selected.evolutionUrl || global.url || ''),
    instance: selected.instance || selected.instanceName || selected.chipInstance || global.instance || '',
    apiKey: selected.key || selected.apiKey || selected.apikey || global.apiKey || '',
    chip: selected
  };
}

if (typeof renderCommercialDashboard !== 'function') {
  function renderCommercialDashboardSafeV4011() {
    try {
      if (typeof renderDashboard === 'function') return renderDashboard();
      return '';
    } catch(e) {
      console.warn('renderCommercialDashboard fallback:', e);
      return '';
    }
  }
}

async function validateActiveLeadWhatsapp() {
  if (!activeLeadDrawerId || !activeLeadDrawerData) return;

  const cfg = getEvolutionConfigForChipV405();
  const phone = normalizePhoneForEvolution(activeLeadDrawerData.whatsapp || activeLeadDrawerData.phone || activeLeadDrawerData.telefone || '');

  if (!phone || phone.length < 10) {
    setLeadWhatsappStatus(activeLeadDrawerId, {
      status: 'invalid',
      label: 'Telefone ausente/inválido',
      number: phone
    });
    addLeadHistory(activeLeadDrawerId, 'WhatsApp: telefone ausente ou inválido', activeLeadDrawerData);
    renderLeadWhatsappValidation();
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    notify('Telefone inválido.', 'warn');
    return;
  }

  if (!cfg.url || !cfg.instance || !cfg.apiKey) {
    notify('Cadastre e conecte um chip antes de validar.', 'warn');
    return;
  }

  setLeadWhatsappStatus(activeLeadDrawerId, {
    status: 'pending',
    label: 'Validando...',
    number: phone
  });
  renderLeadWhatsappValidation();

  try {
    const endpoint = `${cfg.url}/chat/whatsappNumbers/${encodeURIComponent(cfg.instance)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ numbers: [phone] })
    });

    const data = await res.json().catch(() => ({}));
    const item = Array.isArray(data) ? data[0] : (data?.data?.[0] || data?.result?.[0] || data);
    const exists = !!item?.exists;

    if (!res.ok) {
      setLeadWhatsappStatus(activeLeadDrawerId, {
        status: 'invalid',
        label: 'Erro na validação',
        number: phone,
        raw: data
      });
      addLeadHistory(activeLeadDrawerId, `WhatsApp: erro na validação (${res.status})`, activeLeadDrawerData);
      notify('Erro ao validar WhatsApp.', 'err');
    } else if (exists) {
      setLeadWhatsappStatus(activeLeadDrawerId, {
        status: 'valid',
        label: 'WhatsApp válido',
        number: phone,
        raw: item
      });
      addLeadHistory(activeLeadDrawerId, `WhatsApp validado: ${phone}`, activeLeadDrawerData);
      notify('WhatsApp válido.');
    } else {
      setLeadWhatsappStatus(activeLeadDrawerId, {
        status: 'invalid',
        label: 'WhatsApp não confirmado',
        number: phone,
        raw: item
      });
      addLeadHistory(activeLeadDrawerId, `WhatsApp não confirmado: ${phone}`, activeLeadDrawerData);
      notify('WhatsApp não confirmado.', 'warn');
    }
  } catch (err) {
    setLeadWhatsappStatus(activeLeadDrawerId, {
      status: 'invalid',
      label: 'Falha na conexão',
      number: phone,
      error: err?.message || 'erro desconhecido'
    });
    addLeadHistory(activeLeadDrawerId, `WhatsApp: falha na conexão (${err?.message || 'erro'})`, activeLeadDrawerData);
    notify('Falha ao conectar na Evolution.', 'err');
  }

  renderLeadWhatsappValidation();
  if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
  if (typeof renderKanban === 'function') renderKanban();
}


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

    crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
    crm.messages.push({
      id: 'manual_' + Date.now(),
      direction: 'out',
      text,
      phone,
      at: sentAt,
      atLabel: sentAtLabel,
      chipName: cfg.chip?.name || cfg.chip?.nome || cfg.instance,
      response: data
    });

    saveLeadCrm(activeLeadDrawerId, crm);
    addLeadHistory(activeLeadDrawerId, `Mensagem enviada via WhatsApp por ${cfg.chip?.name || cfg.chip?.nome || cfg.instance}`, activeLeadDrawerData);

    if (result) result.textContent = `Mensagem enviada em ${sentAtLabel}.`;
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
    if (typeof renderConversationsV38 === 'function') renderConversationsV38();

    notify('Mensagem enviada via Evolution.');
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
    id: 'manual_' + Date.now(),
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


/* ════════════════════════════
   FILA + CONVERSAS FIX V40.15
════════════════════════════ */
function getWhatsappQueueControl() {
  try {
    const raw = localStorage.getItem(WHATSAPP_QUEUE_CONTROL_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return { paused:false };
    return { paused: !!data.paused, updatedAt: data.updatedAt || null };
  } catch {
    return { paused:false };
  }
}

function renderQueueControlBar() {
  const host = document.getElementById('queueControlBar');
  if (!host) return;

  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const pending = queue.filter(i => i.status === 'Pendente').length;
  const ready = queue.filter(i => i.status === 'Pronto').length;
  const sent = queue.filter(i => i.status === 'Enviado').length;
  const errors = queue.filter(i => i.status === 'Erro').length;

  host.innerHTML = `
    <div class="queue-control-bar">
      <div class="queue-control-left">
        <div class="queue-control-icon">${control.paused ? '⏸️' : '▶️'}</div>
        <div>
          <div class="queue-control-title">
            Fila ${control.paused ? 'pausada' : 'ativa'}
            <span class="queue-state-pill ${control.paused ? 'paused' : 'running'}">${control.paused ? 'PAUSADA' : 'ATIVA'}</span>
          </div>
          <div class="queue-control-text">
            ${pending} pendente(s) · ${ready} pronto(s) · ${sent} enviado(s) · ${errors} erro(s)
          </div>
        </div>
      </div>
      <div class="queue-control-actions">
        <button class="btn btn-ghost" onclick="toggleWhatsappQueuePause()">${control.paused ? 'Retomar fila' : 'Pausar fila'}</button>
        <button class="btn btn-primary" onclick="prepareQueueTemplates()">Sortear templates</button>
      </div>
    </div>
  `;
}

function getLeadCrmStoreSafeV4015() {
  try {
    if (typeof getLeadCrmStore === 'function') return getLeadCrmStore() || {};
  } catch(e) {}
  try {
    return JSON.parse(localStorage.getItem('vs_lead_crm_v1') || '{}') || {};
  } catch {
    return {};
  }
}

function getAllConversationLeadsV38() {
  const crm = getLeadCrmStoreSafeV4015();
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const responses = getLocalResponsesV34 ? getLocalResponsesV34() : [];
  const map = new Map();

  Object.entries(crm || {}).forEach(([leadId, data]) => {
    const hasMessages = Array.isArray(data.messages) && data.messages.length;
    const hasResponse = !!data.lastResponseAt || data.pipelineStatus === 'respondeu';
    const hasLast = !!data.lastWhatsappMessage;
    if (hasMessages || hasResponse || hasLast) {
      const lead = findLeadEverywhere(leadId) || { id: leadId, nome: data.nome || 'Lead' };
      map.set(leadId, { leadId, lead, crm: data });
    }
  });

  responses.forEach(resp => {
    if (!resp.leadId) return;
    const lead = findLeadEverywhere(resp.leadId) || { id: resp.leadId, nome: 'Lead' };
    const crmData = crm[resp.leadId] || {};
    map.set(resp.leadId, { leadId: resp.leadId, lead, crm: crmData });
  });

  queue.forEach(item => {
    if (!item.leadId || item.status !== 'Enviado') return;
    const lead = findLeadEverywhere(item.leadId) || { id: item.leadId, nome: item.nome || 'Lead' };
    const crmData = crm[item.leadId] || {};
    map.set(item.leadId, { leadId: item.leadId, lead, crm: crmData });
  });

  return Array.from(map.values()).sort((a,b) => {
    const ad = a.crm?.lastResponseAt || a.crm?.lastWhatsappMessage?.sentAt || a.crm?.messages?.slice?.(-1)?.[0]?.at || '';
    const bd = b.crm?.lastResponseAt || b.crm?.lastWhatsappMessage?.sentAt || b.crm?.messages?.slice?.(-1)?.[0]?.at || '';
    return String(bd).localeCompare(String(ad));
  });
}

function getConversationMessagesV38(leadId) {
  const crmStore = getLeadCrmStoreSafeV4015();
  const crm = crmStore[leadId] || (typeof ensureLeadCrm === 'function' ? ensureLeadCrm(leadId, findLeadEverywhere(leadId) || {}) : {});
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const messages = [];

  queue.filter(item => item.leadId === leadId && item.status === 'Enviado').forEach(item => {
    messages.push({
      id: item.id,
      direction: 'out',
      text: item.templateText || item.templateName || 'Mensagem enviada',
      at: item.sentAt || item.updatedAt || item.createdAt || '',
      atLabel: item.sentAtLabel || item.createdAtLabel || '',
      chipName: item.chipName || ''
    });
  });

  if (crm?.lastWhatsappMessage) {
    messages.push({
      id: 'last_' + leadId,
      direction: 'out',
      text: crm.lastWhatsappMessage.text || '',
      at: crm.lastWhatsappMessage.sentAt || '',
      atLabel: crm.lastWhatsappMessage.sentAtLabel || '',
      chipName: crm.lastWhatsappMessage.chipName || ''
    });
  }

  (crm?.messages || []).forEach(msg => messages.push(msg));

  const unique = new Map();
  messages.forEach(m => {
    const key = m.id || `${m.direction}_${m.at}_${m.text}`;
    unique.set(key, m);
  });

  return Array.from(unique.values()).sort((a,b) => String(a.at || '').localeCompare(String(b.at || '')));
}

function openLeadConversationV4014() {
  if (!activeLeadDrawerId) return;
  activeConversationLeadV38 = activeLeadDrawerId;
  if (typeof switchPanel === 'function') switchPanel('conversations');
  setTimeout(() => {
    try { renderConversationsV38(); } catch(e) {}
  }, 120);
}

function removeLeadFromWhatsappQueue(leadId) {
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const next = queue.filter(item => item.leadId !== leadId || item.status === 'Enviado');
  if (typeof saveWhatsappQueueV27 === 'function') saveWhatsappQueueV27(next);

  if (activeLeadDrawerId === leadId) {
    try { addLeadHistory(leadId, 'Removido da fila WhatsApp', activeLeadDrawerData || {}); } catch(e) {}
    try { renderLeadQueueBox(); } catch(e) {}
    try { renderLeadTimeline(leadId); } catch(e) {}
  }

  try { renderWhatsappQueuePanel(); } catch(e) { console.warn('render fila ignorado:', e?.message || e); }
}


/* ════════════════════════════
   V41 — IMPORTAÇÃO + MENU + INBOX + CONVERSAS
════════════════════════════ */
const IMPORT_RULES_V41 = { minRating: 4.3, minReviews: 20 };

function normalizeWhatsappV41(value = '') {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  if (!digits.startsWith('55') && digits.length > 11) {
    const last11 = digits.slice(-11);
    if (last11.length === 11) return '55' + last11;
  }
  return digits;
}
if (typeof normalizePhoneForEvolution === 'function') {
  const oldNormalizePhoneForEvolutionV41 = normalizePhoneForEvolution;
  normalizePhoneForEvolution = function(value){ return normalizeWhatsappV41(value) || oldNormalizePhoneForEvolutionV41(value); };
}

function isInstagramUrlV41(value = '') { return /(^|\/\/|www\.)instagram\.com\//i.test(String(value || '')); }
function extractInstagramV41(lead = {}) {
  const fields = [lead.instagram, lead.instagramUrl, lead.instagram_url, lead.insta, lead.website, lead.site, lead.url, lead.link, lead.webSite];
  const found = fields.find(v => isInstagramUrlV41(v));
  if (found) return String(found).trim();
  const handle = fields.find(v => String(v || '').trim().startsWith('@'));
  return handle ? `https://instagram.com/${String(handle).replace('@','').trim()}` : '';
}
function getRatingV41(lead = {}) {
  const value = lead.rating ?? lead.stars ?? lead.reviewScore ?? lead.totalScore ?? lead.nota ?? lead.avaliacao;
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function getReviewsV41(lead = {}) {
  const value = lead.reviewsCount ?? lead.reviews ?? lead.reviewCount ?? lead.totalReviews ?? lead.quantidadeAvaliacoes ?? lead.avaliacoes;
  const n = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function getLeadNameV41(lead = {}) { return String(lead.title || lead.name || lead.nome || lead.companyName || lead.company || lead.nomeEmpresa || '').trim(); }
function getWebsiteV41(lead = {}) {
  const raw = String(lead.website || lead.site || lead.webSite || lead.url || '').trim();
  return isInstagramUrlV41(raw) ? '' : raw;
}
function getWhatsappRawV41(lead = {}) { return lead.phone || lead.phoneNumber || lead.whatsapp || lead.telefone || lead.telefone1 || lead.phone_number || ''; }

function classifyImportedLeadV41(raw = {}) {
  const name = getLeadNameV41(raw);
  const rating = getRatingV41(raw);
  const reviews = getReviewsV41(raw);
  const instagram = extractInstagramV41(raw);
  const whatsapp = normalizeWhatsappV41(getWhatsappRawV41(raw));
  const website = getWebsiteV41(raw);
  const reasons = [];
  if (!name) reasons.push('sem nome');
  if (rating < IMPORT_RULES_V41.minRating) reasons.push(`nota abaixo de ${IMPORT_RULES_V41.minRating}`);
  if (reviews < IMPORT_RULES_V41.minReviews) reasons.push(`menos de ${IMPORT_RULES_V41.minReviews} avaliações`);
  if (!whatsapp && !instagram) reasons.push('sem WhatsApp e sem Instagram');
  if (reasons.length) return { status:'ignored', reasons, lead:null };
  const channel = instagram ? 'instagram' : 'whatsapp';
  const stage = instagram ? 'instagram_backlog' : 'whatsapp_backlog';
  return { status:'approved', channel, stage, lead:{...raw, id: raw.id || 'lead_'+Date.now()+'_'+Math.random().toString(36).slice(2), nome:name, name, whatsapp, phone:whatsapp, instagram, website, rating, reviews, sourceChannel:channel, backlogType:channel, stage, importedAt:new Date().toISOString()} };
}
function canLeadGoToChipQueueV41(lead = {}) {
  const stage = lead.stage || lead.day || lead.assignedDay || lead.weekDay || '';
  const isBacklog = /backlog/i.test(String(stage || '')) || lead.backlogType;
  if (isBacklog && !/(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|mon|tue|wed|thu|fri|sat|sun)/i.test(String(stage))) return false;
  return true;
}
function buildImportSummaryV41(results = []) {
  const total = results.length, approved = results.filter(r=>r.status==='approved').length, instagram = results.filter(r=>r.status==='approved' && r.channel==='instagram').length, whatsapp = results.filter(r=>r.status==='approved' && r.channel==='whatsapp').length, ignored = results.filter(r=>r.status==='ignored').length;
  const reasons = {};
  results.filter(r=>r.status==='ignored').forEach(r => (r.reasons||[]).forEach(reason => reasons[reason]=(reasons[reason]||0)+1));
  const reasonText = Object.entries(reasons).map(([k,v])=>`- ${k}: ${v}`).join('\n') || '- nenhum';
  return `IMPORTAÇÃO V41\nTotal lido: ${total}\nAprovados: ${approved}\nInstagram backlog: ${instagram}\nWhatsApp backlog: ${whatsapp}\nIgnorados: ${ignored}\n\nMotivos de ignorados:\n${reasonText}`;
}
function showImportSummaryV41(text) {
  let box = document.getElementById('importSummaryV41');
  const panel = document.getElementById('panel-import') || document.querySelector('.panel.active') || document.body;
  if (!box) { box = document.createElement('div'); box.id='importSummaryV41'; box.className='import-summary-v41'; panel.appendChild(box); }
  box.textContent = text;
}
function processImportedRowsV41(rows = []) {
  const arr = Array.isArray(rows) ? rows : [];
  const results = arr.map(classifyImportedLeadV41);
  showImportSummaryV41(buildImportSummaryV41(results));
  return { approved: results.filter(r=>r.status==='approved').map(r=>r.lead), ignored: results.filter(r=>r.status==='ignored') };
}

/* Bloqueio: backlog não entra em fila/chip */
if (typeof addActiveLeadToWhatsappQueue === 'function') {
  const oldAddActiveLeadToWhatsappQueueV41 = addActiveLeadToWhatsappQueue;
  addActiveLeadToWhatsappQueue = function(){
    if (activeLeadDrawerData && !canLeadGoToChipQueueV41(activeLeadDrawerData)) {
      notify('Lead em backlog. Atribua a um dia da semana antes de enviar para fila.', 'warn');
      return;
    }
    return oldAddActiveLeadToWhatsappQueueV41();
  };
}

/* Caixa de Entrada */
function getInboxItemsV41() {
  const crm = getLeadCrmStoreSafeV4015 ? getLeadCrmStoreSafeV4015() : {};
  const responses = typeof getLocalResponsesV34 === 'function' ? getLocalResponsesV34() : [];
  const items = [];
  Object.entries(crm || {}).forEach(([leadId, data]) => {
    const incoming = (Array.isArray(data.messages) ? data.messages : []).filter(m => m.direction === 'in');
    if (!incoming.length) return;
    const last = incoming[incoming.length - 1];
    const lead = findLeadEverywhere(leadId) || { id:leadId, nome:data.nome || 'Lead' };
    items.push({ id:last.id || `in_${leadId}`, leadId, lead, text:last.text || '', channel:last.channel || 'whatsapp', at:last.at || last.receivedAt || data.lastResponseAt || '', unread: !last.read });
  });
  responses.forEach(resp => {
    if (!resp.leadId) return;
    const lead = findLeadEverywhere(resp.leadId) || { id:resp.leadId, nome:'Lead' };
    if (!items.some(i => i.id === resp.id)) items.push({ id:resp.id, leadId:resp.leadId, lead, text:resp.text || '', channel:'whatsapp', at:resp.receivedAt || '', unread: !resp.read });
  });
  return items.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
}
function renderInboxV41() {
  const list = document.getElementById('inboxListV41'); if (!list) return;
  const items = getInboxItemsV41();
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('inboxUnreadCountV41', items.filter(i=>i.unread).length);
  set('inboxWhatsappCountV41', items.filter(i=>i.channel!=='instagram').length);
  set('inboxInstagramCountV41', items.filter(i=>i.channel==='instagram').length);
  if (!items.length) { list.innerHTML = '<div class="audit-v35-empty">// nenhuma resposta recebida ainda</div>'; updateInboxBadgeV41(); return; }
  list.innerHTML = items.map(item => `<div class="inbox-v41-item"><div><div class="inbox-v41-title">${escHtml(item.lead?.nome || item.lead?.name || 'Lead')}</div><div class="inbox-v41-message">${escHtml(item.text || '[mensagem sem texto]')}</div><div class="inbox-v41-meta">${escHtml(item.channel || 'whatsapp')} · ${item.at ? escHtml(new Date(item.at).toLocaleString('pt-BR')) : ''}</div></div><div class="inbox-v41-actions"><button class="btn btn-primary" onclick="openConversationFromInboxV41('${escHtml(item.leadId)}')">Responder</button><button class="btn btn-ghost" onclick="openLeadDrawer('${escHtml(item.leadId)}')">Ficha</button></div></div>`).join('');
  updateInboxBadgeV41();
}
function openConversationFromInboxV41(leadId) { activeConversationLeadV38 = leadId; if (typeof switchPanel === 'function') switchPanel('conversations'); setTimeout(()=>{ try{renderConversationsV38();}catch(e){} },100); }
function updateInboxBadgeV41() { const badge=document.getElementById('badge-inbox'); if(badge) badge.textContent = getInboxItemsV41().filter(i=>i.unread).length; }

function formatEvolutionErrorV41(err) {
  const msg = String(err?.message || err || '');
  if (/400|bad request/i.test(msg)) return 'Não foi possível enviar. Verifique se o número tem DDI 55 e existe no WhatsApp.';
  if (/network|fetch|failed/i.test(msg)) return 'Não foi possível conectar na Evolution. Verifique se a API está aberta.';
  return msg || 'Não foi possível concluir a ação.';
}

/* Menu agrupado */
function createMenuItemV41(panel, icon, label, badgeId = '') {
  const item = document.createElement('div');
  item.className = 'nav-item';
  item.dataset.label = label;
  item.onclick = () => {
    if (panel === 'logout') { if (typeof logout === 'function') logout(); else if (typeof signOut === 'function') signOut(); return; }
    if (typeof switchPanel === 'function') switchPanel(panel);
  };
  item.innerHTML = `<div class="nav-icon">${icon}</div><span class="nav-label">${label}</span>${badgeId ? `<span class="nav-badge" id="${badgeId}">0</span>` : ''}`;
  return item;
}
function createMenuGroupV41(title, items = []) {
  const frag = document.createDocumentFragment();
  const group = document.createElement('div'); group.className='sidebar-v41-group'; group.textContent=title; frag.appendChild(group);
  items.forEach(item => { const el=createMenuItemV41(item.panel,item.icon,item.label,item.badgeId||''); if(item.sub) el.classList.add('sidebar-v41-subitem'); frag.appendChild(el); });
  return frag;
}
function rebuildSidebarGroupedV41() {
  const sidebar = document.querySelector('.sidebar'); if (!sidebar || sidebar.dataset.v41Grouped === 'true') return;
  sidebar.innerHTML = '';
  const header=document.createElement('div'); header.className='sidebar-v41-header'; header.innerHTML='<div class="sidebar-v41-hello">Olá, Samuel 👋</div><div class="sidebar-v41-sub">CRM de Prospecção</div>'; sidebar.appendChild(header);
  sidebar.appendChild(createMenuItemV41('busca','🔎','Busca'));
  sidebar.appendChild(createMenuItemV41('inicio','📊','Início'));
  sidebar.appendChild(createMenuItemV41('inbox','📥','Caixa de Entrada','badge-inbox'));
  sidebar.appendChild(createMenuGroupV41('Leads',[{panel:'import',icon:'📥',label:'Importar',sub:true},{panel:'validacao',icon:'✅',label:'Validação',sub:true},{panel:'atribuicao',icon:'🗂️',label:'Atribuição',sub:true}]));
  sidebar.appendChild(createMenuGroupV41('Envios',[{panel:'fila-zap',icon:'💬',label:'WhatsApp',badgeId:'badge-fila-zap',sub:true},{panel:'instagram',icon:'📸',label:'Instagram',sub:true}]));
  sidebar.appendChild(createMenuItemV41('conversations','💬','Conversas'));
  sidebar.appendChild(createMenuGroupV41('Gerenciamento',[{panel:'followups',icon:'⏰',label:'Follow-ups',sub:true},{panel:'kanban',icon:'📋',label:'Kanban',sub:true},{panel:'acompanhamento',icon:'📈',label:'Acompanhamentos',sub:true}]));
  sidebar.appendChild(createMenuGroupV41('Ferramentas',[{panel:'redirects',icon:'🔗',label:'Redirecionamentos',sub:true},{panel:'audit',icon:'📊',label:'Auditoria',badgeId:'badge-audit',sub:true}]));
  sidebar.appendChild(createMenuItemV41('config','⚙️','Configurações'));
  const footer=document.createElement('div'); footer.id='sidebarAuthFooterV40'; footer.appendChild(createMenuItemV41('logout','🚪','Sair')); sidebar.appendChild(footer);
  sidebar.dataset.v41Grouped = 'true';
  try{updateInboxBadgeV41();}catch(e){} try{updateWhatsappQueueBadge();}catch(e){} try{updateAuditBadgeV35();}catch(e){}
}
document.addEventListener('DOMContentLoaded', () => setTimeout(rebuildSidebarGroupedV41, 500));
setTimeout(rebuildSidebarGroupedV41, 1200);


/* V41.1 — MENU EXPANSÍVEL + BADGES SAFE */
function safeSetTextV411(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateBadges() {
  try {
    const data = typeof ensureWeekData === 'function' ? ensureWeekData() : { days:{} };
    const leads = typeof flattenWeekData === 'function' ? flattenWeekData(data) : [];

    safeSetTextV411('badge-inicio', leads.filter(l => (l.status || 'Não enviada') === 'Não enviada').length);
    safeSetTextV411('badge-import', leads.filter(l => (l.status || 'Não enviada') === 'Não enviada').length);
    safeSetTextV411('badge-validacao', typeof getValData === 'function' ? getValData().length : 0);
    const instaSemLink = typeof getInstaFila === 'function' ? getInstaFila().filter(l => !l.instagram).length : 0;
    safeSetTextV411('badge-atribuicao', (typeof getAtribuicaoData === 'function' ? getAtribuicaoData().length : 0) + instaSemLink);
    safeSetTextV411('badge-fila-zap', leads.filter(l => (l.status || 'Não enviada') === 'Não enviada' && l.whatsapp).length);
    const instaWeek = typeof getInstaWeek === 'function' ? getInstaWeek() : {};
    const instaBacklog = typeof getInstaFila === 'function' ? getInstaFila().filter(l => !!l.instagram).length : 0;
    safeSetTextV411('badge-instagram', Object.values(instaWeek).flat().length + instaBacklog);
    const todayIso = new Date().toISOString().slice(0, 10);
    const crm = typeof getLeadCrmStore === 'function' ? getLeadCrmStore() : {};
    safeSetTextV411('badge-followups', Object.values(crm || {}).filter(item => item?.followUpDate && item.followUpDate <= todayIso).length);
    const acomp = typeof getAcompData === 'function' ? getAcompData() : {};
    const month = typeof currentMonthKey === 'function' ? currentMonthKey() : '';
    safeSetTextV411('badge-acompanhamento', (acomp[month] || []).length);

    if (typeof updateInboxBadgeV41 === 'function') updateInboxBadgeV41();
    if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
  } catch(e) {
    console.warn('updateBadges protegido:', e?.message || e);
  }
}

function createMenuItemV411(panel, icon, label, badgeId = '') {
  const item = document.createElement('div');
  item.className = 'nav-item';
  item.dataset.label = label;
  item.onclick = () => {
    if (panel === 'busca') {
      if (typeof openGlobalSearch === 'function') openGlobalSearch();
      return;
    }
    if (panel === 'logout') {
      if (typeof logoutSupabase === 'function') logoutSupabase();
      else if (typeof logout === 'function') logout();
      else if (typeof signOut === 'function') signOut();
      return;
    }
    if (typeof switchPanel === 'function') switchPanel(panel);
  };
  item.innerHTML = `<div class="nav-icon">${icon}</div><span class="nav-label">${label}</span>${badgeId ? `<span class="nav-badge" id="${badgeId}">0</span>` : ''}`;
  return item;
}

function createExpandableMenuGroupV411(title, icon, items = [], open = false) {
  const wrap = document.createElement('div');
  wrap.className = 'sidebar-v411-group' + (open ? ' open' : '');

  const head = document.createElement('div');
  head.className = 'nav-item sidebar-v411-group-head';
  head.innerHTML = `<div class="nav-icon">${icon}</div><span class="nav-label">${title}</span><span class="sidebar-v411-chevron">›</span>`;

  const body = document.createElement('div');
  body.className = 'sidebar-v411-group-body';

  items.forEach(item => {
    const el = createMenuItemV411(item.panel, item.icon, item.label, item.badgeId || '');
    el.classList.add('sidebar-v41-subitem');
    body.appendChild(el);
  });

  head.onclick = () => wrap.classList.toggle('open');
  wrap.appendChild(head);
  wrap.appendChild(body);
  return wrap;
}

function rebuildSidebarGroupedV41() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.dataset.v411Grouped === 'true') return;

  sidebar.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'sidebar-v41-header';
  header.innerHTML = `<div class="sidebar-v41-hello">Olá, Samuel 👋</div><div class="sidebar-v41-sub">CRM de Prospecção</div>`;
  sidebar.appendChild(header);

  sidebar.appendChild(createMenuItemV411('busca', '🔎', 'Busca'));
  sidebar.appendChild(createMenuItemV411('inicio', '📊', 'Início', 'badge-inicio'));
  sidebar.appendChild(createMenuItemV411('inbox', '📥', 'Caixa de Entrada', 'badge-inbox'));

  sidebar.appendChild(createExpandableMenuGroupV411('Leads', '&#128193;', [
    { panel:'importar', icon:'📥', label:'Importar', badgeId:'badge-import' },
    { panel:'validacao', icon:'✅', label:'Validação', badgeId:'badge-validacao' },
    { panel:'atribuicao', icon:'🗂️', label:'Atribuição', badgeId:'badge-atribuicao' }
  ]));

  sidebar.appendChild(createExpandableMenuGroupV411('Envios', '&#128228;', [
    { panel:'fila-zap', icon:'💬', label:'WhatsApp', badgeId:'badge-fila-zap' },
    { panel:'instagram', icon:'📸', label:'Instagram', badgeId:'badge-instagram' }
  ]));

  sidebar.appendChild(createMenuItemV411('conversations', '💬', 'Conversas'));

  sidebar.appendChild(createExpandableMenuGroupV411('Gerenciamento', '&#128203;', [
    { panel:'followups', icon:'⏰', label:'Follow-ups', badgeId:'badge-followups' },
    { panel:'kanban', icon:'📋', label:'Kanban' },
    { panel:'acompanhamento', icon:'📈', label:'Acompanhamentos', badgeId:'badge-acompanhamento' }
  ]));

  sidebar.appendChild(createExpandableMenuGroupV411('Ferramentas', '&#128295;', [
    { panel:'redirecionamentos', icon:'🔗', label:'Redirecionamentos' },
    { panel:'audit', icon:'📊', label:'Auditoria', badgeId:'badge-audit' }
  ]));

  sidebar.appendChild(createMenuItemV411('configuracoes', '⚙️', 'Configurações'));

  const footer = document.createElement('div');
  footer.id = 'sidebarAuthFooterV40';
  footer.appendChild(createMenuItemV411('logout', '🚪', 'Sair'));
  sidebar.appendChild(footer);

  sidebar.dataset.v411Grouped = 'true';
  sidebar.dataset.v41Grouped = 'true';

  try { updateBadges(); } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => setTimeout(rebuildSidebarGroupedV41, 250));
setTimeout(rebuildSidebarGroupedV41, 700);
setTimeout(rebuildSidebarGroupedV41, 1500);


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


/* ════════════════════════════
   V41.2 — TRAVA MENU EXPANSÍVEL
   Impede rebuilds antigos de sobrescreverem a sidebar
════════════════════════════ */
function forceSidebarGroupedV412() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // Se já está com o menu novo e possui grupos expansíveis, apenas atualiza badges.
  if (sidebar.querySelector('.sidebar-v411-group')) {
    sidebar.dataset.v411Grouped = 'true';
    sidebar.dataset.v41Grouped = 'true';
    try { updateBadges(); } catch(e) {}
    return;
  }

  // Força reconstrução limpa ignorando flags antigas.
  delete sidebar.dataset.v411Grouped;
  delete sidebar.dataset.v41Grouped;

  if (typeof rebuildSidebarGroupedV41 === 'function') {
    rebuildSidebarGroupedV41();
  }
}

function disableLegacySidebarRebuildersV412() {
  const noopOrForce = function(){
    setTimeout(forceSidebarGroupedV412, 0);
  };

  // Esses nomes foram usados nas versões anteriores e podem estar sobrescrevendo o menu.
  if (typeof cleanupSidebarMenuV39 === 'function') window.cleanupSidebarMenuV39 = noopOrForce;
  if (typeof rebuildSidebarV40 === 'function') window.rebuildSidebarV40 = noopOrForce;
  if (typeof cleanupSidebarMenuV39 !== 'function') window.cleanupSidebarMenuV39 = noopOrForce;
  if (typeof rebuildSidebarV40 !== 'function') window.rebuildSidebarV40 = noopOrForce;
}

function watchSidebarV412() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.__v412Watcher) return;
  sidebar.__v412Watcher = true;

  const observer = new MutationObserver(() => {
    clearTimeout(window.__v412MenuTimer);
    window.__v412MenuTimer = setTimeout(() => {
      const hasNewMenu = !!sidebar.querySelector('.sidebar-v411-group');
      const hasOldConnected = /Conectado/i.test(sidebar.textContent || '');
      if (!hasNewMenu || hasOldConnected) {
        forceSidebarGroupedV412();
      }
    }, 80);
  });

  observer.observe(sidebar, { childList:true, subtree:true });
}

document.addEventListener('DOMContentLoaded', () => {
  disableLegacySidebarRebuildersV412();
  setTimeout(forceSidebarGroupedV412, 100);
  setTimeout(forceSidebarGroupedV412, 500);
  setTimeout(forceSidebarGroupedV412, 1300);
  setTimeout(watchSidebarV412, 1500);
});

setTimeout(() => {
  disableLegacySidebarRebuildersV412();
  forceSidebarGroupedV412();
  watchSidebarV412();
}, 2200);

setTimeout(forceSidebarGroupedV412, 3500);


/* ════════════════════════════
   V41.3 — MENU NA ORIGEM / HARD FIX
   Garante que o menu antigo não permaneça.
════════════════════════════ */
function createMenuItemV413(panel, icon, label, badgeId = '') {
  const item = document.createElement('div');
  item.className = 'nav-item';
  item.dataset.label = label;
  item.onclick = () => {
    if (panel === 'logout') {
      if (typeof logout === 'function') logout();
      else if (typeof signOut === 'function') signOut();
      return;
    }
    if (typeof switchPanel === 'function') switchPanel(panel);
  };
  item.innerHTML = `
    <div class="nav-icon">${icon}</div>
    <span class="nav-label">${label}</span>
    ${badgeId ? `<span class="nav-badge" id="${badgeId}">0</span>` : ''}
  `;
  return item;
}

function createExpandableMenuGroupV413(title, items = []) {
  const wrap = document.createElement('div');
  wrap.className = 'sidebar-v413-group';

  const head = document.createElement('div');
  head.className = 'sidebar-v413-group-head';
  head.innerHTML = `<span>${title}</span><span class="sidebar-v413-chevron">›</span>`;

  const body = document.createElement('div');
  body.className = 'sidebar-v413-group-body';

  items.forEach(item => {
    const el = createMenuItemV413(item.panel, item.icon, item.label, item.badgeId || '');
    el.classList.add('sidebar-v413-subitem');
    body.appendChild(el);
  });

  head.onclick = () => wrap.classList.toggle('open');
  wrap.appendChild(head);
  wrap.appendChild(body);
  return wrap;
}

function buildFinalSidebarV413() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return false;

  sidebar.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'sidebar-v413-brand';
  brand.innerHTML = `
    <div class="sidebar-v413-hello">Olá, Samuel 👋</div>
    <div class="sidebar-v413-sub">CRM de Prospecção</div>
  `;
  sidebar.appendChild(brand);

  sidebar.appendChild(createMenuItemV413('busca', '🔎', 'Busca'));
  sidebar.appendChild(createMenuItemV413('inicio', '📊', 'Início', 'badge-inicio'));
  sidebar.appendChild(createMenuItemV413('inbox', '📥', 'Caixa de Entrada', 'badge-inbox'));

  sidebar.appendChild(createExpandableMenuGroupV413('Leads', [
    { panel:'import', icon:'📥', label:'Importar', badgeId:'badge-import' },
    { panel:'validacao', icon:'✅', label:'Validação', badgeId:'badge-validacao' },
    { panel:'atribuicao', icon:'🗂️', label:'Atribuição', badgeId:'badge-atribuicao' }
  ]));

  sidebar.appendChild(createExpandableMenuGroupV413('Envios', [
    { panel:'whatsappQueue', icon:'💬', label:'WhatsApp', badgeId:'badge-whatsapp-queue' },
    { panel:'instagram', icon:'📸', label:'Instagram', badgeId:'badge-instagram' }
  ]));

  sidebar.appendChild(createMenuItemV413('conversations', '💬', 'Conversas'));

  sidebar.appendChild(createExpandableMenuGroupV413('Gerenciamento', [
    { panel:'followups', icon:'⏰', label:'Follow-ups', badgeId:'badge-followups' },
    { panel:'kanban', icon:'📋', label:'Kanban' },
    { panel:'acompanhamento', icon:'📈', label:'Acompanhamentos', badgeId:'badge-acompanhamento' }
  ]));

  sidebar.appendChild(createExpandableMenuGroupV413('Ferramentas', [
    { panel:'redirects', icon:'🔗', label:'Redirecionamentos' },
    { panel:'audit', icon:'📊', label:'Auditoria', badgeId:'badge-audit' }
  ]));

  sidebar.appendChild(createMenuItemV413('config', '⚙️', 'Configurações'));

  const footer = document.createElement('div');
  footer.id = 'sidebarAuthFooterV413';
  footer.appendChild(createMenuItemV413('logout', '🚪', 'Sair'));
  sidebar.appendChild(footer);

  sidebar.dataset.v413Final = 'true';
  try { if (typeof updateBadges === 'function') updateBadges(); } catch(e) {}
  return true;
}

function ensureFinalSidebarV413() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const txt = sidebar.textContent || '';
  const hasOldMenu = /PRINCIPAL|LEADS|ENVIO|RESULTADOS|Conectado|Fila WhatsApp/i.test(txt);
  const hasFinal = sidebar.dataset.v413Final === 'true' && sidebar.querySelector('.sidebar-v413-group');

  if (!hasFinal || hasOldMenu) buildFinalSidebarV413();
}

function installSidebarWatchV413() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.__v413Watch) return;
  sidebar.__v413Watch = true;

  const observer = new MutationObserver(() => {
    clearTimeout(window.__v413Timer);
    window.__v413Timer = setTimeout(ensureFinalSidebarV413, 40);
  });
  observer.observe(sidebar, { childList:true, subtree:true, characterData:true });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(buildFinalSidebarV413, 50);
  setTimeout(buildFinalSidebarV413, 250);
  setTimeout(buildFinalSidebarV413, 750);
  setTimeout(() => { buildFinalSidebarV413(); installSidebarWatchV413(); }, 1500);
});

setTimeout(() => { buildFinalSidebarV413(); installSidebarWatchV413(); }, 2500);
setInterval(ensureFinalSidebarV413, 1200);


/* ════════════════════════════
   V41.6 — ESTABILIDADE FILAS / INSTAGRAM / CONFIG
════════════════════════════ */

function ensureWeekDataShapeV416(data) {
  const safe = data && typeof data === 'object' ? data : {};
  safe.days = safe.days && typeof safe.days === 'object' ? safe.days : {};
  safe.importados = Array.isArray(safe.importados) ? safe.importados : [];
  safe.validacao = Array.isArray(safe.validacao) ? safe.validacao : [];
  safe.atribuicao = Array.isArray(safe.atribuicao) ? safe.atribuicao : [];
  safe.instagram = safe.instagram && typeof safe.instagram === 'object' ? safe.instagram : {};
  safe.instagram.backlog = Array.isArray(safe.instagram.backlog) ? safe.instagram.backlog : [];
  safe.instagram.days = safe.instagram.days && typeof safe.instagram.days === 'object' ? safe.instagram.days : {};
  safe.whatsapp = safe.whatsapp && typeof safe.whatsapp === 'object' ? safe.whatsapp : {};
  safe.whatsapp.backlog = Array.isArray(safe.whatsapp.backlog) ? safe.whatsapp.backlog : [];
  safe.whatsapp.days = safe.whatsapp.days && typeof safe.whatsapp.days === 'object' ? safe.whatsapp.days : {};
  return safe;
}

if (typeof ensureWeekData === 'function') {
  const oldEnsureWeekDataV416 = ensureWeekData;
  ensureWeekData = function() {
    try {
      return ensureWeekDataShapeV416(oldEnsureWeekDataV416());
    } catch(e) {
      console.warn('ensureWeekData protegido:', e?.message || e);
      return ensureWeekDataShapeV416({});
    }
  };
}

function getDisparoConfigSafeV416() {
  const defaults = {
    delayMin: 120,
    delayMax: 120,
    loteTamanho: 30,
    loteEsperaMin: 60,
    loteAtivo: 1,
    horarioInicio: '08:00'
  };

  try {
    const cfg = typeof getDisparoConfig === 'function' ? getDisparoConfig() : {};
    return { ...defaults, ...(cfg || {}) };
  } catch {
    return defaults;
  }
}

function getQueueControlSafeV416() {
  try {
    const c = typeof getWhatsappQueueControl === 'function' ? getWhatsappQueueControl() : null;
    return c && typeof c === 'object' ? { paused: !!c.paused } : { paused:false };
  } catch {
    return { paused:false };
  }
}

function getWhatsappQueueSafeV416() {
  try {
    const q = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

/* Corrige Object.values(null) em sincronização da fila */
if (typeof sincronizarFilaComEnviados === 'function') {
  const oldSincronizarFilaComEnviadosV416 = sincronizarFilaComEnviados;
  sincronizarFilaComEnviados = function() {
    try {
      const data = ensureWeekDataShapeV416(typeof ensureWeekData === 'function' ? ensureWeekData() : {});
      return oldSincronizarFilaComEnviadosV416(data);
    } catch(e) {
      console.warn('sincronizarFilaComEnviados protegido:', e?.message || e);
      return [];
    }
  };
}

/* Corrige fila WhatsApp quebrando se estado operacional vem nulo */
if (typeof renderFilaZap === 'function') {
  const oldRenderFilaZapV416 = renderFilaZap;
  renderFilaZap = function() {
    try {
      return oldRenderFilaZapV416();
    } catch(e) {
      console.warn('renderFilaZap protegido:', e?.message || e);
      const panel = document.getElementById('panel-fila-zap') || document.getElementById('panel-whatsappQueue');
      if (panel) {
        panel.innerHTML = `
          <div class="page-header">
            <div class="page-title">WhatsApp <span>Fila.</span></div>
            <div class="page-sub">// fila protegida · dados operacionais inconsistentes</div>
          </div>
          <div class="stretch-card">
            <div class="audit-v35-empty">
              // A fila foi protegida contra dados nulos. Recarregue os dados do Supabase ou adicione leads novamente à fila.
            </div>
          </div>
        `;
      }
    }
  };
}

/* Corrige Instagram quando days/backlog vem null */
function instaCountForDay(dayKey) {
  try {
    const data = ensureWeekDataShapeV416(typeof ensureWeekData === 'function' ? ensureWeekData() : {});
    const instagram = data.instagram || {};
    const days = instagram.days || {};
    const list = days[dayKey] || [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

if (typeof renderInstagram === 'function') {
  const oldRenderInstagramV416 = renderInstagram;
  renderInstagram = function() {
    try {
      return oldRenderInstagramV416();
    } catch(e) {
      console.warn('renderInstagram protegido:', e?.message || e);
      const panel = document.getElementById('panel-instagram');
      if (panel) {
        panel.innerHTML = `
          <div class="page-header">
            <div class="page-title">Instagram <span>Fila.</span></div>
            <div class="page-sub">// backlog · dados protegidos</div>
          </div>
          <div class="stretch-card">
            <div class="audit-v35-empty">
              // Nenhum lead de Instagram disponível ou dados de dias ainda não inicializados.
            </div>
          </div>
        `;
      }
    }
  };
}

/* updateBadges sem Object.values(null) */
function updateBadges() {
  try {
    const data = ensureWeekDataShapeV416(typeof ensureWeekData === 'function' ? ensureWeekData() : {});
    const leads = typeof flattenWeekData === 'function' ? (flattenWeekData(data) || []) : [];

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set('badge-inicio', leads.length || 0);
    set('badge-importar', data.importados.length || 0);
    set('badge-import', data.importados.length || 0);
    set('badge-validacao', data.validacao.length || leads.filter(l => l.status === 'validacao').length || 0);
    set('badge-atribuicao', data.atribuicao.length || leads.filter(l => l.status === 'atribuicao').length || 0);
    set('badge-fila-zap', getWhatsappQueueSafeV416().length);
    set('badge-whatsapp-queue', getWhatsappQueueSafeV416().length);
    set('badge-instagram', (data.instagram.backlog || []).length);
    set('badge-followups', 0);
    set('badge-acompanhamento', 0);

    if (typeof updateInboxBadgeV41 === 'function') updateInboxBadgeV41();
    if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
  } catch(e) {
    console.warn('updateBadges protegido:', e?.message || e);
  }
}

/* Captura global para evitar tela morrer por dados nulos */
window.addEventListener('error', function(e){
  const msg = String(e.message || '');
  if (
    msg.includes("Cannot convert undefined or null to object") ||
    msg.includes("Cannot read properties of null") ||
    msg.includes("Cannot set properties of null")
  ) {
    console.warn('Erro nulo protegido V41.6:', msg);
    e.preventDefault?.();
  }
});





/* ════════════════════════════
   V41.8 — WHATSAPP FILA FINAL SAFE
════════════════════════════ */
function getSafeWhatsappQueueV418() {
  try {
    const q = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function sincronizarFilaComEnviados() {
  try {
    const data = typeof ensureWeekData === 'function' ? ensureWeekData() : {};
    const safe = data && typeof data === 'object' ? data : {};
    const days = safe.days && typeof safe.days === 'object' ? safe.days : {};
    const enviados = [];

    Object.values(days).forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(lead => {
        if (lead && (lead.status === 'enviado' || lead.whatsappStatus === 'sent')) enviados.push(lead);
      });
    });

    return { fila: getSafeWhatsappQueueV418(), enviados };
  } catch(e) {
    console.warn('sincronizarFilaComEnviados protegido V41.8:', e?.message || e);
    return { fila: getSafeWhatsappQueueV418(), enviados: [] };
  }
}

function renderFilaZapSafeV418() {
  const panel = document.getElementById('panel-fila-zap') || document.getElementById('panel-whatsappQueue');
  if (!panel) return;

  const queue = getSafeWhatsappQueueV418();
  const config = getDisparoConfigSafeV418();

  panel.innerHTML = `
    <div class="page-header">
      <div class="page-title">WhatsApp <span>Fila.</span></div>
      <div class="page-sub">// disparos · ${queue.length} lead(s) na fila</div>
    </div>

    <div class="stretch-card">
      <div class="audit-v35-toolbar">
        <div>
          <div class="card-title">Fila de disparo</div>
          <div class="page-sub">${(config ?? getDisparoConfigSafeV418()).delayMin}s entre mensagens · ${(config ?? getDisparoConfigSafeV418()).loteTamanho} por lote · pausa ${(config ?? getDisparoConfigSafeV418()).loteEsperaMin}min</div>
        </div>
        <button class="btn btn-ghost" onclick="renderFilaZapSafeV418()">Atualizar</button>
      </div>

      ${queue.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Chip</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${queue.map(item => `
                <tr>
                  <td>${escHtml(item.nome || item.name || item.leadName || 'Lead')}</td>
                  <td>${escHtml(item.phone || item.whatsapp || item.telefone || '')}</td>
                  <td>${escHtml(item.status || 'Pendente')}</td>
                  <td>${escHtml(item.chipName || item.chip || '')}</td>
                  <td><button class="btn btn-ghost" onclick="removeLeadFromWhatsappQueue('${escHtml(item.leadId || item.id || '')}')">Remover</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="audit-v35-empty">// fila vazia</div>`}
    </div>
  `;

  try { updateBadges(); } catch(e) {}
}

function renderFilaZap() {
  return renderFilaZapSafeV418();
}

window.addEventListener('error', function(e){
  const msg = String(e.message || '');
  if (msg.includes('delayMin') || msg.includes('Cannot convert undefined or null to object')) {
    console.warn('Erro WhatsApp/Fila protegido V41.8:', msg);
    e.preventDefault?.();
    setTimeout(() => { try { renderFilaZapSafeV418(); } catch(err){} }, 30);
  }
});


/* ════════════════════════════
   V41.10 — FILA WHATSAPP ESTÁVEL
════════════════════════════ */
function getFilaWhatsappConfigV4110(){
  return typeof loadEvoConfig === 'function' ? loadEvoConfig() : {
    horarioInicio:'08:00',
    delayMin:120,
    delayMax:120,
    loteTamanho:30,
    loteEsperaMin:60,
    loteAtivo:1
  };
}

function getFilaWhatsappItemsV4110(){
  try {
    const q = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function renderFilaZapSafeV4110(){
  const panel = document.getElementById('panel-fila-zap') || document.getElementById('panel-whatsappQueue');
  if (!panel) return;

  const queue = getFilaWhatsappItemsV4110();
  const cfg = getFilaWhatsappConfigV4110();
  const byStatus = (status) => queue.filter(i => String(i.status || '').toLowerCase() === status).length;

  panel.innerHTML = `
    <div class="page-header">
      <div class="page-title">WhatsApp <span>Fila.</span></div>
      <div class="page-sub">// fila de disparo · ${queue.length} lead(s)</div>
    </div>

    <div class="inbox-v41-grid">
      <div class="inbox-v41-card"><div class="inbox-v41-label">Na fila</div><div class="inbox-v41-value">${queue.length}</div></div>
      <div class="inbox-v41-card"><div class="inbox-v41-label">Prontos</div><div class="inbox-v41-value">${byStatus('pronto')}</div></div>
      <div class="inbox-v41-card"><div class="inbox-v41-label">Enviados</div><div class="inbox-v41-value">${byStatus('enviado')}</div></div>
    </div>

    <div class="stretch-card">
      <div class="audit-v35-toolbar">
        <div>
          <div class="card-title">Fila de disparo</div>
          <div class="page-sub">${cfg.delayMin}s entre mensagens · ${cfg.loteTamanho} por lote · pausa ${cfg.loteEsperaMin}min · início ${cfg.horarioInicio}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="renderFilaZapSafeV4110()">Atualizar</button>
          ${typeof prepareQueueTemplates === 'function' ? `<button class="btn btn-primary" onclick="prepareQueueTemplates()">Sortear templates</button>` : ''}
        </div>
      </div>

      ${queue.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Lead</th><th>Telefone</th><th>Status</th><th>Chip</th><th>Ações</th></tr></thead>
            <tbody>
              ${queue.map(item => `
                <tr>
                  <td>${escHtml(item.nome || item.name || item.leadName || item.companyName || 'Lead')}</td>
                  <td>${escHtml(item.phone || item.whatsapp || item.telefone || '')}</td>
                  <td>${escHtml(item.status || 'Pendente')}</td>
                  <td>${escHtml(item.chipName || item.chip || item.chipId || '')}</td>
                  <td><button class="btn btn-ghost" onclick="removeLeadFromWhatsappQueue('${escHtml(item.leadId || item.id || '')}')">Remover</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="audit-v35-empty">// fila vazia</div>`}
    </div>
  `;

  try { updateBadges(); } catch(e) {}
}

function renderFilaZap(){
  return renderFilaZapSafeV4110();
}

window.addEventListener('error', function(e){
  const msg = String(e.message || '');
  if (msg.includes('delayMin') || msg.includes('delayMax') || msg.includes('loteTamanho')) {
    console.warn('Config da fila protegida V41.10:', msg);
    e.preventDefault?.();
    setTimeout(renderFilaZapSafeV4110, 50);
  }
}, true);
