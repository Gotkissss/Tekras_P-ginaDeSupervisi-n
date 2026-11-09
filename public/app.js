// Panel de avance — lógica del cliente (sin dependencias).
(() => {
  const $ = (s) => document.querySelector(s);
  const NO_TAG = 'Sin área';
  const state = { data: null, active: new Set(), month: null, loading: false };

  try {
    const saved = JSON.parse(localStorage.getItem('tk-filter') || '[]');
    if (Array.isArray(saved)) saved.forEach((t) => state.active.add(t));
  } catch {}

  // Colores de Notion adaptados a fondo oscuro
  const NOTION = {
    default: '#b5b8c2', gray: '#a4a8b2', brown: '#c49c7d', orange: '#e59d5e', yellow: '#dbbb5f',
    green: '#78c493', blue: '#70a9e4', purple: '#b48de4', pink: '#e189b8', red: '#e77a7a',
  };

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 6v7"/><path d="M12 18h.01"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="6"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5-.5-3 0-5.5 1-8z"/></svg>',
  };

  // ---------- Fechas (cadenas YYYY-MM-DD, aritmética en UTC) ----------
  const D = (s) => new Date(s + 'T12:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((D(a) - D(b)) / 86400000);
  const fmt = (s, o) => new Intl.DateTimeFormat('es', { timeZone: 'UTC', ...o }).format(D(s));
  const dow = (s) => (D(s).getUTCDay() + 6) % 7; // 0 = lunes
  const localDate = (ts) => new Intl.DateTimeFormat('en-CA', {
    timeZone: state.data.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  // ---------- Modelo ----------
  const due = (t) => t.endDate || t.date;
  const tagsOf = (t) => (t.tags.length ? t.tags : [NO_TAG]);
  function status(t, today) {
    if (t.done) return 'done';
    if (due(t) < today) return 'late';
    if (t.date <= today) return 'today';
    return 'todo';
  }
  function onTime(t) { return t.done && localDate(t.lastEdited) <= due(t); }

  function filtered() {
    const all = state.data.tasks;
    if (!state.active.size) return all;
    return all.filter((t) => tagsOf(t).some((g) => state.active.has(g)));
  }

  function tagVars(name) {
    const c = NOTION[state.data.tagColors?.[name]] || NOTION.default;
    return `--tag:${c};--tag-bg:${c}24;--tag-line:${c}55`;
  }
  const tagChip = (name) => `<span class="tag" style="${tagVars(name)}">${esc(name)}</span>`;
  const stBox = (s) => `<span class="st ${s}">${s === 'done' ? ICON.check : s === 'late' ? ICON.alert : ''}</span>`;

  // ---------- Carga ----------
  async function load(force = false) {
    if (state.loading) return;
    state.loading = true;
    $('#refresh').classList.add('spin');
    try {
      const res = await fetch('/api/tasks' + (force ? '?refresh=1' : ''), { cache: 'no-store' });
      if (res.status === 401) { location.href = '/login'; return; }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error');
      state.data = body;
      state.presence = body.presence;
      if (!state.month) state.month = body.today.slice(0, 7);
      // descarta filtros de etiquetas que ya no existen
      const known = new Set(body.tasks.flatMap(tagsOf));
      for (const t of [...state.active]) if (!known.has(t)) state.active.delete(t);
      render();
    } catch (e) {
      const b = $('#banner');
      b.hidden = false;
      b.textContent = `No se pudo leer el plan: ${e.message}`;
      $('#sync-text').textContent = 'Sin conexión';
      $('#sync .dot').className = 'dot warn';
    } finally {
      state.loading = false;
      $('#refresh').classList.remove('spin');
    }
  }

  function render() {
    const d = state.data;
    const today = d.today;
    const tasks = filtered();

    renderHeader(d, tasks, today);
    renderPresence();
    renderKpis(tasks, today);
    renderFilters(d.tasks);
    renderToday(tasks, today);
    renderLate(tasks, today);
    renderRhythm(tasks, today);
    renderAreas(tasks, today);
    renderCalendar(tasks, today);
    $('#logout').hidden = !d.authEnabled;
    $('#role-pill').hidden = !(d.authEnabled && d.role === 'owner');
  }

  // ---------- Conexión / jornada ----------
  const TG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.5-1.4zM8.6 14l9.6-6.1c.5-.3.9-.1.5.2l-8.2 7.4-.3 3.4L8.6 14z"/></svg>';
  const timeF = () => new Intl.DateTimeFormat('es-HN', { timeZone: state.data.timezone, hour: 'numeric', minute: '2-digit' });
  function dur(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  }
  const sessionMs = (s, now) => (s.end ? Date.parse(s.end) : s.unclosed ? Date.parse(s.start) : now) - Date.parse(s.start);
  function relDay(day, today) {
    const n = diffDays(today, day);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Ayer';
    return fmt(day, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderPresence() {
    const p = state.presence, d = state.data;
    if (!p || !d) return;
    const isOwner = d.role === 'owner';
    const name = esc(d.owner);
    const today = d.today;
    const tf = timeF();
    const now = Date.now();
    $('#presence').hidden = false;

    const todays = p.sessions.filter((s) => localDate(s.start) === today);
    let title, sub, dot = '';
    if (p.online) {
      dot = 'on';
      title = isOwner ? 'Estás conectado' : `${name} está conectado`;
      sub = `Desde las <b>${tf.format(new Date(p.since))}</b> · ${dur(now - Date.parse(p.since))} de jornada`;
    } else if (todays.length) {
      const total = todays.reduce((a, s) => a + sessionMs(s, now), 0);
      const last = todays.at(-1);
      title = isOwner ? 'Jornada terminada' : `${name} no está conectado`;
      sub = `Hoy: <b>${tf.format(new Date(todays[0].start))}</b> a <b>${last.end ? tf.format(new Date(last.end)) : '¿?'}</b> · ${dur(total)} en total`;
    } else {
      title = isOwner ? 'Aún no marcas tu entrada' : `${name} aún no se ha conectado hoy`;
      const lastS = p.sessions.at(-1);
      sub = lastS
        ? `Última jornada: ${relDay(localDate(lastS.start), today).toLowerCase()}, ${tf.format(new Date(lastS.start))}${lastS.end ? ` – ${tf.format(new Date(lastS.end))}` : ' (sin salida marcada)'}`
        : 'Todavía no hay jornadas registradas.';
    }
    $('#pr-dot').className = 'pr-dot ' + dot;
    $('#pr-title').innerHTML = title;
    $('#pr-sub').innerHTML = sub;

    // Semana actual (lunes a domingo)
    const mon = addDays(today, -dow(today));
    let weekTotal = 0;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(mon, i);
      const list = p.sessions.filter((s) => localDate(s.start) === day);
      const total = list.reduce((a, s) => a + sessionMs(s, now), 0);
      weekTotal += total;
      const live = list.some((s) => !s.end && !s.unclosed);
      const unclosed = list.some((s) => s.unclosed);
      const cls = ['pr-day', day === today && 'today', day > today && 'future', live && 'live',
        !list.length && 'none', !list.length && day < today && dow(day) < 5 && 'missed'].filter(Boolean).join(' ');
      let h, t = '';
      if (list.length) {
        const first = list[0], last = list.at(-1);
        const end = last.end ? tf.format(new Date(last.end)) : last.unclosed ? '¿?' : 'ahora';
        h = `${tf.format(new Date(first.start))} – ${end}`;
        t = unclosed ? '<span class="warn">Sin salida marcada</span>' : `${dur(total)}${live ? ' · en curso' : ''}`;
      } else {
        h = day > today ? '—' : 'Sin conexión';
      }
      const dLabel = fmt(day, { weekday: 'short', day: 'numeric' }).replace('.', '');
      html += `<div class="${cls}"><div class="d">${dLabel.charAt(0).toUpperCase() + dLabel.slice(1)}</div><div class="h">${h}</div><div class="t">${t}</div></div>`;
    }
    $('#pr-week').innerHTML = html;
    $('#pr-week-total').textContent = weekTotal ? `Total: ${dur(weekTotal)}` : '';

    // Botón de jornada (solo tú)
    const clock = $('#clock-btn');
    clock.hidden = !isOwner;
    if (isOwner && !clock.disabled) {
      clock.className = 'btn clock ' + (p.online ? 'stop' : 'start');
      clock.textContent = p.online ? 'Terminar jornada' : 'Iniciar jornada';
    }

    // Botón de Telegram (tú y tu jefe)
    const tg = p.telegram || {};
    const tgBtn = $('#tg-btn');
    tgBtn.hidden = !tg.available;
    if (tg.available && !state.tgWaiting) {
      tgBtn.className = 'btn tg' + (tg.linked ? ' linked' : '');
      tgBtn.innerHTML = `${TG_ICON}<span>${tg.linked ? 'Avisos en Telegram activos' : 'Recibir avisos en Telegram'}</span>`;
      tgBtn.title = tg.linked
        ? `Conectado${tg.name ? ` como ${tg.name}` : ''}. Pulsa para desactivar.`
        : isOwner ? 'Te avisa cuando tu jefe abre el panel' : `Te avisa cuando ${d.owner} inicia su jornada y cuando completa una tarea`;
    }

    // Pie solo para ti: visitas del jefe + estado de Telegram
    const foot = $('#pr-foot');
    foot.hidden = !isOwner;
    if (isOwner) {
      const v = p.visits || [];
      const visits = v.slice(0, 5).map((x) => `${relDay(localDate(x.at), today)} ${tf.format(new Date(x.at))}`).join(' · ');
      let tgTxt;
      if (!tg.configured) tgTxt = 'Telegram: falta el token del bot (TELEGRAM_BOT_TOKEN).';
      else if (!tg.available) tgTxt = `<span class="tg-err">⚠ El bot no pudo iniciar: ${esc(tg.error || 'error desconocido')}. Revisa TELEGRAM_BOT_TOKEN.</span>`;
      else if (!tg.linked) tgTxt = 'Telegram aún no está vinculado en este servidor: pulsa «Recibir avisos en Telegram».';
      else tgTxt = `Recibes un aviso en Telegram con cada visita. <button class="linkbtn" id="tg-test" type="button">Enviar aviso de prueba</button>`;
      if (tg.available && tg.error) tgTxt += `<br><span class="tg-err">⚠ Último problema del bot: ${esc(tg.error)}</span>`;
      foot.innerHTML = `👀 <b>Visitas de tu jefe:</b> ${v.length ? visits : 'todavía no ha abierto el panel.'}<br><span>${tgTxt}</span><br><span class="muted-s">Esto solo lo ves tú.</span>`;
    }
  }

  async function postJSON(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (res.status === 401) { location.href = '/login'; throw new Error('auth'); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Error');
    return j;
  }

  async function pollPresence() {
    if (!state.data) return;
    try {
      const res = await fetch('/api/presence', { cache: 'no-store' });
      if (res.status === 401) { location.href = '/login'; return; }
      if (res.ok) { state.presence = await res.json(); renderPresence(); }
    } catch {}
  }

  $('#pr-foot').addEventListener('click', async (e) => {
    const b = e.target.closest('#tg-test');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Enviando…';
    try {
      await postJSON('/api/telegram/test');
      b.textContent = '✓ Enviado, revisa Telegram';
    } catch (err) {
      if (err.message !== 'auth') { b.textContent = 'No se pudo enviar'; alert(`No se pudo enviar el aviso: ${err.message}`); }
    }
    setTimeout(pollPresence, 4000);
  });

  $('#clock-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const stopping = state.presence?.online;
    if (stopping && !confirm('¿Terminar tu jornada ahora?')) return;
    btn.disabled = true;
    try {
      state.presence = await postJSON('/api/presence', { action: stopping ? 'stop' : 'start' });
    } catch (err) { if (err.message !== 'auth') alert(err.message); }
    btn.disabled = false;
    renderPresence();
  });

  $('#tg-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const tg = state.presence?.telegram || {};
    if (tg.linked) {
      if (!confirm('¿Desactivar los avisos de Telegram?')) return;
      try { state.presence = await postJSON('/api/telegram/unlink'); renderPresence(); } catch (err) { if (err.message !== 'auth') alert(err.message); }
      return;
    }
    try {
      const { url, pin, bot } = await postJSON('/api/telegram/link');
      const box = $('#tg-pin');
      box.hidden = false;
      box.innerHTML = `
        <ol>
          <li>Abre el bot <a href="${esc(url)}" target="_blank" rel="noopener">@${esc(bot)}</a> en Telegram (teléfono o computadora).</li>
          <li>Envíale este código como mensaje.</li>
        </ol>
        <div><div class="code">${pin.slice(0, 3)} ${pin.slice(3)}</div><div class="small">Vence en 15 minutos</div></div>`;
      state.tgWaiting = true;
      btn.disabled = true;
      btn.innerHTML = `${TG_ICON}<span>Esperando el código…</span>`;
      const until = Date.now() + 15 * 60000;
      const wait = async () => {
        await pollPresence();
        const linked = state.presence?.telegram?.linked;
        if (linked || Date.now() > until) {
          state.tgWaiting = false; btn.disabled = false;
          box.innerHTML = linked ? '<ol><li><b>¡Listo! Telegram quedó vinculado.</b> Los avisos te llegarán en el teléfono y en la computadora.</li></ol>' : '';
          if (!linked) box.hidden = true; else setTimeout(() => { box.hidden = true; }, 8000);
          renderPresence();
          return;
        }
        setTimeout(wait, 3000);
      };
      setTimeout(wait, 3000);
    } catch (err) {
      if (err.message !== 'auth') alert(err.message);
    }
  });

  function renderHeader(d, tasks, today) {
    $('#eyebrow').textContent = `Plan de trabajo · ${fmt(today, { month: 'long', year: 'numeric' })}`;
    $('#title').innerHTML = `Avance de ${esc(d.owner)}`;
    const todays = tasks.filter((t) => t.date <= today && due(t) >= today);
    const todayDone = todays.filter((t) => t.done).length;
    const late = tasks.filter((t) => status(t, today) === 'late').length;
    const dayName = fmt(today, { weekday: 'long', day: 'numeric', month: 'long' });
    let lede = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}. `;
    lede += todays.length
      ? `${todayDone} de ${plural(todays.length, 'tarea', 'tareas')} de hoy completadas`
      : 'No hay tareas planificadas para hoy';
    lede += late ? `, y ${plural(late, 'tarea atrasada', 'tareas atrasadas')} de días anteriores.` : '. Sin pendientes atrasados.';
    $('#lede').textContent = lede;

    const b = $('#banner');
    if (d.warning) {
      b.hidden = false;
      b.textContent = `Notion respondió con un error; se muestran los últimos datos válidos. (${d.warning})`;
    } else if (d.source === 'demo') {
      b.hidden = false;
      b.textContent = 'Modo demo: estos son datos de ejemplo. Configura NOTION_TOKEN y NOTION_DATABASE_ID para ver el plan real.';
    } else b.hidden = true;

    $('#foot-src').textContent = d.source === 'demo' ? 'fuente: demo' : `fuente: Notion · ${d.databaseTitle}`;
    updateSync();
  }

  function updateSync() {
    const d = state.data;
    if (!d) return;
    const mins = Math.max(0, Math.round((Date.now() - new Date(d.syncedAt)) / 60000));
    const ago = mins < 1 ? 'ahora' : mins < 60 ? `hace ${mins} min` : `hace ${Math.round(mins / 60)} h`;
    const src = d.source === 'demo' ? 'Demo' : 'Notion';
    $('#sync-text').innerHTML = `${src}<span class="txt-long"> · sincronizado ${ago}</span>`;
    $('#sync .dot').className = 'dot' + (d.source === 'demo' ? ' demo' : d.warning ? ' warn' : '');
  }

  function streakOf(tasks, today) {
    const byDay = new Map();
    for (const t of tasks) {
      if (!byDay.has(t.date)) byDay.set(t.date, []);
      byDay.get(t.date).push(t);
    }
    const first = tasks.reduce((m, t) => (t.date < m ? t.date : m), today);
    let streak = 0;
    for (let day = today; day >= first; day = addDays(day, -1)) {
      const list = byDay.get(day);
      if (!list) continue;
      const ok = list.every((t) => t.done);
      if (day === today) { if (ok) streak++; continue; }
      if (!ok) break;
      streak++;
    }
    return streak;
  }

  function renderKpis(tasks, today) {
    const dueT = tasks.filter((t) => due(t) <= today);
    const doneT = dueT.filter((t) => t.done);
    const pct = dueT.length ? Math.round((doneT.length / dueT.length) * 100) : 100;
    const onTimePct = doneT.length ? Math.round((doneT.filter(onTime).length / doneT.length) * 100) : 100;

    const late = tasks.filter((t) => status(t, today) === 'late').sort((a, b) => due(a).localeCompare(due(b)));
    const oldest = late.length ? diffDays(today, due(late[0])) : 0;

    const mon = addDays(today, -dow(today));
    const sun = addDays(mon, 6);
    const wk = tasks.filter((t) => t.date >= mon && t.date <= sun);
    const wkDone = wk.filter((t) => t.done).length;
    const wkPct = wk.length ? (wkDone / wk.length) * 100 : 0;

    const streak = streakOf(tasks, today);

    $('#kpis').innerHTML = `
      <article class="card kpi reveal">
        <div class="label">${ICON.target} Cumplimiento</div>
        <div class="value">${pct}<small>%</small></div>
        <div class="meter"><i style="width:${pct}%"></i></div>
        <div class="detail"><b>${doneT.length}</b> de ${dueT.length} tareas programadas hasta hoy${doneT.length ? ` · ≈${onTimePct}% a tiempo` : ''}</div>
      </article>
      <article class="card kpi reveal ${late.length ? 'is-bad' : 'is-good'}" style="animation-delay:.05s">
        <div class="label">${late.length ? ICON.alert : ICON.check} Atrasadas</div>
        <div class="value">${late.length}</div>
        <div class="detail">${late.length
          ? `La más antigua lleva <b>${plural(oldest, 'día', 'días')}</b> sin completarse`
          : 'Nada pendiente de días anteriores'}</div>
      </article>
      <article class="card kpi reveal" style="animation-delay:.1s">
        <div class="label">${ICON.week} Esta semana</div>
        <div class="value">${wkDone}<small>/${wk.length}</small></div>
        <div class="meter"><i style="width:${wkPct}%"></i></div>
        <div class="detail">${fmt(mon, { day: 'numeric', month: 'short' })} – ${fmt(sun, { day: 'numeric', month: 'short' })}</div>
      </article>
      <article class="card kpi reveal ${streak >= 3 ? 'is-good' : ''}" style="animation-delay:.15s">
        <div class="label">${ICON.flame} Racha</div>
        <div class="value">${streak}<small> ${streak === 1 ? 'día' : 'días'}</small></div>
        <div class="detail">Días seguidos con todo lo planificado completo</div>
      </article>`;
  }

  function renderFilters(all) {
    const counts = new Map();
    for (const t of all) for (const g of tagsOf(t)) counts.set(g, (counts.get(g) || 0) + 1);
    const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const box = $('#filters');
    box.innerHTML = `<span class="lbl">Área</span>
      <button class="chip" type="button" data-tag="" aria-pressed="${!state.active.size}">Todas</button>
      ${tags.map(([g, n]) => `<button class="chip" type="button" data-tag="${esc(g)}" aria-pressed="${state.active.has(g)}" style="${tagVars(g)}">
        <i class="sw"></i>${esc(g)} <span class="n">${n}</span></button>`).join('')}`;
  }

  function taskRow(t, today, whenText) {
    const s = status(t, today);
    return `<li class="task ${s}">
      ${stBox(s)}
      <div class="t">
        <div class="name" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="meta">${tagsOf(t).map(tagChip).join('')}</div>
      </div>
      <span class="when">${whenText || ''}</span>
    </li>`;
  }

  function renderToday(tasks, today) {
    const list = tasks.filter((t) => t.date <= today && due(t) >= today)
      .sort((a, b) => Number(a.done) - Number(b.done));
    const done = list.filter((t) => t.done).length;
    $('#today-hint').textContent = list.length ? `${done}/${list.length} completadas` : '';
    $('#today-list').innerHTML = list.length
      ? list.map((t) => taskRow(t, today, t.done ? 'hecha' : 'pendiente')).join('')
      : '<li class="empty">No hay tareas planificadas para hoy.</li>';
  }

  function renderLate(tasks, today) {
    const list = tasks.filter((t) => status(t, today) === 'late').sort((a, b) => due(a).localeCompare(due(b)));
    $('#late-hint').textContent = list.length ? plural(list.length, 'tarea', 'tareas') : '';
    const MAX = 7;
    $('#late-list').innerHTML = list.length
      ? list.slice(0, MAX).map((t) => {
          const n = diffDays(today, due(t));
          return taskRow(t, today, `${fmt(due(t), { day: 'numeric', month: 'short' })} · hace ${n} d`);
        }).join('') + (list.length > MAX ? `<li class="empty">y <b>${list.length - MAX} más</b> en el calendario.</li>` : '')
      : '<li class="empty"><b>Todo al día.</b> No hay tareas atrasadas.</li>';
  }

  function renderRhythm(tasks, today) {
    const narrow = innerWidth < 640;
    const N = narrow ? 14 : 28;
    // Ventana de N días que termina hoy; si el plan empezó hace menos,
    // arranca en la primera tarea y completa con los días que vienen.
    const firstDay = tasks.reduce((m, t) => (t.date < m ? t.date : m), today);
    const back = addDays(today, -(N - 1));
    const start = firstDay > back ? firstDay : back;
    const days = Array.from({ length: N }, (_, i) => addDays(start, i));
    const rows = days.map((day) => {
      const list = tasks.filter((t) => t.date === day);
      const done = list.filter((t) => t.done).length;
      return { day, done, open: list.length - done, total: list.length };
    });
    const maxV = Math.max(3, ...rows.map((r) => r.total));
    const W = narrow ? 420 : 1120, H = narrow ? 200 : 220, L = 26, R = 4, T = 8, B = 26;
    const iw = W - L - R, ih = H - T - B;
    const step = iw / N;
    const bw = Math.min(16, step - 10);
    const y = (v) => T + ih - (v / maxV) * ih;
    const ticks = maxV <= 4 ? Array.from({ length: maxV + 1 }, (_, i) => i) : [0, Math.round(maxV / 2), maxV];

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="rgba(201,80,94,.35)"/><rect width="2" height="4" fill="#c9505e"/></pattern></defs>`;
    for (const v of ticks) {
      svg += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="axis-label" x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`;
    }
    rows.forEach((r, i) => {
      const cx = L + step * i + step / 2;
      const x = cx - bw / 2;
      const isToday = r.day === today;
      const isFuture = r.day > today;
      let top = y(0);
      svg += `<g class="bar-col">`;
      if (r.done) {
        const h = y(0) - y(r.done);
        svg += `<rect x="${x}" y="${top - h}" width="${bw}" height="${h}" rx="3" fill="#7fd0a2"/>`;
        top -= h + 2;
      }
      if (r.open) {
        const h = Math.max(2, y(0) - y(r.open) - (r.done ? 2 : 0));
        svg += isToday || isFuture
          ? `<rect x="${x + 1}" y="${top - h + 1}" width="${bw - 2}" height="${h - 2}" rx="3" fill="${isToday ? 'rgba(232,192,122,.12)' : 'none'}" stroke="${isToday ? '#e8c07a' : '#6b7080'}" stroke-width="2"${isFuture ? ' stroke-dasharray="3 3"' : ''}/>`
          : `<rect x="${x}" y="${top - h}" width="${bw}" height="${h}" rx="3" fill="url(#hatch)"/>`;
      }
      svg += `</g>`;
      const label = fmt(r.day, { weekday: 'short', day: 'numeric', month: 'short' });
      const sub = !r.total ? 'Sin tareas planificadas'
        : isFuture ? `${r.total} ${r.total === 1 ? 'tarea planificada' : 'tareas planificadas'}`
        : `${r.done} de ${r.total} completadas${r.open ? (isToday ? ` · ${r.open} pendientes` : ` · ${r.open} sin completar`) : ''}`;
      svg += `<rect class="bar-hit" x="${L + step * i}" y="${T}" width="${step}" height="${ih}" data-tip-k="${esc(label)}" data-tip="${esc(sub)}"/>`;
      const ti = days.indexOf(today);
      if (isToday || (ti >= 0 ? Math.abs(i - ti) % 4 === 0 && Math.abs(i - ti) > 1 : i % 4 === 0)) {
        svg += `<text class="axis-label ${isToday ? 'today' : ''}" x="${cx}" y="${H - 8}" text-anchor="middle">${isToday ? 'hoy' : fmt(r.day, { day: 'numeric', month: 'short' }).replace('.', '')}</text>`;
      }
    });
    svg += '</svg>';
    $('#rhythm').innerHTML = svg;
  }

  function renderAreas(tasks, today) {
    const groups = new Map();
    for (const t of tasks) for (const g of tagsOf(t)) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(t);
    }
    const rows = [...groups.entries()].map(([g, list]) => {
      const dueL = list.filter((t) => due(t) <= today);
      const done = list.filter((t) => t.done).length;
      const late = list.filter((t) => status(t, today) === 'late').length;
      const upcoming = list.filter((t) => t.date > today && !t.done).length;
      const dueDone = dueL.filter((t) => t.done).length;
      const start = list.reduce((m, t) => (t.date < m ? t.date : m), list[0].date);
      return { g, total: list.length, done, late, upcoming, dueN: dueL.length, dueDone, start };
    }).sort((a, b) => (a.start === b.start ? b.total - a.total : a.start.localeCompare(b.start)));

    $('#areas').innerHTML = rows.length ? rows.map((r) => {
      const pctDue = r.dueN ? Math.round((r.dueDone / r.dueN) * 100) : null;
      const pctHtml = pctDue === null
        ? `<span class="area-pct soon">Empieza el ${fmt(r.start, { day: 'numeric', month: 'short' }).replace('.', '')}</span>`
        : `<span class="area-pct" data-tip-k="${esc(r.g)}" data-tip="${r.dueDone} de ${r.dueN} tareas programadas hasta hoy">${pctDue}<small>%</small></span>`;
      return `<div class="area" style="${tagVars(r.g)}">
        <div class="area-top"><span class="area-name">${esc(r.g)}</span>${pctHtml}</div>
        <div class="area-bar" data-tip-k="${esc(r.g)}" data-tip="${r.done} hechas · ${r.late} atrasadas · ${r.upcoming} por venir (de ${r.total} en el plan)">
          <i style="width:${(r.done / r.total) * 100}%"></i>${r.late ? `<i class="miss" style="width:${(r.late / r.total) * 100}%"></i>` : ''}
        </div>
        <div class="area-sub"><span>${r.done} de ${r.total} hechas</span>${r.late ? `<span class="late-n">${r.late} ${r.late === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}<span class="muted">${r.upcoming} por venir</span></div>
      </div>`;
    }).join('') : '<p class="empty">Sin tareas para este filtro.</p>';
  }

  function evChip(t, today) {
    const s = status(t, today);
    const icon = s === 'done' ? ICON.check : s === 'late' ? ICON.alert : ICON.dot;
    const cls = s === 'today' ? 'todo' : s;
    const label = { done: 'Completada', late: 'Atrasada', today: 'Pendiente (hoy)', todo: 'Planificada' }[s];
    const tag = tagsOf(t)[0];
    return `<div class="ev ${cls}" style="${tagVars(tag)}" data-tip-k="${esc(tagsOf(t).join(' · '))} · ${label}" data-tip="${esc(t.title)}">${icon}<span class="tx">${esc(t.title)}</span></div>`;
  }

  function renderCalendar(tasks, today) {
    const [yy, mm] = state.month.split('-').map(Number);
    const first = `${state.month}-01`;
    const last = iso(new Date(Date.UTC(yy, mm, 0, 12)));
    const start = addDays(first, -dow(first));
    const end = addDays(last, 6 - dow(last));
    const mt = fmt(first, { month: 'long', year: 'numeric' });
    $('#cal-title').textContent = mt.charAt(0).toUpperCase() + mt.slice(1);

    const byDay = new Map();
    for (const t of tasks) {
      if (!byDay.has(t.date)) byDay.set(t.date, []);
      byDay.get(t.date).push(t);
    }

    const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let html = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('');
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const list = byDay.get(day) || [];
      const out = day.slice(0, 7) !== state.month;
      const cls = ['cal-day', out && 'out', day === today && 'is-today', dow(day) >= 5 && 'weekend'].filter(Boolean).join(' ');
      const MAX = 4;
      html += `<div class="${cls}"><div class="num"><span>${Number(day.slice(8))}</span></div>
        ${list.slice(0, MAX).map((t) => evChip(t, today)).join('')}
        ${list.length > MAX ? `<div class="ev more" data-tip-k="${esc(fmt(day, { weekday: 'long', day: 'numeric' }))}" data-tip="${esc(list.slice(MAX).map((t) => t.title).join(' · '))}">+${list.length - MAX} más</div>` : ''}
      </div>`;
    }
    $('#cal-grid').innerHTML = html;

    // Agenda (móvil)
    let ag = '';
    for (let day = first; day <= last; day = addDays(day, 1)) {
      const list = byDay.get(day);
      if (!list) continue;
      ag += `<div class="agenda-day ${day === today ? 'is-today' : ''}"><h3>${fmt(day, { weekday: 'long', day: 'numeric' })}${day === today ? ' · hoy' : ''}</h3>
        <ul class="tasks">${list.map((t) => taskRow(t, today, '')).join('')}</ul></div>`;
    }
    $('#agenda').innerHTML = ag || '<p class="empty">Sin tareas este mes.</p>';
  }

  // ---------- Eventos ----------
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const tag = b.dataset.tag;
    if (!tag) state.active.clear();
    else if (state.active.has(tag)) state.active.delete(tag);
    else state.active.add(tag);
    try { localStorage.setItem('tk-filter', JSON.stringify([...state.active])); } catch {}
    render();
  });

  const shiftMonth = (n) => {
    const [y, m] = state.month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    state.month = d.toISOString().slice(0, 7);
    renderCalendar(filtered(), state.data.today);
  };
  $('#cal-prev').addEventListener('click', () => shiftMonth(-1));
  $('#cal-next').addEventListener('click', () => shiftMonth(1));
  $('#cal-today').addEventListener('click', () => { state.month = state.data.today.slice(0, 7); renderCalendar(filtered(), state.data.today); });
  $('#refresh').addEventListener('click', () => load(true));
  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (state.data) renderRhythm(filtered(), state.data.today); }, 150);
  });

  // Tooltip
  const tip = $('#tip');
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.classList.remove('show'); return; }
    tip.innerHTML = `${el.dataset.tipK ? `<span class="k">${esc(el.dataset.tipK)}</span>` : ''}${esc(el.dataset.tip)}`;
    tip.classList.add('show');
  });
  document.addEventListener('mousemove', (e) => {
    if (!tip.classList.contains('show')) return;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  document.addEventListener('mouseleave', () => tip.classList.remove('show'));

  load();
  setInterval(updateSync, 30000);
  setInterval(() => { if (!document.hidden) pollPresence(); }, 30000);
  setInterval(() => { if (!document.hidden) load(); }, 5 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.data && Date.now() - new Date(state.data.syncedAt) > 120000) load(); });
})();
