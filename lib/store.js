// Estado persistente pequeño: jornadas (entrada/salida) y visitas del jefe.
// Se guarda en un JSON dentro de DATA_DIR (en Railway, montar un volumen ahí).
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';

export function createStore(dir) {
  const file = path.join(dir, 'state.json');
  let state = { sessions: [], visits: [], telegram: {} };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    // doneIds: tareas que ya estaban completadas (para avisar solo de las nuevas).
    state = { sessions: raw.sessions || [], visits: raw.visits || [], telegram: raw.telegram || {}, doneIds: raw.doneIds };
  } catch {}

  function save() {
    // Conservar solo lo reciente
    state.sessions = state.sessions.slice(-400);
    state.visits = state.visits.slice(-300);
    mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify(state, null, 1));
    renameSync(tmp, file);
  }

  return { state, save, file };
}
