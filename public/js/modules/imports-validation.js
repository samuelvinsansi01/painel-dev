/* ════════════════════════════
   EXTRACT HELPERS
════════════════════════════ */
function extractSite(item) { return String(item.website || item.url || item.site || '').trim(); }
function extractPhone(item) { return String(item.phone || item.whatsapp || item.phoneNumber || item.telefone || '').trim(); }
function extractName(item)  { return capitalizeName(String(item.title || item.name || item.nome || '').trim()); }
function extractInstagram(item) {
  const ig = String(item.instagram || item.instagramUrl || item.instagram_url || '').trim();
  if (ig) return ig;
  const socials = item.socialMedia || item.profiles || item.social || [];
  if (Array.isArray(socials)) {
    const found = socials.find(s => {
      const url = String(s.url || s.link || s.href || '').toLowerCase();
      return url.includes('instagram.com');
    });
    if (found) return String(found.url || found.link || found.href || '').trim();
  }
  return '';
}
function extractCategory(item) {
  return String(item.categoryName || item.category || item.categoria || item.type || '').trim();
}
function extractGoogleUrl(item) {
  return String(item.url || item.googleUrl || item.google_url || item.maps_url || item.link || '').trim();
}
function hasValidSiteRaw(item) {
  const site = String(item.website || item.url || item.site || '').trim();
  return site.startsWith('http') && site.length > 8;
}
function hasValidPhone(item) {
  return normalizePhone(extractPhone(item)).length >= 10;
}

/* ════════════════════════════
   RAMO FILTER
════════════════════════════ */
let activeRamoId = null;

function getRamoKeywords() {
  if (!activeRamoId) return null;
  const ramo = getRamos().find(r => r.id === activeRamoId);
  return ramo ? ramo.keywords : null;
}

function isRamoMatch(item) {
  const kws = getRamoKeywords();
  if (!kws) return true; // sem ramo selecionado: passa tudo
  const cat = normalizeStr(extractCategory(item));
  return kws.some(kw => cat.includes(normalizeStr(kw)));
}

function onRamoChange() {
  activeRamoId = document.getElementById('ramoSelect').value || null;
  const ramo = activeRamoId ? getRamos().find(r => r.id === activeRamoId) : null;
  const wrap = document.getElementById('subRamosWrap');
  const list = document.getElementById('subRamosList');
  if (ramo) {
    wrap.style.display = 'block';
    list.innerHTML = ramo.keywords.map(k =>
      `<span style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);font-family:'DM Mono',monospace;font-size:8px;padding:2px 8px;border-radius:100px">${escHtml(k)}</span>`
    ).join('');
  } else {
    wrap.style.display = 'none';
    list.innerHTML = '';
  }
  importPreview();
}

function renderRamoSelect() {
  const sel = document.getElementById('ramoSelect');
  const ramos = getRamos();
  sel.innerHTML = '<option value="">Selecionar ramo...</option>' +
    ramos.map(r => `<option value="${r.id}"${activeRamoId===r.id?' selected':''}>${escHtml(r.nome)}</option>`).join('');
}

/* ════════════════════════════
   INÍCIO — RENDER
════════════════════════════ */

/* ════════════════════════════
   RENDER INICIO SAFE V40.11
════════════════════════════ */
function renderCommercialDashboardSafeV4011() {
  try {
    if (typeof renderCommercialDashboard === 'function') {
      return renderCommercialDashboard();
    }
    if (typeof renderDashboard === 'function') {
      return renderDashboard();
    }
    return '';
  } catch (e) {
    console.warn('Dashboard comercial ignorado:', e?.message || e);
    return '';
  }
}

