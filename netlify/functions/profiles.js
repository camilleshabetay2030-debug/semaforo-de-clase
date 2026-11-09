const { redis, getUserId } = require('./utils/redis');

function json(statusCode, obj) {
  return { statusCode: statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async function (event) {
  const userId = await getUserId(event);
  if (!userId) {
    return json(401, { error: 'No autorizado. Inicia sesión primero.' });
  }
  const key = 'sdc:profiles:' + userId;

  if (event.httpMethod === 'GET') {
    const data = await redis.get(key);
    return json(200, data || null);
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = null; }
    if (!body || typeof body !== 'object') {
      return json(400, { error: 'Datos inválidos.' });
    }
    await redis.set(key, body);
    return json(200, { ok: true });
  }

  return json(405, { error: 'Método no permitido.' });
};
