const fetch = require('node-fetch');

const UPSTASH_URL = process.env.UPSTASH_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    const data = req.body;

    // Save to Upstash Redis
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const entry = JSON.stringify({ name: data.name || 'Anonymous', score: data.score || 0, rating: data.rating || 0, ts: Date.now(), date: new Date().toLocaleString() });
        await fetch(`${UPSTASH_URL}/LPUSH/leaderboard`, { method: 'POST', headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ args: [entry] }) });
        await fetch(`${UPSTASH_URL}/LTRIM/leaderboard/0/99`, { method: 'POST', headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ args: [] }) });
      } catch (e) { console.error('Upstash:', e.message); }
    }

    // Telegram report
    if (BOT_TOKEN && PRIVATE_CHAT_ID) {
      try { await sendTelegram(BOT_TOKEN, PRIVATE_CHAT_ID, privateReport(data)); }
    } catch (e) { console.error('Telegram:', e.message); }

    if (BOT_TOKEN && GROUP_CHAT_ID) {
      try { await sendTelegram(BOT_TOKEN, GROUP_CHAT_ID, groupReport(data)); }
    } catch (e) { console.error('Telegram group:', e.message); }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

async function sendTelegram(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const parts = splitText(text);
  for (const part of parts) {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: part, parse_mode: 'HTML' }) });
    await new Promise(r => setTimeout(r, 100));
  }
}

function splitText(t, max = 4096) { if (t.length <= max) return [t]; const r = []; while (t.length > max) { const i = t.lastIndexOf('\n', max); const cut = i === -1 ? max : i; r.push(t.slice(0, cut)); t = t.slice(cut + 1); } if (t) r.push(t); return r; }

function privateReport(d) {
  const q = d.questions || [];
  let m = `<b>Reported Speech Quiz Report</b>\n\n`;
  m += `<b>Student:</b> ${d.name || 'Anonymous'}\n`;
  m += `<b>Score:</b> ${d.score}/${q.length} (${d.percentage || 0}%)\n`;
  m += `<b>Time:</b> ${d.time || 'N/A'}\n`;
  m += `<b>Rating:</b> ${d.rating || 0}/5\n\n`;
  m += `<b>Questions:</b>\n`;
  q.forEach((item, i) => {
    m += `<b>Q${i+1}:</b> ${item.question ? item.question.slice(0,50)+'...' : 'N/A'}\n`;
    m += `User: ${item.userAnswer || 'N/A'} | Correct: ${item.correctAnswer || 'N/A'} | ${item.isCorrect ? '✅' : '❌'}\n\n`;
  });
  const p = d.percentage || 0;
  m += p >= 90 ? `<b>Excellent!</b>` : p >= 75 ? `<b>Very Good!</b>` : p >= 50 ? `<b>Good.</b>` : `<b>Needs practice.</b>`;
  return m;
}

function groupReport(d) {
  return `<b>Quiz Result</b>\nStudent: ${d.name || 'Anonymous'}\nScore: ${d.score}/${(d.questions || []).length} (${d.percentage || 0}%)\nRating: ${d.rating || 0}/5`;
}