function renderInicio() {
  renderCrmHomeDashboard();
  renderHomeProDashboard();
  const data = ensureWeekData();
  const weekDays = currentWeekDays();
  const today = todayStr();
  if (!weekDays.includes(selectedDay)) selectedDay = today;

  document.getElementById('inicioDayTabs').innerHTML = weekDays.map(day => {
    const emps = data.days[day] || [];
    const active = day === selectedDay;
    return `<div class="day-tab${active?' active':''}" onclick="setDay('${day}')">
      ${dayLabel(day)}${day===today?' <span style="color:var(--accent);font-size:8px">●</span>':''}
      ${emps.length>0?`<span class="day-count">${emps.length}</span>`:''}
    </div>`;
  }).join('');

  const emps = data.days[selectedDay] || [];
  const statusCounts = {};
  STATUS_OPTIONS.forEach(s => { statusCounts[s] = emps.filter(e => (e.status||'Não enviada')===s).length; });
  document.getElementById('inicioStatusTabs').innerHTML = STATUS_OPTIONS.map(s =>
    `<div class="status-tab${selectedStatus===s?' active':''}" onclick="setStatus('${s}')">
      ${s} <span class="st-count">${statusCounts[s]}</span>
    </div>`
  ).join('');

  const filtered = emps.filter(e => (e.status||'Não enviada') === selectedStatus);

  // aplicar busca
  const inicioBuscaEl = document.getElementById('inicioBusca');
  const inicioBuscaQ = inicioBuscaEl ? normalizeStr(inicioBuscaEl.value) : '';
  const filteredFinal = inicioBuscaQ
    ? filtered.filter(e => normalizeStr(e.nome||'').includes(inicioBuscaQ) || normalizeStr(e.site||'').includes(inicioBuscaQ) || (e.whatsapp||'').includes(inicioBuscaQ))
    : filtered;

  const totalItems = filteredFinal.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / INICIO_PG));
  if (inicioPage > totalPages) inicioPage = totalPages;
  const pageItems = filteredFinal.slice((inicioPage-1)*INICIO_PG, inicioPage*INICIO_PG);

  const tbody = document.getElementById('inicioTbody');
  if (!totalItems) {
    tbody.innerHTML = `${renderCommercialDashboardSafeV4011()}<tr><td colspan="7" class="table-empty">${inicioBuscaQ ? `Nenhum resultado para "${inicioBuscaEl.value}"` : `Nenhuma empresa com status "${selectedStatus}" neste dia`}</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(e => {
      const googleUrl = e.googleUrl || '';
      const nomeDisplay = googleUrl
        ? `<a href="${escHtml(googleUrl)}" target="_blank" title="Ver perfil Google">${escHtml(e.nome)}</a>`
        : escHtml(e.nome);
      const siteVisitado = e.site && isExcludedDomain(e.site);
      const rowStyle = siteVisitado ? 'background:rgba(240,164,41,0.04);border-left:2px solid rgba(240,164,41,0.4);' : '';
      const siteVisitadoBadge = siteVisitado ? `<span title="Site já visitado" style="display:inline-flex;align-items:center;gap:3px;font-family:'DM Mono',monospace;font-size:8px;color:var(--warning);background:rgba(240,164,41,0.1);border:1px solid rgba(240,164,41,0.25);border-radius:4px;padding:1px 5px;margin-left:4px">👁 visto</span>` : '';
      return `<tr style="${rowStyle}">
        <td class="td-name">${nomeDisplay}${siteVisitadoBadge}</td>
        <td>${e.instagram?`<a href="${escHtml(e.instagram)}" target="_blank" class="q-badge insta" style="text-decoration:none">📸</a>`:'<span class="td-missing">—</span>'}</td>
        <td class="td-link">${e.site?`<a href="${escHtml(e.site)}" target="_blank">${escHtml(e.site.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`:'<span class="td-missing">—</span>'}</td>
        <td>${e.whatsapp
          ?`<div style="display:flex;align-items:center;gap:5px">
              <a href="${buildWaLink(e.whatsapp)}" target="_blank" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ok);text-decoration:none">${escHtml(e.whatsapp)}</a>
              <button onclick="editWhatsapp('${e.id}','${selectedDay}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:2px 4px;border-radius:4px" title="Editar">✏️</button>
            </div>`
          :`<div style="display:flex;align-items:center;gap:5px">
              <span class="td-missing">—</span>
              <button onclick="editWhatsapp('${e.id}','${selectedDay}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:2px 4px;border-radius:4px" title="Adicionar">✏️</button>
            </div>`
        }</td>
        <td><select class="status-select" onchange="updateStatus('${e.id}','${selectedDay}',this.value)">${getStatusOptions(e.status||'Não enviada').map(s=>`<option value="${s}"${(e.status||'Não enviada')===s?' selected':''}>${s}</option>`).join('')}</select></td>
        <td><button class="btn btn-ghost" style="font-size:9px;padding:4px 9px" onclick="showMsg('${e.id}','${selectedDay}')">Msg</button></td>
        <td style="white-space:nowrap">
          <button onclick="moverParaBacklogZapDoDia('${e.id}','${selectedDay}')" title="Mover para Backlog Zap"
            style="background:none;border:1px solid var(--border2);color:var(--muted);border-radius:5px;font-family:'DM Mono',monospace;font-size:9px;padding:3px 8px;cursor:pointer;margin-right:4px;transition:all 0.15s"
            onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
            onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted)'">↩ Backlog</button>
          <button class="del-btn" onclick="deleteEmpresa('${e.id}','${selectedDay}')">✕</button>
        </td>
      </tr>`;
    }).join('');
  }
  renderPagination('inicioPagination', inicioPage, totalPages, totalItems, INICIO_PG, 'goInicioPage', 'changeInicioPgSize');

  const sel = document.getElementById('exportDaySelect');
  if (sel) sel.innerHTML = '<option value="">Exportar dia...</option>' + weekDays.map(d => `<option value="${d}">${dayLabel(d)}</option>`).join('');
  renderHistory();
  renderExcluidos();
  renderFollowUpsHome();
}

function setDay(day)    { selectedDay = day; selectedStatus = 'Não enviada'; inicioPage = 1; const b=document.getElementById('inicioBusca'); if(b) b.value=''; renderInicio(); }
function setStatus(st)  { selectedStatus = st; inicioPage = 1; const b=document.getElementById('inicioBusca'); if(b) b.value=''; renderInicio(); }

/* ════════════════════════════
   PAGINAÇÃO — HELPERS
════════════════════════════ */
function buildPageNumbers(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  const pages=[], delta=2;
  const left=Math.max(2,cur-delta), right=Math.min(total-1,cur+delta);
  pages.push(1);
  if (left>2) pages.push('…');
  for(let i=left;i<=right;i++) pages.push(i);
  if(right<total-1) pages.push('…');
  pages.push(total);
  return pages;
}
function renderPagination(containerId, cur, total, totalItems, pgSize, onPage, onSize, anchor) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalItems === 0) { el.innerHTML=''; return; }
  const start = (cur-1)*pgSize+1;
  const end   = Math.min(cur*pgSize, totalItems);
  const pgNums = buildPageNumbers(cur, total);
  el.innerHTML = `<div class="pagination-bar">
    <div class="pagination-info">Exibindo <strong>${start}–${end}</strong> de <strong>${totalItems}</strong></div>
    <div class="pagination-controls">
      <button class="pg-btn" onclick="${onPage}(${cur-1})" ${cur===1?'disabled':''}>‹</button>
      ${pgNums.map(p=>p==='…'?`<span class="pg-ellipsis">…</span>`:`<button class="pg-btn${p===cur?' active':''}" onclick="${onPage}(${p})">${p}</button>`).join('')}
      <button class="pg-btn" onclick="${onPage}(${cur+1})" ${cur===total?'disabled':''}>›</button>
    </div>
    <select class="pg-size-select" onchange="${onSize}(+this.value)" title="Itens por página">
      ${[10,20,50,100].map(n=>`<option value="${n}"${pgSize===n?' selected':''}>${n}/pág</option>`).join('')}
    </select>
  </div>`;
}

/* goPage functions per panel */
function goInicioPage(p)   { inicioPage=p;  renderInicio(); }
function changeInicioPgSize(n){ INICIO_PG=n; inicioPage=1; renderInicio(); }
function goImportPage(p)   { importPage=p;  importPreview(); }
function changeImportPgSize(n){ IMPORT_PG=n; importPage=1; importPreview(); }
function goValPage(p)      { valPage=p;     renderValidacao(); }
function changeValPgSize(n){ VAL_PG=n; valPage=1; renderValidacao(); }
function goAtribPage(p)    { atribPage=p;   renderAtribuicao(); }
function changeAtribPgSize(n){ ATRIB_PG=n; atribPage=1; renderAtribuicao(); }
function goDisparoPage(p)  { disparoPage=p; renderDisparoEmpresas(); }
function changeDisparoPgSize(n){ DISPARO_PG=n; disparoPage=1; renderDisparoEmpresas(); }

function showMsg(id, day) {
  const data = ensureWeekData();
  const emp  = (data.days[day]||[]).find(e => e.id === id);
  if (!emp) return;
  msgEmpresaId = id;
  const { text, idx } = pickTemplate(emp.nome, emp.ramoId || null);
  document.getElementById('msgPanelEmpresa').innerHTML = `empresa: <span>${escHtml(emp.nome)}</span>`;
  document.getElementById('msgBody').textContent = text;
  document.getElementById('msgCopyBtn').disabled = false;
  document.getElementById('msgModal').classList.add('open');
}
function fecharMsgModal() {
  document.getElementById('msgModal').classList.remove('open');
}
function copyMsg() {
  const text = document.getElementById('msgBody').textContent;
  navigator.clipboard.writeText(text).then(() => notify('✓ Mensagem copiada'));
}
function shuffleMsg() {
  if (!msgEmpresaId) return;
  const data = ensureWeekData();
  const emp  = Object.values(data.days).flat().find(e => e.id === msgEmpresaId);
  if (!emp) return;
  const { text, idx } = pickOtherTemplate(emp.nome, msgTemplateIdx, emp.ramoId || null);
  msgTemplateIdx = idx;
  document.getElementById('msgBody').textContent = text;
}
// Opções de status disponíveis dependendo do status atual
const STATUS_FORWARD_ONLY = ['Respondida','Não respondida','Recusada','Fechada'];
function getStatusOptions(currentStatus) {
  if (currentStatus === 'Enviada' || STATUS_FORWARD_ONLY.includes(currentStatus)) {
    // Não pode voltar — só status à frente + o atual
    return ['Enviada', ...STATUS_FORWARD_ONLY];
  }
  return STATUS_OPTIONS;
}

function updateStatus(id, day, status) {
  const data = ensureWeekData();
  const emp  = (data.days[day]||[]).find(e => e.id === id);
  if (!emp) return;
  // Bloquear retroação a partir de Enviada
  const curr = emp.status || 'Não enviada';
  const lockedForward = curr === 'Enviada' || STATUS_FORWARD_ONLY.includes(curr);
  if (lockedForward && !STATUS_FORWARD_ONLY.includes(status) && status !== 'Enviada') {
    notify('// não é possível retroceder após Enviada','warn');
    return;
  }
  emp.status = status;
  if (status === 'Enviada') emp.enviadoEm = todayStr();
  saveWeekData(data);
  updateBadges();
  renderInicio(); // re-render para atualizar o select corretamente
}
function editWhatsapp(id, day) {
  const data = ensureWeekData();
  const emp  = (data.days[day]||[]).find(e => e.id === id);
  if (!emp) return;
  const currentNum = emp.whatsapp || '';
  const allRows = document.querySelectorAll('#inicioTbody tr');
  let targetCell = null;
  allRows.forEach(row => {
    const delBtn = row.querySelector('.del-btn');
    if (delBtn && delBtn.getAttribute('onclick') && delBtn.getAttribute('onclick').includes(`'${id}'`)) targetCell = row.cells[3];
  });
  if (!targetCell) return;
  targetCell.innerHTML = `<div style="display:flex;align-items:center;gap:5px">
    <input id="waInput_${id}" type="text" value="${escHtml(currentNum)}" placeholder="ex: 11999999999"
      style="background:var(--bg);border:1px solid var(--accent);border-radius:6px;color:var(--text);font-family:'DM Mono',monospace;font-size:10px;padding:4px 8px;width:130px;outline:none"
      onkeydown="if(event.key==='Enter')saveWhatsapp('${id}','${day}');if(event.key==='Escape')renderInicio();"/>
    <button onclick="saveWhatsapp('${id}','${day}')" style="background:var(--accent);border:none;color:#0a0a0d;border-radius:5px;font-size:10px;padding:4px 8px;cursor:pointer;font-weight:700">✓</button>
    <button onclick="renderInicio()" style="background:none;border:1px solid var(--border2);color:var(--muted);border-radius:5px;font-size:10px;padding:4px 8px;cursor:pointer">✕</button>
  </div>`;
  document.getElementById(`waInput_${id}`).focus();
}
function saveWhatsapp(id, day) {
  const input = document.getElementById(`waInput_${id}`);
  if (!input) return;
  const raw = input.value.trim();
  const data = ensureWeekData();
  const emp  = (data.days[day]||[]).find(e => e.id === id);
  if (!emp) return;
  emp.whatsapp = raw;
  saveWeekData(data); updateBadges(); renderInicio();
  notify(raw ? '✓ Número atualizado' : '✓ Número removido');
}
function deleteEmpresa(id, day) {
  const data = ensureWeekData();
  const emp = (data.days[day]||[]).find(e => e.id === id);
  abrirModalConfirm(
    `Remover <strong>${emp ? escHtml(emp.nome) : 'esta empresa'}</strong> da semana?`,
    () => {
      const d = ensureWeekData();
      if (!d.days[day]) return;
      d.days[day] = d.days[day].filter(e => e.id !== id);
      saveWeekData(d); renderInicio(); updateBadges();
      notify('Empresa removida');
    }
  );
}
function clearAll() { document.getElementById('clearModal').classList.add('open'); }
function confirmClear() {
  const data = ensureWeekData();
  const flat = flattenWeekData(data);

  // Leads pós-envio → migrar para base mensal
  const STATUS_MENSAIS = ['Enviada','Respondida','Não respondida','Recusada','Fechada'];
  const paraMes = flat.filter(e => STATUS_MENSAIS.includes(e.status||''));
  if (paraMes.length) migrarParaMes(paraMes);

  // Leads sem status (Não enviada) voltam para a Base de Atribuição
  const semStatus = flat.filter(e => !e.status || e.status === 'Não enviada' || e.status === 'Em fila');
  if (semStatus.length) {
    const atrib = getAtribuicaoData();
    const atribIds = new Set(atrib.map(a => a.id));
    const novosNaAtrib = semStatus
      .filter(e => !atribIds.has(e.id))
      .map(e => ({ ...e, voltouDaSemana: todayStr(), diaDestino: null }));
    saveAtribuicaoData([...atrib, ...novosNaAtrib]);
  }

  // Zera os dias da semana
  data.days = {};
  saveWeekData(data);
  document.getElementById('clearModal').classList.remove('open');
  renderInicio(); updateBadges();
  const msgs = [];
  if (paraMes.length) msgs.push(`${paraMes.length} lead${paraMes.length!==1?'s':''} → Acompanhamento`);
  if (semStatus.length) msgs.push(`${semStatus.length} → Atribuição`);
  notify('Semana limpa' + (msgs.length ? ' · ' + msgs.join(' · ') : ''));
}

function clearDayModal() {
  const weekDays = currentWeekDays();
  const data = ensureWeekData();
  const sel = document.getElementById('clearDaySelect');
  sel.innerHTML = weekDays.map(day => {
    const count = (data.days[day]||[]).length;
    return `<option value="${day}"${day===selectedDay?' selected':''}>${dayLabel(day)} — ${count} empresa${count!==1?'s':''}</option>`;
  }).join('');
  document.getElementById('clearDayModalOverlay').classList.add('open');
}

function confirmClearDay() {
  const day = document.getElementById('clearDaySelect').value;
  if (!day) return;
  const data = ensureWeekData();
  const emps = data.days[day] || [];

  // Leads pós-envio → migrar para base mensal
  const STATUS_MENSAIS = ['Enviada','Respondida','Não respondida','Recusada','Fechada'];
  const paraMes = emps.filter(e => STATUS_MENSAIS.includes(e.status||''));
  if (paraMes.length) migrarParaMes(paraMes);

  // Leads sem status voltam para Atribuição
  const semStatus = emps.filter(e => !e.status || e.status === 'Não enviada' || e.status === 'Em fila');
  if (semStatus.length) {
    const atrib = getAtribuicaoData();
    const atribIds = new Set(atrib.map(a => a.id));
    const novos = semStatus.filter(e => !atribIds.has(e.id)).map(e => ({ ...e, voltouDaSemana: todayStr(), diaDestino: null }));
    saveAtribuicaoData([...atrib, ...novos]);
  }

  // Remove todos do dia
  data.days[day] = [];
  saveWeekData(data);
  document.getElementById('clearDayModalOverlay').classList.remove('open');
  renderInicio(); updateBadges();
  const msgs = [];
  if (paraMes.length) msgs.push(`${paraMes.length} → Acompanhamento`);
  if (semStatus.length) msgs.push(`${semStatus.length} → Atribuição`);
  notify(`${dayLabel(day)} limpo` + (msgs.length ? ' · ' + msgs.join(' · ') : ''));
}

/* ════════════════════════════
   HISTÓRICO
════════════════════════════ */
function renderHistory() {
  const hist = getHistoryData();
  const section = document.getElementById('historySection');
  if (!hist) { section.style.display = 'none'; return; }
  const flat = Object.keys(hist.days).sort().flatMap(d => (hist.days[d]||[]).map(e => ({ date: d, ...e })));
  if (!flat.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('historyBadge').textContent = `${flat.length} empresa${flat.length!==1?'s':''}`;
  document.getElementById('historyToggleBtn').textContent = historyOpen ? 'Ocultar' : 'Mostrar';
  document.getElementById('historyContent').classList.toggle('open', historyOpen);
  if (!historyOpen) return;
  document.getElementById('historyTbody').innerHTML = flat.map(e => `<tr>
    <td style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">${escHtml(e.date)}</td>
    <td class="td-name">${escHtml(e.nome)}</td>
    <td class="td-link">${e.site?`<a href="${escHtml(e.site)}" target="_blank">${escHtml(e.site.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`:'<span class="td-missing">—</span>'}</td>
    <td style="font-family:'DM Mono',monospace;font-size:9px">${e.whatsapp||'—'}</td>
    <td style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">${escHtml(e.status||'Não enviada')}</td>
  </tr>`).join('');
}
function toggleHistory() { historyOpen = !historyOpen; renderHistory(); }
function archiveHistory() {
  if (!confirm('Arquivar semana anterior?')) return;
  localStorage.removeItem(HISTORY_KEY); renderHistory(); notify('Semana arquivada');
}

/* ════════════════════════════
   EXCLUDED DOMAINS
════════════════════════════ */
function renderExcluidos() {
  const domains = getExcludedDomains();
  const countEl = document.getElementById('excludedCount');
  const listEl  = document.getElementById('excludedList');
  if (!countEl || !listEl) return;
  countEl.textContent = `(${domains.length} domínio${domains.length!==1?'s':''})`;
  if (!domains.length) { listEl.innerHTML = '<span style="color:var(--muted)">// nenhum domínio excluído ainda</span>'; return; }
  listEl.innerHTML = domains.map(d =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
      <span>${escHtml(d)}</span>
      <button onclick="removerExcluido('${escHtml(d)}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:2px 5px;border-radius:4px" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--muted)'">✕</button>
    </div>`
  ).join('');
}
function removerExcluido(domain) {
  saveExcludedDomains(getExcludedDomains().filter(d => d !== domain));
  renderExcluidos(); notify(`✓ ${domain} removido`);
}
/* limparExcluidos: delegated to abrirModalLimparExcluidos() */

