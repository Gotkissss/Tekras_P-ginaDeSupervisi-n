// Datos de ejemplo para ver el panel sin conectar Notion (DEMO=1 o sin NOTION_TOKEN).
// El plan desde hoy se basa en el calendario real; el historial previo es inventado.

const PLAN = [
  ['2026-11-09', 'Exploitation Basics', 'PEH'],
  ['2026-11-09', 'Revisar y entregar todas las gráficas', 'Graficas', true],
  ['2026-11-09', 'Qué es SDP/ZTNA, 8 conceptos', 'ZTNA'],
  ['2026-11-10', 'New Capstone I: Blue + Academy', 'PEH'],
  ['2026-11-10', 'Revisar y enviar a Julio los avances', 'Construye'],
  ['2026-11-10', 'Token flow y arquitectura', 'ZTNA'],
  ['2026-11-11', 'New Capstone II: Dev + Butler', 'PEH'],
  ['2026-11-11', 'Appliances y funciones, diseño', 'ZTNA'],
  ['2026-11-12', 'AD Overview + Lab Build', 'PEH'],
  ['2026-11-12', 'Pre-instalación, lab base', 'ZTNA'],
  ['2026-11-13', 'AAD: Initial Attack Vectors', 'PEH'],
  ['2026-11-13', 'Primer Controller (cz-setup)', 'ZTNA'],
  ['2026-11-14', 'AAD: Post-Compromise Enumeration', 'PEH'],
  ['2026-11-14', 'Gateway y primer Client conectado', 'ZTNA'],
  ['2026-11-15', 'Colchón + AD-Commands.md', 'PNPT'],
  ['2026-11-15', 'Repaso 1: dibuja el Collective', 'ZTNA'],
  ['2026-11-16', 'AAD: Post-Compromise Attacks I', 'PEH'],
  ['2026-11-16', 'SPA y Client Profiles', 'ZTNA'],
  ['2026-11-17', 'AAD: Post-Compromise Attacks II', 'PEH'],
  ['2026-11-17', 'IdPs, LDAP y usuarios locales', 'ZTNA'],
  ['2026-11-18', "We've compromised the domain, now what?", 'PEH'],
  ['2026-11-18', 'SAML y OIDC (Keycloak)', 'ZTNA'],
  ['2026-11-19', 'Post Exploitation (File Transfers, Pivoting)', 'PEH'],
  ['2026-11-19', 'Claims: user, device, system', 'ZTNA'],
  ['2026-11-20', 'Pivoting en la práctica: ligolo-ng', 'PNPT'],
  ['2026-11-20', 'MFA y registro de dispositivos', 'ZTNA'],
  ['2026-11-21', 'Web App Enumeration + SQLi', 'PEH'],
  ['2026-11-21', 'Policies y admin roles', 'ZTNA'],
  ['2026-11-22', 'Colchón + AD-Commands.md', 'PNPT'],
  ['2026-11-22', 'Repaso 2: del sign-in al token', 'ZTNA'],
  ['2026-11-23', 'Web Vulns II (Command Injection, IDOR)', 'PEH'],
  ['2026-11-23', 'Entitlements y definición de recursos', 'ZTNA'],
  ['2026-11-24', 'Legal Documents + Report Writing', 'PEH'],
  ['2026-11-24', 'Conditions y reevaluación', 'ZTNA'],
  ['2026-11-25', 'Intro + Exploring Automated Tools', 'WPE'],
  ['2026-11-25', 'Kernel Exploits', 'WPE'],
  ['2026-11-25', 'Risk Model, Ringfence, App Discovery', 'ZTNA'],
  ['2026-11-26', 'Passwords and Port Forwarding', 'WPE'],
  ['2026-11-26', 'Windows Subsystem for Linux', 'WPE'],
  ['2026-11-26', 'IP Pools y DNS', 'ZTNA'],
  ['2026-11-27', 'Impersonation and Potato Attacks', 'WPE'],
  ['2026-11-27', 'getSystem', 'WPE'],
  ['2026-11-27', 'Routing, Sites, NAT traversal', 'ZTNA'],
  ['2026-11-28', 'runAs + Additional labs', 'WPE'],
  ['2026-11-28', 'Registry', 'WPE'],
  ['2026-11-28', 'Cloud resolvers, revocar acceso', 'ZTNA'],
  ['2026-11-29', 'Colchón + repaso de lo que falló', 'PNPT'],
  ['2026-11-29', 'Repaso 3: caso práctico en el lab', 'ZTNA'],
  ['2026-11-30', 'Executable Files', 'WPE'],
  ['2026-11-30', 'Startup Applications', 'WPE'],
  ['2026-11-30', 'DLL Hijacking', 'WPE'],
  ['2026-11-30', 'Portal y Connector', 'ZTNA'],
  ['2026-12-01', 'Service Permission (Paths)', 'WPE'],
  ['2026-12-01', 'CVE-2019-1388', 'WPE'],
  ['2026-12-01', 'Clients Windows', 'ZTNA'],
  ['2026-12-02', 'Capstone Challenge I', 'WPE'],
  ['2026-12-02', 'Clients macOS, Linux, k8s, móvil', 'ZTNA'],
  ['2026-12-03', 'Capstone Challenge II', 'WPE'],
  ['2026-12-03', 'Troubleshooting 6 capas', 'ZTNA'],
  ['2026-12-04', 'Intro + Initial Enumeration', 'LPE'],
  ['2026-12-04', 'Audit logs y monitoreo', 'ZTNA'],
  ['2026-12-05', 'Automated Tools (linpeas)', 'LPE'],
  ['2026-12-05', 'HA, certificados, replicación', 'ZTNA'],
];

