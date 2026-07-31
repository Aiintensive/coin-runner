const GH_REPO = 'Aiintensive/coin-runner';
const GH_FILE = 'scores.json';
const GH_TOKEN = process.env.GH_TOKEN;

async function ghGet() {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'coin-runner' }
    });
    if (res.status === 404) return { sha: null, data: [] };
    if (!res.ok) throw new Error('GitHub read failed: ' + res.status);
    const json = await res.json();
    let data = [];
    try { data = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8')); } catch (e) { data = []; }
    if (!Array.isArray(data)) data = [];
    return { sha: json.sha, data };
}

async function ghPut(content, sha) {
    const body = {
        message: 'Update high scores',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64')
    };
    if (sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'coin-runner', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('GitHub write failed: ' + res.status);
    return true;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    if (req.method === 'GET') {
        try {
            const { data } = await ghGet();
            data.sort((a, b) => (b.score || 0) - (a.score || 0));
            res.status(200).json({ ok: true, scores: data.slice(0, 20) });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e.message || e) });
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            let body = {};
            try { body = JSON.parse(req.body || '{}'); } catch (e) { body = {}; }
            const score = {
                player: String(body.player || 'Игрок').slice(0, 20),
                score: Math.floor(Number(body.score) || 0),
                distance: Math.floor(Number(body.distance) || 0),
                date: new Date().toISOString()
            };
            const { sha, data } = await ghGet();
            data.push(score);
            data.sort((a, b) => (b.score || 0) - (a.score || 0));
            const trimmed = data.slice(0, 20);
            await ghPut(trimmed, sha);
            res.status(200).json({ ok: true, scores: trimmed });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e.message || e) });
        }
        return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
}