/* ════════════════════════════
   IMPORTAR
════════════════════════════ */
function renderImportarPanel() {
  renderRamoSelect();
  importPreview();
  renderManualValChips();
}

function parseApifyJson(raw) {
  let arr;
  try { arr = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(arr)) arr = arr.results || arr.items || arr.data || [];
  return Array.isArray(arr) ? arr : null;
}

function importPreview() {
  const raw     = document.getElementById('importJsonInput').value.trim();
  const listEl  = document.getElementById('importPreviewList');
  const sumEl   = document.getElementById('importSummary');
  const countEl = document.getElementById('previewCount');
  if (!raw) { listEl.innerHTML='<span style="color:var(--muted)">// aguardando JSON...</span>'; sumEl.innerHTML='// cole o JSON acima para ver a prévia do filtro'; countEl.textContent=''; return; }
  const arr = parseApifyJson(raw);
  if (!arr) { sumEl.innerHTML='<span class="err">// JSON inválido</span>'; listEl.innerHTML=''; countEl.textContent=''; return; }

  const total     = arr.length;
  const fora      = arr.filter(i => !isRamoMatch(i));
  const doRamo    = arr.filter(isRamoMatch);
  // Novo critério: SEM site = válido → Validação; COM site = já-vistos
  const comSiteRamo   = doRamo.filter(i => hasValidSiteRaw(i) && !isSiteBlocklisted(extractSite(i)) && !isExcludedDomain(extractSite(i)));
  const comSiteJaVisto= doRamo.filter(i => hasValidSiteRaw(i) && (isSiteBlocklisted(extractSite(i)) || isExcludedDomain(extractSite(i))));
  const semSiteRamo   = doRamo.filter(i => !hasValidSiteRaw(i));
  const semTel        = semSiteRamo.filter(i => !hasValidPhone(i));
  const validos       = semSiteRamo.filter(hasValidPhone);

  // deduplication check
  const data = ensureWeekData();
  const valFila = getValData();
  const existPhones = new Set([...getAllPhones(data), ...valFila.map(v => normalizePhone(v.whatsapp||'')).filter(Boolean)]);
  const novos = validos.filter(i => {
    const ph = normalizePhone(extractPhone(i));
    return !existPhones.has(ph);
  });

  sumEl.innerHTML = `
    <span class="acc">${total}</span> total ·
    <span class="err">${fora.length}</span> fora do ramo ·
    <span class="err">${comSiteRamo.length + comSiteJaVisto.length}</span> com site → já vistos ·
    <span class="warn">${semTel.length}</span> sem telefone ·
    <span class="acc">${validos.length}</span> sem site ·
    <span class="acc">${novos.length}</span> novos → Validação
  `;
  countEl.textContent = `· ${validos.length} sem site`;

  if (!validos.length) { listEl.innerHTML='<span style="color:var(--muted)">// nenhuma empresa sem site encontrada</span>'; document.getElementById('importPreviewPagination').innerHTML=''; return; }

  const totalPrev = validos.length;
  const totalPrevPages = Math.max(1, Math.ceil(totalPrev / IMPORT_PG));
  if (importPage > totalPrevPages) importPage = totalPrevPages;
  const previewItems = validos.slice((importPage-1)*IMPORT_PG, importPage*IMPORT_PG);

  listEl.innerHTML = '<div class="ext-list">' + previewItems.map(item => {
    const nome     = extractName(item);
    const phone    = extractPhone(item);
    const cat      = extractCategory(item);
    const googleUrl= extractGoogleUrl(item);
    const ph = normalizePhone(phone);
    const isDup = existPhones.has(ph);
    const score   = item.totalScore;
    const reviews = item.reviewsCount;
    const scoreStr = score ? `⭐ ${Number(score).toFixed(1)}` : '';
    const revStr   = reviews ? `(${reviews})` : '';
    return `<div class="empresa-card" style="${isDup?'opacity:0.45':''}">
      <div class="empresa-info">
        <div class="empresa-nome">${googleUrl?`<a href="${escHtml(googleUrl)}" target="_blank" style="color:var(--text);text-decoration:none">${escHtml(nome)}</a>`:escHtml(nome)}</div>
        <div class="empresa-meta">
          <div class="empresa-phone">📱 ${escHtml(phone)}</div>
          ${cat?`<span class="q-badge ok" style="font-size:7px">${escHtml(cat)}</span>`:''}
          ${scoreStr?`<span class="q-badge info" style="font-size:7px">${scoreStr} ${revStr}</span>`:''}
        </div>
      </div>
      ${isDup?'<span class="q-badge warn">duplicada</span>':'<span class="q-badge ok">✓ sem site</span>'}
    </div>`;
  }).join('') + '</div>';
  renderPagination('importPreviewPagination', importPage, totalPrevPages, totalPrev, IMPORT_PG, 'goImportPage', 'changeImportPgSize');
}