// Historial inventado: [fecha, título, etiqueta, estado] — estado: 'ok' | 'late' | 'open'
const HISTORY = [
  ['2026-10-19', 'Intro + Notekeeping', 'PEH', 'ok'],
  ['2026-10-19', 'OhSINT (sin writeup)', 'PNPT', 'ok'],
  ['2026-10-20', 'Networking Refresher', 'PEH', 'ok'],
  ['2026-10-20', 'Google Dorking', 'PNPT', 'ok'],
  ['2026-10-21', 'Setting Up Our Lab', 'PEH', 'ok'],
  ['2026-10-21', 'Planos de sitio – primera revisión', 'Construye', 'ok'],
  ['2026-10-22', 'Intro to Linux', 'PEH', 'late'],
  ['2026-10-22', 'Web Enumeration', 'PNPT', 'ok'],
  ['2026-10-23', 'Intro to Python', 'PEH', 'late'],
  ['2026-10-23', 'Laboratorio 3D: modelo base', 'Graficas', 'ok'],
  ['2026-10-24', 'The Ethical Hacker Methodology', 'PEH', 'ok'],
  ['2026-10-24', 'Steel Mountain', 'PNPT', 'ok'],
  ['2026-10-25', 'Colchón + notas de la semana', 'PNPT', 'ok'],
  ['2026-10-26', 'Information Gathering (Reconnaissance)', 'PEH', 'ok'],
  ['2026-10-26', 'Blue', 'PNPT', 'ok'],
  ['2026-10-27', 'Scanning & Enumeration', 'PEH', 'ok'],
  ['2026-10-27', 'Cotización de materiales', 'Construye', 'late'],
  ['2026-10-28', 'Vulnerability Scanning with Nessus', 'PEH', 'ok'],
  ['2026-10-28', 'Crack the Hash', 'PNPT', 'ok'],
  ['2026-10-29', 'Additional Scanning Tools', 'PEH', 'late'],
  ['2026-10-29', 'Laboratorio 3D: iluminación', 'Graficas', 'ok'],
  ['2026-10-30', 'Exploitation Basics I: Reverse vs Bind', 'PEH', 'ok'],
  ['2026-10-30', 'Post-Exploitation Basics', 'PNPT', 'open'],
  ['2026-10-31', 'Colchón + repaso de lo que falló', 'PNPT', 'ok'],
  ['2026-11-01', 'Gaining Root with Metasploit', 'PEH', 'ok'],
  ['2026-11-02', 'Manual Exploitation', 'PEH', 'ok'],
  ['2026-11-02', 'Breaching Active Directory', 'PNPT', 'late'],
  ['2026-11-03', 'Brute Force + Credential Stuffing', 'PEH', 'ok'],
  ['2026-11-03', 'Planos de sitio – correcciones', 'Construye', 'ok'],
  ['2026-11-04', 'Enumerating Active Directory', 'PNPT', 'open'],
  ['2026-11-04', 'Laboratorio 3D: texturas', 'Graficas', 'ok'],
  ['2026-11-05', 'Mid-Course Capstone: Legacy', 'PEH', 'late'],
  ['2026-11-05', 'Lateral Movement and Pivoting', 'PNPT', 'open'],
  ['2026-11-06', 'Mid-Course Capstone: Lame', 'PEH', 'ok'],
  ['2026-11-06', 'Informe semanal para Julio', 'Construye', 'ok'],
  ['2026-11-07', 'Exploiting Active Directory', 'PNPT', 'open'],
  ['2026-11-07', 'Laboratorio 3D: entrega parcial', 'Graficas', 'ok'],
  ['2026-11-08', 'Colchón + AD-Detailed.md', 'PNPT', 'ok'],
];

const COLORS = {
  PEH: 'gray',
  ZTNA: 'purple',
  WPE: 'orange',
  PNPT: 'red',
  LPE: 'yellow',
  Graficas: 'green',
  Construye: 'blue',
};

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function loadDemo() {
  const tasks = [];
  let i = 0;
  for (const [date, title, tag, state] of HISTORY) {
    const done = state !== 'open';
    const editDay = state === 'late' ? addDays(date, 1 + (i % 2)) : date;
    tasks.push({
      id: `demo-h${i++}`,
      title, date, endDate: null, done, tags: [tag],
      lastEdited: `${editDay}T${done ? '22:15' : '08:00'}:00.000Z`,
    });
  }
  for (const [date, title, tag, done] of PLAN) {
    tasks.push({
      id: `demo-p${i++}`,
      title, date, endDate: null, done: !!done, tags: [tag],
      lastEdited: `${date}T16:40:00.000Z`,
    });
  }
  return {
    tasks,
    tagColors: COLORS,
    columns: { title: 'Name', date: 'Date', done: 'Done', tags: 'Tags' },
    databaseTitle: 'Plan (demo)',
  };
}
