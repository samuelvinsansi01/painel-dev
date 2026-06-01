/* ════════════════════════════
   FILA INSTAGRAM — RENDER
════════════════════════════ */
function renderFilaInsta() {
  const fila = getInstaFila();
  const tabs = ['pendente','enviado'];
  const counts = { pendente: fila.filter(f=>f.status==='pendente').length, enviado: fila.filter(f=>f.status==='enviado').length };

  document.getElementById('instaStatusTabs').innerHTML = tabs.map(t =>
    `<div class="status-tab${instaStatus===t?' active':''}" onclick="setInstaStatus('${t}')">
      ${t==='pendente'?'Pendentes':'Enviados'} <span class="st-count">${counts[t]}</span>
    </div>`
  ).join('');

  const filtered = fila.filter(f => f.status === instaStatus);
  const listEl = document.getElementById('instaFilaList');

  if (!filtered.length) {
    listEl.innerHTML = `<div class="fila-empty">Nenhuma empresa ${instaStatus==='pendente'?'pendente':'enviada'}.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const apresentacao = getTemplates()[0].replace(/\{EMPRESA\}/g, item.nome);
    return `<div class="insta-card" id="insta-card-${item.id}">
      <div class="insta-card-header">
        <div class="insta-nome">
          ${item.googleUrl?`<a href="${escHtml(item.googleUrl)}" target="_blank" style="color:var(--text);text-decoration:none">${escHtml(item.nome)}</a>`:escHtml(item.nome)}
        </div>
        ${item.instagram?`<a href="${escHtml(item.instagram)}" target="_blank" class="q-badge insta" style="text-decoration:none">📸 ver perfil</a>`:''}
      </div>
      <div style="margin-bottom:10px">
        <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:4px">LINK INSTAGRAM</div>
        <div style="display:flex;gap:6px">
          <input class="insta-link-input" id="insta-ig-${item.id}" type="url" placeholder="https://instagram.com/empresa" value="${escHtml(item.instagram||'')}"/>
          <button class="copy-small" onclick="salvarInstaLink('${item.id}')">salvar</button>
        </div>
      </div>
      <div class="insta-msg-blocks">
        <div class="insta-msg-block">
          <div class="insta-msg-block-label">① APRESENTAÇÃO</div>
          <div class="insta-msg-text">${escHtml(apresentacao)}</div>
          <div style="margin-top:6px;display:flex;gap:5px">
            <button class="copy-small" onclick="copiarTexto(${JSON.stringify(apresentacao)})">copiar</button>
          </div>
        </div>
        <div class="insta-msg-block">
          <div class="insta-msg-block-label">② LINK DO SITE</div>
          <div class="insta-msg-text">${escHtml(LINK_BICHOP)}</div>
          <div style="margin-top:6px"><button class="copy-small" onclick="copiarTexto('${LINK_BICHOP}')">copiar</button></div>
        </div>
        <div class="insta-msg-block">
          <div class="insta-msg-block-label">③ IMAGEM PERSONALIZADA</div>
          <div class="fila-img-area${item.imagemBase64?' has-img':''}" onclick="document.getElementById('insta-img-${item.id}').click()" style="min-height:50px">
            ${item.imagemBase64?`<img src="${item.imagemBase64}" alt="preview"/>`:''}
            <span class="fila-img-label">${item.imagemBase64?'':'📎 anexar imagem'}</span>
          </div>
          <input type="file" accept="image/*" class="fila-img-input" id="insta-img-${item.id}" onchange="onInstaImgChange('${item.id}',this)"/>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        ${item.status==='pendente'
          ?`<button class="btn btn-insta" style="font-size:10px;padding:7px 14px" onclick="marcarInstaEnviado('${item.id}')">✓ Marcar enviado</button>`
          :`<span class="q-badge ok">✓ enviado</span>`
        }
        <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px;margin-right:4px" onclick="instaFilaVoltarAtribuicao('${item.id}')" title="Devolver para Atribuição">↩ Atribuição</button>
        <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removerDaFilaInsta('${item.id}')">Remover</button>
      </div>
    </div>`;
  }).join('');
}


function instaFilaVoltarAtribuicao(id) {
  const fila = getInstaFila();
  const item = fila.find(f => f.id === id);
  if (!item) return;
  const atrib = getAtribuicaoData();
  if (!atrib.find(a => a.id === id)) {
    atrib.push({
      id: item.id, nome: item.nome, whatsapp: item.whatsapp || '',
      instagram: item.instagram || '', googleUrl: item.googleUrl || '',
      canal: 'insta', site: '',
      status: 'Não enviada', criadoEm: item.criadoEm || todayStr(),
      validadoEm: todayStr(), diaDestino: null,
    });
    saveAtribuicaoData(atrib);
  }
  saveInstaFila(fila.filter(f => f.id !== id));
  renderFilaInsta(); updateBadges();
  notify(`↩ ${item.nome} → Atribuição`);
}
function setInstaStatus(s) { instaStatus = s; renderFilaInsta(); }

function salvarInstaLink(id) {
  const input = document.getElementById(`insta-ig-${id}`);
  if (!input) return;
  const fila = getInstaFila();
  const item = fila.find(f => f.id === id);
  if (!item) return;
  item.instagram = input.value.trim();
  saveInstaFila(fila); notify('✓ Link salvo');
}

function onInstaImgChange(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const fila = getInstaFila();
    const item = fila.find(f => f.id === id);
    if (!item) return;
    item.imagemBase64 = e.target.result;
    saveInstaFila(fila); renderFilaInsta();
  };
  reader.readAsDataURL(file);
}

function marcarInstaEnviado(id) {
  const fila = getInstaFila();
  const item = fila.find(f => f.id === id);
  if (!item) return;
  item.status = 'enviado'; item.enviadoEm = todayStr();
  saveInstaFila(fila); renderFilaInsta(); updateBadges();
  notify('✓ Marcado como enviado');
}

function removerDaFilaInsta(id) {
  saveInstaFila(getInstaFila().filter(f => f.id !== id));
  renderFilaInsta(); updateBadges();
}

function limparFilaInsta() {
  if (!confirm('Remover todos os enviados?')) return;
  saveInstaFila(getInstaFila().filter(f => f.status !== 'enviado'));
  renderFilaInsta(); updateBadges(); notify('✓ Enviados removidos');
}

function copiarTexto(text) {
  navigator.clipboard.writeText(text).then(() => notify('✓ Copiado'));
}

/* ════════════════════════════
   REDIRECIONAMENTOS
════════════════════════════ */
const API_BASE = '';

async function criarRedirecionamento() {
  const nome   = document.getElementById('rdNomeEmpresa').value.trim();
  const desk   = document.getElementById('rdDeskUrl').value.trim();
  const mob    = document.getElementById('rdMobUrl').value.trim();
  if (!nome || !desk || !mob) { notify('// preencha todos os campos','err'); return; }

  const spinner = document.getElementById('rdSpinner');
  spinner.style.display = 'block';
  try {
    const res = await fetch(`${API_BASE}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: nome, deskUrl: desk, mobUrl: mob })
    });
    const data = await res.json();
    if (!res.ok) { notify(data.error || '// erro ao criar link','err'); return; }
    const result = document.getElementById('rdResultado');
    const link   = document.getElementById('rdLinkGerado');
    result.style.display = 'block';
    link.href = data.shortUrl; link.textContent = data.shortUrl;
    notify('✓ Link criado!');
  } catch(e) {
    notify('// erro de conexão','err');
  } finally {
    spinner.style.display = 'none';
  }
}

