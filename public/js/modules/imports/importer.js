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

