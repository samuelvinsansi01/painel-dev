
/* V41.9 DELAYMIN ERROR GUARD */
window.addEventListener('error', function(e){
  const msg = String(e.message || '');
  if (msg.includes("delayMin")) {
    console.warn('delayMin protegido V41.9:', msg);
    e.preventDefault?.();
  }
}, true);


/* V41.9 SAFE CONFIG PRELUDE */
function getDisparoConfigSafeV419(){
  const defaults = {
    horarioInicio: '08:00',
    delayMin: 120,
    delayMax: 120,
    loteTamanho: 30,
    loteEsperaMin: 60,
    loteAtivo: 1
  };
  try {
    if (typeof getDisparoConfigSafeV418 === 'function') {
      return { ...defaults, ...(getDisparoConfigSafeV418() || {}) };
    }
  } catch {}
  try {
    const raw = localStorage.getItem('vs_disparo_config') || localStorage.getItem('disparoConfig') || '{}';
    const parsed = JSON.parse(raw);
    return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return defaults;
  }
}
function getDisparoConfigSafeV418(){
  return getDisparoConfigSafeV419();
}


/* V41.8 PRELUDE SAFE DEFAULTS */
function getDisparoConfigSafeV418(){
  const defaults = {
    horarioInicio: '08:00',
    delayMin: 120,
    delayMax: 120,
    loteTamanho: 30,
    loteEsperaMin: 60,
    loteAtivo: 1
  };
  try {
    const raw = localStorage.getItem('vs_disparo_config') || localStorage.getItem('disparoConfig') || '{}';
    const parsed = JSON.parse(raw);
    return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return defaults;
  }
}

/* ════════════════════════════
   CONSTANTS & KEYS
════════════════════════════ */
const EMPRESAS_KEY   = 'vs_empresas_v2';
const HISTORY_KEY    = 'vs_history_v2';
const ACOMP_KEY      = 'vs_acompanhamento_v1'; // base de resultados mensais
const EVO_KEY        = 'vs_evo_config_v2';
const SIDEBAR_KEY    = 'vs_sidebar';
const EXCLUDED_KEY   = 'vs_excluded_domains';
const CHIPS_KEY      = 'vs_chips_v2';
const RAMOS_KEY      = 'vs_ramos_v2';
const TEMPLATES_KEY  = 'vs_templates_v2';
const TEMPLATES_RAMO_KEY = 'vs_templates_ramo_v1'; // templates por ramo+tipo
const VAL_KEY        = 'vs_validacao_v2';   // fila de validação
const ATRIBUICAO_KEY = 'vs_atribuicao_v1';  // base de atribuição (leads validados sem dia)
const INSTA_KEY      = 'vs_insta_fila_v2';  // fila instagram aguardando atribuição
const INSTA_WEEK_KEY = 'vs_insta_week_v1';  // leads instagram atribuídos por dia
const INSTA_SCHED_KEY = 'vs_insta_sched_v1'; // cronograma instagram
const FILA_DISPARO_KEY = 'vs_fila_disparo_v1'; // fila de disparo WhatsApp
const RECUPERAR_VALIDACAO_ZAP_KEY = 'vs_recover_validacao_zap_v1';
const LEAD_CRM_KEY   = 'vs_lead_crm_v1'; // notas, histórico e pipeline comercial
const LEADS_BASE_KEY = 'vs_leads_base_v1'; // inventário permanente, independente da agenda semanal

// Supabase — usado primeiro apenas para login Google.
// Ainda não mexe nos leads e ainda não substitui o localStorage.
const SUPABASE_URL = 'https://txyknazfufashgzlxkqh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ClGVAmaiS4tNWe8W_4EPew_aPvAzK0E';
const sbClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
let currentUser = null;
const supabaseDataAdapter = (sbClient && window.SupabaseAdapter)
  ? new window.SupabaseAdapter(sbClient)
  : null;

const STATUS_OPTIONS = ['Não enviada','Em fila','Enviada','Respondida','Não respondida','Recusada','Fechada'];
const WEEKDAY_NAMES  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];



/* ════════════════════════════
   AUTH GATE V20.2 FIXED
════════════════════════════ */
function isAuthenticated() {
  return !!(currentUser && currentUser.id);
}

function showAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.add('open');
  document.documentElement.classList.add('auth-locked');
  document.body.classList.add('auth-locked');
}

function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.remove('open');
  document.documentElement.classList.remove('auth-locked');
  document.body.classList.remove('auth-locked');
}

function updateAuthGate() {
  if (isAuthenticated()) hideAuthGate();
  else showAuthGate();
}

document.addEventListener('DOMContentLoaded', () => {
  showAuthGate();
});

