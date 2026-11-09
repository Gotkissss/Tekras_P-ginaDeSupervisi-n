# Panel de avance (tekras)

Panel web de solo lectura que lee el plan de tareas desde Notion y muestra el avance real:
cumplimiento, tareas atrasadas, semana en curso, racha, ritmo diario, avance por área y calendario.
Pensado para compartir con supervisión mediante una clave de acceso.

Sin dependencias: solo Node 18 o superior.

## Probar en local

```bash
cp .env.example .env     # en Windows: copy .env.example .env
npm start                # http://localhost:3000
```

Sin `NOTION_TOKEN` arranca en **modo demo** con datos de ejemplo.

## Conectar Notion

1. Entra a https://www.notion.so/profile/integrations → **New integration** (tipo *Internal*, permiso solo *Read content*).
2. Copia el token (`ntn_…`) en `NOTION_TOKEN` del archivo `.env`.
3. Abre la base de datos de tareas en Notion → menú `•••` → **Conexiones** → agrega la integración.
4. Copia el ID de la base (los 32 caracteres del link antes de `?v=`) en `NOTION_DATABASE_ID`.
5. Borra `DEMO=1` del `.env` y reinicia (`npm start`).

Las columnas se detectan solas (título, primera fecha, casilla *Done* o propiedad de *Estado*, y etiquetas).
Si la detección elige mal, fíjalas con `PROP_TITLE`, `PROP_DATE`, `PROP_DONE`, `PROP_TAGS`.
Para ocultar áreas que no son de la empresa: `EXCLUDE_TAGS=Graficas` (o lista blanca con `INCLUDE_TAGS`).

## Acceso (dos claves)

- `OWNER_KEY`: tu clave. Ves todo, marcas tu jornada y ves las visitas de tu jefe.
- `ACCESS_KEY`: la clave de tu jefe. Solo lectura; ve tu estado de conexión y tu horario de la semana.

La sesión dura 30 días (cookie firmada, `HttpOnly`). Si ambas claves están vacías, el panel queda abierto: no lo publiques así.

## Jornada (entrada / salida)

Con tu clave aparece el botón **Iniciar jornada / Terminar jornada**. Tu jefe ve en su panel si estás conectado,
desde qué hora, y la entrada, salida y horas de cada día de la semana. Si olvidas marcar la salida, ese día queda
como «Sin salida marcada». Se guarda en `DATA_DIR/state.json` (por defecto `data/`).

## Tareas asignadas por el jefe

Con su clave, tu jefe ve el botón **Asignar una tarea** (título, fecha, área y detalles opcionales).
La tarea se crea directamente en la base de Notion, aparece en el panel con la etiqueta «📝 De tu jefe»
y te llega un aviso por Telegram. Requiere que la integración de Notion tenga la capacidad
**Insert content** (notion.so/profile/integrations → tu integración → Capabilities).

## Avisos por Telegram

1. En Telegram abre **@BotFather** → `/newbot` → ponle nombre (ej. *Tekras Avance*) y un usuario que termine en `bot`.
2. Copia el token que te da y pégalo en `TELEGRAM_BOT_TOKEN` del `.env`. Reinicia el servidor.
3. En el panel pulsa **Recibir avisos en Telegram** y envíale al bot el código de 6 dígitos que aparece.

- A ti te llega un aviso cada vez que tu jefe abre el panel (una vez por visita; `VISIT_GAP_MINUTES`, 30 por defecto).
- Tu jefe puede vincularse desde su panel y recibirá un aviso cuando **inicies tu jornada** y cada vez que
  **marques una tarea como completada** en Notion (se revisa cada `WATCH_MINUTES`, 2 por defecto).
- Los mensajes llegan a la app de Telegram en el teléfono y en la computadora a la vez.
- Solo un proceso puede leer el bot a la vez. Para probar en local mientras Railway está activo, pon
  `TELEGRAM_DISABLED=1` en tu `.env` local (el bot queda apagado solo en tu PC).

## Railway

- Se despliega tal cual (`npm start`, puerto en `PORT`). `railway.json` define el health check en `/healthz`.
- Monta un **volumen** en `/data` y define `DATA_DIR=/data`, si no, jornadas, visitas y vínculos de Telegram se pierden en cada despliegue.
- Usa **una sola réplica** y no dejes una copia local corriendo con el mismo bot (Telegram solo admite un lector).

## Notas

- «A tiempo» se estima con la fecha de última edición de la tarea en Notion (si se edita después, cuenta como tarde).
- La respuesta de Notion se guarda en caché `CACHE_SECONDS` (60 s); el botón **Actualizar** fuerza una lectura.
- Se leen solo tareas con fecha dentro de los últimos `HISTORY_DAYS` días (120).
