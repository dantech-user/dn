const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const tempDirectory = fs.mkdtempSync(path.join(__dirname, '..', '.hydra-test-data-'));
process.env.HYDRA_DATA_DIR = tempDirectory;
const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads');
const uploadsBefore = new Set(fs.existsSync(uploadDirectory) ? fs.readdirSync(uploadDirectory) : []);
const { api, db } = require('../server');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(pathname, { method = 'GET', body, cookie = '' } = {}) {
  const request = new Readable({
    read() {
      if (body !== undefined) this.push(JSON.stringify(body));
      this.push(null);
    }
  });
  request.method = method;
  request.headers = { cookie };
  let status = 0;
  const headers = {};
  let raw = '';
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const response = {
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    writeHead(code, values = {}) {
      status = code;
      for (const [name, value] of Object.entries(values)) headers[name.toLowerCase()] = value;
    },
    end(value = '') { raw += value; finish(); }
  };
  await api(request, response, pathname);
  await finished;
  return { status, headers, body: raw ? JSON.parse(raw) : null };
}

const sessionFrom = response => String(response.headers['set-cookie'] || '').split(';')[0];

async function run() {
  const adminRegister = await call('/api/auth/register', { method: 'POST', body: { name: 'Daniel', email: 'danqxy7@gmail.com', password: 'segredo1' } });
  assert(adminRegister.status === 201, 'Falha ao criar conta administrativa.');
  const adminCookie = sessionFrom(adminRegister);
  await call('/api/farm', { method: 'POST', cookie: adminCookie, body: { name: 'Fazenda Admin', city: 'Brejões', state: 'BA', area: 0, activity: 'Agricultura' } });
  const adminMe = await call('/api/me', { cookie: adminCookie });
  assert(adminMe.body.user.is_admin === 1 && adminMe.body.user.vip === 1 && adminMe.body.user.plan === 'pro', 'Conta do dono não recebeu ADM/VIP/Pro.');

  const userRegister = await call('/api/auth/register', { method: 'POST', body: { name: 'Usuário Teste', email: 'usuario-teste@hydra.local', password: 'segredo22' } });
  assert(userRegister.status === 201, 'Falha ao criar usuário comum.');
  let userCookie = sessionFrom(userRegister);
  await call('/api/farm', { method: 'POST', cookie: userCookie, body: { name: 'Fazenda Zero', city: 'Brejões', state: 'BA', area: 0, activity: 'Pecuária', water_goal: 4200 } });
  const farmSetup = await call('/api/me', { cookie: userCookie });
  assert(farmSetup.body.farm.water_goal === 4200, 'Meta de água da fazenda não foi persistida.');

  const initialDashboard = await call('/api/dashboard', { cookie: userCookie });
  assert(initialDashboard.body.todayWater === 0 && initialDashboard.body.animalStats.total === 0 && initialDashboard.body.dronesActive === 0 && initialDashboard.body.sustainabilityScore === 0, 'A conta nova não começou zerada.');
  const deniedAdmin = await call('/api/admin/overview', { cookie: userCookie });
  assert(deniedAdmin.status === 403, 'Usuário comum acessou o painel administrativo.');

  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nB8AAAAASUVORK5CYII=';
  const profile = await call('/api/profile', { method: 'PATCH', cookie: userCookie, body: { name: 'Usuário Atualizado', avatar: tinyPng } });
  assert(profile.status === 200 && profile.body.avatar_url?.startsWith('/uploads/'), 'Foto de perfil não foi persistida.');
  await call('/api/profile', { method: 'PATCH', cookie: userCookie, body: { name: 'Usuário Atualizado', removeAvatar: true } });

  await call('/api/settings', { method: 'PATCH', cookie: userCookie, body: { notifications: true, animations: true, compact_mode: false, dark_mode: true } });
  const settings = await call('/api/settings', { cookie: userCookie });
  assert(settings.body.dark_mode === 1, 'Modo escuro não persistiu.');

  const animal = await call('/api/animals', { method: 'POST', cookie: userCookie, body: { tag: 'AG-0001', name: 'Mimosa', species: 'Bovino', breed: 'Nelore', sector: 'Pasto 1', status: 'Saudável', weight: 320 } });
  assert(animal.status === 201, 'Animal com NFC não foi cadastrado.');
  const scan = await call('/api/nfc/scan', { method: 'POST', cookie: userCookie, body: { tag: 'ag-0001' } });
  assert(scan.status === 201 && scan.body.animal?.name === 'Mimosa', 'Leitura NFC não identificou o animal.');
  const nfc = await call('/api/nfc', { cookie: userCookie });
  assert(nfc.body.stats.scans === 1 && nfc.body.stats.identified === 1 && nfc.body.stats.registered === 1, 'Resumo NFC incorreto.');

  const waterLog = await call('/api/water', { method: 'POST', cookie: userCookie, body: { sector: 'Bebedouro principal', liters: 100 } });
  assert(waterLog.status === 201, 'Leitura real de água não foi registrada.');
  const drone = await call('/api/drones', { method: 'POST', cookie: userCookie, body: { name: 'Hydra 01', model: 'Monitor', mission: 'Inspeção do pasto', status: 'Em voo', battery: 92 } });
  assert(drone.status === 201, 'Drone não foi cadastrado.');
  const droneReturn = await call(`/api/drones/${drone.body.id}`, { method: 'PATCH', cookie: userCookie, body: { mission: 'Disponível', status: 'Na base', battery: 71 } });
  assert(droneReturn.status === 200 && droneReturn.body.missionCompleted === true, 'Retorno real do drone não concluiu a missão.');
  const progress = await call('/api/social', { cookie: userCookie });
  const challengeByTitle = title => progress.body.challenges.find(item => item.title === title);
  assert(challengeByTitle('Rebanho identificado')?.progress === 1, 'Desafio NFC não avançou pela leitura real.');
  assert(challengeByTitle('7 dias economizando água')?.progress === 1, 'Desafio de água não avançou pelo registro real.');
  assert(challengeByTitle('Fazenda monitorada')?.progress === 1, 'Desafio do drone não avançou pela missão real.');
  const fakeProgress = await call(`/api/challenges/${challengeByTitle('Fazenda monitorada').id}`, { method: 'PATCH', cookie: userCookie, body: { increment: 1 } });
  assert(fakeProgress.status === 404, 'A API ainda permite progresso manual de desafios.');

  const announcement = await call('/api/admin/announcements', { method: 'POST', cookie: adminCookie, body: { type: 'maintenance', title: 'Manutenção programada', message: 'O aplicativo ficará em manutenção para atualização.', active: true, starts_at: new Date(Date.now() - 60_000).toISOString() } });
  assert(announcement.status === 201, 'Aviso administrativo não foi criado.');
  const visibleAnnouncements = await call('/api/announcements', { cookie: userCookie });
  assert(visibleAnnouncements.body.some(item => item.title === 'Manutenção programada'), 'Aviso ativo não chegou ao usuário.');

  const overview = await call('/api/admin/overview', { cookie: adminCookie });
  const target = overview.body.users.find(item => item.email === 'usuario-teste@hydra.local');
  assert(target && overview.body.counts.users === 2, 'Painel não listou os usuários.');
  const protectedAdmin = await call(`/api/admin/users/${adminMe.body.user.id}/ban`, { method: 'POST', cookie: adminCookie, body: { reason: 'Teste proibido' } });
  assert(protectedAdmin.status === 400, 'O painel permitiu banir a própria conta administrativa.');
  const ban = await call(`/api/admin/users/${target.id}/ban`, { method: 'POST', cookie: adminCookie, body: { reason: 'Teste de moderação' } });
  assert(ban.status === 200, 'Banimento falhou.');
  const invalidated = await call('/api/me', { cookie: userCookie });
  assert(invalidated.status === 401, 'Sessão do usuário banido não foi encerrada.');
  const blockedLogin = await call('/api/auth/login', { method: 'POST', body: { email: 'usuario-teste@hydra.local', password: 'segredo22' } });
  assert(blockedLogin.status === 403, 'Usuário banido conseguiu entrar.');
  const unban = await call(`/api/admin/users/${target.id}/unban`, { method: 'POST', cookie: adminCookie });
  assert(unban.status === 200, 'Desbanimento falhou.');
  const loginAgain = await call('/api/auth/login', { method: 'POST', body: { email: 'usuario-teste@hydra.local', password: 'segredo22' } });
  assert(loginAgain.status === 200, 'Usuário desbanido não conseguiu entrar.');
  userCookie = sessionFrom(loginAgain);
  assert((await call('/api/me', { cookie: userCookie })).status === 200, 'Nova sessão após desbanimento é inválida.');

  const finalOverview = await call('/api/admin/overview', { cookie: adminCookie });
  assert(finalOverview.body.auditLog.some(item => item.action === 'ban_user') && finalOverview.body.auditLog.some(item => item.action === 'unban_user'), 'Auditoria administrativa não registrou as ações.');
  console.log('Integração OK: cadastro direto, fazenda, zero inicial, perfil, modo escuro, progresso real, NFC, avisos, ADM, banimento e auditoria.');
}

run().finally(() => {
  try { db.close(); } catch {}
  if (fs.existsSync(uploadDirectory)) {
    for (const file of fs.readdirSync(uploadDirectory)) {
      if (!uploadsBefore.has(file)) fs.rmSync(path.join(uploadDirectory, file), { force: true });
    }
  }
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}).catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
