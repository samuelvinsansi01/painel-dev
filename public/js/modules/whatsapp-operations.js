/* ════════════════════════════
   FILA WHATSAPP V27 REAL
════════════════════════════ */
const WHATSAPP_QUEUE_V27_KEY = 'vs_whatsapp_queue_v27';
const QUEUE_CAMPAIGNS_V27_KEY = 'vs_queue_campaigns_v27';
const QUEUE_TEMPLATES_V27_KEY = 'vs_queue_templates_v27';

function getQueueCampaigns() {
  try {
    const data = JSON.parse(localStorage.getItem(QUEUE_CAMPAIGNS_V27_KEY) || 'null');
    return Array.isArray(data) && data.length ? data : ['Campanha Principal'];
  } catch {
    return ['Campanha Principal'];
  }
}

function saveQueueCampaigns(list) {
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(QUEUE_CAMPAIGNS_V27_KEY, JSON.stringify(list || []));
}

function getQueueTemplates() {
  try {
    const data = JSON.parse(localStorage.getItem(QUEUE_TEMPLATES_V27_KEY) || 'null');
    return Array.isArray(data) && data.length ? data : [
      { id:'tpl_default_1', name:'Template A', text:'Olá, tudo bem? Posso te enviar uma apresentação rápida?' },
      { id:'tpl_default_2', name:'Template B', text:'Oi! Vi sua empresa e acredito que posso ajudar com presença digital.' }
    ];
  } catch {
    return [];
  }
}

function saveQueueTemplates(list) {
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(QUEUE_TEMPLATES_V27_KEY, JSON.stringify(list || []));
}

