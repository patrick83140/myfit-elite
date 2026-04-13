// ─────────────────────────────────────────────────────────────
// CONFIGURATION COACH IA
// ─────────────────────────────────────────────────────────────
//
// ⚠️  SÉCURITÉ : Ne jamais mettre de clé API en clair ici.
//     Option A — Proxy serverless (recommandé) :
//       Déployer une fonction Netlify/Vercel qui relaie les appels Groq.
//     Option B — Dev local : import.meta.env.VITE_GROQ_KEY via Vite.
//
const COACH_PROXY_URL   = '/api/coach';
const COACH_STORAGE_KEY = 'myfit_coach_v3';

// ─────────────────────────────────────────────────────────────
// PROFIL UTILISATEUR
// ─────────────────────────────────────────────────────────────
export const CoachProfile = {
    data: null,

    init() {
        try {
            const raw = localStorage.getItem(COACH_STORAGE_KEY);
            this.data = raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Erreur profil :', e);
            this.data = null;
        }
    },

    save(profile) {
        this.data = profile;
        localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(profile));
    },

    clear() {
        this.data = null;
        localStorage.removeItem(COACH_STORAGE_KEY);
    },
};

CoachProfile.init();

// ─────────────────────────────────────────────────────────────
// MOTEUR IA — appel via proxy sécurisé
// ─────────────────────────────────────────────────────────────
export const CoachIA = {
    _generating: false,

    async ask(prompt, userData) {
        try {
            const response = await fetch(COACH_PROXY_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ prompt, userData }),
            });

            if (response.status === 429) return '⏳ Quota atteint. Attends 1 minute puis réessaie.';
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return `⚠️ Erreur : ${err?.error?.message || response.statusText}`;
            }

            const data = await response.json();
            return data?.content || data?.choices?.[0]?.message?.content || '⚠️ Réponse vide.';

        } catch (error) {
            console.error('Erreur réseau :', error);
            return `⚠️ Mode hors ligne\n\n💪 Conseil rapide :\n- Mange propre\n- Entraîne-toi régulièrement\n- Dors bien\n\n🔥 Discipline > motivation`;
        }
    },
};

// ─────────────────────────────────────────────────────────────
// SYNC STATE — applique un programme reçu depuis le Coach
// ─────────────────────────────────────────────────────────────
export async function syncProgramToState(program) {
    if (!program) return;
    const { State } = await import('./state.js');

    if (program.workoutPlan)  State.data.aiWorkoutPlan = program.workoutPlan;
    if (program.mealPlan)     State.data.aiMealPlan    = program.mealPlan;
    if (program.targetKcal)   State.data.nutri.goal    = program.targetKcal;
    if (program.macros) {
        if (program.macros.protein != null) State.data.nutri.goalProtein = program.macros.protein;
        if (program.macros.carbs   != null) State.data.nutri.goalCarbs   = program.macros.carbs;
        if (program.macros.fat     != null) State.data.nutri.goalFat     = program.macros.fat;
    }
    State.save();

    // Notifie l'UI que le programme a été mis à jour
    window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: program }));
}

// ─────────────────────────────────────────────────────────────
// EXTRACTION PROGRAMME depuis une réponse texte du Coach
// Cherche un bloc JSON contenant au moins un champ programme connu
// ─────────────────────────────────────────────────────────────
export function extractProgramFromResponse(text) {
    if (!text) return null;

    const jsonMatch =
        text.match(/```json\s*([\s\S]*?)```/i) ||
        text.match(/```\s*(\{[\s\S]*?\})\s*```/) ||
        text.match(/(\{[\s\S]*?"(?:workoutPlan|mealPlan|macros|targetKcal)"[\s\S]*?\})\s*$/);

    if (!jsonMatch) return null;
    try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed.workoutPlan || parsed.mealPlan || parsed.macros || parsed.targetKcal) {
            return parsed;
        }
    } catch (_) { /* JSON invalide */ }
    return null;
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION PROGRAMME COMPLET
// ─────────────────────────────────────────────────────────────
export async function generateFullProgram(profile, _, onSuccess, onError) {
    if (CoachIA._generating) return;
    CoachIA._generating = true;

    try {
        const result = await CoachIA.ask(
            `Génère un programme musculation + nutrition complet en JSON avec cette structure EXACTE, sans texte avant ou après :
{
  "summary": "résumé objectif en 1 phrase",
  "tdee": 2500,
  "targetKcal": 2800,
  "macros": {"protein": 180, "carbs": 300, "fat": 80},
  "workoutPlan": [
    {
      "day": "Lundi",
      "focus": "Pectoraux / Triceps",
      "exercises": [
        {"name": "Développé couché", "sets": 4, "reps": "8-10", "rest": 90, "tips": "Garde les coudes à 45°"}
      ]
    }
  ],
  "mealPlan": [
    {
      "meal": "Petit-déjeuner",
      "time": "7h00",
      "kcal": 600,
      "protein": 40,
      "carbs": 80,
      "fat": 15,
      "foods": ["Flocons d'avoine 80g", "Oeufs entiers x3", "Banane"]
    }
  ],
  "coachTips": ["Conseil 1", "Conseil 2", "Conseil 3"]
}`,
            profile
        );

        const clean   = result.replace(/```json|```/g, '').trim();
        const program = JSON.parse(clean);

        await syncProgramToState(program);

        if (onSuccess) onSuccess(program);
        return program;

    } catch (err) {
        console.error('Erreur génération programme :', err);
        if (onError) onError(err.message);
    } finally {
        CoachIA._generating = false;
    }
}