function importarLeads() {
  const raw = document.getElementById('importJsonInput').value.trim();
  if (!raw) { notify('// cole o JSON primeiro','err'); return; }
  const arr = parseApifyJson(raw);
  if (!arr || !arr.length) { notify('// JSON inválido ou vazio','err'); return; }

  const data = ensureWeekData();
  const valFila = getValData();
  const existPhones = new Set([...getAllPhones(data), ...valFila.map(v => normalizePhone(v.whatsapp||'')).filter(Boolean)]);
  const existSites  = new Set([...getAllSites(data),  ...valFila.map(v => extractDomain(v.site||'')).filter(Boolean)]);

  // dedup instagram também
  const instaFila = getInstaFila();
  const existInstaPhones = new Set(instaFila.map(v => normalizePhone(v.whatsapp||'')).filter(Boolean));

  let addedSemSite = 0, addedJaVistos = 0, skipped = 0;
  const novaValFila = [...valFila];

  arr.filter(isRamoMatch).forEach(item => {
    const nome  = extractName(item);
    const site  = extractSite(item);
    const phone = extractPhone(item);
    if (!nome) { skipped++; return; }

    const ph = normalizePhone(phone);
    const temSite = hasValidSiteRaw(item) && !isSiteBlocklisted(site);
    const temTel  = hasValidPhone(item);

    // ── COM site → já-vistos (bloqueado permanentemente) ──
    if (temSite) {
      const si = extractDomain(site);
      if (si && !isExcludedDomain(site)) addExcludedDomains([site]);
      addedJaVistos++;
      return;
    }

    // ── SEM site + com telefone → Validação ──
    if (!temSite && temTel) {
      if (ph && existPhones.has(ph)) { skipped++; return; }
      const entry = {
        id: genId(), nome,
        whatsapp: phone,
        instagram: extractInstagram(item),
        googleUrl: extractGoogleUrl(item),
        categoria: extractCategory(item),
        ramoId: activeRamoId || null,
        reviewsCount: item.reviewsCount != null ? Number(item.reviewsCount) : null,
        totalScore:   item.totalScore   != null ? Number(item.totalScore)   : null,
        numStatus: 'pendente',
        tipo: 'sem-site',
        canal: 'pendente', // será definido após validação do número
        importadoEm: todayStr(),
      };
      if (ph) existPhones.add(ph);
      novaValFila.push(entry);
      addedSemSite++;
      return;
    }

    skipped++;
  });

  saveValData(novaValFila);
  updateBadges();
  importPreview();

  let msg = `✓ ${addedSemSite} sem site → Validação`;
  if (addedJaVistos) msg += ` · ${addedJaVistos} com site → já vistos`;
  if (skipped)    msg += ` · ${skipped} ignoradas`;
  notify(msg, addedSemSite > 0 ? '' : 'warn');
  document.getElementById('importJsonInput').value = '';
}

