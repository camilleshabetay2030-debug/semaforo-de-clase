const { redis, getUserId } = require('./_redis');

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
