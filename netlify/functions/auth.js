const crypto = require('crypto');
const { redis } = require('./utils/redis');

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

function json(statusCode, obj) {
  return { statusCode: statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido.' });
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = null; }
  if (!body || typeof body !== 'object') {
    return json(400, { error: 'Datos inválidos.' });
  }

  if (body.action === 'logout') {
    if (typeof body.token === 'string' && body.token) {
      try { await redis.del('sdc:session:' + body.token); } catch (e) {}
    }
    return json(200, { ok: true });
  }

  const rawName = String(body.name || '').trim();
  const slug = slugify(rawName);
  const password = String(body.password || '');

  if (slug.length < 2) {
    return json(400, { error: 'Escribe tu nombre (al menos 2 letras).' });
  }
  if (password.length < 4) {
    return json(400, { error: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  const userKey = 'sdc:user:' + slug;

  if (body.action === 'signup') {
    const existing = await redis.get(userKey);
    if (existing) {
      return json(409, { error: 'Ya existe una cuenta con ese nombre. Elige otro o inicia sesión.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await redis.set(userKey, { name: rawName.slice(0, 60), salt: salt, hash: hash });
    const token = await newSession(slug);
    return json(200, { token: token, name: rawName.slice(0, 60) });
  }

  if (body.action === 'login') {
    const user = await redis.get(userKey);
    if (!user || !user.salt || !user.hash) {
      return json(401, { error: 'No existe una cuenta con ese nombre.' });
    }
    const candidate = hashPassword(password, user.salt);
    const a = Buffer.from(candidate, 'hex');
    const b = Buffer.from(user.hash, 'hex');
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      return json(401, { error: 'Contraseña incorrecta.' });
    }
    const token = await newSession(slug);
    return json(200, { token: token, name: user.name || rawName });
  }

  return json(400, { error: 'Acción desconocida.' });
};
