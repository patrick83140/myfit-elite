// ─────────────────────────────────────────────────────────────
// coach.js — Client IA · MYFIT AI ELITE
// Appelle le proxy Netlify qui sécurise la clé Groq
// ─────────────────────────────────────────────────────────────
 
const PROXY_URL = '/netlify/functions/coach';
 
// ── PROFIL UTILISATEUR (localStorage) ────────────────────────
export const CoachProfile = {
    _key: 'myfit_coach_profile_v1',
    data: null,
 
    init() {
        try {
            const raw = localStorage.getItem(this._key);
            this.data = raw ? JSON.parse(raw) : null;
        } catch {
            this.data = null;
        }
    },
 
    save(profile) {
        this.data = profile;
        try {
            localStorage.setItem(this._key, JSON.stringify(profile));
        } catch (e) {
            console.error('CoachProfile.save() :', e);
        }
    },
 
    clear() {
        this.data = null;
        try {
            localStorage.removeItem(this._key);
        } catch {}
    },
};
 
CoachProfile.init();
 
// ── APPEL PROXY ───────────────────────────────────────────────
async function callProxy(prompt, userData) {
    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userData }),
    });
 
    if (res.status === 429) throw new Error('Quota API atteint. Réessaie dans quelques secondes.');
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Erreur serveur (${res.status})`);
    }
 
    const data = await res.json();
    return data.content || '';
}
 
// ── EXTRACTION JSON PROGRAMME ─────────────────────────────────
function extractProgram(text) {
    try {
        const match = text.match(/```json([\s\S]*?)```/);
        if (!match) return null;
        const parsed = JSON.parse(match[1].trim());
        if (parsed.workoutPlan || parsed.mealPlan) {
            // Sauvegarde dans State si disponible
            try {
                const { State } = await import('./state.js').catch(() => ({ State: null }));
                if (State) {
                    if (parsed.workoutPlan) State.data.aiWorkoutPlan = parsed.workoutPlan;
                    if (parsed.mealPlan)    State.data.aiMealPlan    = parsed.mealPlan;
                    State.save();
                }
            } catch {}
            // Émet l'événement de mise à jour
            window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: parsed }));
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}
 
// ── GÉNÉRATION PROGRAMME COMPLET ──────────────────────────────
export async function generateFullProgram(profile, onProgress, onDone, onError) {
    const prompt = `
Tu es un coach expert en musculation et nutrition. Génère un programme COMPLET et PERSONNALISÉ pour cet athlète.
 
PROFIL :
- Âge : ${profile.age} ans
- Poids : ${profile.weight} kg
- Taille : ${profile.height} cm
- Niveau : ${profile.level}
- Objectif : ${profile.goal}
- Équipement : ${profile.equipment}
- Jours d'entraînement : ${profile.days} jours/semaine
- Restrictions alimentaires : ${profile.diet || 'Aucune'}
 
INSTRUCTIONS :
1. Analyse le profil et donne un résumé motivant (3-4 lignes)
2. Génère le programme dans un bloc JSON unique comme suit :
 
\`\`\`json
{
  "workoutPlan": [
    {
      "day": "Lundi",
      "focus": "Pectoraux / Triceps",
      "exercises": [
        { "name": "Développé couché", "sets": 4, "reps": "8-10", "rest": 90, "tip": "Garde les omoplates serrées" }
      ]
    }
  ],
  "mealPlan": [
    {
      "meal": "Petit-déjeuner",
      "time": "07h00",
      "kcal": 650,
      "protein": 40,
      "carbs": 70,
      "fat": 15,
      "foods": ["Flocons d'avoine 80g", "Whey protéine 30g", "Banane", "Lait demi-écrémé 200ml"]
    }
  ],
  "dailyKcal": 2800,
  "dailyProtein": 180,
  "dailyCarbs": 320,
  "dailyFat": 80
}
\`\`\`
 
3. Termine par un message de motivation court et percutant.
`;
 
    try {
        onProgress?.('Analyse en cours...');
        const content = await callProxy(prompt, profile);
 
        // Sauvegarde programme dans State
        try {
            const stateModule = await import('./state.js');
            const { State } = stateModule;
            const match = content.match(/```json([\s\S]*?)```/);
            if (match) {
                const parsed = JSON.parse(match[1].trim());
                if (parsed.workoutPlan) State.data.aiWorkoutPlan = parsed.workoutPlan;
                if (parsed.mealPlan)    State.data.aiMealPlan    = parsed.mealPlan;
                if (parsed.dailyKcal) {
                    State.data.nutri.goal        = parsed.dailyKcal;
                    State.data.nutri.goalProtein = parsed.dailyProtein || 0;
                    State.data.nutri.goalCarbs   = parsed.dailyCarbs   || 0;
                    State.data.nutri.goalFat     = parsed.dailyFat     || 0;
                }
                State.save();
                // Sauvegarde dans le profil aussi
                CoachProfile.data.program = parsed;
                CoachProfile.save(CoachProfile.data);
                window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: parsed }));
            }
        } catch (e) {
            console.warn('Extraction programme :', e);
        }
 
        onDone?.(content);
    } catch (err) {
        onError?.(err.message);
    }
}
 