function getWhatsappQueueV27() {
  try {
    const data = JSON.parse(localStorage.getItem(WHATSAPP_QUEUE_V27_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveWhatsappQueueV27(list) {
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(WHATSAPP_QUEUE_V27_KEY, JSON.stringify(list || []));
  updateWhatsappQueueBadge();
  if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
}

function addQueueCampaign() {
  const input = document.getElementById('queueCampaignName');
  const name = (input?.value || '').trim();
  if (!name) return;

  const campaigns = getQueueCampaigns();
  if (!campaigns.includes(name)) campaigns.push(name);
  saveQueueCampaigns(campaigns);

  if (input) input.value = '';
  renderWhatsappQueuePanel();
  notify('Campanha adicionada.');
}

function removeQueueCampaign(name) {
  const campaigns = getQueueCampaigns().filter(item => item !== name);
  saveQueueCampaigns(campaigns.length ? campaigns : ['Campanha Principal']);
  renderWhatsappQueuePanel();
}

function addQueueTemplate() {
  const nameEl = document.getElementById('queueTemplateName');
  const textEl = document.getElementById('queueTemplateText');

  const name = (nameEl?.value || '').trim();
  const text = (textEl?.value || '').trim();

  if (!name || !text) {
    notify('Informe nome e texto do template.', 'warn');
    return;
  }

  const templates = getQueueTemplates();
  templates.push({
    id: 'tpl_' + Date.now(),
    name,
    text
  });

  saveQueueTemplates(templates);

  if (nameEl) nameEl.value = '';
  if (textEl) textEl.value = '';

  renderWhatsappQueuePanel();
  notify('Template adicionado.');
}

function removeQueueTemplate(id) {
  saveQueueTemplates(getQueueTemplates().filter(tpl => tpl.id !== id));
  renderWhatsappQueuePanel();
}

function renderQueueCampaigns() {
  const box = document.getElementById('queueCampaignList');
  if (!box) return;

  const campaigns = getQueueCampaigns();

  box.innerHTML = campaigns.map(name => `
    <div class="queue-v27-item">
      <div>
        <div class="queue-v27-item-title">${escHtml(name)}</div>
        <div class="queue-v27-item-text">// campanha disponível</div>
      </div>
      <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeQueueCampaign('${escHtml(name)}')">Remover</button>
    </div>
  `).join('');
}

function renderQueueTemplates() {
  const box = document.getElementById('queueTemplateList');
  if (!box) return;

  const templates = getQueueTemplates();

  box.innerHTML = templates.map(tpl => `
    <div class="queue-v27-item">
      <div>
        <div class="queue-v27-item-title">${escHtml(tpl.name)}</div>
        <div class="queue-v27-item-text">${escHtml((tpl.text || '').slice(0, 120))}</div>
      </div>
      <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeQueueTemplate('${escHtml(tpl.id)}')">Remover</button>
    </div>
  `).join('');
}

function addActiveLeadToWhatsappQueue() {
  if (!activeLeadDrawerId || !activeLeadDrawerData) return;
  if (!isLeadWhatsappValidatedForQueue({ ...activeLeadDrawerData, id: activeLeadDrawerId })) {
    notify('Valide o WhatsApp antes de adicionar à fila.', 'warn');
    return;
  }

  const campaign = document.getElementById('leadQueueCampaign')?.value || 'Campanha Principal';
  const queue = getWhatsappQueueV27();

  const exists = queue.some(item => item.leadId === activeLeadDrawerId && !['Enviado','Erro'].includes(item.status));
  if (exists) {
    notify('Este lead já está na fila.', 'warn');
    return;
  }

  const phone = normalizePhoneForEvolution(activeLeadDrawerData.whatsapp || activeLeadDrawerData.phone || activeLeadDrawerData.telefone || '');

  const item = {
    id: 'queue_' + Date.now(),
    leadId: activeLeadDrawerId,
    nome: activeLeadDrawerData.nome || activeLeadDrawerData.companyName || 'Lead',
    telefone: phone,
    campaign,
    status: 'Pendente',
    templateId: '',
    templateName: '',
    createdAt: new Date().toISOString(),
    createdAtLabel: crmNowLabel()
  };

  queue.unshift(item);
  saveWhatsappQueueV27(queue);

  addLeadHistory(activeLeadDrawerId, `Adicionado à fila WhatsApp (${campaign})`, activeLeadDrawerData);
  renderLeadQueueBox();
  if (typeof renderLeadTimeline === 'function') renderLeadTimeline(activeLeadDrawerId);
  notify('Lead adicionado à fila.');
}

function removeLeadFromWhatsappQueue(leadId) {
  const queue = getWhatsappQueueV27().filter(item => item.leadId !== leadId || item.status === 'Enviado');
  saveWhatsappQueueV27(queue);

  if (activeLeadDrawerId === leadId) {
    addLeadHistory(leadId, 'Removido da fila WhatsApp', activeLeadDrawerData || {});
    renderLeadQueueBox();
    if (typeof renderLeadTimeline === 'function') renderLeadTimeline(leadId);
  }

  renderWhatsappQueuePanel();
}

function setQueueItemStatus(id, status) {
  const queue = getWhatsappQueueV27();
  const item = queue.find(q => q.id === id);
  if (!item) return;

  item.status = status;
  item.updatedAt = new Date().toISOString();
  saveWhatsappQueueV27(queue);

  if (item.leadId) {
    addLeadHistory(item.leadId, `Fila WhatsApp: status alterado para ${status}`, findLeadEverywhere(item.leadId) || {});
  }

  renderWhatsappQueuePanel();
}

function renderWhatsappQueueList() {
  const box = document.getElementById('whatsappQueueList');
  if (!box) return;

  const queue = getWhatsappQueueV27();

  if (!queue.length) {
    box.innerHTML = '<div class="queue-v27-empty">// nenhum lead na fila WhatsApp</div>';
    return;
  }

  box.innerHTML = queue.map(item => {
    const cls = normalizeStr(item.status || 'pendente').replace(/[^a-z0-9]+/g,'');
    return `
      <div class="queue-v27-row">
        <div>
          <div class="queue-v27-name">${escHtml(item.nome || 'Lead')}</div>
          <div class="queue-v27-meta">${escHtml(item.telefone || 'sem telefone')}</div>
        </div>
        <div class="queue-v27-meta">${escHtml(item.campaign || 'Campanha Principal')}</div>
        <div class="queue-v27-meta">${item.templateName ? `<span class="queue-v28-template">${escHtml(item.templateName)}</span>` : 'template ainda não sorteado'}</div>
        <span class="queue-v27-status ${cls}">${escHtml(item.status || 'Pendente')}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="openLeadDrawer('${escHtml(item.leadId)}')">Ficha</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="setQueueItemStatus('${escHtml(item.id)}','Pronto')">Pronto</button>
          <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeLeadFromWhatsappQueue('${escHtml(item.leadId)}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderWhatsappQueuePanel() {
  renderQueueControlBar();
  renderQueueCampaigns();
  renderQueueTemplates();
  renderWhatsappQueueList();
  updateWhatsappQueueBadge();
}

function updateWhatsappQueueBadge() {
  const badge = document.getElementById('badge-whatsapp-queue');
  if (!badge) return;
  const pending = getWhatsappQueueV27().filter(item => ['Pendente','Pronto'].includes(item.status)).length;
  badge.textContent = pending;
}

function ensureLeadQueueContainer() {
  if (document.getElementById('leadQueueBox')) return true;

  const drawer = document.getElementById('leadDrawer');
  if (!drawer) return false;

  const target =
    document.getElementById('leadMessageBox') ||
    document.getElementById('leadWhatsappValidationBox') ||
    document.getElementById('leadPresentationsList') ||
    document.getElementById('leadTimelineList');

  const block = document.createElement('div');
  block.id = 'leadQueueBox';

  if (target && target.parentElement) {
    target.parentElement.insertAdjacentElement('afterend', block);
  } else {
    drawer.appendChild(block);
  }

  return true;
}

function renderLeadQueueBox() {
  ensureLeadQueueContainer();
  const box = document.getElementById('leadQueueBox');
  if (!box || !activeLeadDrawerId) return;

  const campaigns = getQueueCampaigns();
  const active = getWhatsappQueueV27().find(item => item.leadId === activeLeadDrawerId && !['Enviado','Erro'].includes(item.status));

  box.innerHTML = `
    <div class="lead-queue-block">
      <div class="lead-queue-title">Fila WhatsApp</div>
      <div class="lead-queue-form">
        <select id="leadQueueCampaign" ${active ? 'disabled' : ''}>
          ${campaigns.map(c => `<option value="${escHtml(c)}" ${active?.campaign === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        </select>
        ${active
          ? `<button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeLeadFromWhatsappQueue('${escHtml(activeLeadDrawerId)}')">Remover da fila</button>`
          : `<button class="btn btn-primary" style="font-size:10px;padding:7px 12px" onclick="addActiveLeadToWhatsappQueue()">Adicionar à fila</button>`
        }
      </div>
      <div class="lead-queue-status">
        ${active ? `Status: ${escHtml(active.status)} · Campanha: ${escHtml(active.campaign)}` : '// lead ainda não está na fila'}
      </div>
    </div>
  `;
}


/* ════════════════════════════
   CONTROLE DE FILA V28
════════════════════════════ */
const WHATSAPP_QUEUE_CONTROL_KEY = 'vs_whatsapp_queue_control_v28';

function getWhatsappQueueControl() {
  try {
    const control = JSON.parse(localStorage.getItem(WHATSAPP_QUEUE_CONTROL_KEY) || '{"paused":false}');
    return control && typeof control === 'object' && !Array.isArray(control) ? control : { paused:false };
  } catch {
    return { paused:false };
  }
}

function saveWhatsappQueueControl(control) {
  localStorage.setItem(WHATSAPP_QUEUE_CONTROL_KEY, JSON.stringify({
    paused: !!control.paused,
    updatedAt: new Date().toISOString()
  }));
}

function pauseWhatsappQueue() {
  saveWhatsappQueueControl({ paused:true });
  renderWhatsappQueuePanel();
  notify('Fila pausada.');
}

function resumeWhatsappQueue() {
  saveWhatsappQueueControl({ paused:false });
  renderWhatsappQueuePanel();
  notify('Fila retomada.');
}

function toggleWhatsappQueuePause() {
  const control = getWhatsappQueueControl();
  if (control.paused) resumeWhatsappQueue();
  else pauseWhatsappQueue();
}

function pickRandomQueueTemplate() {
  const templates = getQueueTemplates ? getQueueTemplates() : [];
  if (!templates.length) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

function prepareQueueTemplates() {
  const control = getWhatsappQueueControl();
  if (control.paused) {
    notify('Retome a fila antes de preparar templates.', 'warn');
    return;
  }

  const queue = getWhatsappQueueV27();
  let count = 0;

  queue.forEach(item => {
    if (item.status !== 'Pendente') return;
    const template = pickRandomQueueTemplate();
    if (!template) return;

    item.templateId = template.id;
    item.templateName = template.name;
    item.templateText = template.text;
    item.status = 'Pronto';
    item.updatedAt = new Date().toISOString();
    count++;

    if (item.leadId && typeof addLeadHistory === 'function') {
      addLeadHistory(item.leadId, `Template sorteado para fila: ${template.name}`, findLeadEverywhere(item.leadId) || {});
    }
  });

  saveWhatsappQueueV27(queue);
  renderWhatsappQueuePanel();
  notify(`${count} lead(s) preparado(s) com template sorteado.`);
}

function renderQueueControlBar() {
  const host = document.getElementById('queueControlBar');
  if (!host) return;

  const control = getWhatsappQueueControl();
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


/* ════════════════════════════
   CHIPS V29 — DISTRIBUIÇÃO
════════════════════════════ */
const WHATSAPP_CHIPS_V29_KEY = 'vs_whatsapp_chips_v29';
const CHIP_USAGE_DAY_KEY = 'vs_chip_usage_day_v29';

function todayUsageKeyV29(){ return new Date().toISOString().slice(0,10); }

function getWhatsappChipsV29(){
  try {
    const data = JSON.parse(localStorage.getItem(WHATSAPP_CHIPS_V29_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveWhatsappChipsV29(list){
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(WHATSAPP_CHIPS_V29_KEY, JSON.stringify(list || []));
  updateChipsBadge();
}

function getChipUsageV29(){
  try {
    const usage = JSON.parse(localStorage.getItem(CHIP_USAGE_DAY_KEY) || '{}');
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return { day: todayUsageKeyV29(), chips:{} };
    if (usage.day !== todayUsageKeyV29()) return { day: todayUsageKeyV29(), chips:{} };
    return usage;
  } catch { return { day: todayUsageKeyV29(), chips:{} }; }
}

function saveChipUsageV29(usage){
  localStorage.setItem(CHIP_USAGE_DAY_KEY, JSON.stringify(usage));
}

function getChipUsedToday(chipId){
  const usage = getChipUsageV29();
  return Number(usage.chips?.[chipId] || 0);
}

function setChipUsedToday(chipId, count){
  const usage = getChipUsageV29();
  usage.chips = usage.chips || {};
  usage.chips[chipId] = Number(count || 0);
  saveChipUsageV29(usage);
}

function addWhatsappChip(){
  return saveChipWithConnectionTestV406();
}

function removeWhatsappChip(id){
  saveWhatsappChipsV29(getWhatsappChipsV29().filter(chip => chip.id !== id));
  renderChipsPanel();
}

function toggleChipPause(id){
  const chips = getWhatsappChipsV29();
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  chip.paused = !chip.paused;
  saveWhatsappChipsV29(chips);
  renderChipsPanel();
}

function toggleChipEnabled(id){
  const chips = getWhatsappChipsV29();
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  chip.status = chip.status === 'disabled' ? 'active' : 'disabled';
  saveWhatsappChipsV29(chips);
  renderChipsPanel();
}

function resetDailyChipUsage(){
  saveChipUsageV29({ day: todayUsageKeyV29(), chips:{} });
  renderChipsPanel();
  notify('Contadores do dia zerados.');
}

function getAvailableChipsV29(){
  return getWhatsappChipsV29().filter(chip => {
    if (chip.status === 'disabled' || chip.paused) return false;
    return getChipUsedToday(chip.id) < Number(chip.dailyLimit || 120);
  });
}

function assignChipsToReadyQueue(){
  const chips = getAvailableChipsV29();
  if (!chips.length) {
    notify('Nenhum chip disponível.', 'warn');
    return;
  }

  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const ready = queue.filter(item => item.status === 'Pronto' && !item.chipId);

  if (!ready.length) {
    notify('Nenhum lead pronto sem chip.', 'warn');
    return;
  }

  let assigned = 0;
  let chipIndex = 0;

  ready.forEach(item => {
    let tries = 0;
    let selected = null;

    while (tries < chips.length) {
      const chip = chips[chipIndex % chips.length];
      chipIndex++;
      tries++;

      const used = getChipUsedToday(chip.id);
      if (used < Number(chip.dailyLimit || 120)) {
        selected = chip;
        break;
      }
    }

    if (!selected) return;

    item.chipId = selected.id;
    item.chipName = selected.name;
    item.chipInstance = selected.instance;
    item.intervalSeconds = Number(selected.intervalSeconds || 120);
    item.blockSize = Number(selected.blockSize || 30);
    item.blocks = selected.blocks || ['08:00','10:00','12:00','14:00'];
    item.updatedAt = new Date().toISOString();

    setChipUsedToday(selected.id, getChipUsedToday(selected.id) + 1);
    assigned++;

    if (item.leadId && typeof addLeadHistory === 'function') {
      addLeadHistory(item.leadId, `Chip atribuído para disparo: ${selected.name}`, findLeadEverywhere(item.leadId) || {});
    }
  });

  saveWhatsappQueueV27(queue);
  renderChipsPanel();
  if (typeof renderWhatsappQueuePanel === 'function') renderWhatsappQueuePanel();
  notify(`${assigned} lead(s) receberam chip.`);
}

function renderChipsOperationSummary(){
  const box = document.getElementById('chipsOperationSummary');
  if (!box) return;

  const chips = getWhatsappChipsV29();
  const active = chips.filter(c => c.status !== 'disabled' && !c.paused);
  const totalCapacity = active.reduce((sum, chip) => sum + Math.max(0, Number(chip.dailyLimit || 120) - getChipUsedToday(chip.id)), 0);
  const totalDaily = chips.reduce((sum, chip) => sum + Number(chip.dailyLimit || 120), 0);

  box.innerHTML = `
    Chips cadastrados: ${chips.length}<br>
    Chips ativos: ${active.length}<br>
    Capacidade diária total: ${totalDaily}<br>
    Capacidade restante hoje: ${totalCapacity}<br>
    Padrão recomendado: 120 por chip · 4 blocos de 30 · 120s · espera 1h entre blocos
  `;
}

function renderChipsList(){
  const box = document.getElementById('chipsList');
  if (!box) return;

  const chips = getWhatsappChipsV29();

  if (!chips.length) {
    box.innerHTML = '<div class="queue-v27-empty">// nenhum chip cadastrado ainda</div>';
    return;
  }

  box.innerHTML = chips.map(chip => {
    const used = getChipUsedToday(chip.id);
    const limit = Number(chip.dailyLimit || 120);
    const pct = Math.min(100, Math.round((used / Math.max(limit,1)) * 100));
    const disabled = chip.status === 'disabled';
    const paused = !!chip.paused;
    const stateClass = disabled ? 'disabled' : paused ? 'paused' : '';
    const pill = disabled
      ? '<span class="chip-pill err">desativado</span>'
      : paused
        ? '<span class="chip-pill warn">pausado</span>'
        : '<span class="chip-pill ok">ativo</span>';

    return `
      <div class="chip-card ${stateClass}">
        <div class="chip-card-top">
          <div>
            <div class="chip-card-name">${escHtml(chip.name)}</div>
            <div class="chip-card-meta">
              URL: ${escHtml(chip.url || chip.baseUrl || chip.evolutionUrl || 'sem URL')}<br>Instância: ${escHtml(chip.instance)}<br>Estado: ${escHtml(chip.connectionState || 'não testado')}<br>
              Blocos: ${escHtml((chip.blocks || []).join(', '))}<br>
              Intervalo: ${escHtml(String(chip.intervalSeconds || 120))}s
            </div>
          </div>
          ${pill}
        </div>
        <div class="chip-card-meta">${used} / ${limit} envios hoje</div>
        <div class="chip-progress"><div class="chip-progress-fill" style="width:${pct}%"></div></div>
        <div class="chip-card-actions">
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="toggleChipPause('${escHtml(chip.id)}')">${paused ? 'Retomar' : 'Pausar'}</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="toggleChipEnabled('${escHtml(chip.id)}')">${disabled ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeWhatsappChip('${escHtml(chip.id)}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderChipsPanel(){
  renderChipsOperationSummary();
  renderChipsList();
  updateChipsBadge();
}

function updateChipsBadge(){
  const badge = document.getElementById('badge-chips');
  if (badge) badge.textContent = getWhatsappChipsV29().length;
}


/* ════════════════════════════
   DISPARO INICIAL V30
════════════════════════════ */
const DISPATCH_V30_LOG_KEY = 'vs_dispatch_v30_log';

function getDispatchLogsV30() {
  try {
    const data = JSON.parse(localStorage.getItem(DISPATCH_V30_LOG_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveDispatchLogsV30(list) {
  localStorage.setItem(DISPATCH_V30_LOG_KEY, JSON.stringify((list || []).slice(0, 200)));
}

function addDispatchLogV30(text) {
  const logs = getDispatchLogsV30();
  logs.unshift({
    at: crmNowLabel(),
    text
  });
  saveDispatchLogsV30(logs);
}

function getReadyDispatchItemsV30() {
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const chips = getWhatsappChipsV29 ? getWhatsappChipsV29() : [];
  const chipMap = new Map(chips.map(chip => [chip.id, chip]));

  return queue.filter(item => {
    if (item.status !== 'Pronto') return false;
    if (!item.chipId || !item.templateText) return false;

    const chip = chipMap.get(item.chipId);
    if (!chip) return false;
    if (chip.paused || chip.status === 'disabled') return false;

    return true;
  });
}

function renderDispatchV30Panel() {
  const host = document.getElementById('dispatchV30Panel');
  if (!host) return;

  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };
  const ready = getReadyDispatchItemsV30();
  const logs = getDispatchLogsV30().slice(0, 8);

  host.innerHTML = `
    <div class="dispatch-v30-panel">
      <div class="dispatch-v30-head">
        <div>
          <div class="dispatch-v30-title">
            Disparo em massa
            <span class="dispatch-v30-pill">${ready.length} pronto(s)</span>
          </div>
          <div class="dispatch-v30-sub">
            120 mensagens por chip · 4 lotes de 30 · 120s entre envios · espera 1h
          </div>
        </div>
        <div class="dispatch-v30-actions">
          <button class="btn btn-ghost" onclick="previewDispatchV30()">Pré-visualizar</button>
          <button class="btn btn-primary" onclick="startDispatchV32()">Iniciar disparo</button><button class="btn btn-danger" onclick="stopDispatchV32()">Parar</button>
        </div>
      </div>
      <div class="dispatch-v30-log">
        ${logs.length ? logs.map(log => `${escHtml(log.at)} · ${escHtml(log.text)}`).join('<br>') : '// nenhum disparo iniciado ainda'}
      </div>
    </div>
  `;
}

function previewDispatchV30() {
  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };

  if (control.paused) {
    notify('A fila está pausada.', 'warn');
    addDispatchLogV30('Prévia bloqueada: fila pausada');
    renderDispatchV30Panel();
    return;
  }

  const ready = getReadyDispatchItemsV30();
  const byChip = {};

  ready.forEach(item => {
    byChip[item.chipName || 'Sem chip'] = (byChip[item.chipName || 'Sem chip'] || 0) + 1;
  });

  const summary = Object.entries(byChip)
    .map(([chip, count]) => `${chip}: ${count}`)
    .join(' · ');

  addDispatchLogV30(`Prévia: ${ready.length} lead(s) pronto(s). ${summary || 'Nenhum chip disponível.'}`);
  renderDispatchV30Panel();
  notify(`${ready.length} lead(s) pronto(s) para disparo.`);
}

async function startDispatchV30() {
  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };

  if (control.paused) {
    notify('Retome a fila antes de disparar.', 'warn');
    addDispatchLogV30('Disparo bloqueado: fila pausada');
    renderDispatchV30Panel();
    return;
  }

  const settings = getEvolutionSettings ? getEvolutionSettings() : {};
  const chips = getWhatsappChipsV29 ? getWhatsappChipsV29() : [];
  const hasEvolutionConfig = chips.some(chip => {
    const config = typeof getEvolutionConfigForChipV405 === 'function'
      ? getEvolutionConfigForChipV405(chip)
      : chip;
    return !!(config.url && config.instance && (config.apiKey || config.key || config.apikey));
  }) || !!(settings.url && settings.instance && settings.apiKey);

  if (!hasEvolutionConfig) {
    notify('Configure a Evolution API antes do disparo.', 'warn');
    addDispatchLogV30('Disparo bloqueado: Evolution incompleta');
    renderDispatchV30Panel();
    return;
  }

  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const ready = getReadyDispatchItemsV30();

  if (!ready.length) {
    notify('Nenhum lead pronto para envio.', 'warn');
    addDispatchLogV30('Nenhum lead pronto para envio');
    renderDispatchV30Panel();
    return;
  }

  addDispatchLogV30(`Disparo iniciado: ${ready.length} lead(s).`);
  addDispatchLogV30('Ritmo V31 ativo: valida limite diário e bloco por chip.');

  let sent = 0;
  let failed = 0;

  for (const item of ready) {
    const currentControl = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };
    if (currentControl.paused) {
      addDispatchLogV30('Disparo interrompido: fila pausada');
      break;
    }

    const chip = (getWhatsappChipsV29 ? getWhatsappChipsV29() : []).find(c => c.id === item.chipId);
    if (!chip || chip.paused || chip.status === 'disabled') {
      item.status = 'Erro';
      item.error = 'Chip indisponível';
      failed++;
      continue;
    }

    const chipConfigV405 = typeof getEvolutionConfigForChipV405 === 'function'
      ? getEvolutionConfigForChipV405(chip)
      : settings;

    if (!chipConfigV405.url || !chipConfigV405.instance || !chipConfigV405.apiKey) {
      item.status = 'Erro';
      item.error = 'Evolution incompleta no chip';
      failed++;
      continue;
    }

    const phone = normalizePhoneForEvolution(item.telefone || '');
    const text = item.templateText || '';

    if (!phone || !text) {
      item.status = 'Erro';
      item.error = 'Telefone ou template ausente';
      failed++;
      continue;
    }

    try {
      const endpoint = `${chipConfigV405.url}/message/sendText/${encodeURIComponent(chipConfigV405.instance)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: (typeof getEvolutionHeadersV405 === 'function' ? getEvolutionHeadersV405(chipConfigV405) : getEvolutionHeaders(chipConfigV405)),
        body: JSON.stringify(buildEvolutionTextPayloadV4013(phone, text))
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        item.status = 'Erro';
        item.error = data?.message || data?.error || `HTTP ${res.status}`;
        failed++;
        addDispatchLogV30(`Erro: ${item.nome} · ${item.error}`);
        if (item.leadId) addLeadHistory(item.leadId, `Disparo WhatsApp com erro: ${item.error}`, findLeadEverywhere(item.leadId) || {});
      } else {
        item.status = 'Enviado';
        item.sentAt = new Date().toISOString();
        item.sentAtLabel = crmNowLabel();
        item.response = data;
        sent++;
        addDispatchLogV30(`Enviado: ${item.nome} · ${chip.name} · bloco ${item.sentBlock || '--'}`);
        if (item.leadId) addLeadHistory(item.leadId, `Mensagem enviada em massa via ${chip.name} · Template: ${item.templateName}`, findLeadEverywhere(item.leadId) || {});
      }
    } catch (err) {
      item.status = 'Erro';
      item.error = err?.message || 'falha desconhecida';
      failed++;
      addDispatchLogV30(`Falha: ${item.nome} · ${item.error}`);
      if (item.leadId) addLeadHistory(item.leadId, `Disparo WhatsApp falhou: ${item.error}`, findLeadEverywhere(item.leadId) || {});
    }
  }

  saveWhatsappQueueV27(queue);
  addDispatchLogV30(`Disparo finalizado: ${sent} enviado(s), ${failed} erro(s).`);

  if (typeof renderWhatsappQueuePanel === 'function') renderWhatsappQueuePanel();
  if (typeof renderChipsPanel === 'function') renderChipsPanel();
  renderDispatchV30Panel();

  notify(`Disparo finalizado: ${sent} enviado(s), ${failed} erro(s).`);
}


/* ════════════════════════════
   RITMO E BLOCOS V31
════════════════════════════ */
function getChipBlockUsageV31(chipId) {
  const usage = getChipUsageV29 ? getChipUsageV29() : { day: todayUsageKeyV29(), chips:{} };
  usage.blocks = usage.blocks || {};
  usage.blocks[chipId] = usage.blocks[chipId] || {};
  return usage.blocks[chipId];
}

function setChipBlockUsageV31(chipId, block, count) {
  const usage = getChipUsageV29 ? getChipUsageV29() : { day: todayUsageKeyV29(), chips:{} };
  usage.blocks = usage.blocks || {};
  usage.blocks[chipId] = usage.blocks[chipId] || {};
  usage.blocks[chipId][block] = Number(count || 0);
  saveChipUsageV29(usage);
}

function getCurrentDispatchBlockV31(chip) {
  const blocks = chip?.blocks?.length ? chip.blocks : ['08:00','10:00','12:00','14:00'];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let selected = blocks[0];

  blocks.forEach(block => {
    const [h, m] = String(block).split(':').map(Number);
    const blockMinutes = (h || 0) * 60 + (m || 0);
    if (currentMinutes >= blockMinutes) selected = block;
  });

  return selected;
}

function canSendByChipRulesV31(chip) {
  if (!chip) return { ok:false, reason:'chip ausente' };
  if (chip.paused || chip.status === 'disabled') return { ok:false, reason:'chip pausado/desativado' };

  const dailyLimit = Number(chip.dailyLimit || 120);
  const blockSize = Number(chip.blockSize || 30);
  const usedToday = getChipUsedToday(chip.id);

  if (usedToday >= dailyLimit) {
    return { ok:false, reason:'limite diário atingido' };
  }

  const block = getCurrentDispatchBlockV31(chip);
  const blockUsage = getChipBlockUsageV31(chip.id);
  const usedInBlock = Number(blockUsage[block] || 0);

  if (usedInBlock >= blockSize) {
    return { ok:false, reason:`bloco ${block} cheio` };
  }

  return { ok:true, block, usedToday, usedInBlock };
}

function registerChipSendV31(chip) {
  const block = getCurrentDispatchBlockV31(chip);
  setChipUsedToday(chip.id, getChipUsedToday(chip.id) + 1);

  const blockUsage = getChipBlockUsageV31(chip.id);
  setChipBlockUsageV31(chip.id, block, Number(blockUsage[block] || 0) + 1);

  return block;
}

function getDispatchScheduleSummaryV31() {
  const chips = getWhatsappChipsV29 ? getWhatsappChipsV29() : [];
  const active = chips.filter(c => c.status !== 'disabled' && !c.paused);
  const totalDaily = active.reduce((sum, chip) => sum + Number(chip.dailyLimit || 120), 0);
  const remaining = active.reduce((sum, chip) => sum + Math.max(0, Number(chip.dailyLimit || 120) - getChipUsedToday(chip.id)), 0);
  const currentBlock = active[0] ? getCurrentDispatchBlockV31(active[0]) : '--:--';

  return {
    chips: active.length,
    totalDaily,
    remaining,
    currentBlock
  };
}

function renderDispatchScheduleV31() {
  const summary = getDispatchScheduleSummaryV31();

  return `
    <div class="dispatch-v31-schedule">
      <div class="dispatch-v31-slot">
        <div class="dispatch-v31-slot-title">Chips ativos</div>
        <div class="dispatch-v31-slot-value">${summary.chips}</div>
      </div>
      <div class="dispatch-v31-slot">
        <div class="dispatch-v31-slot-title">Capacidade/dia</div>
        <div class="dispatch-v31-slot-value">${summary.totalDaily}</div>
      </div>
      <div class="dispatch-v31-slot">
        <div class="dispatch-v31-slot-title">Restante hoje</div>
        <div class="dispatch-v31-slot-value">${summary.remaining}</div>
      </div>
      <div class="dispatch-v31-slot">
        <div class="dispatch-v31-slot-title">Bloco atual</div>
        <div class="dispatch-v31-slot-value">${summary.currentBlock}</div>
      </div>
    </div>
    <div class="dispatch-v31-warning">
      Regra ativa: 120 mensagens por chip · 4 blocos de 30 · 120 segundos entre envios · espera 1h entre blocos.
    </div>
  `;
}


/* ════════════════════════════
   DISPARO TEMPORIZADO V32
════════════════════════════ */
let dispatchTimerV32 = null;
let dispatchRunningV32 = false;

function getDispatchRuntimeV32() {
  try {
    const runtime = JSON.parse(localStorage.getItem('vs_dispatch_runtime_v32') || '{}');
    return runtime && typeof runtime === 'object' && !Array.isArray(runtime) ? runtime : {};
  } catch {
    return {};
  }
}

function saveDispatchRuntimeV32(data = {}) {
  const prev = getDispatchRuntimeV32();
  localStorage.setItem('vs_dispatch_runtime_v32', JSON.stringify({
    ...prev,
    ...data,
    updatedAt: new Date().toISOString()
  }));
}

function getNextReadyDispatchItemV32() {
  const ready = getReadyDispatchItemsV30 ? getReadyDispatchItemsV30() : [];

  for (const item of ready) {
    const chip = (getWhatsappChipsV29 ? getWhatsappChipsV29() : []).find(c => c.id === item.chipId);
    if (!chip) continue;

    const rule = canSendByChipRulesV31 ? canSendByChipRulesV31(chip) : { ok:true };
    if (rule.ok) return { item, chip };
  }

  return null;
}

function getDispatchIntervalMsV32(chip) {
  const seconds = Number(chip?.intervalSeconds || 120);
  return Math.max(10, seconds) * 1000;
}

function stopDispatchV32(reason = 'Disparo parado') {
  dispatchRunningV32 = false;
  clearTimeout(dispatchTimerV32);
  dispatchTimerV32 = null;
  saveDispatchRuntimeV32({ running:false, reason });
  addDispatchLogV30(reason);
  if (typeof renderDispatchV30Panel === 'function') renderDispatchV30Panel();
  notify(reason);
}

async function dispatchOneItemV32(item, chip) {
  const settings = getEvolutionSettings ? getEvolutionSettings() : {};
  const chipConfigV405 = getEvolutionConfigForChipV405 ? getEvolutionConfigForChipV405(chip) : settings;
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const queueItem = queue.find(q => q.id === item.id);

  if (!queueItem) return { ok:false, reason:'item não encontrado' };

  const phone = normalizePhoneForEvolution(queueItem.telefone || '');
  const text = queueItem.templateText || '';

  if (!chipConfigV405.url || !chipConfigV405.apiKey || !chipConfigV405.instance) {
    queueItem.status = 'Erro';
    queueItem.error = 'Evolution incompleta no chip';
    saveWhatsappQueueV27(queue);
    return { ok:false, reason:'Evolution incompleta' };
  }

  if (!phone || !text) {
    queueItem.status = 'Erro';
    queueItem.error = 'Telefone ou template ausente';
    saveWhatsappQueueV27(queue);
    return { ok:false, reason:'Telefone/template ausente' };
  }

  try {
    queueItem.status = 'Enviando';
    saveWhatsappQueueV27(queue);
    if (typeof renderWhatsappQueuePanel === 'function') renderWhatsappQueuePanel();

    const endpoint = `${chipConfigV405.url}/message/sendText/${encodeURIComponent(chipConfigV405.instance)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: (typeof getEvolutionHeadersV405 === 'function' ? getEvolutionHeadersV405(chipConfigV405) : getEvolutionHeaders(chipConfigV405)),
      body: JSON.stringify(buildEvolutionTextPayloadV4013(phone, text))
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      queueItem.status = 'Erro';
      queueItem.error = data?.message || data?.error || `HTTP ${res.status}`;
      queueItem.updatedAt = new Date().toISOString();
      saveWhatsappQueueV27(queue);

      if (queueItem.leadId) {
        addLeadHistory(queueItem.leadId, `Disparo WhatsApp com erro: ${queueItem.error}`, findLeadEverywhere(queueItem.leadId) || {});
      }

      return { ok:false, reason:queueItem.error };
    }

    queueItem.status = 'Enviado';
    queueItem.sentAt = new Date().toISOString();
    queueItem.sentAtLabel = crmNowLabel();
    queueItem.sentBlock = registerChipSendV31 ? registerChipSendV31(chip) : '';
    queueItem.response = data;
    saveWhatsappQueueV27(queue);

    if (queueItem.leadId) {
      addLeadHistory(queueItem.leadId, `Mensagem enviada em massa via ${chip.name} · Template: ${queueItem.templateName}`, findLeadEverywhere(queueItem.leadId) || {});
    }

    return { ok:true, reason:'enviado' };
  } catch (err) {
    queueItem.status = 'Erro';
    queueItem.error = err?.message || 'falha desconhecida';
    queueItem.updatedAt = new Date().toISOString();
    saveWhatsappQueueV27(queue);

    if (queueItem.leadId) {
      addLeadHistory(queueItem.leadId, `Disparo WhatsApp falhou: ${queueItem.error}`, findLeadEverywhere(queueItem.leadId) || {});
    }

    return { ok:false, reason:queueItem.error };
  }
}

async function dispatchLoopV32() {
  if (!dispatchRunningV32) return;

  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };
  if (control.paused) {
    stopDispatchV32('Disparo pausado: fila pausada');
    return;
  }

  const next = getNextReadyDispatchItemV32();

  if (!next) {
    stopDispatchV32('Disparo finalizado: nenhum item disponível');
    return;
  }

  const { item, chip } = next;
  addDispatchLogV30(`Enviando: ${item.nome} · ${chip.name}`);

  const result = await dispatchOneItemV32(item, chip);

  if (result.ok) {
    addDispatchLogV30(`Enviado: ${item.nome} · próximo em ${chip.intervalSeconds || 120}s`);
  } else {
    addDispatchLogV30(`Erro: ${item.nome} · ${result.reason}`);
  }

  if (typeof renderWhatsappQueuePanel === 'function') renderWhatsappQueuePanel();
  if (typeof renderChipsPanel === 'function') renderChipsPanel();
  if (typeof renderDispatchV30Panel === 'function') renderDispatchV30Panel();

  if (!dispatchRunningV32) return;

  const interval = getDispatchIntervalMsV32(chip);
  saveDispatchRuntimeV32({
    running:true,
    lastSentAt:new Date().toISOString(),
    nextRunAt:new Date(Date.now() + interval).toISOString()
  });

  dispatchTimerV32 = setTimeout(dispatchLoopV32, interval);
}

function startDispatchV32() {
  if (dispatchRunningV32) {
    notify('Disparo já está em execução.', 'warn');
    return;
  }

  const control = getWhatsappQueueControl ? getWhatsappQueueControl() : { paused:false };
  if (control.paused) {
    notify('Retome a fila antes de iniciar.', 'warn');
    return;
  }

  const ready = getReadyDispatchItemsV30 ? getReadyDispatchItemsV30() : [];
  if (!ready.length) {
    notify('Nenhum lead pronto para disparo.', 'warn');
    return;
  }

  dispatchRunningV32 = true;
  saveDispatchRuntimeV32({ running:true, startedAt:new Date().toISOString(), reason:'' });
  addDispatchLogV30(`Disparo temporizado iniciado: ${ready.length} item(s).`);
  renderDispatchV30Panel();
  dispatchLoopV32();
}

function renderDispatchRuntimeV32() {
  const runtime = getDispatchRuntimeV32();
  const interruptedByReload = !dispatchRunningV32 && runtime.running;
  const cls = dispatchRunningV32 ? 'running' : '';
  const state = dispatchRunningV32
    ? 'em execução'
    : interruptedByReload
      ? 'interrompido ao recarregar'
      : 'parado';
  const next = dispatchRunningV32 && runtime.nextRunAt
    ? new Date(runtime.nextRunAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '--';

  return `
    <div class="dispatch-v32-runtime ${cls}">
      Estado: ${state}<br>
      Próximo envio: ${next}<br>
      Regra: 120s entre envios · 30 por bloco · 4 blocos · 120 por chip/dia
    </div>
  `;
}


/* ════════════════════════════
   WEBHOOK RESPOSTAS V34
════════════════════════════ */
const EVOLUTION_RESPONSES_V34_KEY = 'vs_evolution_responses_v34';

function getLocalResponsesV34() {
  try {
    const data = JSON.parse(localStorage.getItem(EVOLUTION_RESPONSES_V34_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLocalResponsesV34(list) {
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(EVOLUTION_RESPONSES_V34_KEY, JSON.stringify((list || []).slice(0, 500)));
  updateResponsesBadgeV34();
}

function getWebhookUrlV34() {
  return `${window.location.origin}/api/webhook/evolution`;
}

function renderWebhookUrlV34() {
  const box = document.getElementById('webhookUrlV34');
  if (box) box.textContent = getWebhookUrlV34();
}

function copyWebhookUrlV34() {
  navigator.clipboard?.writeText(getWebhookUrlV34());
  notify('URL do webhook copiada.');
}

function normalizePhoneV34(value = '') {
  return String(value || '').replace(/\D/g,'');
}

function findLeadByPhoneV34(phone) {
  const target = normalizePhoneV34(phone);
  if (!target) return null;

  const data = ensureWeekData ? ensureWeekData() : { days:{} };
  const leads = flattenWeekData ? flattenWeekData(data) : [];

  for (const lead of leads) {
    const current = normalizePhoneV34(lead.whatsapp || lead.phone || lead.telefone || '');
    if (!current) continue;
    if (current.endsWith(target.slice(-8)) || target.endsWith(current.slice(-8))) return lead;
  }

  return null;
}

async function fetchEvolutionResponsesV34() {
  try {
    const res = await fetch('/api/webhook/evolution?limit=100');
    const data = await res.json();

    if (!res.ok || !data.success) {
      notify('Não foi possível buscar respostas.', 'err');
      return;
    }

    const local = getLocalResponsesV34();
    const map = new Map(local.map(item => [item.id, item]));

    (data.events || []).forEach(item => {
      map.set(item.id, item);
    });

    saveLocalResponsesV34(Array.from(map.values()).sort((a,b) => String(b.receivedAt).localeCompare(String(a.receivedAt))));
    renderResponsesV34();
    notify('Respostas atualizadas.');
  } catch (err) {
    notify('Erro ao buscar respostas do webhook.', 'err');
  }
}

function applyResponseToLeadV34(responseId) {
  const responses = getLocalResponsesV34();
  const response = responses.find(item => item.id === responseId);
  if (!response) return;

  const lead = findLeadByPhoneV34(response.phone);
  if (!lead) {
    notify('Lead não encontrado pelo telefone.', 'warn');
    return;
  }

  const leadId = lead.id;
  const crm = ensureLeadCrm(leadId, lead);

  crm.messages = Array.isArray(crm.messages) ? crm.messages : [];
  crm.messages.push({
    id: response.id,
    direction: 'in',
    text: response.text || '',
    phone: response.phone || '',
    at: response.receivedAt || new Date().toISOString(),
    atLabel: response.receivedAt ? new Date(response.receivedAt).toLocaleString('pt-BR') : crmNowLabel()
  });

  crm.pipelineStatus = crm.pipelineStatus === 'contato_enviado' ? 'respondeu' : crm.pipelineStatus;
  crm.lastResponseAt = response.receivedAt || new Date().toISOString();

  saveLeadCrm(leadId, crm);
  addLeadHistory(leadId, `Lead respondeu no WhatsApp: ${(response.text || '').slice(0, 120)}`, lead);

  response.applied = true;
  response.leadId = leadId;
  saveLocalResponsesV34(responses);

  renderResponsesV34();
  if (typeof renderKanban === 'function') renderKanban();
  notify('Resposta vinculada ao lead.');
}

function renderResponsesV34() {
  renderWebhookUrlV34();

  const list = document.getElementById('responsesListV34');
  if (!list) return;

  const responses = getLocalResponsesV34();

  if (!responses.length) {
    list.innerHTML = '<div class="response-v34-empty">// nenhuma resposta recebida ainda</div>';
    updateResponsesBadgeV34();
    return;
  }

  list.innerHTML = responses.map(item => {
    const date = item.receivedAt ? new Date(item.receivedAt).toLocaleString('pt-BR') : '';
    const lead = findLeadByPhoneV34(item.phone);
    return `
      <div class="response-v34-item">
        <div class="response-v34-top">
          <div>
            <div class="response-v34-phone">${escHtml(item.phone || 'sem telefone')}</div>
            <div class="response-v34-date">${escHtml(date)}</div>
          </div>
          <span class="queue-v27-status ${item.applied ? 'enviado' : 'pendente'}">${item.applied ? 'vinculada' : 'nova'}</span>
        </div>
        <div class="response-v34-text">${escHtml(item.text || '[mensagem sem texto]')}</div>
        <div class="response-v34-actions">
          ${lead ? `<button class="btn btn-primary" style="font-size:10px;padding:7px 12px" onclick="applyResponseToLeadV34('${escHtml(item.id)}')">${item.applied ? 'Atualizar lead' : 'Vincular ao lead'}</button>` : '<span class="queue-v27-status erro">lead não encontrado</span>'}
          ${lead ? `<button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="openLeadDrawer('${escHtml(lead.id)}')">Abrir ficha</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  updateResponsesBadgeV34();
}

function updateResponsesBadgeV34() {
  const badge = document.getElementById('badge-responses');
  if (!badge) return;
  const count = getLocalResponsesV34().filter(item => !item.applied).length;
  badge.textContent = count;
}

function renderResponsesPanelV34() {
  renderResponsesV34();
}


/* ════════════════════════════
   AUDITORIA V35
════════════════════════════ */
function getAuditQueueItemsV35() {
  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  return queue.map(item => ({
    id: item.id,
    leadId: item.leadId,
    nome: item.nome || 'Lead',
    telefone: item.telefone || '',
    campaign: item.campaign || '',
    templateName: item.templateName || '',
    chipName: item.chipName || '',
    status: item.status || 'Pendente',
    error: item.error || '',
    createdAt: item.createdAtLabel || item.createdAt || '',
    sentAt: item.sentAtLabel || item.sentAt || '',
    block: item.sentBlock || ''
  }));
}

function getAuditStatsV35() {
  const items = getAuditQueueItemsV35();
  return {
    total: items.length,
    enviados: items.filter(i => i.status === 'Enviado').length,
    erros: items.filter(i => i.status === 'Erro').length,
    prontos: items.filter(i => i.status === 'Pronto').length
  };
}

function renderAuditCardsV35() {
  const box = document.getElementById('auditCardsV35');
  if (!box) return;

  const s = getAuditStatsV35();

  box.innerHTML = `
    <div class="audit-v35-card"><div class="audit-v35-label">Total na fila</div><div class="audit-v35-value">${s.total}</div></div>
    <div class="audit-v35-card"><div class="audit-v35-label">Enviados</div><div class="audit-v35-value">${s.enviados}</div></div>
    <div class="audit-v35-card"><div class="audit-v35-label">Erros</div><div class="audit-v35-value">${s.erros}</div></div>
    <div class="audit-v35-card"><div class="audit-v35-label">Prontos</div><div class="audit-v35-value">${s.prontos}</div></div>
  `;
}

function renderAuditListV35() {
  const box = document.getElementById('auditListV35');
  if (!box) return;

  const filter = document.getElementById('auditFilterV35')?.value || 'todos';
  let items = getAuditQueueItemsV35();

  if (filter !== 'todos') {
    items = items.filter(item => item.status === filter);
  }

  if (!items.length) {
    box.innerHTML = '<div class="audit-v35-empty">// nenhum registro encontrado</div>';
    return;
  }

  box.innerHTML = items.map(item => {
    const cls = normalizeStr(item.status || '').replace(/[^a-z0-9]+/g,'');
    return `
      <div class="audit-v35-row">
        <div>
          <div class="audit-v35-title">${escHtml(item.nome)}</div>
          <div class="audit-v35-meta">${escHtml(item.telefone)} · ${escHtml(item.createdAt || '')}</div>
        </div>
        <div class="audit-v35-meta">Campanha<br>${escHtml(item.campaign || '-')}</div>
        <div class="audit-v35-meta">Template<br>${escHtml(item.templateName || '-')}</div>
        <div class="audit-v35-meta">Chip<br>${escHtml(item.chipName || '-')}</div>
        <div>
          <span class="audit-v35-status ${cls}">${escHtml(item.status)}</span>
          ${item.error ? `<div class="audit-v35-meta">${escHtml(item.error)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAuditV35() {
  renderAuditCardsV35();
  renderAuditListV35();
}

function exportAuditCsvV35() {
  const items = getAuditQueueItemsV35();
  const header = ['Nome','Telefone','Campanha','Template','Chip','Status','Erro','Criado','Enviado','Bloco'];
  const rows = items.map(i => [
    i.nome, i.telefone, i.campaign, i.templateName, i.chipName, i.status, i.error, i.createdAt, i.sentAt, i.block
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell || '').replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria-disparos-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function updateAuditBadgeV35() {
  const badge = document.getElementById('badge-audit');
  if (!badge) return;
  const s = getAuditStatsV35();
  badge.textContent = s.erros ? `${s.erros}!` : 'LOG';
}


