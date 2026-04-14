// netlify/functions/coach.js — Proxy sécurisé NETLIFY
// La clé API reste sur le serveur, jamais exposée au client.
 
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
 
export const handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
 
    // Preflight CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
 
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }
 
    let prompt, userData;
    try {
        const body = JSON.parse(event.body || '{}');
        prompt   = body.prompt;
        userData = body.userData;
    } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body invalide' }) };
    }
 
    if (!prompt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Paramètre prompt manquant' }) };
    }
 
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Clé API non configurée' }) };
    }
 
    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 4000,
                temperature: 0.7,
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un coach de musculation expert "Cyber-Elite".
Données utilisateur : ${JSON.stringify(userData || {})}
Règles : Réponse structurée et motivante. Utilise des emojis avec parcimonie.`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
 
        if (response.status === 429) {
            return { statusCode: 429, headers, body: JSON.stringify({ error: 'Quota atteint' }) };
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { statusCode: response.status, headers, body: JSON.stringify({ error: err?.error?.message || 'Erreur API' }) };
        }
 
        const data    = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        return { statusCode: 200, headers, body: JSON.stringify({ content }) };
 
    } catch (err) {
        console.error('Erreur proxy coach :', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur réseau serveur' }) };
    }
};