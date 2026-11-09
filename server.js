// Panel de avance — servidor HTTP sin dependencias (Node >= 18).
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFromNotion, createTask } from './lib/notion.js';
import { loadDemo } from './lib/demo.js';
import { createStore } from './lib/store.js';
import { createTelegram } from './lib/telegram.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

// --- .env local (en Railway las variables vienen del panel) ---
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const cfg = {
  port: Number(env.PORT) || 3000,
  token: env.NOTION_TOKEN,
  databaseId: env.NOTION_DATABASE_ID,
  demo: env.DEMO === '1' || env.DEMO === 'true' || !env.NOTION_TOKEN,
  accessKey: env.ACCESS_KEY || '',   // clave del jefe (solo lectura)
  ownerKey: env.OWNER_KEY || '',     // tu clave (marca jornada, ve visitas)
  secret: env.SESSION_SECRET || crypto.createHash('sha256').update('tekras:' + (env.ACCESS_KEY || 'dev') + (env.OWNER_KEY || '')).digest('hex'),
  owner: env.OWNER_NAME || 'Diego',
  timezone: env.TIMEZONE || 'America/Tegucigalpa',
  propTitle: env.PROP_TITLE, propDate: env.PROP_DATE, propDone: env.PROP_DONE, propTags: env.PROP_TAGS,
  doneValues: list(env.DONE_VALUES || 'Done,Listo,Hecho,Completado,Terminado').map((s) => s.toLowerCase()),
  includeTags: list(env.INCLUDE_TAGS),
  excludeTags: list(env.EXCLUDE_TAGS),
  historyDays: Number(env.HISTORY_DAYS) || 120,
  startDate: /^\d{4}-\d{2}-\d{2}$/.test(env.START_DATE || '') ? env.START_DATE : null,
  cacheMs: (Number(env.CACHE_SECONDS) || 60) * 1000,
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  visitGapMs: (Number(env.VISIT_GAP_MINUTES) || 30) * 60000,
  // TELEGRAM_DISABLED=1 apaga el bot (útil en local mientras Railway lo usa).
  telegramToken: env.TELEGRAM_DISABLED === '1' ? '' : env.TELEGRAM_BOT_TOKEN || '',
  telegramChat: env.TELEGRAM_CHAT_ID || '',
};
const authEnabled = !!(cfg.accessKey || cfg.ownerKey);

if (!authEnabled) console.warn('⚠  Sin ACCESS_KEY ni OWNER_KEY: el panel queda abierto. Defínelos antes de publicar.');
else if (!cfg.ownerKey) console.warn('⚠  OWNER_KEY vacío: nadie podrá marcar la jornada.');
if (cfg.demo) console.log('ℹ  Modo demo: usando datos de ejemplo (define NOTION_TOKEN y NOTION_DATABASE_ID para datos reales).');

const store = createStore(cfg.dataDir);

// --- Fechas en la zona horaria configurada ---
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('es-HN', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit' });
const dayOf = (d) => dayFmt.format(new Date(d));
const todayIn = () => dayOf(Date.now());
const hhmm = (d) => timeFmt.format(new Date(d));
function duration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// --- Telegram ---
const telegram = createTelegram({
  token: cfg.telegramToken,
  store,
  fallbackOwnerChat: cfg.telegramChat,
  messages: {
    linked: (role) => role === 'owner'
      ? '✅ Listo. Te avisaré aquí cada vez que tu jefe abra el panel de avance.'
      : `✅ Listo. Te avisaré aquí cuando ${cfg.owner} inicie su jornada y cada vez que complete una tarea.`,
  },
  // Si te vinculas mientras tu jefe tiene el panel abierto, te avisa en ese momento.
  onLinked: (role) => {
    if (role !== 'owner') return;
    const v = store.state.visits.at(-1);
    if (v && Date.now() - Date.parse(v.last) < 2 * 60000) {
      telegram.notify('owner', `👀 Tu jefe tiene el panel de avance abierto en este momento (entró a las ${hhmm(v.at)}).`);
    }
  },
});
telegram.start();

// --- Datos de Notion con caché ---
let cache = { at: 0, data: null, error: null };
let inflight = null;

function applyFilters(data) {
  const { includeTags, excludeTags, startDate } = cfg;
  const tasks = data.tasks.filter((t) => {
    if (startDate && t.date < startDate) return false;
    if (!includeTags.length && !excludeTags.length) return true;
    if (includeTags.length) return t.tags.some((g) => includeTags.includes(g));
    return !t.tags.some((g) => excludeTags.includes(g));
  });
  return { ...data, tasks };
}

async function getData(force = false) {
  const fresh = Date.now() - cache.at < cfg.cacheMs;
  if (cache.data && fresh && !force) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const raw = cfg.demo ? loadDemo() : await loadFromNotion(cfg);
        cache = { at: Date.now(), data: applyFilters(raw), error: null };
      } catch (e) {
        console.error('Error leyendo Notion:', e.message);
        cache = { ...cache, at: Date.now(), error: e.message };
      } finally {
        inflight = null;
      }
    })();
  }
  await inflight;
  return cache;
}