/* ════════════════════════════
   VALIDAÇÃO
════════════════════════════ */
function setValTab(tab) {
  valTab = tab;
  const el = document.getElementById('valTabComSite');
  if (el) el.classList.toggle('active', tab==='com-site');
}

/* ── aba de resultado de validação (pendentes / validados) ── */
let valResultTab = 'pendentes'; // 'pendentes' | 'validados'
let validadorAba = 'pendentes'; // qual aba o validador de links vai operar

function setValResultTab(tab) {
  valResultTab = tab;
  valPage = 1;
  // estilo dos botões
  const btnP = document.getElementById('valResultTabPendentes');
  const btnV = document.getElementById('valResultTabValidados');
  if (btnP && btnV) {
    if (tab === 'pendentes') {
      btnP.style.cssText = 'padding:6px 14px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-dim);color:var(--accent);font-family:\'DM Mono\',monospace;font-size:9px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px';
      btnV.style.cssText = 'padding:6px 14px;border:1px solid var(--border2);border-radius:8px;background:var(--bg);color:var(--muted);font-family:\'DM Mono\',monospace;font-size:9px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px';
    } else {
      btnV.style.cssText = 'padding:6px 14px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-dim);color:var(--accent);font-family:\'DM Mono\',monospace;font-size:9px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px';
      btnP.style.cssText = 'padding:6px 14px;border:1px solid var(--border2);border-radius:8px;background:var(--bg);color:var(--muted);font-family:\'DM Mono\',monospace;font-size:9px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px';
    }
  }
  renderValidacao();
}