// ── CHAT AVEC LE COACH ────────────────────────────────────────
export async function chatWithCoach(profile, history, userMessage, onPartial, onDone, onError) {
    const historyText = history
        .slice(-10)
        .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Coach'}: ${m.content}`)
        .join('\n');
 
    const prompt = `
Tu es un coach de musculation et nutrition expert, motivant et précis.
 
PROFIL ATHLÈTE :
- Âge : ${profile.age} ans | Poids : ${profile.weight} kg | Taille : ${profile.height} cm
- Niveau : ${profile.level} | Objectif : ${profile.goal}
- Équipement : ${profile.equipment}
${profile.diet ? `- Régime : ${profile.diet}` : ''}
 
HISTORIQUE RÉCENT :
${historyText || 'Début de conversation.'}
 
QUESTION : ${userMessage}
 
Si l'utilisateur demande une modification de son programme ou de son plan alimentaire, génère les changements dans un bloc JSON :
\`\`\`json
{
  "workoutPlan": [...] ou "mealPlan": [...]
}
\`\`\`
Sinon, réponds directement sans JSON.
`;
 
    try {
        // Simulation streaming côté client (le proxy renvoie la réponse complète)
        onPartial?.('...');
        const content = await callProxy(prompt, profile);
 
        // Vérifie si un programme est inclus dans la réponse
        let extractedProgram = null;
        try {
            const match = content.match(/```json([\s\S]*?)```/);
            if (match) {
                const parsed = JSON.parse(match[1].trim());
                if (parsed.workoutPlan || parsed.mealPlan) {
                    const stateModule = await import('./state.js');
                    const { State } = stateModule;
                    if (parsed.workoutPlan) State.data.aiWorkoutPlan = parsed.workoutPlan;
                    if (parsed.mealPlan)    State.data.aiMealPlan    = parsed.mealPlan;
                    State.save();
                    window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: parsed }));
                    extractedProgram = parsed;
                }
            }
        } catch {}
 
        onDone?.(content, extractedProgram);
    } catch (err) {
        onError?.(err.message);
    }
}
 
// ── REMPLACEMENT D'UN REPAS ───────────────────────────────────
export async function replaceMeal(mealIndex, currentMeal, profile, onDone, onError) {
    const prompt = `
Tu es un nutritionniste expert. Remplace ce repas par une alternative équivalente.
 
PROFIL : ${profile.age} ans, ${profile.weight} kg, objectif : ${profile.goal}
${profile.diet ? `Restrictions : ${profile.diet}` : ''}
 
REPAS ACTUEL :
- Nom : ${currentMeal.meal}
- Heure : ${currentMeal.time}
- Calories : ${currentMeal.kcal} kcal
- Protéines : ${currentMeal.protein}g | Glucides : ${currentMeal.carbs}g | Lipides : ${currentMeal.fat}g
- Aliments : ${currentMeal.foods?.join(', ')}
 
Génère UN SEUL repas de remplacement avec des valeurs nutritionnelles similaires (±10%).
Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{
  "meal": "Nom du repas",
  "time": "${currentMeal.time}",
  "kcal": 000,
  "protein": 00,
  "carbs": 00,
  "fat": 00,
  "foods": ["Aliment 1", "Aliment 2", "Aliment 3"]
}
`;
 
    try {
        const content = await callProxy(prompt, profile);
 
        // Extrait le JSON de la réponse
        let newMeal = null;
        try {
            // Essaie d'abord un parse direct
            newMeal = JSON.parse(content.trim());
        } catch {
            // Sinon cherche un objet JSON dans le texte
            const match = content.match(/\{[\s\S]*\}/);
            if (match) newMeal = JSON.parse(match[0]);
        }
 
        if (!newMeal?.meal) throw new Error('Format de réponse invalide');
 
        // Met à jour le State
        try {
            const stateModule = await import('./state.js');
            const { State } = stateModule;
            if (State.data.aiMealPlan) {
                State.data.aiMealPlan[mealIndex] = newMeal;
                State.save();
            }
        } catch {}
 
        onDone?.(newMeal);
    } catch (err) {
        onError?.(err.message);
    }
}