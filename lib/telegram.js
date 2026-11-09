// Bot de Telegram: vincula a cada rol (tú / tu jefe) con un enlace t.me/<bot>?start=<código>
// y envía los avisos. Usa long polling (getUpdates): no necesita URL pública ni webhook,
// así funciona igual en local que en Railway. Solo puede haber UN proceso leyendo el bot a la vez.
import crypto from 'node:crypto';

const LINK_TTL = 15 * 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTelegram({ token, store, fallbackOwnerChat, messages }) {
  const tg = { username: null, offset: 0, pending: new Map(), error: null };
  const links = () => store.state.telegram;

  async function api(method, body) {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
    if (!j.ok) {
      const err = new Error(j.description || 'Error de Telegram');
      err.code = j.error_code;
      throw err;
    }
    return j.result;
  }

  async function send(chatId, text) {
    try { await api('sendMessage', { chat_id: chatId, text }); }
    catch (e) { console.error('Telegram: no se pudo enviar el mensaje:', e.message); }
  }

  const HOW = 'pulsa «Recibir avisos en Telegram» en el panel y escríbeme aquí el código de 6 dígitos que aparece.';
  const tries = new Map(); // intentos fallidos de código por chat

  function findPending(text) {
    const now = Date.now();
    for (const [k, v] of tg.pending) {
      if (v.exp < now) continue;
      if (k === text || v.pin === text) return [k, v];
    }
    return null;
  }

  async function handle(update) {
    const m = update.message;
    if (!m || !m.text || m.chat?.type !== 'private') return;
    const text = m.text.trim();
    const [cmd, arg] = text.split(/\s+/);
    // Acepta: "/start <código>" (enlace), o el código de 6 dígitos escrito a mano.
    let candidate = null;
    if (cmd === '/start' && arg) candidate = arg;
    else if (/^\d{3}\s?\d{3}$/.test(text)) candidate = text.replace(/\s/g, '');
    if (!candidate) {
      return send(m.chat.id, `Hola 👋 Soy el bot de avisos del panel de avance de tekras.\nPara activarlos, ${HOW}`);
    }
    const t = tries.get(m.chat.id) || { n: 0, since: Date.now() };
    if (Date.now() - t.since > 15 * 60000) { t.n = 0; t.since = Date.now(); }
    if (t.n >= 6) return send(m.chat.id, 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.');
    const hit = findPending(candidate);
    if (!hit) {
      t.n++; tries.set(m.chat.id, t);
      return send(m.chat.id, `Ese código no es válido o ya venció (duran 15 minutos). Para generar uno nuevo, ${HOW}`);
    }
    tries.delete(m.chat.id);
    const [code, p] = hit;
    tg.pending.delete(code);
    links()[p.role] = {
      chatId: m.chat.id,
      name: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || null,
      username: m.from?.username || null,
      linkedAt: new Date().toISOString(),
    };
    store.save();
    console.log(`Telegram vinculado para el rol ${p.role}`);
    send(m.chat.id, messages.linked(p.role));
  }

  async function loop() {
    for (;;) {
      try {
        const updates = await api('getUpdates', { offset: tg.offset, timeout: 50, allowed_updates: ['message'] });
        tg.error = null;
        for (const u of updates) {
          tg.offset = u.update_id + 1;
          await handle(u).catch((e) => console.error('Telegram:', e.message));
        }
      } catch (e) {
        tg.error = e.message;
        if (e.code === 409) console.error('Telegram: otro proceso está leyendo este bot (¿el panel está corriendo en otro lado?).');
        else console.error('Telegram (polling):', e.message);
        await sleep(e.code === 401 ? 60000 : 5000);
      }
    }
  }

  async function start() {
    if (!token) return;
    try {
      const me = await api('getMe');
      tg.username = me.username;
      // Si el bot tenía un webhook configurado, getUpdates no funciona: se quita.
      await api('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
      console.log(`Telegram listo: @${tg.username}`);
      loop();
    } catch (e) {
      tg.error = e.message;
      console.error('Telegram: el token no es válido o no hay conexión:', e.message);
    }
  }

  return {
    start,
    get available() { return !!tg.username; },
    get username() { return tg.username; },
    status(role) {
      const l = links()[role];
      return {
        available: !!tg.username,
        bot: tg.username,
        linked: !!l || (role === 'owner' && !!fallbackOwnerChat),
        name: l?.name || null,
      };
    },
    createLink(role) {
      if (!tg.username) return null;
      // limpiar códigos vencidos
      for (const [k, v] of tg.pending) if (v.exp < Date.now()) tg.pending.delete(k);
      // Un enlace nuevo reemplaza al anterior del mismo rol.
      for (const [k, v] of tg.pending) if (v.role === role) tg.pending.delete(k);
      const code = crypto.randomBytes(18).toString('base64url');
      let pin;
      do { pin = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); }
      while ([...tg.pending.values()].some((v) => v.pin === pin));
      tg.pending.set(code, { role, pin, exp: Date.now() + LINK_TTL });
      return { url: `https://t.me/${tg.username}?start=${code}`, pin };
    },
    unlink(role) {
      const l = links()[role];
      if (!l) return;
      delete links()[role];
      store.save();
      if (tg.username) send(l.chatId, 'Avisos desactivados. Puedes volver a activarlos desde el panel cuando quieras.');
    },
    notify(role, text) {
      if (!tg.username) return;
      const chatId = links()[role]?.chatId || (role === 'owner' ? fallbackOwnerChat : null);
      if (chatId) send(chatId, text);
    },
  };
}