function setValidadorAba(aba) {
  validadorAba = aba;
  const btn0 = document.getElementById('validadorAbaBtn0');
  const btn1 = document.getElementById('validadorAbaBtn1');
  const info = document.getElementById('validadorAbaInfo');
  if (btn0 && btn1) {
    if (aba === 'pendentes') {
      btn0.style.cssText = 'flex:1;padding:5px 8px;border:1px solid var(--accent-border);border-radius:6px;background:var(--accent-dim);color:var(--accent);font-family:\'DM Mono\',monospace;font-size:8px;cursor:pointer;transition:all 0.18s;white-space:nowrap';
      btn1.style.cssText = 'flex:1;padding:5px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--bg);color:var(--muted);font-family:\'DM Mono\',monospace;font-size:8px;cursor:pointer;transition:all 0.18s;white-space:nowrap';
    } else {
      btn1.style.cssText = 'flex:1;padding:5px 8px;border:1px solid var(--accent-border);border-radius:6px;background:var(--accent-dim);color:var(--accent);font-family:\'DM Mono\',monospace;font-size:8px;cursor:pointer;transition:all 0.18s;white-space:nowrap';
      btn0.style.cssText = 'flex:1;padding:5px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--bg);color:var(--muted);font-family:\'DM Mono\',monospace;font-size:8px;cursor:pointer;transition:all 0.18s;white-space:nowrap';
    }
  }
  if (info) {
    const abaLabel = aba === 'pendentes' ? '<strong style="color:var(--accent)">Aguardando / Inválidos</strong>' : '<strong style="color:var(--ok)">Número Validado</strong>';
    info.innerHTML = `Cole os links que achar bons. Os sites <strong style="color:var(--text2)">não colados</strong> serão removidos apenas da aba ${abaLabel}.`;
  }
  // Recalcula badge ao trocar aba
  previewValidadorLinks();
}