/* ════════════════════════════
   AUTH — SUPABASE / GOOGLE
   Por enquanto só identifica o usuário.
   Não salva leads no banco ainda.
════════════════════════════ */
function getAuthRedirectUrl() {
  if (window.location.protocol === 'file:') {
    notify('Abra pelo domínio publicado, não pelo arquivo direto.', 'warn');
    return window.location.origin;
  }

  return window.location.origin;
}

function getUserDisplayName(user) {
  if (!user) return '';
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuário';
}


function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAuthUser(user) {
  const box = document.getElementById('authUserBox');
  const loginBtn = document.getElementById('authLoginBtn');
  const logoutBtn = document.getElementById('authLogoutBtn');
  if (!box || !loginBtn || !logoutBtn) return;

  if (user) {
    const name = getUserDisplayName(user);
    box.innerHTML = `<strong>Conectado</strong><br>${escapeHtml(name)}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
  } else {
    box.innerHTML = '<strong>Conta</strong><br>não conectado';
    loginBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
  }
}

function clearLocalSessionData() {
  localStorage.removeItem('vs_empresas_v2');
  localStorage.removeItem('vs_lead_crm_v1');
  localStorage.removeItem('vs_leads_base_v1');
  localStorage.removeItem(SYNC_STATE_KEY);
  updateAuthGate();
  try { rebuildSidebarV40(); } catch(e){}
}

async function initAuth() {
  if (!sbClient) {
    console.warn('[auth] Supabase SDK não carregou.');
    renderAuthUser(null);
    showAuthGate();
    return;
  }

  const { data, error } = await sbClient.auth.getSession();
  if (error) console.warn('[auth] getSession:', error.message);
  currentUser = data?.session?.user || null;
  
  if (!currentUser) {
    clearLocalSessionData();
  }
renderAuthUser(currentUser);
  updateAuthGate();
  renderProductionReadyNote();

  sbClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    renderAuthUser(currentUser);
    updateAuthGate();

    if (currentUser) {
      let operationalLoaded = false;
      try { operationalLoaded = await loadOperationalDataFromSupabaseV36(); } catch(e){}
      try { if (typeof loadWhatsappInstancesFromSupabaseV414 === 'function') await loadWhatsappInstancesFromSupabaseV414(); } catch(e){}
      if (typeof loadSupabaseAsPrimarySource === 'function') {
        await loadSupabaseAsPrimarySource({ preserveWorkflow: operationalLoaded });
      } else if (typeof loadSupabaseLeadsToLocalState === 'function') {
        await loadSupabaseLeadsToLocalState({ preserveWorkflow: operationalLoaded });
      }
    } else {
      if (typeof clearLocalSessionData === 'function') clearLocalSessionData();
      localStorage.removeItem('vs_empresas_v2');
      localStorage.removeItem('vs_lead_crm_v1');
      if (typeof renderInicio === 'function') renderInicio();
      if (typeof updateBadges === 'function') updateBadges();
    }
  });

  if (currentUser) {
    let operationalLoaded = false;
    try { operationalLoaded = await loadOperationalDataFromSupabaseV36(); } catch(e){}
    try { if (typeof loadWhatsappInstancesFromSupabaseV414 === 'function') await loadWhatsappInstancesFromSupabaseV414(); } catch(e){}
    await loadSupabaseAsPrimarySource({ preserveWorkflow: operationalLoaded });
  }
}

async function loginGoogle() {
  if (!sbClient) {
    notify('Supabase não carregou. Recarregue a página.', 'err');
    return;
  }

  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl() }
  });

  if (error) {
    console.error('[auth] loginGoogle:', error);
    notify('Erro ao entrar com Google', 'err');
  }
}

async function logoutSupabase() {
  localStorage.removeItem('vs_empresas_v2');
  localStorage.removeItem('vs_lead_crm_v1');
  localStorage.removeItem('vs_leads_base_v1');

  currentUser = null;

  renderAuthUser(null);

  if (typeof renderInicio === 'function') renderInicio();
  if (typeof updateBadges === 'function') updateBadges();

  showAuthGate();

  if (!sbClient) {
    notify('Conta desconectada');
    return;
  }

  try {
    const { error } = await sbClient.auth.signOut();
    if (error) {
      console.warn('[auth] logout remoto:', error.message);
      notify('Sessão local encerrada. Recarregue se necessário.', 'warn');
      return;
    }
    notify('Conta desconectada');
  } catch (error) {
    console.warn('[auth] logout remoto:', error?.message || error);
    notify('Sessão local encerrada. Recarregue se necessário.', 'warn');
  }
}



