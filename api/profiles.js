const { verifyToken } = require('@clerk/backend');
const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

async function getUserId(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    return claims.sub || null;
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' });
    return;
  }
  const key = 'sdc:profiles:' + userId;

  if (req.method === 'GET') {
    const data = await redis.get(key);
    res.status(200).json(data || null);
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Datos inválidos.' });
      return;
    }
    await redis.set(key, body);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
};
