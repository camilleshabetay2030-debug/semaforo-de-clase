const crypto = require('crypto');
const { redis } = require('./_redis');

const SESSION_SECONDS = 60 * 60 * 24 * 60; // 60 días

function slugify(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function newSession(slug) {
  const token = randomToken();
  await redis.set('sdc:session:' + token, slug, { ex: SESSION_SECONDS });
  return token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Datos inválidos.' });
    return;
  }

  if (body.action === 'logout') {
    if (typeof body.token === 'string' && body.token) {
      try { await redis.del('sdc:session:' + body.token); } catch (e) {}
    }
    res.status(200).json({ ok: true });
    return;
  }

  const rawName = String(body.name || '').trim();
  const slug = slugify(rawName);
  const password = String(body.password || '');

  if (slug.length < 2) {
    res.status(400).json({ error: 'Escribe tu nombre (al menos 2 letras).' });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
    return;
  }

  const userKey = 'sdc:user:' + slug;

  if (body.action === 'signup') {
    const existing = await redis.get(userKey);
    if (existing) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese nombre. Elige otro o inicia sesión.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await redis.set(userKey, { name: rawName.slice(0, 60), salt: salt, hash: hash });
    const token = await newSession(slug);
    res.status(200).json({ token: token, name: rawName.slice(0, 60) });
    return;
  }

  if (body.action === 'login') {
    const user = await redis.get(userKey);
    if (!user || !user.salt || !user.hash) {
      res.status(401).json({ error: 'No existe una cuenta con ese nombre.' });
      return;
    }
    const candidate = hashPassword(password, user.salt);
    const a = Buffer.from(candidate, 'hex');
    const b = Buffer.from(user.hash, 'hex');
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      res.status(401).json({ error: 'Contraseña incorrecta.' });
      return;
    }
    const token = await newSession(slug);
    res.status(200).json({ token: token, name: user.name || rawName });
    return;
  }

  res.status(400).json({ error: 'Acción desconocida.' });
};
