const fetch = require('node-fetch');

const UPSTASH_URL = process.env.UPSTASH_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) { return res.status(500).json({ error: 'Upstash not configured' }); }
    const resp = await fetch(`${UPSTASH_URL}/LRANGE/leaderboard/0/-1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] })
    });
    const data = await resp.json();
    const entries = (data.result || []).map(e => { try { return JSON.parse(e); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => b.score !== a.score ? b.score - a.score : b.rating !== a.rating ? b.rating - a.rating : b.ts - a.ts)
      .slice(0, 20);
    res.status(200).json({ entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
