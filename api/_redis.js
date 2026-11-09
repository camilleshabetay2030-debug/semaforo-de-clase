const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

/* Sesión a partir del encabezado Authorization: Bearer <token>.
   Devuelve el nombre de usuario (slug) dueño de esa sesión, o null. */
async function getUserId(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const name = await redis.get('sdc:session:' + token);
    return name || null;
  } catch (e) {
    return null;
  }
}

module.exports = { redis: redis, getUserId: getUserId };