// --- Jornada (entrada / salida) ---
function openSession() {
  const s = store.state.sessions.at(-1);
  return s && !s.end ? s : null;
}
// Una jornada abierta de un día anterior se considera olvidada (sin salida marcada).
function isStale(s) {
  return s && dayOf(s.start) < todayIn();
}
function closeStale() {
  const s = openSession();
  // Se cierra sin hora de salida conocida (end = start) y se marca como no cerrada.
  if (s && isStale(s)) { s.end = s.start; s.unclosed = true; return true; }
  return false;
}
function presence(role) {
  const s = openSession();
  const online = !!s && !isStale(s);
  const since = Date.now() - 21 * 86400000;
  const sessions = store.state.sessions
    .filter((x) => Date.parse(x.start) >= since)
    .map((x) => {
      const unclosed = !!x.unclosed || (x === s && !online);
      return { start: x.start, end: unclosed ? null : x.end || null, unclosed };
    });
  const out = {
    online, since: online ? s.start : null, sessions,
    serverNow: new Date().toISOString(),
    telegram: telegram.status(role),
  };
  if (role !== 'owner') { delete out.telegram.error; delete out.telegram.configured; }
  if (role === 'owner') out.visits = store.state.visits.slice(-12).reverse();
  return out;
}

// --- Tareas asignadas por el jefe ---
// Áreas que el jefe puede elegir: las de Notion menos las excluidas (o solo las incluidas).
function allowedAreas(tagColors = {}) {
  return Object.keys(tagColors).filter((g) =>
    cfg.includeTags.length ? cfg.includeTags.includes(g) : !cfg.excludeTags.includes(g));
}
const longDate = (iso) => new Intl.DateTimeFormat('es-HN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  .format(new Date(iso + 'T12:00:00Z'));
const createLog = []; // marcas de tiempo para limitar a 20 tareas por hora

async function assignTask(input) {
  const title = String(input.title || '').replace(/\s+/g, ' ').trim();
  const date = String(input.date || '');
  const tag = String(input.tag || '').trim();
  const note = String(input.note || '').trim();
  if (!title) throw Object.assign(new Error('Escribe qué tarea necesitas.'), { status: 400 });
  if (title.length > 200) throw Object.assign(new Error('El título es muy largo (máximo 200 caracteres).'), { status: 400 });
  if (note.length > 1500) throw Object.assign(new Error('La nota es muy larga (máximo 1500 caracteres).'), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayIn() || date > addDaysIso(todayIn(), 366)) {
    throw Object.assign(new Error('Elige una fecha desde hoy en adelante.'), { status: 400 });
  }
  const c = await getData();
  if (tag && !allowedAreas(c.data?.tagColors).includes(tag)) throw Object.assign(new Error('Área no válida.'), { status: 400 });
  const now = Date.now();
  while (createLog.length && now - createLog[0] > 3600000) createLog.shift();
  if (createLog.length >= 20) throw Object.assign(new Error('Demasiadas tareas en poco tiempo. Intenta más tarde.'), { status: 429 });

  const { id } = await createTask(cfg, { title, date, tag, note, by: 'tu jefe' });
  createLog.push(now);
  store.state.bossTasks.push({ id, at: new Date(now).toISOString(), title, date });
  store.save();
  await getData(true); // que aparezca de inmediato en el panel
  telegram.notify('owner', `📝 Tu jefe te asignó una tarea:\n«${title}»\n📅 ${longDate(date)}${tag ? ` · ${tag}` : ''}${note ? `\n💬 ${note}` : ''}`);
  console.log('Tarea asignada por el jefe:', id);
  return { id };
}
function addDaysIso(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- Tareas completadas (aviso al jefe) ---
// Cada WATCH_MINUTES se relee Notion; las tareas que pasan a «Done» generan un aviso.
// La primera lectura solo guarda la referencia, para no avisar de todo lo ya completado.
const WATCH_MS = Math.max(1, Number(env.WATCH_MINUTES) || 2) * 60000;
async function watchCompletions() {
  if (cfg.demo) return;
  const c = await getData(true);
  if (!c.data || c.error) return;
  const doneNow = c.data.tasks.filter((t) => t.done);
  const ids = doneNow.map((t) => t.id);
  if (!Array.isArray(store.state.doneIds)) {
    store.state.doneIds = ids;
    store.save();
    console.log(`Referencia de tareas completadas guardada (${ids.length}).`);
    return;
  }
  const prev = new Set(store.state.doneIds);
  const fresh = doneNow.filter((t) => !prev.has(t.id));
  const changed = fresh.length || ids.length !== prev.size;
  if (changed) { store.state.doneIds = ids; store.save(); }
  if (!fresh.length) return;
  const line = (t) => `«${t.title}»${t.tags.length ? ` (${t.tags.join(', ')})` : ''}`;
  if (fresh.length === 1) {
    telegram.notify('boss', `✅ ${cfg.owner} completó una tarea: ${line(fresh[0])}`);
  } else {
    const shown = fresh.slice(0, 8).map((t) => `• ${line(t)}`).join('\n');
    const more = fresh.length > 8 ? `\n…y ${fresh.length - 8} más` : '';
    telegram.notify('boss', `✅ ${cfg.owner} completó ${fresh.length} tareas:\n${shown}${more}`);
  }
  console.log(`Tareas completadas nuevas: ${fresh.length}`);
}
setTimeout(() => watchCompletions().catch((e) => console.error('watch:', e.message)), 4000);
setInterval(() => watchCompletions().catch((e) => console.error('watch:', e.message)), WATCH_MS);

// --- Visitas del jefe (aviso a ti) ---
// force = true cuando tu jefe acaba de iniciar sesión: siempre cuenta como visita nueva.
function trackBossVisit(force = false) {
  const now = Date.now();
  const v = store.state.visits.at(-1);
  if (!force && v && now - Date.parse(v.last) < cfg.visitGapMs) {
    // Misma visita: solo se actualiza el último movimiento (como mucho cada minuto).
    if (now - Date.parse(v.last) > 60000) { v.last = new Date(now).toISOString(); store.save(); }
    return;
  }
  const iso = new Date(now).toISOString();
  store.state.visits.push({ at: iso, last: iso });
  store.save();
  const s = openSession();
  const estado = s && !isStale(s)
    ? `Apareces conectado desde las ${hhmm(s.start)}.`
    : 'Ahora mismo apareces DESCONECTADO.';
  telegram.notify('owner', `👀 Tu jefe acaba de abrir el panel de avance (${hhmm(now)}).\n${estado}`);
  console.log('Visita del jefe registrada', iso);
}

// --- Sesión firmada en cookie (incluye el rol) ---
const COOKIE = 'tk_session';
const SESSION_DAYS = 30;
const ROLES = ['owner', 'boss'];

function sign(value) {
  return crypto.createHmac('sha256', cfg.secret).update(value).digest('base64url');
}
function makeSession(role) {
  const payload = `${role}.${Date.now() + SESSION_DAYS * 86400000}`;
  return `${payload}.${sign(payload)}`;
}
function sessionRole(tok) {
  const parts = (tok || '').split('.');
  if (parts.length !== 3) return null;
  const [role, exp, sig] = parts;
  if (!ROLES.includes(role) || Number(exp) < Date.now()) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(`${role}.${exp}`));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? role : null;
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function roleOf(req) {
  if (!authEnabled) return 'owner';
  return sessionRole(cookies(req)[COOKIE]);
}
function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}
function keyMatches(input, secret) {
  if (!secret) return false;
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
// Las acciones que escriben solo se aceptan desde la propia página.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const proto = isHttps(req) ? 'https' : 'http';
  return origin === `${proto}://${req.headers.host}`;
}

// Límite simple de intentos por IP
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, since: now };
  if (now - rec.since > 15 * 60000) { rec.n = 0; rec.since = now; }
  return rec.n >= 10;
}
function fail(ip) {
  const rec = attempts.get(ip) || { n: 0, since: Date.now() };
  rec.n++; attempts.set(ip, rec);
}