// ─────────────────────────────────────────────────────────────
// REMPLACEMENT D'UN REPAS (mêmes valeurs nutritionnelles ±5%)
// ─────────────────────────────────────────────────────────────
export async function replaceMeal(mealIndex, currentMeal, profile, onSuccess, onError) {
    try {
        const result = await CoachIA.ask(
            `Remplace ce repas par une ALTERNATIVE DIFFÉRENTE avec exactement les mêmes valeurs nutritionnelles (±5% tolérance).
Repas actuel : ${JSON.stringify(currentMeal)}
Contraintes alimentaires : ${profile?.diet || 'aucune'}
Objectif : ${profile?.goal || 'non précisé'}

IMPORTANT : propose quelque chose de différent, pas une variation du même plat.

Réponds UNIQUEMENT avec l'objet JSON suivant (aucun texte avant ou après) :
{
  "meal": "${currentMeal.meal}",
  "time": "${currentMeal.time}",
  "kcal": ${currentMeal.kcal},
  "protein": ${currentMeal.protein},
  "carbs": ${currentMeal.carbs},
  "fat": ${currentMeal.fat},
  "foods": ["aliment 1 avec grammage", "aliment 2 avec grammage"]
}`,
            profile
        );

        const clean   = result.replace(/```json|```/g, '').trim();
        const newMeal = JSON.parse(clean);

        // Met à jour dans State et dans le profil sauvegardé
        const { State } = await import('./state.js');
        if (!State.data.aiMealPlan) State.data.aiMealPlan = [];
        State.data.aiMealPlan[mealIndex] = newMeal;

        if (CoachProfile.data?.program?.mealPlan) {
            CoachProfile.data.program.mealPlan[mealIndex] = newMeal;
            CoachProfile.save(CoachProfile.data);
        }
        State.save();

        if (onSuccess) onSuccess(newMeal, mealIndex);
        return newMeal;

    } catch (err) {
        console.error('Erreur remplacement repas :', err);
        if (onError) onError(err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// CHAT AVEC LE COACH
// Détecte auto si la réponse contient un programme à appliquer
// ─────────────────────────────────────────────────────────────
export async function chatWithCoach(profile, history, msg, onPartial, onSuccess, onError) {
    try {
        let sessionContext = '';
        try {
            const { State } = await import('./state.js');
            const todaySets = State.getTodaySets();
            const stats     = State.getStats();
            const streak    = State.getStreak();
            if (todaySets.length > 0) {
                const volToday = todaySets.reduce((a, s) => a + s.weight * s.reps, 0);
                sessionContext = `\n\nCONTEXTE SESSION DU JOUR : ${todaySets.length} séries · ${volToday}kg de volume. Streak : ${streak} jours. Total sessions : ${stats.sessions}.`;
            }
        } catch (_) { /* contexte optionnel */ }

        // Instruction : retourner un JSON si l'utilisateur demande une modif de programme
        const systemHint = `\n\nSI l'utilisateur demande explicitement de modifier, changer ou créer son programme d'entraînement ou son plan nutritionnel, retourne un objet JSON complet (avec workoutPlan et/ou mealPlan selon ce qui est modifié) encadré par \`\`\`json ... \`\`\` à la fin de ta réponse. Sinon, réponds en texte uniquement sans JSON.`;

        const context = history?.length
            ? history.map(h => `${h.role}: ${h.content}`).join('\n')
            : '';

        const fullPrompt = `${context ? `Historique :\n${context}\n\n` : ''}Question :\n${msg}${sessionContext}${systemHint}`;
        const result     = await CoachIA.ask(fullPrompt, profile);

        // Extrait et applique un programme si présent dans la réponse
        const extractedProgram = extractProgramFromResponse(result);
        if (extractedProgram) {
            await syncProgramToState(extractedProgram);
            if (CoachProfile.data) {
                CoachProfile.data.program = { ...CoachProfile.data.program, ...extractedProgram };
                CoachProfile.save(CoachProfile.data);
            }
        }

        if (onSuccess) onSuccess(result, extractedProgram);
        return result;

    } catch (err) {
        if (onError) onError(err.message);
    }
}

window.CoachIA = CoachIA;