function renderValidacao() {
  const val = getValData();
  // Suporta tanto 'sem-site' (novo fluxo) quanto 'com-site' (legado) — todos entram na validação
  const comSite = val.filter(v => v.tipo === 'sem-site' || v.tipo === 'com-site' || !v.tipo);

  const semZap = comSite.filter(v => v.numStatus !== 'valido');
  const comZap = comSite.filter(v => v.numStatus === 'valido');

  // atualiza contadores nas abas
  const countSem = document.getElementById('valCountSemZap');
  const countCom = document.getElementById('valCountComZap');
  if (countSem) countSem.textContent = semZap.length;
  if (countCom) countCom.textContent = comZap.length;

  const countEl = document.getElementById('valCountComSite');
  if (countEl) countEl.textContent = `(${comSite.length})`;

  // chip tabs para validação — prioridade chip 2 (final 8457)
  const chips = getChips();
  const chipPriority = chips.find(c => c.nome && c.nome.includes('8457')) || chips.find(c => c.nome && c.nome.toLowerCase().includes('ativação')) || chips[1] || chips[0];
  if (!activeChipId && chips.length) activeChipId = chipPriority ? chipPriority.id : chips[0].id;

  document.getElementById('valChipTabs').innerHTML = chips.length
    ? chips.map(c => `<div class="chip-tab${activeChipId===c.id?' active':''}" onclick="setValChip('${c.id}')">${escHtml(c.nome)}</div>`).join('')
    : '<span style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--muted)">Nenhum chip configurado</span>';

  const comSiteEl = document.getElementById('valComSiteList');

  // seleciona qual grupo mostrar baseado na aba ativa
  const activeGroup = valResultTab === 'validados' ? comZap : semZap;
  const groupLabel = valResultTab === 'validados'
    ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--ok);letter-spacing:0.1em;text-transform:uppercase;padding:8px 4px 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
        ✅ Número Validado <span style="background:rgba(78,203,113,0.1);border:1px solid rgba(78,203,113,0.3);color:var(--ok);padding:1px 6px;border-radius:100px;margin-left:4px">${comZap.length}</span>
       </div>`
    : `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;padding:8px 4px 6px;border-bottom:1px solid var(--border);margin-bottom:6px">
        📋 Aguardando / Sem WhatsApp <span style="background:rgba(255,92,92,0.1);border:1px solid rgba(255,92,92,0.3);color:var(--error);padding:1px 6px;border-radius:100px;margin-left:4px">${semZap.length}</span>
       </div>`;

  if (!comSite.length) {
    comSiteEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--muted);padding:20px;text-align:center">// nenhuma empresa aguardando validação</div>';
  } else if (!activeGroup.length) {
    const emptyMsg = valResultTab === 'validados'
      ? '// nenhum número validado ainda'
      : '// nenhuma empresa pendente ou inválida';
    comSiteEl.innerHTML = `${groupLabel}<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);padding:20px;text-align:center">${emptyMsg}</div>`;
  } else {
    // Pré-calcula os domínios dos links colados para mostrar indicador por card
    const _rawLinks = document.getElementById('validadorLinksInput')?.value || '';
    const _normLink = (url) => { try { return new URL(url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return url.toLowerCase().trim(); } };
    const _linkDomains = new Set(_rawLinks.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('http')).map(_normLink));

    const renderCard = (v) => {
      const statusColor = v.numStatus==='valido'?'var(--ok)':v.numStatus==='invalido'?'var(--error)':'var(--muted)';
      const statusLabel = v.numStatus==='valido'?'✓ número válido':v.numStatus==='invalido'?'✗ sem WhatsApp':'pendente';
      const chipId = v.chipValidacaoId || activeChipId;
      const chipNome = getChipById(chipId) ? getChipById(chipId).nome : '';
      const isMantido = v.site && _linkDomains.size > 0 && _linkDomains.has(_normLink(v.site));
      const mantidoBadge = isMantido
        ? `<span style="display:inline-flex;align-items:center;gap:4px;font-family:'DM Mono',monospace;font-size:7px;padding:2px 7px;border-radius:100px;border:1px solid rgba(91,184,245,0.35);background:rgba(91,184,245,0.07);color:#5bb8f5;white-space:nowrap"><span style="width:4px;height:4px;border-radius:50%;background:#5bb8f5;display:inline-block;flex-shrink:0"></span>mantido</span>`
        : '';
      return `<div class="empresa-card" id="val-card-${v.id}">
        <div class="empresa-info">
          <div class="empresa-nome">
            ${v.googleUrl?`<a href="${escHtml(v.googleUrl)}" target="_blank" style="color:var(--text);text-decoration:none" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text)'">${escHtml(v.nome)}</a>`:escHtml(v.nome)}
          </div>
          <div class="empresa-meta">
            ${v.site?`<div class="empresa-site"><a href="${escHtml(v.site)}" target="_blank">${escHtml(v.site.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a></div>`:''}
            <div class="empresa-phone">📱
              <span id="val-phone-${v.id}" style="cursor:pointer" onclick="editValPhone('${v.id}')">${escHtml(v.whatsapp||'—')}</span>
            </div>
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:${statusColor}">${statusLabel}</span>
            ${chipNome?`<span class="q-badge ok" style="font-size:7px">📱 ${escHtml(chipNome)}</span>`:''}
            ${mantidoBadge}
          </div>
          <div class="empresa-meta" style="margin-top:4px">
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">importado em:</span>
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text2)">${v.importadoEm || '—'}</span>
          </div>
        </div>
        <div class="empresa-actions">
          ${v.numStatus==='valido'
            ?`<button class="add-btn added" onclick="aprovarParaFila('${v.id}')">→ Atribuir</button>`
            : v.numStatus==='invalido'
              ?`<button class="add-btn added" onclick="aprovarParaInsta('${v.id}')">→ Instagram</button>
                <button class="add-btn" onclick="validarNumeroUnico('${v.id}')">Validar novamente</button>`
              :`<button class="add-btn" onclick="validarNumeroUnico('${v.id}')">Validar</button>`
          }
          <button class="del-btn" onclick="removerDaValidacao('${v.id}')">✕</button>
        </div>
      </div>`;
    };

    const totalVal = activeGroup.length;
    const totalValPages = Math.max(1, Math.ceil(totalVal / VAL_PG));
    if (valPage > totalValPages) valPage = totalValPages;
    const pageCards = activeGroup.slice((valPage-1)*VAL_PG, valPage*VAL_PG);

    comSiteEl.innerHTML = groupLabel + '<div class="ext-list">' + pageCards.map(renderCard).join('') + '</div>';
    renderPagination('valPagination', valPage, totalValPages, totalVal, VAL_PG, 'goValPage', 'changeValPgSize');
  }
  renderValidadorLinks();
}

function setValChip(id) { activeChipId = id; valPage = 1; renderValidacao(); }

function editValPhone(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;
  const el = document.getElementById(`val-phone-${id}`);
  if (!el) return;
  el.outerHTML = `<input id="val-phone-edit-${id}" type="text" value="${escHtml(v.whatsapp||'')}"
    style="background:var(--bg);border:1px solid var(--accent);border-radius:5px;color:var(--text);font-family:'DM Mono',monospace;font-size:9px;padding:3px 7px;width:120px;outline:none"
    onkeydown="if(event.key==='Enter')saveValPhone('${id}');if(event.key==='Escape')renderValidacao();" onblur="saveValPhone('${id}')"/>`;
  document.getElementById(`val-phone-edit-${id}`)?.focus();
}

function saveValPhone(id) {
  const input = document.getElementById(`val-phone-edit-${id}`);
  if (!input) return;
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;
  v.whatsapp = input.value.trim();
  v.numStatus = 'pendente';
  saveValData(val); renderValidacao(); notify('✓ Número atualizado');
}

async function validarNumeroUnico(id) {
  const chip = getChipById(activeChipId);
  if (!chip) { notify('// selecione um chip primeiro','warn'); return; }
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;
  const phone = normalizePhone(v.whatsapp || '');
  if (!phone || phone.length < 10) { notify('// número inválido','err'); return; }
  const numero = phone.startsWith('55') ? phone : '55' + phone;

  const card = document.getElementById(`val-card-${id}`);
  if (card) card.style.opacity = '0.6';
  try {
    const res = await fetch(`${chip.url}/chat/whatsappNumbers/${chip.instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': chip.key },
      body: JSON.stringify({ numbers: [numero] })
    });
    const data = await res.json();
    const result = Array.isArray(data) ? data[0] : data;
    v.numStatus = result?.exists ? 'valido' : 'invalido';
    saveValData(val); renderValidacao();
    notify(result?.exists ? `✓ ${v.nome} — número válido` : `✗ ${v.nome} — sem WhatsApp`);
  } catch(e) {
    notify('// erro ao validar número','err');
    if (card) card.style.opacity = '1';
  }
}

