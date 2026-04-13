// ─────────────────────────────────────────────────────────────
// PROXY SÉCURISÉ — à déployer sur Netlify ou Vercel
//
// Netlify : placer dans /netlify/functions/coach.js
// Vercel  : placer dans /api/coach.js
//
// La clé API reste sur le serveur, jamais exposée au client.
// ─────────────────────────────────────────────────────────────
 
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
 
export default async function handler(req, res) {
    // CORS — autorise seulement ton domaine en production
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }
 
    const { prompt, userData } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Paramètre prompt manquant' });
    }
 
    const apiKey = process.env.GROQ_API_KEY; // ← définie dans les variables d'environnement
    if (!apiKey) {
        return res.status(500).json({ error: 'Clé API non configurée sur le serveur' });
    }
 
    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
                model:       'llama-3.3-70b-versatile',
                max_tokens:  2000,
                temperature: 0.7,
                messages: [
                    {
                        role:    'system',
                        content: `Tu es un coach de musculation expert "Cyber-Elite".
Données utilisateur : ${JSON.stringify(userData || {})}
Règles : Réponse structurée et motivante. Utilise des emojis avec parcimonie.`,
                    },
                    {
                        role:    'user',
                        content: prompt,
                    },
                ],
            }),
        });
 
        if (response.status === 429) {
            return res.status(429).json({ error: 'Quota atteint' });
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err?.error?.message || 'Erreur API' });
        }
 
        const data    = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        return res.status(200).json({ content });
 
    } catch (err) {
        console.error('Erreur proxy coach :', err);
        return res.status(500).json({ error: 'Erreur réseau serveur' });
    }
}