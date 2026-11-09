// Lectura de la base de tareas en Notion (API REST, sin SDK).
// Detecta solas las columnas: título, fecha, casilla/estado "Done" y etiquetas.

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(token, path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body).message || body; } catch {}
    const err = new Error(`Notion ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function cleanId(id) {
  // Acepta el link completo o el ID con/sin guiones.
  const m = String(id || '').replace(/-/g, '').match(/[0-9a-f]{32}/i);
  return m ? m[0] : String(id || '').trim();
}

// Elige qué propiedad cumple cada rol.
function resolveSchema(props, cfg) {
  const entries = Object.entries(props);
  const byName = (name) => (name && props[name] ? name : null);
  const firstOf = (...types) => {
    for (const t of types) {
      const hit = entries.find(([, p]) => p.type === t);
      if (hit) return hit[0];
    }
    return null;
  };
  const named = (re, ...types) => {
    const hit = entries.find(([n, p]) => re.test(n) && types.includes(p.type));
    return hit ? hit[0] : null;
  };

  const schema = {
    title: byName(cfg.propTitle) || firstOf('title'),
    date: byName(cfg.propDate) || named(/fecha|date|d[ií]a|when|cu[aá]ndo/i, 'date') || firstOf('date'),
    done: byName(cfg.propDone) || named(/done|hecho|listo|complet|terminad|estado|status/i, 'checkbox', 'status')
      || firstOf('checkbox', 'status'),
    tags: byName(cfg.propTags) || named(/tag|etiqueta|[aá]rea|categor|curso|proyecto|tipo/i, 'multi_select', 'select')
      || firstOf('multi_select', 'select'),
  };
  for (const role of ['title', 'date', 'done']) {
    if (!schema[role]) throw new Error(`No encontré la columna de ${role} en la base de Notion. Configura PROP_${role.toUpperCase()}.`);
  }
  schema.doneType = props[schema.done].type;
  schema.tagsType = schema.tags ? props[schema.tags].type : null;

  // Colores de las etiquetas tal como están en Notion.
  schema.tagColors = {};
  if (schema.tags) {
    const p = props[schema.tags];
    const options = p[p.type]?.options || [];
    for (const o of options) schema.tagColors[o.name] = o.color;
  }
  return schema;
}

function plain(rich) {
  return (rich || []).map((r) => r.plain_text).join('').trim();
}

function normalize(page, schema, cfg) {
  const p = page.properties;
  const title = plain(p[schema.title]?.title) || 'Sin título';
  const dateProp = p[schema.date]?.date;
  const date = dateProp?.start ? dateProp.start.slice(0, 10) : null;
  const endDate = dateProp?.end ? dateProp.end.slice(0, 10) : null;

  let done = false;
  const dp = p[schema.done];
  if (schema.doneType === 'checkbox') done = !!dp?.checkbox;
  else if (schema.doneType === 'status') done = cfg.doneValues.includes((dp?.status?.name || '').toLowerCase());

  let tags = [];
  if (schema.tags) {
    const tp = p[schema.tags];
    if (schema.tagsType === 'multi_select') tags = (tp?.multi_select || []).map((t) => t.name);
    else if (tp?.select) tags = [tp.select.name];
  }

  return {
    id: page.id,
    title,
    date,
    endDate,
    done,
    tags,
    lastEdited: page.last_edited_time,
  };
}

export async function loadFromNotion(cfg) {
  const dbId = cleanId(cfg.databaseId);
  const db = await notionFetch(cfg.token, `/databases/${dbId}`);
  const schema = resolveSchema(db.properties, cfg);

  const byHistory = new Date(Date.now() - cfg.historyDays * 86400000).toISOString().slice(0, 10);
  const since = cfg.startDate && cfg.startDate > byHistory ? cfg.startDate : byHistory;
  const pages = [];
  let cursor;
  do {
    const body = {
      page_size: 100,
      filter: { property: schema.date, date: { on_or_after: since } },
      sorts: [{ property: schema.date, direction: 'ascending' }],
    };
    if (cursor) body.start_cursor = cursor;
    const res = await notionFetch(cfg.token, `/databases/${dbId}/query`, { method: 'POST', body: JSON.stringify(body) });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor && pages.length < 2000);

  const tasks = pages
    .filter((pg) => !pg.archived && !pg.in_trash)
    .map((pg) => normalize(pg, schema, cfg))
    .filter((t) => t.date);

  return {
    tasks,
    tagColors: schema.tagColors,
    columns: { title: schema.title, date: schema.date, done: schema.done, tags: schema.tags },
    databaseTitle: plain(db.title) || 'Notion',
  };
}