function copiarLinkRd() {
  const link = document.getElementById('rdLinkGerado').textContent;
  navigator.clipboard.writeText(link).then(() => notify('✓ Link copiado'));
}

async function atualizarRedirecionamento() {
  const alias = document.getElementById('rdAliasUpdate').value.trim();
  const desk  = document.getElementById('rdDeskUrlUpdate').value.trim();
  const mob   = document.getElementById('rdMobUrlUpdate').value.trim();
  if (!alias) { notify('// informe o alias','err'); return; }
  if (!desk && !mob) { notify('// informe ao menos um link','err'); return; }
  try {
    const res = await fetch(`${API_BASE}/api/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias, deskUrl: desk||undefined, mobUrl: mob||undefined })
    });
    const data = await res.json();
    if (!res.ok) { notify(data.error || '// erro','err'); return; }
    notify('✓ Link atualizado!');
  } catch(e) { notify('// erro de conexão','err'); }
}

/* ════════════════════════════
   CONFIGURAÇÕES
════════════════════════════ */
function renderConfiguracoes() {
  renderChipsConfig();
  renderRamosConfig();
  renderTemplatesConfig();
  renderInstaTemplatesConfig();
}

/* CHIPS */
function abrirModalNovoChip() {
  document.getElementById('chipNome').value = '';
  document.getElementById('chipUrl').value = '';
  document.getElementById('chipLegacyInstance').value = '';
  document.getElementById('chipKey').value = '';
  document.getElementById('chipModal').classList.add('open');
}
function fecharChipModal() { document.getElementById('chipModal').classList.remove('open'); }

function salvarChip() {
  const nome     = document.getElementById('chipNome').value.trim();
  const url      = document.getElementById('chipUrl').value.trim();
  const instance = document.getElementById('chipLegacyInstance').value.trim();
  const key      = document.getElementById('chipKey').value.trim();
  if (!nome || !url || !instance || !key) { notify('// preencha todos os campos','err'); return; }
  const chips = getChips();
  chips.push({ id: genId(), nome, url, instance, key, status: 'desconectado' });
  saveChips(chips);
  fecharChipModal(); renderConfiguracoes(); updateBadges();
  notify('✓ Chip salvo');
}

function renderChipsConfig() {
  const chips = getChips();
  const grid  = document.getElementById('chipGrid');
  if (!chips.length) {
    grid.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--muted)">Nenhum chip configurado. Adicione os chips usados na operação.</div>';
    return;
  }
  grid.innerHTML = chips.map(c => `<div class="chip-card">
    <div class="chip-card-header">
      <div class="chip-dot ${c.status==='conectado'?'on':'off'}"></div>
      <div style="flex:1;min-width:0">
        <div class="chip-name" id="chipNameDisplay_${c.id}">${escHtml(c.nome)}</div>
        <div class="chip-instance">${escHtml(c.instance)}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-ghost" style="font-size:10px;padding:6px 12px" onclick="verQRChip('${c.id}')">📱 QR Code</button>
      <button class="btn btn-ghost" style="font-size:10px;padding:6px 12px" onclick="iniciarRenomeioChip('${c.id}')">✏ Renomear</button>
      <button class="btn btn-danger chip-del" style="font-size:10px;padding:6px 12px" onclick="deletarChip('${c.id}')">✕ Remover</button>
    </div>
    <div id="renamePanel_${c.id}" style="display:none;margin-top:10px;display:none">
      <div style="display:flex;gap:6px;align-items:center">
        <input type="text" id="renameInput_${c.id}" value="${escHtml(c.nome)}" placeholder="Novo nome..." style="flex:1;font-size:11px;padding:7px 10px"/>
        <button class="btn btn-primary" style="font-size:10px;padding:6px 12px;white-space:nowrap" onclick="confirmarRenomeioCip('${c.id}')">✓ Salvar</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:6px 10px" onclick="cancelarRenomeioChip('${c.id}')">✕</button>
      </div>
    </div>
  </div>`).join('');
}

async function verQRChip(id) {
  qrChipIdAtivo = id;
  const chip = getChipById(id);
  if (!chip) return;
  document.getElementById('qrChipNome').textContent = chip.nome;
  document.getElementById('qrModal').classList.add('open');
  await carregarQR(chip);
}

async function carregarQR(chip) {
  document.getElementById('qrWrap').innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--muted)">Gerando QR Code...</div>';
  try {
    const res = await fetch(`${chip.url}/instance/connect/${chip.instance}`, { headers: { 'apikey': chip.key } });
    const data = await res.json();
    const qr = data.qrcode?.base64 || data.base64 || data.qr || '';
    if (qr) {
      document.getElementById('qrWrap').innerHTML = `<img src="${qr.startsWith('data:')?qr:'data:image/png;base64,'+qr}" alt="QR Code"/>`;
    } else {
      document.getElementById('qrWrap').innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--ok)">✓ Instância já conectada</div>';
    }
  } catch(e) {
    document.getElementById('qrWrap').innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--error)">✗ Erro ao gerar QR Code</div>';
  }
}

async function atualizarQR() {
  if (!qrChipIdAtivo) return;
  const chip = getChipById(qrChipIdAtivo);
  if (chip) await carregarQR(chip);
}

function deletarChip(id) {
  if (!confirm('Remover este chip?')) return;
  saveChips(getChips().filter(c => c.id !== id));
  if (disparoChipId === id) disparoChipId = null;
  if (activeChipId === id) activeChipId = null;
  renderConfiguracoes(); updateBadges(); notify('✓ Chip removido');
}

function iniciarRenomeioChip(id) {
  const panel = document.getElementById('renamePanel_' + id);
  if (!panel) return;
  panel.style.display = 'block';
  const inp = document.getElementById('renameInput_' + id);
  if (inp) { inp.focus(); inp.select(); }
}
function cancelarRenomeioChip(id) {
  const panel = document.getElementById('renamePanel_' + id);
  if (panel) panel.style.display = 'none';
}
function confirmarRenomeioCip(id) {
  const inp = document.getElementById('renameInput_' + id);
  if (!inp) return;
  const novoNome = inp.value.trim();
  if (!novoNome) { notify('// informe um nome','err'); return; }
  const chips = getChips();
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  chip.nome = novoNome;
  saveChips(chips);
  renderConfiguracoes(); updateBadges();
  notify('✓ Chip renomeado');
}

/* RAMOS */
function renderRamosConfig() {
  const ramos = getRamos();
  document.getElementById('ramosConfigList').innerHTML = ramos.map(r => `<div style="background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:12px;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-weight:700;font-size:13px;flex:1">${escHtml(r.nome)}</span>
      <button class="del-btn" onclick="deletarRamo('${r.id}')">✕</button>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      ${r.keywords.map(k=>`<span style="background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:'DM Mono',monospace;font-size:8px;padding:2px 7px;border-radius:100px">${escHtml(k)}</span>`).join('')}
    </div>
  </div>`).join('');
}

function adicionarRamo() {
  const input = document.getElementById('novoRamoInput');
  const nome = input.value.trim();
  if (!nome) return;
  const ramos = getRamos();
  ramos.push({ id: genId(), nome, keywords: [normalizeStr(nome)] });
  saveRamos(ramos); renderRamosConfig(); renderRamoSelect();
  input.value = ''; notify('✓ Ramo adicionado');
}

function deletarRamo(id) {
  if (!confirm('Remover ramo?')) return;
  saveRamos(getRamos().filter(r => r.id !== id));
  renderRamosConfig(); renderRamoSelect();
  if (activeRamoId === id) { activeRamoId = null; onRamoChange(); }
  notify('✓ Ramo removido');
}

/* TEMPLATES */
function renderTemplatesConfig() {
  const ramos = getRamos();
  const el = document.getElementById('templatesList');

  // Seletor de ramo apenas (sem abas de tipo)
  const ramoSel = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
    <select id="tplRamoSel" onchange="onTplRamoChange()" style="flex:1;min-width:140px;font-size:11px;padding:8px 12px">
      <option value="">— Selecione um ramo —</option>
      ${ramos.map(r => `<option value="${r.id}"${tplRamoId===r.id?' selected':''}>${escHtml(r.nome)}</option>`).join('')}
    </select>
  </div>`;

  let tpls, isRamo;
  if (tplRamoId) {
    tpls = getTemplatesForRamoTipo(tplRamoId, 'com-site');
    isRamo = true;
  } else {
    // Sem ramo selecionado — não exibe nada
    el.innerHTML = ramoSel + `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);padding:16px 0">// Selecione um ramo para ver e editar os templates.</div>`;
    return;
  }

  const maxTpl = 10;
  const limitLabel = tplRamoId
    ? `<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">${tpls.length}/${maxTpl} templates</span>`
    : '';

  const tplsHtml = tpls.map((t, i) => `<div style="background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:12px;margin-bottom:8px;position:relative">
    <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:8px">TEMPLATE ${i+1}</div>
    <textarea style="min-height:80px;font-size:10px;line-height:1.6" oninput="${isRamo?`saveRamoTemplate('${tplRamoId}','com-site',${i},this.value)`:`saveTemplate(${i},this.value)`}">${escHtml(t)}</textarea>
    ${tpls.length>1?`<button class="del-btn" style="position:absolute;top:8px;right:8px" onclick="${isRamo?`removerRamoTemplate('${tplRamoId}','com-site',${i})`:`removerTemplate(${i})`}">✕</button>`:''}
  </div>`).join('');

  const addBtn = `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
    ${limitLabel}
    <button class="btn btn-ghost" onclick="${isRamo?`adicionarRamoTemplate('${tplRamoId}','com-site')`:`adicionarTemplate()`}" ${tpls.length>=maxTpl?'disabled':''}>+ Novo template</button>
  </div>`;

  el.innerHTML = ramoSel + tplsHtml + addBtn;
}

function onTplRamoChange() {
  tplRamoId = document.getElementById('tplRamoSel').value || null;
  renderTemplatesConfig();
}
function setTplTipo(tipo) {
  tplTipo = tipo;
  renderTemplatesConfig();
}

function saveTemplate(idx, val) {
  const tpls = getTemplates(); tpls[idx] = val; saveTemplates(tpls);
}
function adicionarTemplate() {
  const tpls = getTemplates();
  tpls.push('Olá, me chamo Samuel. Tudo bem?\n\nVi o site da {EMPRESA}...\n\nFaz sentido conversarmos?');
  saveTemplates(tpls); renderTemplatesConfig(); notify('✓ Template adicionado');
}
function removerTemplate(idx) {
  const tpls = getTemplates(); tpls.splice(idx, 1); saveTemplates(tpls); renderTemplatesConfig();
}

/* ════════════════════════════
   INSTAGRAM — PAINEL PRINCIPAL
════════════════════════════ */

/* ── MODAL LEAD MANUAL INSTAGRAM ── */
function abrirModalInstaLead() {
  ['ilNome','ilWhatsapp','ilGoogleUrl','ilInstagram','ilCategoria'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('instaLeadModal').classList.add('open');
}
function salvarInstaLead() {
  const nome = (document.getElementById('ilNome').value||'').trim();
  if (!nome) { notify('// informe o nome da empresa','err'); return; }
  const whatsapp   = (document.getElementById('ilWhatsapp').value||'').trim();
  const googleUrl  = (document.getElementById('ilGoogleUrl').value||'').trim();
  const instagram  = (document.getElementById('ilInstagram').value||'').trim();
  const categoria  = (document.getElementById('ilCategoria').value||'').trim();
  const fila = getInstaFila();
  fila.push({ id: genId(), nome, whatsapp, googleUrl, instagram, categoria, criadoEm: todayStr() });
  saveInstaFila(fila);
  document.getElementById('instaLeadModal').classList.remove('open');
  renderInstagram(); renderAtribInstaFila(); updateBadges();
  notify('✓ Lead adicionado à fila Instagram');
}

function salvarInstaLeadInline() {
  const nome      = (document.getElementById('instaLeadNome')?.value||'').trim();
  const instagram = (document.getElementById('instaLeadLink')?.value||'').trim();
  if (!nome) { notify('// informe o nome da empresa','err'); return; }
  const fila = getInstaFila();
  fila.push({ id: genId(), nome: capitalizeName(nome), whatsapp: '', googleUrl: '', instagram, categoria: '', criadoEm: todayStr() });
  saveInstaFila(fila);
  // Limpar campos
  const nEl = document.getElementById('instaLeadNome'); if (nEl) nEl.value = '';
  const lEl = document.getElementById('instaLeadLink'); if (lEl) lEl.value = '';
  document.getElementById('instaLeadNome')?.focus();
  toggleAtribForm('insta'); // fecha o form
  renderInstagram(); renderAtribInstaFila(); updateBadges();
  notify(`✓ ${capitalizeName(nome)} → Fila Instagram`);
}

/* ════════════════════════════
   BASE DE ATRIBUIÇÃO — ABAS
════════════════════════════ */
let atribActiveTab = 'zap'; // 'zap' | 'insta'

function salvarZapLeadManual() {
  const nome     = (document.getElementById('zapLeadNome')?.value||'').trim();
  const whatsapp = (document.getElementById('zapLeadWpp')?.value||'').trim();
  if (!nome) { notify('// nome da empresa é obrigatório','err'); return; }

  const atrib = getAtribuicaoData();
  atrib.push({
    id: genId(),
    nome: capitalizeName(nome),
    site: '',
    whatsapp: whatsapp || '',
    instagram: '',
    googleUrl: '',
    canal: 'zap',
    status: 'Não enviada',
    criadoEm: todayStr(),
    diaDestino: null,
  });
  saveAtribuicaoData(atrib);
  // Limpar campos
  ['zapLeadNome','zapLeadWpp'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('zapLeadNome')?.focus();
  toggleAtribForm('zap'); // fecha o form
  renderAtribuicao(); updateBadges(); updateAtribTabCounts();
  notify(`✓ ${capitalizeName(nome)} → Base de Atribuição (ZAP)`);
}

function setAtribTab(tab) {
  atribActiveTab = tab;
  const tabZap   = document.getElementById('atribTabZap');
  const tabInsta = document.getElementById('atribTabInsta');
  const panelZap   = document.getElementById('atribPanelZap');
  const panelInsta = document.getElementById('atribPanelInsta');

  if (tab === 'zap') {
    tabZap.style.borderBottomColor   = 'var(--accent)';
    tabZap.style.color               = 'var(--accent)';
    tabInsta.style.borderBottomColor = 'transparent';
    tabInsta.style.color             = 'var(--muted)';
    panelZap.style.display   = 'flex';
    panelInsta.style.display = 'none';
    renderAtribuicao();
  } else {
    tabInsta.style.borderBottomColor = 'var(--insta)';
    tabInsta.style.color             = 'var(--insta)';
    tabZap.style.borderBottomColor   = 'transparent';
    tabZap.style.color               = 'var(--muted)';
    panelInsta.style.display = 'flex';
    panelZap.style.display   = 'none';
    renderAtribInstaFila();
    updateAtribInstaCorteInfo();
    setTimeout(() => document.getElementById('instaLeadNome')?.focus(), 60);
  }
  updateAtribTabCounts();
}

function updateAtribTabCounts() {
  const zapCount   = getAtribuicaoData().length;
  const instaCount = getInstaFila().length;
  const elZ = document.getElementById('atribTabZapCount');
  const elI = document.getElementById('atribTabInstaCount');
  if (elZ) elZ.textContent = zapCount ? `(${zapCount})` : '';
  if (elI) elI.textContent = instaCount ? `(${instaCount})` : '';
}

/* ── Info de corte horário ── */
function updateAtribInstaCorteInfo() {
  // aviso removido — sem exibição de info de horário
}

function toggleAtribForm(aba) {
  const formId = aba === 'zap' ? 'zapLeadForm' : 'instaLeadForm';
  const btnId  = aba === 'zap' ? 'btnToggleZapForm' : 'btnToggleInstaForm';
  const form   = document.getElementById(formId);
  const btn    = document.getElementById(btnId);
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? '+ Novo lead' : '✕ Fechar';
  if (!open) {
    // foca no primeiro input ao abrir
    const first = form.querySelector('input');
    if (first) setTimeout(() => first.focus(), 50);
  }
}

/* ── Qual dia o lead deve entrar (regra de corte 19h + limite 60/dia) ── */
function instaDeterminarDiaDestino() {
  const now   = new Date();
  const hora  = now.getHours();
  const week  = getInstaWeek();
  const days  = instaWeekDays();

  const todayKey = todayStr();
  const todayIdx = days.indexOf(todayKey);
  // Nunca começa antes de hoje — ignora dias passados da semana
  let startIdx = todayIdx >= 0 ? todayIdx : 0;
  if (hora >= INSTA_CUTOFF_HOUR) startIdx = Math.min(startIdx + 1, days.length - 1);

  for (let i = startIdx; i < days.length; i++) {
    const d = days[i];
    if ((week[d]||[]).length < INSTA_DIA_LIMIT) return d;
  }
  return days[days.length - 1]; // fallback: último dia da semana
}

/* ── RENDER DA FILA INSTAGRAM NA BASE DE ATRIBUIÇÃO ── */
let atribInstaPage = 0;
const ATRIB_INSTA_PG = 30;

function renderAtribInstaFila() {
  const listEl = document.getElementById('atribInstaList');
  if (!listEl) return;

  // Atribuição exibe apenas leads que ainda NÃO têm link do Instagram
  const filaAll = getInstaFila().filter(e => !e.instagram);
  const buscaEl = document.getElementById('atribInstaBusca');
  const buscaQ  = buscaEl ? normalizeStr(buscaEl.value) : '';
  const fila = buscaQ
    ? filaAll.filter(e => normalizeStr(e.nome||'').includes(buscaQ) || (e.whatsapp||'').includes(buscaQ))
    : filaAll;

  const totalEl = document.getElementById('atribInstaFilaTotalBadge');
  if (totalEl) totalEl.textContent = fila.length ? `· ${fila.length} empresa${fila.length>1?'s':''}` : '';

  // Tab counts
  updateAtribTabCounts();

  if (!fila.length) {
    listEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--muted);text-align:center;padding:32px">// nenhum lead aguardando atribuição</div>';
    document.getElementById('atribInstaPagination').innerHTML = '';
    return;
  }

  const totalPags = Math.max(1, Math.ceil(fila.length / ATRIB_INSTA_PG));
  if (atribInstaPage >= totalPags) atribInstaPage = totalPags - 1;
  const page = fila.slice(atribInstaPage * ATRIB_INSTA_PG, (atribInstaPage + 1) * ATRIB_INSTA_PG);

  listEl.innerHTML = page.map(e => {
    const stars   = e.totalScore   ? `⭐ ${Number(e.totalScore).toFixed(1)}` : '';
    const reviews = e.reviewsCount ? `(${e.reviewsCount} av.)` : '';
    const temInstaPreview = !!(e.instagram);
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)" id="atrib-insta-row-${e.id}">
      <!-- info empresa -->
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${e.googleUrl
            ? `<a href="${escHtml(e.googleUrl)}" target="_blank" style="color:var(--text);text-decoration:none" onmouseover="this.style.color='var(--insta)'" onmouseout="this.style.color='var(--text)'">${escHtml(e.nome||'—')}</a>`
            : escHtml(e.nome||'—')}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text2);display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
          ${stars?`<span style="color:var(--ok)">${stars} ${reviews}</span>`:''}
          ${e.categoria?`<span style="color:var(--muted)">${escHtml(e.categoria)}</span>`:''}
        </div>
        <!-- Campo de link Instagram inline -->
        <div style="display:flex;gap:6px;margin-top:7px;align-items:center">
          <a href="https://www.google.com/search?q=site:instagram.com+${encodeURIComponent('"'+e.nome+'"')}" target="_blank"
            title="Buscar Instagram no Google"
            style="background:none;border:1px solid rgba(225,48,108,0.25);color:var(--insta);border-radius:6px;font-size:11px;padding:4px 8px;cursor:pointer;flex-shrink:0;text-decoration:none;line-height:1;display:flex;align-items:center;transition:all 0.18s"
            onmouseover="this.style.background='rgba(225,48,108,0.1)'" onmouseout="this.style.background='none'">🔍</a>
          <input id="atrib-insta-link-${e.id}" type="text"
            value="${escHtml(e.instagram||'')}"
            placeholder="Cole o link do Instagram..."
            style="flex:1;background:rgba(225,48,108,0.06);border:1px solid rgba(225,48,108,0.25);border-radius:6px;color:var(--text);font-family:'DM Mono',monospace;font-size:9px;padding:5px 9px;outline:none;transition:border-color 0.18s"
            onfocus="this.style.borderColor='var(--insta)'" onblur="this.style.borderColor='rgba(225,48,108,0.25)'"
            onpaste="setTimeout(()=>atribInstaConfirmarLink('${e.id}'),0)"
            onkeydown="if(event.key==='Enter') atribInstaConfirmarLink('${e.id}')"/>
          <button onclick="atribInstaExcluir('${e.id}')"
            style="background:none;border:1px solid transparent;color:var(--muted);border-radius:6px;font-size:10px;padding:4px 7px;cursor:pointer;transition:all 0.18s;flex-shrink:0"
            onmouseover="this.style.borderColor='var(--error)';this.style.color='var(--error)';this.style.background='rgba(255,92,92,0.06)'"
            onmouseout="this.style.borderColor='transparent';this.style.color='var(--muted)';this.style.background='none'">✕</button>
        </div>
      </div>
    </div>`; }).join('');

  // Paginação
  const pEl = document.getElementById('atribInstaPagination');
  if (pEl) {
    if (totalPags <= 1) { pEl.innerHTML = ''; }
    else {
      pEl.innerHTML = `<div style="display:flex;gap:8px;justify-content:center;padding:10px 0;flex-wrap:wrap">
        ${atribInstaPage>0?`<button class="btn btn-ghost" style="font-size:9px;padding:5px 12px" onclick="atribInstaChangePage(${atribInstaPage-1})">← Anterior</button>`:''}
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);align-self:center">${atribInstaPage+1} / ${totalPags}</span>
        ${atribInstaPage<totalPags-1?`<button class="btn btn-ghost" style="font-size:9px;padding:5px 12px" onclick="atribInstaChangePage(${atribInstaPage+1})">Próxima →</button>`:''}
      </div>`;
    }
  }
}

function atribInstaChangePage(p) { atribInstaPage = p; renderAtribInstaFila(); }

/* ── CONFIRMAR LINK → VAI PARA O BACKLOG ── */
function atribInstaConfirmarLink(id) {
  const input = document.getElementById(`atrib-insta-link-${id}`);
  if (!input) return;
  let url = input.value.trim();
  if (!url) { notify('// cole o link do Instagram antes de confirmar','warn'); return; }
  if (!url.startsWith('http')) url = 'https://instagram.com/' + url.replace('@','');

  const fila = getInstaFila();
  const emp  = fila.find(e => e.id === id);
  if (!emp) return;

  // Salva o link no item — ele permanece na INSTA_KEY, agora com instagram preenchido.
  // O backlog do painel Instagram exibe apenas os que têm e.instagram preenchido.
  emp.instagram = url;
  saveInstaFila(fila);

  updateAtribInstaCorteInfo();
  renderAtribInstaFila();
  if (document.getElementById('panel-instagram')?.classList.contains('active')) renderInstagram();
  updateBadges();
  notify(`✓ ${emp.nome} → Backlog Instagram`);
}

/* ── EXCLUIR DA FILA INSTAGRAM (BASE DE ATRIBUIÇÃO) ── */
function atribInstaExcluir(id) {
  const fila = getInstaFila();
  const emp  = fila.find(e => e.id === id);
  abrirModalConfirm(
    `Excluir <strong>${emp ? escHtml(emp.nome) : 'este lead'}</strong> da fila Instagram?`,
    () => {
      saveInstaFila(getInstaFila().filter(e => e.id !== id));
      renderAtribInstaFila(); updateBadges();
      notify(`✕ Lead removido`);
    }
  );
}



/* ════════════════════════════
   INSTAGRAM — STORAGE
════════════════════════════ */
// getInstaFila / saveInstaFila definidas acima — sem duplicata
function getInstaWeek()    { try { return JSON.parse(localStorage.getItem(INSTA_WEEK_KEY)||'{}'); } catch { return {}; } }
function saveInstaWeek(d)  { localStorage.setItem(INSTA_WEEK_KEY, JSON.stringify(d)); scheduleLegacyOperationalSyncV36(); }

/* ── MIGRAÇÃO: normaliza chaves antigas para dd/mm/aaaa ── */
function migrarChavesInstaWeek() {
  const raw = localStorage.getItem(INSTA_WEEK_KEY);
  if (!raw) return;
  let data; try { data = JSON.parse(raw); } catch { return; }

  let alterou = false;
  const novo = {};

  for (const key of Object.keys(data)) {
    // Formato antigo: aaaa/mm/dd  ou aaaa-mm-dd
    const matchISO = key.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (matchISO) {
      const novaChave = `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`; // → dd/mm/aaaa
      novo[novaChave] = [...(novo[novaChave]||[]), ...(data[key]||[])];
      alterou = true;
    } else {
      // Já está no formato certo ou desconhecido — mantém
      novo[key] = [...(novo[key]||[]), ...(data[key]||[])];
    }
  }

  if (alterou) {
    saveInstaWeek(novo);
    console.log('[insta] chaves migradas:', Object.keys(data), '→', Object.keys(novo));
    notify('✓ Leads do Instagram recuperados');
  }
}

/* ── Constantes e estado do painel Instagram (declaração única) ── */
const INSTA_DIA_LIMIT   = 60;
const INSTA_PAGE_SIZE   = 50;
const INSTA_CUTOFF_HOUR = 19;
const INSTA_STATUS      = ['Não contatado','DM Enviada','Respondeu','Não respondeu','Fechou','Recusou'];

let instaPage      = 0;
let instaBacklogPg = 0;
let instaActiveTab = 'backlog'; // 'backlog' | dd/mm/aaaa

function instaWeekDays()              { return currentWeekDays(); }
function instaCountForDay(week, day)  { return (week[day]||[]).length; }
function instaParseDay(day) {
  const [d, m, y] = day.split('/').map(Number);
  return new Date(y, m - 1, d);
}

/* ════════════════════════════
   INSTAGRAM TEMPLATES
════════════════════════════ */
const INSTA_TEMPLATES_KEY = 'vs_insta_templates_v1';
const INSTA_TEMPLATES_DEFAULT = [
`Olá, tudo bem?
Me chamo Samuel. Encontrei a {EMPRESA} e estive vendo o trabalho de vocês aqui no Instagram. Cada projeto postado aqui reforça o nível do que entregam, dá para ver o cuidado em cada detalhe.
Percebi que vocês ainda não têm um site. Para marcenarias com esse padrão de projeto, isso é uma oportunidade clara. O cliente que pesquisa no Google simplesmente não encontra vocês, e a decisão de orçar muitas vezes começa antes do primeiro contato.
Recentemente desenvolvi um projeto para uma marcenaria chamada Bicho Preguiça: bichopreguicaplanejados.com.br
A ideia é que qualquer pessoa que chegue pelo Google ou pelas redes sociais consiga visualizar de modo sofisticado e completo tudo que vocês já entregaram, criando uma jornada que reforce o valor do trabalho antes do orçamento.
Montei uma amostra do que poderia ser feito para vocês. Dá uma olhada e me fala se faz sentido, beleza?`,
`Olá, tudo bem?
Me chamo Samuel. Achei a {EMPRESA} e estive vendo o trabalho de vocês aqui no Instagram. Cada projeto apresentado e postado aqui reforça a qualidade do que entregam. Nota-se o cuidado e a qualidade em cada entrega.
O que percebi é que vocês ainda não têm um site. No nicho de marcenarias e planejados, o cliente forma a percepção de valor antes mesmo de entrar em contato. Quem não aparece no Google fica fora dessa decisão.
Deixo aqui um projeto que desenvolvi para uma marcenaria chamada Bicho Preguiça: bichopreguicaplanejados.com.br
Sem um espaço próprio no Google, cada cliente que pesquisa ativamente por móveis planejados na região passa direto para quem tem. Esse é o tipo de decisão que acontece antes de qualquer contato, e vocês ficam fora dela.
Montei uma amostra do que poderia ser feito para vocês. Dá uma olhada e me fala se faz sentido, beleza?`,
`Olá, tudo bem?
Me chamo Samuel. Encontrei a {EMPRESA} e estive vendo o trabalho de vocês aqui no Instagram. Os projetos que postam têm um padrão muito bom, cada detalhe bem pensado e bem apresentado.
Só que percebi que vocês ainda não têm presença no Google. Isso significa que o cliente que está pesquisando ativamente por móveis planejados na região não encontra vocês. Essa busca acontece exatamente no momento em que ele está pronto para orçar.
Aqui um projeto que desenvolvi recentemente para uma marcenaria chamada Bicho Preguiça: bichopreguicaplanejados.com.br
O objetivo é que qualquer pessoa que chegue até vocês consiga visualizar com clareza e sofisticação tudo que já entregaram, criando uma jornada que reforce o valor do projeto antes do primeiro contato.
Montei uma amostra do que poderia ser feito para vocês. Dá uma olhada e me fala se faz sentido, beleza?`
];

function getInstaTemplates() {
  try { return JSON.parse(localStorage.getItem(INSTA_TEMPLATES_KEY)||'null') || INSTA_TEMPLATES_DEFAULT; } catch { return INSTA_TEMPLATES_DEFAULT; }
}
function saveInstaTemplates(t) { localStorage.setItem(INSTA_TEMPLATES_KEY, JSON.stringify(t)); }

function sortearInstaTemplate(nome) {
  const tpls = getInstaTemplates();
  if (!tpls.length) return '';
  const t = tpls[Math.floor(Math.random() * tpls.length)];
  return t.replace(/\{EMPRESA\}/g, nome || '');
}

function copiarInstaMsg(nome) {
  const msg = sortearInstaTemplate(nome);
  if (!msg) { notify('// nenhum template Instagram cadastrado','warn'); return; }
  navigator.clipboard.writeText(msg).then(() => {
    notify('📋 Mensagem copiada');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = msg; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    notify('📋 Mensagem copiada');
  });
}

function renderInstaTemplatesConfig() {
  const el = document.getElementById('instaTemplatesList');
  if (!el) return;
  const tpls = getInstaTemplates();
  el.innerHTML = tpls.map((t, i) => `
    <div style="background:var(--bg);border:1px solid rgba(225,48,108,0.2);border-radius:10px;padding:12px;margin-bottom:8px;position:relative">
      <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--insta);margin-bottom:8px;opacity:0.7">TEMPLATE ${i+1}</div>
      <textarea style="min-height:100px;font-size:10px;line-height:1.6;border-color:rgba(225,48,108,0.2)"
        oninput="saveInstaTemplateItem(${i},this.value)"
        onfocus="this.style.borderColor='var(--insta)'" onblur="this.style.borderColor='rgba(225,48,108,0.2)'">${escHtml(t)}</textarea>
      ${tpls.length>1?`<button class="del-btn" style="position:absolute;top:8px;right:8px" onclick="removerInstaTemplate(${i})">✕</button>`:''}
    </div>`).join('');
}
function saveInstaTemplateItem(idx, val) {
  const tpls = getInstaTemplates(); tpls[idx] = val; saveInstaTemplates(tpls);
}
function adicionarInstaTemplate() {
  const tpls = getInstaTemplates();
  if (tpls.length >= 10) { notify('// limite de 10 templates','warn'); return; }
  tpls.push('Olá, tudo bem?\nMe chamo Samuel. Encontrei a {EMPRESA}...\n\nDá uma olhada e me fala se faz sentido, beleza?');
  saveInstaTemplates(tpls); renderInstaTemplatesConfig(); notify('✓ Template Instagram adicionado');
}
function removerInstaTemplate(idx) {
  const tpls = getInstaTemplates();
  if (tpls.length <= 1) { notify('// mantenha ao menos 1 template','warn'); return; }
  tpls.splice(idx, 1); saveInstaTemplates(tpls); renderInstaTemplatesConfig();
}

/* ════════════════════════════
   INSTAGRAM — RENDER PRINCIPAL
════════════════════════════ */

/* ── alocar automaticamente: preenche o dia mais próximo disponível ── */
function instaAlocarAuto(id) {
  const fila = getInstaFila();
  const emp  = fila.find(e => e.id === id);
  if (!emp) return;
  const week = getInstaWeek();
  const days = instaWeekDays();
  const hora = new Date().getHours();
  const hoje = todayStr();
  const hojeIdx = days.indexOf(hoje);

  // Dias disponíveis: apenas de hoje em diante (ou amanhã se após 19h)
  const startIdx = hojeIdx >= 0 ? hojeIdx : 0;
  const diasDisponiveis = hora >= INSTA_CUTOFF_HOUR
    ? days.slice(startIdx + 1)   // após 19h: só de amanhã em diante
    : days.slice(startIdx);      // antes das 19h: de hoje em diante

  const dia = diasDisponiveis.find(d => (week[d]||[]).length < INSTA_DIA_LIMIT);
  if (!dia) { notify('// todos os dias disponíveis estão cheios (60/dia)','warn'); return; }

  if (!week[dia]) week[dia] = [];
  week[dia].push({ ...emp, status: 'Não contatado', instagramUrl: emp.instagram || '', atribuidoEm: todayStr() });
  saveInstaWeek(week);
  saveInstaFila(fila.filter(e => e.id !== id));
  notify(`✓ ${emp.nome} → ${dia}`);
  renderInstagram(); updateBadges();
}

function renderInstagram() {
  renderInstaTabBar();
  renderInstaTabContent();
  updateBadges();
}

/* ── barra de abas ── */
function renderInstaTabBar() {
  const bar = document.getElementById('instaTabBar');
  if (!bar) return;
  const week = getInstaWeek();
  const days = instaWeekDays();
  const backlogCount = getInstaFila().filter(e => !!e.instagram).length;

  const tabStyle = (active, color) => `background:none;border:none;border-bottom:2px solid ${active?color:'transparent'};color:${active?color:'var(--muted)'};font-family:'DM Mono',monospace;font-size:10px;padding:8px 16px;cursor:pointer;font-weight:700;transition:all 0.18s;margin-bottom:-1px;white-space:nowrap`;

  const backlogActive = instaActiveTab === 'backlog';
  let html = `<button onclick="instaSetTab('backlog')" style="${tabStyle(backlogActive,'var(--insta)')}">`
    + `📦 Backlog${backlogCount?` <span style="opacity:0.65;font-weight:400">(${backlogCount})</span>`:''}` + `</button>`;

  days.forEach(day => {
    const count  = instaCountForDay(week, day);
    const active = instaActiveTab === day;
    const dt     = instaParseDay(day);
    const lbl    = dt.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric'}).replace('.','');
    const full   = count >= INSTA_DIA_LIMIT;
    const color  = full ? 'var(--warning)' : 'var(--accent)';
    html += `<button onclick="instaSetTab('${day}')" style="${tabStyle(active, color)}">`
      + `${lbl}${count?` <span style="opacity:0.65;font-weight:400">${count}</span>`:''}` + `</button>`;
  });

  bar.innerHTML = html;
}

function instaSetTab(tab) {
  instaActiveTab = tab;
  instaBacklogPg = 0;
  renderInstagram();
}

/* ── conteúdo da aba ── */
function renderInstaTabContent() {
  const el = document.getElementById('instaTabContent');
  if (!el) return;
  if (instaActiveTab === 'backlog') {
    renderInstaBacklog(el);
  } else {
    renderInstaDia(el, instaActiveTab);
  }
}

/* ── ABA BACKLOG ── */
function renderInstaBacklog(container) {
  // Apenas leads com link do Instagram já confirmado na Atribuição
  const filaAll = getInstaFila().filter(e => !!(e.instagram));

  if (!filaAll.length) {
    container.innerHTML = `<div class="stretch-card" style="flex:1">
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);text-align:center;padding:48px">
        // backlog vazio · confirme o link do Instagram na aba Atribuição para os leads aparecerem aqui
      </div></div>`;
    return;
  }

  const totalPags = Math.max(1, Math.ceil(filaAll.length / INSTA_PAGE_SIZE));
  if (instaBacklogPg >= totalPags) instaBacklogPg = totalPags - 1;
  const page = filaAll.slice(instaBacklogPg * INSTA_PAGE_SIZE, (instaBacklogPg + 1) * INSTA_PAGE_SIZE);

  const rows = page.map(e => {
    const stars   = e.totalScore   ? `⭐ ${Number(e.totalScore).toFixed(1)}` : '';
    const reviews = e.reviewsCount ? `(${e.reviewsCount} av.)` : '';
    const instaUrl = e.instagram || e.instagramUrl || '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border)">
      <!-- Nome clicável no instagram -->
      <div style="flex:1;min-width:0">
        ${instaUrl
          ? `<a href="${escHtml(instaUrl)}" target="_blank" style="font-weight:700;font-size:12px;color:var(--text);text-decoration:none" onmouseover="this.style.color='var(--insta)'" onmouseout="this.style.color='var(--text)'">${escHtml(e.nome||'—')}</a>`
          : `<span style="font-weight:700;font-size:12px">${escHtml(e.nome||'—')}</span>`}
        ${stars||e.categoria?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:1px">${[stars&&(stars+(reviews?` ${reviews}`:'')),'',e.categoria].filter(Boolean).join(' · ')}</div>`:''}
      </div>
      <!-- Botão alocar -->
      <button onclick="instaAlocarAuto('${e.id}')"
        style="background:var(--insta);color:#fff;border:none;border-radius:7px;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;padding:6px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:opacity 0.18s"
        onmouseover="this.style.opacity='0.82'" onmouseout="this.style.opacity='1'">
        → Alocar
      </button>
      <!-- Excluir -->
      <button onclick="excluirInstaFila('${e.id}')" title="Excluir"
        style="background:none;border:1px solid transparent;color:var(--muted);border-radius:6px;font-size:11px;padding:4px 8px;cursor:pointer;flex-shrink:0;transition:all 0.18s"
        onmouseover="this.style.borderColor='var(--error)';this.style.color='var(--error)';this.style.background='rgba(255,92,92,0.06)'"
        onmouseout="this.style.borderColor='transparent';this.style.color='var(--muted)';this.style.background='none'">✕</button>
    </div>`;
  }).join('');

  const pag = totalPags > 1 ? `<div style="display:flex;gap:6px;justify-content:center;padding:12px;flex-wrap:wrap">
    ${instaBacklogPg>0?`<button class="btn btn-ghost" style="font-size:9px;padding:5px 12px" onclick="instaBacklogPg--;renderInstaTabContent()">← Anterior</button>`:''}
    <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);align-self:center">${instaBacklogPg+1} / ${totalPags}</span>
    ${instaBacklogPg<totalPags-1?`<button class="btn btn-ghost" style="font-size:9px;padding:5px 12px" onclick="instaBacklogPg++;renderInstaTabContent()">Próxima →</button>`:''}
  </div>` : '';

  container.innerHTML = `<div class="stretch-card" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden">
    <div class="card-title" style="flex-shrink:0">
      Backlog
      <span style="font-size:10px;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0">· ${filaAll.length} empresa${filaAll.length>1?'s':''} aguardando</span>
    </div>
    <div style="flex:1;overflow-y:auto">${rows}</div>
    ${pag}
  </div>`;
}

/* ── ABA DIA ── */
function renderInstaDia(container, day) {
  const week  = getInstaWeek();
  const leads = week[day] || [];
  const full  = leads.length >= INSTA_DIA_LIMIT;
  const statusColor = { 'Não contatado':'var(--muted)', 'DM Enviada':'var(--insta)', 'Respondeu':'var(--ok)', 'Não respondeu':'var(--muted)', 'Fechou':'var(--ok)', 'Recusou':'var(--error)' };

  const header = `<div class="card-title" style="flex-shrink:0">
    Leads do dia
    <span style="font-size:10px;color:${full?'var(--warning)':'var(--muted)'};font-weight:400;text-transform:none;letter-spacing:0">· ${leads.length}/${INSTA_DIA_LIMIT}</span>
    <button onclick="instaLimparDia('${day}')"
      style="margin-left:auto;background:none;border:1px solid var(--border2);color:var(--muted);border-radius:6px;font-family:'DM Mono',monospace;font-size:8px;padding:3px 9px;cursor:pointer"
      onmouseover="this.style.color='var(--error)';this.style.borderColor='var(--error)'"
      onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--border2)'">Limpar dia</button>
  </div>`;

  if (!leads.length) {
    container.innerHTML = `<div class="stretch-card" style="flex:1;display:flex;flex-direction:column;min-height:0">${header}
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);text-align:center;padding:48px">// nenhum lead atribuído neste dia</div>
    </div>`; return;
  }

  const rows = leads.map((e, i) => {
    const stColor = statusColor[e.status] || 'var(--muted)';
    const instaUrl = e.instagramUrl || e.instagram || '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--border)">
      <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);width:18px;flex-shrink:0">${i+1}.</span>
      <!-- Nome = link direto para o instagram -->
      <div style="flex:1;min-width:0">
        ${instaUrl
          ? `<a href="${escHtml(instaUrl)}" target="_blank" style="font-weight:700;font-size:12px;color:var(--text);text-decoration:none" onmouseover="this.style.color='var(--insta)'" onmouseout="this.style.color='var(--text)'" title="Abrir Instagram">${escHtml(e.nome||'—')}</a>`
          : `<span style="font-weight:700;font-size:12px;color:var(--text2)">${escHtml(e.nome||'—')}</span>`}
        ${e.categoria?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:1px">${escHtml(e.categoria)}</div>`:''}
      </div>
      <!-- Ações -->
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
        <!-- Copiar mensagem -->
        <button onclick="copiarInstaMsg('${escHtml(e.nome||'').replace(/'/g,"\\'")}')" title="Copiar mensagem"
          style="background:none;border:1px solid rgba(225,48,108,0.3);color:var(--insta);border-radius:6px;font-size:13px;padding:3px 8px;cursor:pointer;transition:all 0.18s;flex-shrink:0"
          onmouseover="this.style.background='rgba(225,48,108,0.1)'"
          onmouseout="this.style.background='none'">📋</button>
        <!-- Select status -->
        <select onchange="instaUpdateStatus('${e.id}','${day}',this.value)"
          style="font-family:'DM Mono',monospace;font-size:8px;padding:3px 6px;background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:${stColor};outline:none;cursor:pointer">
          ${INSTA_STATUS.map(s => `<option value="${s}" ${e.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        ${e.dmEnviadaEm?`<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);white-space:nowrap">${e.dmEnviadaEm}</span>`:''}
        <!-- Voltar para backlog -->
        <button onclick="instaVoltarBacklog('${e.id}','${day}')" title="Voltar para o backlog"
          style="background:none;border:1px solid var(--border2);color:var(--muted);border-radius:6px;font-family:'DM Mono',monospace;font-size:9px;padding:3px 7px;cursor:pointer;transition:all 0.15s"
          onmouseover="this.style.borderColor='var(--insta)';this.style.color='var(--insta)'"
          onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted)'">↩</button>
        <!-- Excluir -->
        <button onclick="abrirModalExcluirInstaLead('${e.id}','${day}')" title="Excluir permanentemente"
          style="background:none;border:1px solid transparent;color:var(--muted);border-radius:6px;font-size:10px;padding:3px 7px;cursor:pointer;transition:all 0.18s"
          onmouseover="this.style.borderColor='var(--error)';this.style.color='var(--error)';this.style.background='rgba(255,92,92,0.06)'"
          onmouseout="this.style.borderColor='transparent';this.style.color='var(--muted)';this.style.background='none'">✕</button>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="stretch-card" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden">
    ${header}
    <div style="flex:1;overflow-y:auto">${rows}</div>
  </div>`;
}

/* ── VOLTAR PARA BACKLOG ── */
function instaVoltarBacklog(id, day) {
  const week = getInstaWeek();
  const lead = (week[day]||[]).find(e => e.id === id);
  if (!lead) return;
  week[day] = week[day].filter(e => e.id !== id);
  saveInstaWeek(week);
  const fila = getInstaFila();
  if (!fila.find(e => e.id === id)) {
    const { status, instagramUrl, atribuidoEm, dmEnviadaEm, ...base } = lead;
    // Garante que e.instagram (usado pelo backlog) está presente
    if (!base.instagram && instagramUrl) base.instagram = instagramUrl;
    saveInstaFila([...fila, base]);
  }
  renderInstagram();
  notify(`↩ ${lead.nome} voltou ao backlog`);
}

/* ── EXCLUIR DO BACKLOG ── */
function excluirInstaFila(id) {
  const fila = getInstaFila();
  const lead = fila.find(e => e.id === id);
  if (!lead) return;
  abrirModalConfirm(
    `Excluir <strong>${escHtml(lead.nome)}</strong> permanentemente?`,
    () => {
      saveInstaFila(getInstaFila().filter(e => e.id !== id));
      renderInstagram(); updateBadges();
      notify(`✕ ${lead.nome} excluído`);
    }
  );
}

/* ── STATUS ── */
function instaUpdateStatus(id, day, status) {
  const week = getInstaWeek();
  const lead = (week[day]||[]).find(e => e.id === id);
  if (!lead) return;
  lead.status = status;
  if (status === 'DM Enviada' && !lead.dmEnviadaEm) lead.dmEnviadaEm = todayStr();
  saveInstaWeek(week);
  renderInstaDia(document.getElementById('instaTabContent'), day);
  notify(`✓ ${status}`);
}

/* ── LIMPAR DIA ── */
function instaLimparDia(day) {
  const week  = getInstaWeek();
  const leads = week[day] || [];
  const naoContatados = leads.filter(e => !e.status || e.status === 'Não contatado');
  const outros = leads.filter(e => e.status && e.status !== 'Não contatado');
  const aviso = naoContatados.length
    ? `<br><br><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">${naoContatados.length} "Não contatado" voltarão ao backlog. ${outros.length} com status ficam no histórico.</span>`
    : '';
  abrirModalConfirm(`Limpar todos os leads de <strong>${day}</strong>?${aviso}`, () => {
    const w = getInstaWeek();
    const STATUS_HIST = ['DM Enviada','Respondeu','Não respondeu','Fechou','Recusou'];
    const paraMes = (w[day]||[]).filter(e => STATUS_HIST.includes(e.status||''));
    if (paraMes.length) migrarInstaParaMes(paraMes);
    const voltam = (w[day]||[]).filter(e => !e.status || e.status === 'Não contatado');
    if (voltam.length) {
      const filaAtual = getInstaFila();
      const filaIds   = new Set(filaAtual.map(f => f.id));
      const novos = voltam.filter(e => !filaIds.has(e.id))
        .map(({ status, instagramUrl, atribuidoEm, dmEnviadaEm, ...base }) => ({ ...base, instagram: base.instagram || instagramUrl || '', voltouEm: todayStr() }));
      saveInstaFila([...filaAtual, ...novos]);
    }
    delete w[day]; saveInstaWeek(w);
    instaActiveTab = 'backlog';
    renderInstagram(); renderAtribInstaFila(); updateBadges();
    let msg = `✓ Dia ${day} limpo`;
    if (voltam.length)  msg += ` · ${voltam.length} → backlog`;
    if (paraMes.length) msg += ` · ${paraMes.length} → acompanhamento`;
    notify(msg);
  });
}