// --- HTTP ---
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY, ...extra });
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
}
function redirect(res, to, extra = {}) {
  res.writeHead(303, { Location: to, ...SECURITY, ...extra });
  res.end();
}
async function serveFile(res, rel, status = 200) {
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'No encontrado');
  try {
    const buf = await readFile(file);
    send(res, status, buf, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
  } catch {
    send(res, 404, 'No encontrado');
  }
}
function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const PUBLIC_ASSETS = new Set(['/app.css', '/login.js', '/favicon.svg', '/logo.svg']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  try {
    if (p === '/healthz') return send(res, 200, 'ok');

    if (p === '/login' && req.method === 'GET') {
      if (roleOf(req)) return redirect(res, '/');
      return serveFile(res, 'login.html');
    }
    if (p === '/login' && req.method === 'POST') {
      if (tooMany(ip)) return redirect(res, '/login?e=limit');
      const key = new URLSearchParams(await readBody(req)).get('key') || '';
      const role = keyMatches(key, cfg.ownerKey) ? 'owner' : keyMatches(key, cfg.accessKey) ? 'boss' : null;
      if (role) {
        attempts.delete(ip);
        if (role === 'boss') trackBossVisit(true);
        const secure = isHttps(req) ? '; Secure' : '';
        return redirect(res, '/', {
          'Set-Cookie': `${COOKIE}=${makeSession(role)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`,
        });
      }
      fail(ip);
      return redirect(res, '/login?e=1');
    }
    if (p === '/logout') {
      return redirect(res, '/login', { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
    }

    if (PUBLIC_ASSETS.has(p)) return serveFile(res, p.slice(1));

    const role = roleOf(req);
    if (!role) {
      if (p.startsWith('/api/')) return json(res, 401, { error: 'auth' });
      return redirect(res, '/login');
    }

    if (p === '/api/tasks') {
      if (role === 'boss') trackBossVisit();
      const c = await getData(url.searchParams.get('refresh') === '1');
      if (!c.data) return json(res, 502, { error: c.error || 'Sin datos' });
      return json(res, 200, {
        owner: cfg.owner,
        timezone: cfg.timezone,
        today: todayIn(),
        source: cfg.demo ? 'demo' : 'notion',
        syncedAt: new Date(c.at).toISOString(),
        warning: c.error || null,
        authEnabled,
        role,
        presence: presence(role),
        assigned: store.state.bossTasks.map((t) => t.id),
        areas: allowedAreas(c.data.tagColors),
        canAssign: role === 'boss' && !cfg.demo,
        ...c.data,
      });
    }

    if (p === '/api/tasks/create' && req.method === 'POST') {
      if (role !== 'boss') return json(res, 403, { error: 'Solo tu jefe puede asignar tareas desde el panel.' });
      if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
      if (cfg.demo) return json(res, 400, { error: 'No disponible en modo demo.' });
      let body = {};
      try { body = JSON.parse(await readBody(req, 8192) || '{}'); } catch {}
      try {
        return json(res, 200, await assignTask(body));
      } catch (e) {
        console.error('No se pudo crear la tarea:', e.message);
        return json(res, e.status && e.status < 500 ? e.status : 502, { error: e.message });
      }
    }

    if (p === '/api/presence' && req.method === 'GET') {
      if (role === 'boss') trackBossVisit();
      return json(res, 200, presence(role));
    }
    if (p === '/api/presence' && req.method === 'POST') {
      if (role !== 'owner') return json(res, 403, { error: 'Solo el dueño del panel puede marcar la jornada.' });
      if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch {}
      if (!['start', 'stop'].includes(body.action)) return json(res, 400, { error: 'Acción no válida.' });
      const now = new Date().toISOString();
      closeStale();
      const open = openSession();
      if (body.action === 'start' && !open) {
        store.state.sessions.push({ start: now, end: null });
        telegram.notify('boss', `🟢 ${cfg.owner} marcó su entrada a las ${hhmm(now)}.`);
      } else if (body.action === 'stop' && open) {
        open.end = now; // sin aviso: el jefe solo recibe inicio de jornada y tareas completadas
      }
      store.save();
      return json(res, 200, presence(role));
    }

    if (p === '/api/telegram/link' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
      const link = telegram.createLink(role);
      if (!link) return json(res, 409, { error: 'El bot de Telegram todavía no está configurado.' });
      return json(res, 200, { ...link, bot: telegram.username });
    }
    if (p === '/api/telegram/test' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
      const r = await telegram.test(role);
      return json(res, r.ok ? 200 : 409, r);
    }
    if (p === '/api/telegram/unlink' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
      telegram.unlink(role);
      return json(res, 200, presence(role));
    }

    if (p === '/' || p === '/index.html') return serveFile(res, 'index.html');
    return serveFile(res, p.slice(1));
  } catch (e) {
    console.error(e);
    send(res, 500, 'Error interno');
  }
});

server.listen(cfg.port, () => {
  console.log(`Panel listo en http://localhost:${cfg.port}`);
});