async function validarTodosNumeros() {
  const chip = getChipById(activeChipId);
  if (!chip) { notify('// selecione um chip primeiro','warn'); return; }
  const val = getValData();
  const pendentes = val.filter(v => (v.tipo==='sem-site' || v.tipo==='com-site' || !v.tipo) && v.numStatus==='pendente');
  if (!pendentes.length) { notify('// nenhum número pendente','warn'); return; }

  document.getElementById('valSpinner').style.display = 'block';
  let validados = 0, invalidos = 0;

  for (let i = 0; i < pendentes.length; i += 10) {
    const lote = pendentes.slice(i, i + 10);
    const numbers = lote.map(v => {
      const ph = normalizePhone(v.whatsapp || '');
      return ph.startsWith('55') ? ph : '55' + ph;
    }).filter(n => n.length >= 12);
    if (!numbers.length) continue;
    try {
      const res = await fetch(`${chip.url}/chat/whatsappNumbers/${chip.instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': chip.key },
        body: JSON.stringify({ numbers })
      });
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      lote.forEach(v => {
        const ph = normalizePhone(v.whatsapp || '');
        const numero = ph.startsWith('55') ? ph : '55' + ph;
        const found = results.find(r => r.jid && r.jid.includes(numero));
        v.numStatus = found?.exists ? 'valido' : 'invalido';
        if (v.numStatus === 'valido') validados++; else invalidos++;
      });
    } catch(e) { console.error(e); }
    await new Promise(r => setTimeout(r, 800));
  }

  const updated = getValData().map(v => {
    const p = pendentes.find(p => p.id === v.id);
    return p || v;
  });
  saveValData(updated);
  document.getElementById('valSpinner').style.display = 'none';
  renderValidacao(); updateBadges();
  notify(`✓ ${validados} válidos · ${invalidos} sem WhatsApp`);
}

function aprovarSemSiteParaZap(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;
  if (v.numStatus !== 'valido') { notify('// valide o número primeiro','warn'); return; }
  const phone = normalizePhone(v.whatsapp || '');
  if (!phone || phone.length < 10) { notify('// número inválido para WhatsApp','err'); return; }
  markLeadWhatsappValidatedForQueue(v);

  const data = ensureWeekData();
  const day = v.diaDestino || todayStr();
  if (!data.days[day]) data.days[day] = [];

  const diasSemana = currentWeekDays();
  let diaDestino = day;
  let idx = diasSemana.indexOf(day);
  while ((data.days[diaDestino]||[]).length >= getDailyLimit()) {
    idx++;
    if (idx >= diasSemana.length) { notify('// semana cheia','warn'); return; }
    diaDestino = diasSemana[idx];
    if (!data.days[diaDestino]) data.days[diaDestino] = [];
  }

  data.days[diaDestino].push({
    id: v.id, nome: v.nome, site: '', whatsapp: v.whatsapp,
    instagram: v.instagram, googleUrl: v.googleUrl,
    numStatus: 'valido', whatsappValidationStatus: 'valid',
    status: 'Não enviada', criadoEm: todayStr(), semSite: true,
  });
  saveWeekData(data);
  saveValData(getValData().filter(x => x.id !== id));
  renderValidacao(); updateBadges();
  notify(`✓ ${v.nome} → Fila WhatsApp (${dayLabel(diaDestino)})`);
}

function removerDaValidacao(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (v && v.site) addExcludedDomains([v.site]);
  saveValData(val.filter(x => x.id !== id));
  renderValidacao(); updateBadges();
  if (v && v.site) notify('\u2715 removido · ' + (extractDomain(v.site)||v.site) + ' → sites já vistos');
}

/* Passa lead para o dia seguinte (antes de entrar na fila) */
function passarProximoDia(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;
  const proxDia = nextWeekday(v.diaDestino || todayStr());
  v.diaDestino = proxDia;
  saveValData(val);
  renderValidacao();
  notify(`→ ${v.nome} movido para ${dayLabel(proxDia)}`);
}