/* ── EXCLUIR LEAD DO DIA ── */
function abrirModalExcluirInstaLead(id, day) {
  const week = getInstaWeek();
  const lead = (week[day]||[]).find(e => e.id === id);
  if (!lead) return;
  abrirModalConfirm(
    `Excluir <strong>${escHtml(lead.nome)}</strong> permanentemente?`,
    () => {
      const w = getInstaWeek();
      if (w[day]) { w[day] = w[day].filter(e => e.id !== id); saveInstaWeek(w); }
      saveInstaFila(getInstaFila().filter(e => e.id !== id));
      if (lead.site) addExcludedDomains([lead.site]);
      renderInstagram(); updateBadges();
      notify(`✕ ${lead.nome} excluído`);
    }
  );
}

/* ── MIGRAR PARA ACOMPANHAMENTO ── */
function migrarInstaParaMes(leads) {
  const data = getAcompData();
  const mk   = currentMonthKey();
  if (!data[mk]) data[mk] = {};
  if (!data[mk].instagram) data[mk].instagram = [];
  const existingIds = new Set(data[mk].instagram.map(e => e.id));
  const novos = leads.filter(e => !existingIds.has(e.id)).map(e => ({ ...e, migradoEm: todayStr(), fonte: 'instagram' }));
  data[mk].instagram = [...data[mk].instagram, ...novos];
  saveAcompData(data);
}

