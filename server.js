const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.HYDRA_DATA_DIR ? path.resolve(process.env.HYDRA_DATA_DIR) : path.join(__dirname, 'data');
const VIP_EMAIL = 'danqxy7@gmail.com';
const weatherCache = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'hydra-agro.sqlite'));
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    vip INTEGER NOT NULL DEFAULT 0,
    subscription_status TEXT NOT NULL DEFAULT 'inactive',
    avatar_url TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    banned_at TEXT,
    banned_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    area REAL NOT NULL DEFAULT 0,
    activity TEXT NOT NULL DEFAULT 'Pecuária e agricultura',
    water_goal INTEGER NOT NULL DEFAULT 3500,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS animals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Saudável',
    weight REAL NOT NULL DEFAULT 0,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(farm_id, tag)
  );
  CREATE TABLE IF NOT EXISTS reservoirs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    level INTEGER NOT NULL CHECK(level BETWEEN 0 AND 100),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS water_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    sector TEXT NOT NULL,
    liters INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS drones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Na base',
    battery INTEGER NOT NULL DEFAULT 100,
    mission TEXT NOT NULL DEFAULT 'Disponível'
  );
  CREATE TABLE IF NOT EXISTS drone_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    drone_id INTEGER NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
    mission TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'Atualização',
    content TEXT NOT NULL,
    reactions INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    joined INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(post_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS post_saves (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(post_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS farm_follows (
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(farm_id,follower_id)
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notifications INTEGER NOT NULL DEFAULT 1,
    animations INTEGER NOT NULL DEFAULT 1,
    compact_mode INTEGER NOT NULL DEFAULT 0,
    dark_mode INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS post_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS vip_allowlist (
    email TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'pro',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'manual',
    provider_reference TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT
  );
  CREATE TABLE IF NOT EXISTS nfc_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
    tag TEXT NOT NULL,
    result TEXT NOT NULL,
    scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS app_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('info','update','maintenance')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const postColumns = db.prepare('PRAGMA table_info(posts)').all().map(column => column.name);
if (!postColumns.includes('image_url')) db.exec('ALTER TABLE posts ADD COLUMN image_url TEXT');
const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
if (!userColumns.includes('plan')) db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
if (!userColumns.includes('vip')) db.exec('ALTER TABLE users ADD COLUMN vip INTEGER NOT NULL DEFAULT 0');
if (!userColumns.includes('subscription_status')) db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive'");
if (!userColumns.includes('avatar_url')) db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
if (!userColumns.includes('is_admin')) db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
if (!userColumns.includes('banned_at')) db.exec('ALTER TABLE users ADD COLUMN banned_at TEXT');
if (!userColumns.includes('banned_reason')) db.exec('ALTER TABLE users ADD COLUMN banned_reason TEXT');
const settingColumns = db.prepare('PRAGMA table_info(user_settings)').all().map(column => column.name);
if (!settingColumns.includes('dark_mode')) db.exec('ALTER TABLE user_settings ADD COLUMN dark_mode INTEGER NOT NULL DEFAULT 0');
db.prepare('INSERT OR IGNORE INTO vip_allowlist(email,plan,note) VALUES(?,?,?)').run(VIP_EMAIL,'pro','VIP vitalício do criador');
db.prepare("UPDATE users SET plan='pro',vip=1,subscription_status='active',is_admin=1 WHERE lower(email)=?").run(VIP_EMAIL);
db.prepare('UPDATE users SET is_admin=0 WHERE lower(email)<>?').run(VIP_EMAIL);
db.exec(`
  UPDATE posts SET reactions=(SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id=posts.id);
  UPDATE posts SET comments=(SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id=posts.id);
`);
db.prepare("UPDATE challenges SET description='Avança nos dias em que o consumo registrado fica dentro da meta.' WHERE title='7 dias economizando água'").run();
db.prepare("UPDATE challenges SET description='Avança quando uma etiqueta NFC cadastrada é realmente lida.' WHERE title='Rebanho identificado'").run();
db.prepare("UPDATE challenges SET description='Avança quando um drone volta de uma missão para a base.' WHERE title='Fazenda monitorada'").run();

const json = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
};

const readBody = req => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', chunk => {
    raw += chunk;
    if (raw.length > 8_000_000) reject(new Error('Payload muito grande'));
  });
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : {}); }
    catch { reject(new Error('JSON inválido')); }
  });
});

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const savePostImage = dataUrl => {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Formato de imagem inválido');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5_000_000) throw new Error('A imagem deve ter no máximo 5 MB');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const directory = path.join(PUBLIC_DIR, 'uploads');
  fs.mkdirSync(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(directory, filename), buffer);
  return `/uploads/${filename}`;
};
const removePostImage = imageUrl => {
  if (!imageUrl || !String(imageUrl).startsWith('/uploads/')) return;
  const file = path.join(PUBLIC_DIR, path.basename(imageUrl));
  const uploadFile = path.join(PUBLIC_DIR, 'uploads', path.basename(imageUrl));
  if (uploadFile.startsWith(path.join(PUBLIC_DIR, 'uploads')) && fs.existsSync(uploadFile)) fs.unlinkSync(uploadFile);
};
const passwordHash = password => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};
const passwordMatches = (password, stored) => {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const calculated = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(calculated, Buffer.from(key, 'hex'));
};
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => {
  const [key, ...rest] = v.trim().split('=');
  return [key, decodeURIComponent(rest.join('='))];
}));
const createSession = (res, userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 30 * 864e5).toISOString();
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash, userId, expires);
  res.setHeader('Set-Cookie', `hydra_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
};
const auth = req => {
  const token = cookies(req).hydra_session;
  if (!token) return null;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`SELECT u.id,u.name,u.email,u.plan,u.vip,u.subscription_status,u.avatar_url,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.banned_at IS NULL`).get(hash);
  return row || null;
};
const farmFor = userId => db.prepare('SELECT * FROM farms WHERE user_id=?').get(userId);
const isOwner = user => Boolean(user && user.is_admin && String(user.email).toLowerCase() === VIP_EMAIL);
const audit = (adminId, action, targetType, targetId, details='') => db.prepare('INSERT INTO admin_audit_log(admin_id,action,target_type,target_id,details) VALUES(?,?,?,?,?)').run(adminId,action,targetType,String(targetId??''),clean(details,500));

function seedFarm(farmId) {
  const insertChallenge = db.prepare("INSERT INTO challenges(farm_id,title,description,target,progress,unit,ends_at) VALUES(?,?,?,?,?,?,date('now',?))");
  [
    ['7 dias economizando água','Avança nos dias em que o consumo registrado fica dentro da meta.',7,0,'dias','+30 days'],
    ['Rebanho identificado','Avança quando uma etiqueta NFC cadastrada é realmente lida.',50,0,'animais','+60 days'],
    ['Fazenda monitorada','Avança quando um drone volta de uma missão para a base.',10,0,'missões','+60 days']
  ].forEach(c => insertChallenge.run(farmId, ...c));
}

function ensureSocial(farmId) {
  if (!db.prepare('SELECT id FROM challenges WHERE farm_id=? LIMIT 1').get(farmId)) {
    const insertChallenge = db.prepare("INSERT INTO challenges(farm_id,title,description,target,progress,unit,ends_at) VALUES(?,?,?,?,?,?,date('now',?))");
    [['7 dias economizando água','Avança nos dias em que o consumo registrado fica dentro da meta.',7,0,'dias','+30 days'],['Rebanho identificado','Avança quando uma etiqueta NFC cadastrada é realmente lida.',50,0,'animais','+60 days'],['Fazenda monitorada','Avança quando um drone volta de uma missão para a base.',10,0,'missões','+60 days']].forEach(c => insertChallenge.run(farmId, ...c));
  }
}

function dashboard(farm) {
  const today = db.prepare("SELECT COALESCE(SUM(liters),0) total FROM water_logs WHERE farm_id=? AND date(recorded_at)=date('now')").get(farm.id).total;
  const animalStats = db.prepare("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status='Saudável' THEN 1 ELSE 0 END),0) healthy,COALESCE(SUM(CASE WHEN status!='Saudável' THEN 1 ELSE 0 END),0) attention FROM animals WHERE farm_id=?").get(farm.id);
  const dronesActive = db.prepare("SELECT COUNT(*) total FROM drones WHERE farm_id=? AND status='Em voo'").get(farm.id).total;
  const reservoirs = db.prepare('SELECT * FROM reservoirs WHERE farm_id=? ORDER BY level ASC').all(farm.id);
  const history = db.prepare("SELECT date(recorded_at) day,SUM(liters) liters FROM water_logs WHERE farm_id=? AND recorded_at>=date('now','-6 days') GROUP BY date(recorded_at) ORDER BY day").all(farm.id);
  const notifications = db.prepare('SELECT * FROM notifications WHERE farm_id=? ORDER BY created_at DESC LIMIT 5').all(farm.id);
  const streak = db.prepare("SELECT COUNT(DISTINCT date(recorded_at)) total FROM water_logs WHERE farm_id=? AND liters<=? AND recorded_at>=date('now','-30 days')").get(farm.id,farm.water_goal).total;
  const waterLogCount = db.prepare('SELECT COUNT(*) total FROM water_logs WHERE farm_id=?').get(farm.id).total;
  const waterScore = waterLogCount ? Math.max(0,Math.min(100,Math.round((1-(today/(farm.water_goal||1)))*100))) : 0;
  const healthScore = animalStats.total ? Math.round((animalStats.healthy/animalStats.total)*100) : 0;
  const challengeRows = db.prepare('SELECT target,progress FROM challenges WHERE farm_id=?').all(farm.id);
  const challengeScore = challengeRows.length ? Math.round(challengeRows.reduce((sum,item)=>sum+Math.min(1,item.progress/item.target),0)/challengeRows.length*100) : 0;
  const sustainabilityScore = Math.round((waterScore*.4)+(healthScore*.35)+(challengeScore*.25));
  const tasks=[];const low=reservoirs.find(item=>item.level<30);if(!waterLogCount)tasks.push({type:'water',title:'Registrar a primeira leitura de água',route:'water'});if(!animalStats.total)tasks.push({type:'animal',title:'Cadastrar o primeiro animal',route:'animals'});if(!db.prepare('SELECT id FROM drones WHERE farm_id=? LIMIT 1').get(farm.id))tasks.push({type:'drone',title:'Conectar o primeiro drone',route:'drones'});if(low)tasks.push({type:'water',title:`Atualizar ${low.name}`,route:'water'});if(animalStats.attention)tasks.push({type:'animal',title:`Acompanhar ${animalStats.attention} animal(is)`,route:'animals'});
  const tips=['Revise vazamentos antes de iniciar a irrigação.','Agrupe inspeções para reduzir deslocamentos.','Atualize as etiquetas NFC após cada manejo.','Compare o consumo diário antes de mudar a irrigação.'];
  return { todayWater: today, animalStats, dronesActive, reservoirs, history, notifications, waterGoal: farm.water_goal, streak, sustainabilityScore, tasks, tip:tips[new Date().getDate()%tips.length] };
}

async function api(req, res, pathname) {
  try {
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body=await readBody(req),name=clean(body.name,80),email=clean(body.email,150).toLowerCase(),password=String(body.password||'');
      if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8)return json(res,400,{error:'Informe nome, e-mail válido e uma senha com no mínimo 8 caracteres.'});
      if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return json(res,409,{error:'Este e-mail já está cadastrado.'});
      const vipPlan=db.prepare('SELECT plan FROM vip_allowlist WHERE lower(email)=?').get(email),plan=vipPlan?.plan||'free',vip=vipPlan?1:0,status=vipPlan?'active':'inactive',isAdmin=email===VIP_EMAIL?1:0;
      const result=db.prepare('INSERT INTO users(name,email,password_hash,plan,vip,subscription_status,is_admin) VALUES(?,?,?,?,?,?,?)').run(name,email,passwordHash(password),plan,vip,status,isAdmin);
      if(vipPlan)db.prepare('INSERT INTO subscriptions(user_id,plan,status,provider,provider_reference) VALUES(?,?,?,?,?)').run(Number(result.lastInsertRowid),plan,'active','vip_allowlist',email);
      createSession(res,Number(result.lastInsertRowid));return json(res,201,{ok:true});
    }
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const email=clean(body.email,150).toLowerCase();let user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user || !passwordMatches(String(body.password || ''), user.password_hash)) return json(res, 401, { error: 'E-mail ou senha incorretos.' });
      if(user.banned_at)return json(res,403,{error:`Esta conta foi suspensa${user.banned_reason?`: ${user.banned_reason}`:'.'}`});
      if(db.prepare('SELECT 1 FROM vip_allowlist WHERE lower(email)=?').get(email)){db.prepare("UPDATE users SET plan='pro',vip=1,subscription_status='active',is_admin=1 WHERE id=?").run(user.id);user=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);}
      createSession(res, user.id);
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = cookies(req).hydra_session;
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
      res.setHeader('Set-Cookie', 'hydra_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(res, 200, { ok: true });
    }
    if(pathname==='/api/billing/webhook'&&req.method==='POST'){
      const configured=String(process.env.HYDRA_BILLING_WEBHOOK_SECRET||''),provided=String(req.headers['x-hydra-webhook-secret']||'');
      const configuredHash=crypto.createHash('sha256').update(configured).digest(),providedHash=crypto.createHash('sha256').update(provided).digest();
      if(!configured)return json(res,503,{error:'Webhook de cobrança não configurado.'});if(!crypto.timingSafeEqual(configuredHash,providedHash))return json(res,401,{error:'Assinatura do webhook inválida.'});
      const b=await readBody(req),email=clean(b.email,150).toLowerCase(),status=clean(b.status,30),reference=clean(b.reference,160),account=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(!account)return json(res,404,{error:'Conta não encontrada.'});if(!['active','canceled','expired'].includes(status))return json(res,400,{error:'Status de assinatura inválido.'});
      const vip=Boolean(db.prepare('SELECT 1 FROM vip_allowlist WHERE lower(email)=?').get(email)),active=status==='active'||vip;db.prepare('UPDATE users SET plan=?,vip=?,subscription_status=? WHERE id=?').run(active?'pro':'free',vip?1:0,active?'active':status,account.id);db.prepare('INSERT INTO subscriptions(user_id,plan,status,provider,provider_reference,expires_at) VALUES(?,?,?,?,?,?)').run(account.id,'pro',status,clean(b.provider,60)||'checkout',reference||null,b.expires_at||null);return json(res,200,{ok:true,active});
    }
    const user = auth(req);
    if (!user) return json(res, 401, { error: 'Faça login para continuar.' });
    let farm = farmFor(user.id);
    if (pathname === '/api/me' && req.method === 'GET') return json(res, 200, { user, farm: farm || null });
    if(pathname==='/api/profile'&&req.method==='PATCH'){
      const b=await readBody(req),name=clean(b.name,80)||user.name,current=db.prepare('SELECT avatar_url FROM users WHERE id=?').get(user.id);if(name.length<2)return json(res,400,{error:'Informe um nome válido.'});const avatarUrl=b.removeAvatar?null:(b.avatar?savePostImage(b.avatar):current.avatar_url);if(current.avatar_url&&current.avatar_url!==avatarUrl)removePostImage(current.avatar_url);db.prepare('UPDATE users SET name=?,avatar_url=? WHERE id=?').run(name,avatarUrl,user.id);const updated=db.prepare('SELECT id,name,email,plan,vip,subscription_status,avatar_url,is_admin FROM users WHERE id=?').get(user.id);return json(res,200,updated);
    }
    if(pathname==='/api/announcements'&&req.method==='GET')return json(res,200,db.prepare("SELECT id,type,title,message,starts_at,ends_at,created_at FROM app_announcements WHERE active=1 AND datetime(starts_at)<=datetime('now') AND (ends_at IS NULL OR datetime(ends_at)>datetime('now')) ORDER BY CASE type WHEN 'maintenance' THEN 1 WHEN 'update' THEN 2 ELSE 3 END,created_at DESC").all());
    if(pathname==='/api/admin/overview'&&req.method==='GET'){
      if(!isOwner(user))return json(res,403,{error:'Acesso exclusivo do administrador.'});const users=db.prepare(`SELECT u.id,u.name,u.email,u.plan,u.vip,u.is_admin,u.banned_at,u.banned_reason,u.created_at,u.avatar_url,f.name farm_name,(SELECT COUNT(*) FROM posts p WHERE p.farm_id=f.id) posts,(SELECT COUNT(*) FROM animals a WHERE a.farm_id=f.id) animals FROM users u LEFT JOIN farms f ON f.user_id=u.id ORDER BY u.created_at DESC`).all();const announcements=db.prepare('SELECT a.*,u.name author_name FROM app_announcements a JOIN users u ON u.id=a.author_id ORDER BY a.created_at DESC').all();const auditLog=db.prepare('SELECT l.*,u.name admin_name FROM admin_audit_log l JOIN users u ON u.id=l.admin_id ORDER BY l.created_at DESC LIMIT 30').all();const reports=db.prepare(`SELECT r.id,r.reason,r.created_at,p.content,u.name reporter_name,f.name farm_name FROM post_reports r JOIN users u ON u.id=r.user_id JOIN posts p ON p.id=r.post_id JOIN farms f ON f.id=p.farm_id ORDER BY r.created_at DESC LIMIT 30`).all();return json(res,200,{counts:{users:users.length,banned:users.filter(item=>item.banned_at).length,farms:db.prepare('SELECT COUNT(*) total FROM farms').get().total,posts:db.prepare('SELECT COUNT(*) total FROM posts').get().total,reports:db.prepare('SELECT COUNT(*) total FROM post_reports').get().total},users,announcements,auditLog,reports});
    }
    if(pathname==='/api/admin/announcements'&&req.method==='POST'){
      if(!isOwner(user))return json(res,403,{error:'Acesso exclusivo do administrador.'});const b=await readBody(req),type=clean(b.type,20),title=clean(b.title,100),message=clean(b.message,500),endsAt=clean(b.ends_at,40)||null;if(!['info','update','maintenance'].includes(type)||title.length<3||message.length<3)return json(res,400,{error:'Informe tipo, título e mensagem válidos.'});const result=db.prepare('INSERT INTO app_announcements(author_id,type,title,message,active,starts_at,ends_at) VALUES(?,?,?,?,?,?,?)').run(user.id,type,title,message,b.active===false?0:1,clean(b.starts_at,40)||new Date().toISOString(),endsAt);audit(user.id,'create_announcement','announcement',result.lastInsertRowid,title);return json(res,201,db.prepare('SELECT * FROM app_announcements WHERE id=?').get(Number(result.lastInsertRowid)));
    }
    const adminAnnouncementMatch=pathname.match(/^\/api\/admin\/announcements\/(\d+)$/);
    if(adminAnnouncementMatch&&req.method==='PATCH'){
      if(!isOwner(user))return json(res,403,{error:'Acesso exclusivo do administrador.'});const id=Number(adminAnnouncementMatch[1]),current=db.prepare('SELECT * FROM app_announcements WHERE id=?').get(id);if(!current)return json(res,404,{error:'Aviso não encontrado.'});const b=await readBody(req),type=clean(b.type??current.type,20),title=clean(b.title??current.title,100),message=clean(b.message??current.message,500),active=b.active===undefined?current.active:(b.active?1:0),startsAt=clean(b.starts_at??current.starts_at,40),endsAt=b.ends_at===undefined?current.ends_at:(clean(b.ends_at,40)||null);if(!['info','update','maintenance'].includes(type)||title.length<3||message.length<3)return json(res,400,{error:'Dados do aviso inválidos.'});db.prepare("UPDATE app_announcements SET type=?,title=?,message=?,active=?,starts_at=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(type,title,message,active,startsAt,endsAt,id);audit(user.id,'update_announcement','announcement',id,`${title} · ${active?'ativo':'inativo'}`);return json(res,200,{ok:true});
    }
    if(adminAnnouncementMatch&&req.method==='DELETE'){
      if(!isOwner(user))return json(res,403,{error:'Acesso exclusivo do administrador.'});const id=Number(adminAnnouncementMatch[1]),result=db.prepare('DELETE FROM app_announcements WHERE id=?').run(id);if(!result.changes)return json(res,404,{error:'Aviso não encontrado.'});audit(user.id,'delete_announcement','announcement',id);return json(res,200,{ok:true});
    }
    const adminBanMatch=pathname.match(/^\/api\/admin\/users\/(\d+)\/(ban|unban)$/);
    if(adminBanMatch&&req.method==='POST'){
      if(!isOwner(user))return json(res,403,{error:'Acesso exclusivo do administrador.'});const targetId=Number(adminBanMatch[1]),action=adminBanMatch[2],target=db.prepare('SELECT id,name,email,is_admin FROM users WHERE id=?').get(targetId);if(!target)return json(res,404,{error:'Usuário não encontrado.'});if(target.id===user.id||target.is_admin)return json(res,400,{error:'Uma conta administrativa não pode ser suspensa por este painel.'});if(action==='ban'){const b=await readBody(req),reason=clean(b.reason,200);if(reason.length<3)return json(res,400,{error:'Informe o motivo do banimento.'});db.prepare("UPDATE users SET banned_at=CURRENT_TIMESTAMP,banned_reason=? WHERE id=?").run(reason,targetId);db.prepare('DELETE FROM sessions WHERE user_id=?').run(targetId);audit(user.id,'ban_user','user',targetId,`${target.email} · ${reason}`);return json(res,200,{ok:true,banned:true});}db.prepare('UPDATE users SET banned_at=NULL,banned_reason=NULL WHERE id=?').run(targetId);audit(user.id,'unban_user','user',targetId,target.email);return json(res,200,{ok:true,banned:false});
    }
    if(pathname==='/api/billing'&&req.method==='GET')return json(res,200,{current:{plan:user.plan,vip:Boolean(user.vip),status:user.subscription_status},plans:[{id:'free',name:'Gratuito',price:'R$ 0',features:['Gestão essencial da fazenda','Comunidade completa','Até 50 animais e 2 drones']},{id:'pro',name:'Hydra Agro Pro',price:process.env.HYDRA_PRO_PRICE||'Preço no checkout',features:['Cadastros ilimitados','Exportação completa dos dados','Selo Pro/VIP no perfil','Suporte prioritário']}]});
    if(pathname==='/api/billing/checkout'&&req.method==='POST'){
      if(user.plan==='pro'&&user.subscription_status==='active')return json(res,200,{active:true});
      const checkoutUrl=process.env.HYDRA_PRO_CHECKOUT_URL;if(!checkoutUrl)return json(res,503,{error:'O checkout ainda não foi configurado pelo administrador.'});
      return json(res,200,{url:String(checkoutUrl).replaceAll('{email}',encodeURIComponent(user.email)).replaceAll('{user_id}',encodeURIComponent(user.id))});
    }
    if (pathname === '/api/farm' && req.method === 'POST') {
      if (farm) return json(res, 409, { error: 'Você já possui uma fazenda cadastrada.' });
      const body = await readBody(req);
      const name = clean(body.name, 100), city = clean(body.city, 80), state = clean(body.state, 2).toUpperCase(), activity = clean(body.activity, 80);
      const area = Math.max(0, Number(body.area) || 0), waterGoal=Math.max(1,Math.round(Number(body.water_goal)||3500));
      if (name.length < 2 || city.length < 2 || state.length !== 2) return json(res, 400, { error: 'Informe nome, cidade e UF da propriedade.' });
      const result = db.prepare('INSERT INTO farms(user_id,name,city,state,area,activity,water_goal) VALUES(?,?,?,?,?,?,?)').run(user.id, name, city, state, area, activity || 'Pecuária e agricultura',waterGoal);
      seedFarm(Number(result.lastInsertRowid));
      return json(res, 201, { ok: true });
    }
    if (!farm) return json(res, 428, { error: 'Cadastre sua propriedade primeiro.' });
    if (pathname === '/api/farm' && req.method === 'PATCH') {
      const b=await readBody(req),name=clean(b.name,100),city=clean(b.city,80),stateCode=clean(b.state,2).toUpperCase(),activity=clean(b.activity,80),area=Math.max(0,Number(b.area)||0),waterGoal=Math.max(1,Math.round(Number(b.water_goal)||farm.water_goal));
      if(name.length<2||city.length<2||stateCode.length!==2)return json(res,400,{error:'Informe nome, cidade e UF válidos.'});
      db.prepare('UPDATE farms SET name=?,city=?,state=?,area=?,activity=?,water_goal=? WHERE id=? AND user_id=?').run(name,city,stateCode,area,activity||farm.activity,waterGoal,farm.id,user.id);
      farm=farmFor(user.id);
      return json(res,200,farm);
    }
    if (pathname === '/api/dashboard' && req.method === 'GET') return json(res, 200, dashboard(farm));
    if (pathname === '/api/animals' && req.method === 'GET') return json(res, 200, db.prepare('SELECT * FROM animals WHERE farm_id=? ORDER BY id DESC').all(farm.id));
    if (pathname === '/api/animals' && req.method === 'POST') {
      const b = await readBody(req), tag = clean(b.tag, 30).toUpperCase(), name = clean(b.name, 80), sector = clean(b.sector, 80);
      if (!tag || !name || !sector) return json(res, 400, { error: 'Informe identificação NFC, nome e setor.' });
      if(user.plan!=='pro'&&db.prepare('SELECT COUNT(*) total FROM animals WHERE farm_id=?').get(farm.id).total>=50)return json(res,403,{error:'O plano Gratuito permite até 50 animais. Abra Planos para conhecer o Pro.'});
      try {
        const result = db.prepare('INSERT INTO animals(farm_id,tag,name,species,breed,sector,status,weight) VALUES(?,?,?,?,?,?,?,?)').run(farm.id,tag,name,clean(b.species,50)||'Bovino',clean(b.breed,50),sector,clean(b.status,30)||'Saudável',Number(b.weight)||0);
        return json(res, 201, db.prepare('SELECT * FROM animals WHERE id=?').get(Number(result.lastInsertRowid)));
      } catch (e) { if (e.message.includes('UNIQUE')) return json(res,409,{error:'Esta etiqueta NFC já está cadastrada.'}); throw e; }
    }
    const animalMatch = pathname.match(/^\/api\/animals\/(\d+)$/);
    if (animalMatch && req.method === 'DELETE') {
      const result = db.prepare('DELETE FROM animals WHERE id=? AND farm_id=?').run(Number(animalMatch[1]), farm.id);
      return json(res, result.changes ? 200 : 404, result.changes ? {ok:true} : {error:'Animal não encontrado.'});
    }
    if(pathname==='/api/nfc'&&req.method==='GET'){
      const history=db.prepare(`SELECT s.id,s.tag,s.result,s.scanned_at,a.id animal_id,a.name animal_name,a.status animal_status FROM nfc_scans s LEFT JOIN animals a ON a.id=s.animal_id WHERE s.farm_id=? ORDER BY s.scanned_at DESC LIMIT 50`).all(farm.id),stats=db.prepare(`SELECT COUNT(*) scans,COUNT(DISTINCT CASE WHEN animal_id IS NOT NULL THEN animal_id END) identified FROM nfc_scans WHERE farm_id=?`).get(farm.id);return json(res,200,{stats:{...stats,registered:db.prepare('SELECT COUNT(*) total FROM animals WHERE farm_id=?').get(farm.id).total},history});
    }
    if(pathname==='/api/nfc/scan'&&req.method==='POST'){
      const b=await readBody(req),tag=clean(b.tag,60).toUpperCase();if(!tag)return json(res,400,{error:'Informe ou aproxime uma etiqueta NFC.'});const animal=db.prepare('SELECT * FROM animals WHERE farm_id=? AND upper(tag)=?').get(farm.id,tag),result=animal?'identified':'unregistered';const inserted=db.prepare('INSERT INTO nfc_scans(farm_id,user_id,animal_id,tag,result) VALUES(?,?,?,?,?)').run(farm.id,user.id,animal?.id||null,tag,result);if(animal){db.prepare('UPDATE animals SET last_seen=CURRENT_TIMESTAMP WHERE id=?').run(animal.id);const identified=db.prepare('SELECT COUNT(DISTINCT animal_id) total FROM nfc_scans WHERE farm_id=? AND animal_id IS NOT NULL').get(farm.id).total;db.prepare("UPDATE challenges SET progress=MIN(target,?) WHERE farm_id=? AND title='Rebanho identificado'").run(identified,farm.id);}return json(res,201,{scan:db.prepare('SELECT * FROM nfc_scans WHERE id=?').get(Number(inserted.lastInsertRowid)),animal:animal||null});
    }
    if (pathname === '/api/water' && req.method === 'GET') return json(res, 200, { reservoirs: db.prepare('SELECT * FROM reservoirs WHERE farm_id=? ORDER BY id').all(farm.id), history: dashboard(farm).history });
    if (pathname === '/api/water' && req.method === 'POST') {
      const b = await readBody(req), liters = Math.round(Number(b.liters));
      if (!liters || liters < 1) return json(res,400,{error:'Informe uma quantidade válida de litros.'});
      db.prepare('INSERT INTO water_logs(farm_id,sector,liters) VALUES(?,?,?)').run(farm.id, clean(b.sector,80)||'Geral', liters);
      const daysWithinGoal=db.prepare("SELECT COUNT(*) total FROM (SELECT date(recorded_at) day FROM water_logs WHERE farm_id=? AND recorded_at>=date('now','-29 days') GROUP BY date(recorded_at) HAVING SUM(liters)<=?)").get(farm.id,farm.water_goal).total;
      db.prepare("UPDATE challenges SET progress=MIN(target,?) WHERE farm_id=? AND title='7 dias economizando água'").run(daysWithinGoal,farm.id);
      return json(res,201,{ok:true});
    }
    if(pathname==='/api/reservoirs'&&req.method==='POST'){
      const b=await readBody(req),name=clean(b.name,80),sector=clean(b.sector,80),capacity=Math.round(Number(b.capacity)),level=Math.min(100,Math.max(0,Math.round(Number(b.level))));if(!name||!sector||!capacity||capacity<1)return json(res,400,{error:'Informe nome, setor e capacidade do reservatório.'});const result=db.prepare('INSERT INTO reservoirs(farm_id,name,sector,capacity,level) VALUES(?,?,?,?,?)').run(farm.id,name,sector,capacity,level);return json(res,201,db.prepare('SELECT * FROM reservoirs WHERE id=?').get(Number(result.lastInsertRowid)));
    }
    const reservoirMatch = pathname.match(/^\/api\/reservoirs\/(\d+)$/);
    if (reservoirMatch && req.method === 'PATCH') {
      const b=await readBody(req), level=Math.min(100,Math.max(0,Math.round(Number(b.level))));
      db.prepare("UPDATE reservoirs SET level=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=?").run(level,Number(reservoirMatch[1]),farm.id);
      return json(res,200,{ok:true});
    }
    if (pathname === '/api/drones' && req.method === 'GET') return json(res,200,db.prepare('SELECT * FROM drones WHERE farm_id=? ORDER BY id').all(farm.id));
    if (pathname === '/api/drones' && req.method === 'POST') {
      const b=await readBody(req),name=clean(b.name,80),model=clean(b.model,80),mission=clean(b.mission,120);
      if(!name||!model)return json(res,400,{error:'Informe o nome e o modelo do drone.'});
      if(user.plan!=='pro'&&db.prepare('SELECT COUNT(*) total FROM drones WHERE farm_id=?').get(farm.id).total>=2)return json(res,403,{error:'O plano Gratuito permite até 2 drones. Abra Planos para conhecer o Pro.'});
      const result=db.prepare('INSERT INTO drones(farm_id,name,model,status,battery,mission) VALUES(?,?,?,?,?,?)').run(farm.id,name,model,clean(b.status,30)||'Na base',Math.min(100,Math.max(0,Number(b.battery)||100)),mission||'Disponível');
      return json(res,201,db.prepare('SELECT * FROM drones WHERE id=?').get(Number(result.lastInsertRowid)));
    }
    const droneMatch=pathname.match(/^\/api\/drones\/(\d+)$/);
    if(droneMatch&&req.method==='PATCH'){
      const b=await readBody(req),mission=clean(b.mission,120),status=clean(b.status,30),battery=Math.min(100,Math.max(0,Math.round(Number(b.battery))));
      if(!mission||!status||!Number.isFinite(battery))return json(res,400,{error:'Preencha a missão, o status e a bateria.'});
      const droneId=Number(droneMatch[1]),current=db.prepare('SELECT * FROM drones WHERE id=? AND farm_id=?').get(droneId,farm.id);if(!current)return json(res,404,{error:'Drone não encontrado.'});
      const completed=current.status==='Em voo'&&status==='Na base'&&current.mission!=='Disponível';
      const result=db.prepare('UPDATE drones SET mission=?,status=?,battery=? WHERE id=? AND farm_id=?').run(mission,status,battery,droneId,farm.id);
      if(completed){db.prepare('INSERT INTO drone_missions(farm_id,drone_id,mission) VALUES(?,?,?)').run(farm.id,droneId,current.mission);const completedMissions=db.prepare('SELECT COUNT(*) total FROM drone_missions WHERE farm_id=?').get(farm.id).total;db.prepare("UPDATE challenges SET progress=MIN(target,?) WHERE farm_id=? AND title='Fazenda monitorada'").run(completedMissions,farm.id);}
      return json(res,result.changes?200:404,result.changes?{ok:true,missionCompleted:completed}:{error:'Drone não encontrado.'});
    }
    if (pathname === '/api/notifications' && req.method === 'GET') return json(res,200,db.prepare('SELECT * FROM notifications WHERE farm_id=? ORDER BY created_at DESC').all(farm.id));
    if (pathname === '/api/notifications/read' && req.method === 'POST') { db.prepare('UPDATE notifications SET read=1 WHERE farm_id=?').run(farm.id); return json(res,200,{ok:true}); }
    if (pathname === '/api/weather' && req.method === 'GET') {
      const key=`${farm.city}-${farm.state}`.toLowerCase(),cached=weatherCache.get(key);if(cached&&Date.now()-cached.time<1_200_000)return json(res,200,cached.value);
      try{const geoResponse=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(farm.city)}&countryCode=BR&count=1&language=pt`,{signal:AbortSignal.timeout(3500)});const geo=await geoResponse.json();const place=geo.results?.[0];if(!place)throw new Error('Cidade não localizada');const weatherResponse=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`,{signal:AbortSignal.timeout(3500)});const weather=await weatherResponse.json();const value={available:true,temperature:Math.round(weather.current.temperature_2m),code:weather.current.weather_code,city:farm.city};weatherCache.set(key,{time:Date.now(),value});return json(res,200,value)}catch{return json(res,200,{available:false,city:farm.city})}
    }
    if (pathname === '/api/social' && req.method === 'GET') {
      ensureSocial(farm.id);
      const posts = db.prepare(`SELECT p.*,f.name farm_name,f.city farm_city,f.state farm_state,u.name author_name,u.avatar_url author_avatar,
        CASE WHEN p.farm_id=? THEN 1 ELSE 0 END mine,
        CASE WHEN EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) THEN 1 ELSE 0 END liked,
        CASE WHEN EXISTS(SELECT 1 FROM post_saves s WHERE s.post_id=p.id AND s.user_id=?) THEN 1 ELSE 0 END saved,
        CASE WHEN EXISTS(SELECT 1 FROM farm_follows ff WHERE ff.farm_id=p.farm_id AND ff.follower_id=?) THEN 1 ELSE 0 END followed
        FROM posts p JOIN farms f ON f.id=p.farm_id JOIN users u ON u.id=f.user_id ORDER BY p.created_at DESC`).all(farm.id,user.id,user.id,user.id);
      const challenges = db.prepare('SELECT * FROM challenges WHERE farm_id=? ORDER BY id').all(farm.id);
      const rankingRows=db.prepare(`SELECT f.id,f.name,f.city,f.state,f.water_goal,COUNT(d.day) measured_days,COALESCE(AVG(d.daily_total),0) average FROM farms f LEFT JOIN (SELECT farm_id,date(recorded_at) day,SUM(liters) daily_total FROM water_logs GROUP BY farm_id,date(recorded_at)) d ON d.farm_id=f.id GROUP BY f.id ORDER BY f.id`).all();
      const rankingBase=rankingRows.map(row=>({id:row.id,name:row.name,city:`${row.city}, ${row.state}`,saving:row.measured_days?Math.max(0,Math.min(100,Math.round((1-(row.average/(row.water_goal||1)))*100))):0,qualified:Boolean(row.measured_days),mine:row.id===farm.id}));
      const qualified=rankingBase.filter(row=>row.qualified).sort((a,b)=>b.saving-a.saving).map((row,index)=>({...row,position:index+1}));
      const ranking=[...qualified,...rankingBase.filter(row=>!row.qualified).map(row=>({...row,position:0}))];
      return json(res,200,{posts,challenges,ranking});
    }
    if (pathname === '/api/posts' && req.method === 'POST') {
      const b=await readBody(req),content=clean(b.content,500),category=clean(b.category,50)||'Atualização';
      if(content.length<3)return json(res,400,{error:'Escreva uma atualização antes de publicar.'});
      const imageUrl=savePostImage(b.image);
      const result=db.prepare('INSERT INTO posts(farm_id,category,content,image_url) VALUES(?,?,?,?)').run(farm.id,category,content,imageUrl);
      return json(res,201,db.prepare('SELECT * FROM posts WHERE id=?').get(Number(result.lastInsertRowid)));
    }
    const postLikeMatch=pathname.match(/^\/api\/posts\/(\d+)\/like$/);
    if(postLikeMatch&&req.method==='POST'){
      const postId=Number(postLikeMatch[1]);if(!db.prepare('SELECT id FROM posts WHERE id=?').get(postId))return json(res,404,{error:'Publicação não encontrada.'});
      const exists=db.prepare('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?').get(postId,user.id);if(exists)db.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').run(postId,user.id);else db.prepare('INSERT INTO post_likes(post_id,user_id) VALUES(?,?)').run(postId,user.id);
      const count=db.prepare('SELECT COUNT(*) count FROM post_likes WHERE post_id=?').get(postId).count;db.prepare('UPDATE posts SET reactions=? WHERE id=?').run(count,postId);return json(res,200,{liked:!exists,count});
    }
    const postSaveMatch=pathname.match(/^\/api\/posts\/(\d+)\/save$/);
    if(postSaveMatch&&req.method==='POST'){
      const postId=Number(postSaveMatch[1]);if(!db.prepare('SELECT id FROM posts WHERE id=?').get(postId))return json(res,404,{error:'Publicação não encontrada.'});
      const exists=db.prepare('SELECT 1 FROM post_saves WHERE post_id=? AND user_id=?').get(postId,user.id);if(exists)db.prepare('DELETE FROM post_saves WHERE post_id=? AND user_id=?').run(postId,user.id);else db.prepare('INSERT INTO post_saves(post_id,user_id) VALUES(?,?)').run(postId,user.id);return json(res,200,{saved:!exists});
    }
    const postCommentsMatch=pathname.match(/^\/api\/posts\/(\d+)\/comments$/);
    if(postCommentsMatch&&req.method==='GET'){
      const postId=Number(postCommentsMatch[1]);return json(res,200,db.prepare('SELECT c.*,u.name author_name,CASE WHEN c.user_id=? THEN 1 ELSE 0 END mine FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at').all(user.id,postId));
    }
    if(postCommentsMatch&&req.method==='POST'){
      const postId=Number(postCommentsMatch[1]),b=await readBody(req),content=clean(b.content,300);if(!db.prepare('SELECT id FROM posts WHERE id=?').get(postId))return json(res,404,{error:'Publicação não encontrada.'});if(content.length<1)return json(res,400,{error:'Escreva um comentário.'});
      db.prepare('INSERT INTO post_comments(post_id,user_id,content) VALUES(?,?,?)').run(postId,user.id,content);const count=db.prepare('SELECT COUNT(*) count FROM post_comments WHERE post_id=?').get(postId).count;db.prepare('UPDATE posts SET comments=? WHERE id=?').run(count,postId);return json(res,201,{ok:true,count});
    }
    const commentMatch=pathname.match(/^\/api\/comments\/(\d+)$/);
    if(commentMatch&&req.method==='PATCH'){
      const b=await readBody(req),content=clean(b.content,300);if(!content)return json(res,400,{error:'O comentário não pode ficar vazio.'});const result=db.prepare('UPDATE post_comments SET content=? WHERE id=? AND user_id=?').run(content,Number(commentMatch[1]),user.id);return json(res,result.changes?200:403,result.changes?{ok:true}:{error:'Você só pode editar seu comentário.'});
    }
    if(commentMatch&&req.method==='DELETE'){
      const comment=db.prepare('SELECT post_id FROM post_comments WHERE id=? AND user_id=?').get(Number(commentMatch[1]),user.id);if(!comment)return json(res,403,{error:'Você só pode excluir seu comentário.'});db.prepare('DELETE FROM post_comments WHERE id=?').run(Number(commentMatch[1]));const count=db.prepare('SELECT COUNT(*) count FROM post_comments WHERE post_id=?').get(comment.post_id).count;db.prepare('UPDATE posts SET comments=? WHERE id=?').run(count,comment.post_id);return json(res,200,{ok:true,count});
    }
    const postDeleteMatch=pathname.match(/^\/api\/posts\/(\d+)$/);
    if(postDeleteMatch&&req.method==='PATCH'){
      const b=await readBody(req),content=clean(b.content,500),category=clean(b.category,50)||'Atualização';if(content.length<3)return json(res,400,{error:'A publicação precisa de conteúdo.'});const current=db.prepare('SELECT * FROM posts WHERE id=? AND farm_id=?').get(Number(postDeleteMatch[1]),farm.id);if(!current)return json(res,403,{error:'Você só pode editar suas publicações.'});const imageUrl=b.removeImage?null:(b.image?savePostImage(b.image):current.image_url);if(current.image_url&&current.image_url!==imageUrl)removePostImage(current.image_url);db.prepare('UPDATE posts SET content=?,category=?,image_url=? WHERE id=?').run(content,category,imageUrl,current.id);return json(res,200,{ok:true});
    }
    if(postDeleteMatch&&req.method==='DELETE'){
      const current=db.prepare('SELECT image_url FROM posts WHERE id=? AND farm_id=?').get(Number(postDeleteMatch[1]),farm.id);if(!current)return json(res,403,{error:'Você só pode excluir suas publicações.'});db.prepare('DELETE FROM posts WHERE id=? AND farm_id=?').run(Number(postDeleteMatch[1]),farm.id);removePostImage(current.image_url);return json(res,200,{ok:true});
    }
    const reportMatch=pathname.match(/^\/api\/posts\/(\d+)\/report$/);
    if(reportMatch&&req.method==='POST'){
      const b=await readBody(req),reason=clean(b.reason,160)||'Conteúdo inadequado';try{db.prepare('INSERT INTO post_reports(post_id,user_id,reason) VALUES(?,?,?)').run(Number(reportMatch[1]),user.id,reason)}catch(error){if(String(error.message).includes('UNIQUE'))return json(res,409,{error:'Você já denunciou esta publicação.'});throw error}return json(res,201,{ok:true});
    }
    const followMatch=pathname.match(/^\/api\/farms\/(\d+)\/follow$/);
    if(followMatch&&req.method==='POST'){
      const farmId=Number(followMatch[1]);if(farmId===farm.id)return json(res,400,{error:'Esta já é sua fazenda.'});if(!db.prepare('SELECT id FROM farms WHERE id=?').get(farmId))return json(res,404,{error:'Fazenda não encontrada.'});const exists=db.prepare('SELECT 1 FROM farm_follows WHERE farm_id=? AND follower_id=?').get(farmId,user.id);if(exists)db.prepare('DELETE FROM farm_follows WHERE farm_id=? AND follower_id=?').run(farmId,user.id);else db.prepare('INSERT INTO farm_follows(farm_id,follower_id) VALUES(?,?)').run(farmId,user.id);return json(res,200,{followed:!exists});
    }
    const farmProfileMatch=pathname.match(/^\/api\/farms\/(\d+)\/profile$/);
    if(farmProfileMatch&&req.method==='GET'){
      const profile=db.prepare(`SELECT f.id,f.name,f.city,f.state,f.area,f.activity,u.avatar_url owner_avatar,COUNT(DISTINCT a.id) animals,COUNT(DISTINCT p.id) posts,(SELECT COUNT(*) FROM farm_follows ff WHERE ff.farm_id=f.id) followers FROM farms f JOIN users u ON u.id=f.user_id LEFT JOIN animals a ON a.farm_id=f.id LEFT JOIN posts p ON p.farm_id=f.id WHERE f.id=? GROUP BY f.id`).get(Number(farmProfileMatch[1]));return profile?json(res,200,profile):json(res,404,{error:'Fazenda não encontrada.'});
    }
    if(pathname==='/api/settings'&&req.method==='GET'){
      db.prepare('INSERT OR IGNORE INTO user_settings(user_id) VALUES(?)').run(user.id);return json(res,200,db.prepare('SELECT notifications,animations,compact_mode,dark_mode FROM user_settings WHERE user_id=?').get(user.id));
    }
    if(pathname==='/api/settings'&&req.method==='PATCH'){
      const b=await readBody(req);db.prepare('INSERT OR IGNORE INTO user_settings(user_id) VALUES(?)').run(user.id);db.prepare('UPDATE user_settings SET notifications=?,animations=?,compact_mode=?,dark_mode=? WHERE user_id=?').run(b.notifications?1:0,b.animations?1:0,b.compact_mode?1:0,b.dark_mode?1:0,user.id);return json(res,200,{ok:true});
    }
    if(pathname==='/api/export'&&req.method==='GET'){
      if(user.plan!=='pro'||user.subscription_status!=='active')return json(res,403,{error:'A exportação completa é um recurso do Hydra Agro Pro.'});
      return json(res,200,{generated_at:new Date().toISOString(),user:{name:user.name,email:user.email,plan:user.plan,avatar_url:user.avatar_url},farm,animals:db.prepare('SELECT * FROM animals WHERE farm_id=? ORDER BY id').all(farm.id),nfc_scans:db.prepare('SELECT tag,result,scanned_at,animal_id FROM nfc_scans WHERE farm_id=? ORDER BY scanned_at').all(farm.id),reservoirs:db.prepare('SELECT * FROM reservoirs WHERE farm_id=? ORDER BY id').all(farm.id),water_logs:db.prepare('SELECT * FROM water_logs WHERE farm_id=? ORDER BY recorded_at').all(farm.id),drones:db.prepare('SELECT * FROM drones WHERE farm_id=? ORDER BY id').all(farm.id),drone_missions:db.prepare('SELECT drone_id,mission,completed_at FROM drone_missions WHERE farm_id=? ORDER BY completed_at').all(farm.id),challenges:db.prepare('SELECT * FROM challenges WHERE farm_id=? ORDER BY id').all(farm.id),posts:db.prepare('SELECT id,category,content,image_url,reactions,comments,created_at FROM posts WHERE farm_id=? ORDER BY created_at').all(farm.id)});
    }
    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Não foi possível concluir a operação.' });
  }
}

function serve(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, safePath);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Não encontrado');
  }
  const ext = path.extname(file);
  const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json'}[ext] || 'application/octet-stream';
  res.writeHead(200, {'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(req,res,url.pathname);
  return serve(res,url.pathname);
});
if (require.main === module) server.listen(PORT, () => console.log(`Hydra Agro disponível em http://localhost:${PORT}`));

module.exports = { api, dashboard, db, server };
