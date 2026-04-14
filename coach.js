
Copier

// coach.js — Client IA · MYFIT AI ELITE
const PROXY_URL = '/.netlify/functions/coach';
const TICKS = '```';
 
// ── PROFIL UTILISATEUR ────────────────────────────────────────
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
            console.error('CoachProfile.save():', e);
        }
    },
 
    clear() {
        this.data = null;
        try { localStorage.removeItem(this._key); } catch {}
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
 
// ── EXTRACTION JSON ───────────────────────────────────────────
function extractJSON(text) {
    // Essaie bloc markdown
    const mdMatch = text.match(/```json([\s\S]*?)```/);
    if (mdMatch) {
        try { return JSON.parse(mdMatch[1].trim()); } catch {}
    }
    // Essaie JSON brut
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch {}
    }
    return null;
}
 
// ── SAUVEGARDE PROGRAMME ──────────────────────────────────────
async function saveProgram(parsed) {
    try {
        const { State } = await import('./state.js');
        if (parsed.workoutPlan?.length) State.data.aiWorkoutPlan = parsed.workoutPlan;
        if (parsed.mealPlan?.length)    State.data.aiMealPlan    = parsed.mealPlan;
        if (parsed.targetKcal || parsed.dailyKcal) {
            State.data.nutri.goal        = parsed.targetKcal || parsed.dailyKcal;
            State.data.nutri.goalProtein = parsed.dailyProtein || parsed.macros?.protein || 0;
            State.data.nutri.goalCarbs   = parsed.dailyCarbs   || parsed.macros?.carbs   || 0;
            State.data.nutri.goalFat     = parsed.dailyFat     || parsed.macros?.fat     || 0;
        }
        State.save();
    } catch (e) {
        console.warn('saveProgram:', e);
    }
}
 
// ── GÉNÉRATION PROGRAMME COMPLET ──────────────────────────────
export async function generateFullProgram(profile, onProgress, onDone, onError) {
    const nbEx = profile.duration === '45 minutes' ? 4
               : profile.duration === '1h15'        ? '6 à 7'
               : profile.duration === '1h30'        ? '7 à 8'
               : '5 à 6';
 
    const prompt = `Tu es APEX COACH, coach expert en musculation et nutrition de niveau professionnel.
Génère un programme COMPLET, RÉALISTE et PROGRESSIF pour cet athlète.
 
PROFIL :
- Âge : ${profile.age} ans | Poids : ${profile.weight} kg | Taille : ${profile.height} cm
- Niveau : ${profile.level}
- Objectif : ${profile.goal}
- Équipement : ${profile.equipment}
- Jours d'entraînement : ${profile.days} jours/semaine
- Durée de séance : ${profile.duration || '1 heure'} → EXACTEMENT ${nbEx} exercices par séance
${profile.diet ? `- Restrictions alimentaires : ${profile.diet}` : ''}
 
RÈGLES STRICTES :
1. Génère EXACTEMENT ${profile.days} jours dans workoutPlan
2. EXACTEMENT ${nbEx} exercices par jour (ni plus, ni moins)
3. Chaque exercice : 3-4 séries, reps format "8-10", repos en secondes, tip technique précis
4. Varie les groupes musculaires (push/pull/legs ou full body selon les jours)
5. Exercices adaptés à l'équipement disponible
6. Plan alimentaire sur 5 repas avec aliments et grammages précis
7. Calcule les macros selon l'objectif (masse = surplus calorique, sèche = déficit)
 
Réponds avec un résumé motivant de 2-3 lignes, puis UN SEUL bloc JSON :
 
${TICKS}json
{
  "workoutPlan": [
    {
      "day": "Jour 1",
      "focus": "Pectoraux / Triceps",
      "exercises": [
        { "name": "Développé couché barre", "sets": 4, "reps": "6-8", "rest": 120, "tip": "Omoplates serrées, descente contrôlée" },
        { "name": "Développé incliné haltères", "sets": 3, "reps": "10-12", "rest": 90, "tip": "Angle 30°, amplitude complète" },
        { "name": "Écarté poulie basse croisée", "sets": 3, "reps": "12-15", "rest": 60, "tip": "Contracte les pecs en fin de mouvement" },
        { "name": "Dips lestés", "sets": 3, "reps": "8-10", "rest": 90, "tip": "Buste légèrement penché en avant" },
        { "name": "Extension triceps poulie haute", "sets": 3, "reps": "12-15", "rest": 60, "tip": "Coudes fixes, extension complète" }
      ]
    }
  ],
  "mealPlan": [
    { "meal": "Petit-déjeuner", "time": "07h00", "kcal": 650, "protein": 45, "carbs": 75, "fat": 15, "foods": ["Flocons d'avoine 90g", "Whey 30g", "Banane 1", "Lait demi-écrémé 250ml"] }
  ],
  "dailyKcal": 2800,
  "dailyProtein": 180,
  "dailyCarbs": 320,
  "dailyFat": 80
}
${TICKS}
 
Termine par 1 phrase de motivation percutante.`;
 
    try {
        onProgress?.('Analyse en cours...');
        const content = await callProxy(prompt, profile);
        const parsed = extractJSON(content);
 
        if (parsed?.workoutPlan) {
            await saveProgram(parsed);
 
            const program = {
                workoutPlan: parsed.workoutPlan,
                mealPlan:    parsed.mealPlan || [],
                targetKcal:  parsed.dailyKcal || 2500,
                tdee:        Math.round((parsed.dailyKcal || 2500) * 0.85),
                macros: {
                    protein: parsed.dailyProtein || Math.round((parsed.dailyKcal || 2500) * 0.30 / 4),
                    carbs:   parsed.dailyCarbs   || Math.round((parsed.dailyKcal || 2500) * 0.45 / 4),
                    fat:     parsed.dailyFat     || Math.round((parsed.dailyKcal || 2500) * 0.25 / 9),
                },
                coachTips: parsed.coachTips || [
                    'Dors 7 à 9 heures par nuit pour maximiser la récupération.',
                    'Hydrate-toi avec au moins 2,5L d\'eau par jour.',
                    'La régularité prime sur l\'intensité — sois constant.',
                ],
            };
 
            // Sauvegarde dans le profil
            CoachProfile.data.program = program;
            CoachProfile.save(CoachProfile.data);
 
            window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: {
                workoutPlan: parsed.workoutPlan,
                mealPlan: parsed.mealPlan,
            }}));
 
            onDone?.(program);
        } else {
            onError?.('Le programme n\'a pas pu être généré. Réessaie.');
        }
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
 
    const currentPlan = profile.program?.workoutPlan
        ? JSON.stringify(profile.program.workoutPlan, null, 2)
        : 'Aucun programme généré';
 
    const prompt = `Tu es APEX COACH — coach expert en musculation et nutrition de niveau professionnel.
Tu as accès à TOUTES les données de l'athlète et tu peux TOUT modifier dans son programme.
 
PROFIL DE L'ATHLÈTE :
- Âge : ${profile.age} ans | Poids : ${profile.weight} kg | Taille : ${profile.height} cm
- Niveau : ${profile.level} | Objectif : ${profile.goal}
- Équipement : ${profile.equipment} | Durée séance : ${profile.duration || '1 heure'}
${profile.diet ? `- Régime : ${profile.diet}` : ''}
 
PROGRAMME MUSCULATION ACTUEL :
${currentPlan}
 
PLAN NUTRITIONNEL ACTUEL :
${profile.program?.mealPlan ? JSON.stringify(profile.program.mealPlan, null, 2) : 'Aucun plan généré'}
 
HISTORIQUE RÉCENT :
${historyText || 'Début de conversation.'}
 
MESSAGE DE L'ATHLÈTE : ${userMessage}
 
RÈGLES :
1. Réponds en français, de façon directe et motivante
2. Si tu modifies le programme, inclus le workoutPlan COMPLET (tous les jours) dans le JSON
3. Si tu modifies la nutrition, inclus le mealPlan COMPLET dans le JSON
4. Durée séance : ${profile.duration || '1 heure'} → respecte le nombre d'exercices
5. Si pas de modification, réponds directement sans JSON
 
Format si modification :
[Explication de ce que tu as changé et pourquoi]
 
${TICKS}json
{
  "workoutPlan": [...tous les jours modifiés...],
  "mealPlan": [...plan complet si modifié...],
  "dailyKcal": 0,
  "dailyProtein": 0,
  "dailyCarbs": 0,
  "dailyFat": 0
}
${TICKS}`;
 
    try {
        onPartial?.('⚡ Analyse en cours...');
        const content = await callProxy(prompt, profile);
 
        let extractedProgram = null;
        const parsed = extractJSON(content);
 
        if (parsed?.workoutPlan || parsed?.mealPlan) {
            try {
                const { State } = await import('./state.js');
 
                if (parsed.workoutPlan?.length) {
                    State.data.aiWorkoutPlan = parsed.workoutPlan;
                }
                if (parsed.mealPlan?.length) {
                    State.data.aiMealPlan = parsed.mealPlan;
                }
                if (parsed.dailyKcal) {
                    State.data.nutri.goal        = parsed.dailyKcal;
                    State.data.nutri.goalProtein = parsed.dailyProtein || 0;
                    State.data.nutri.goalCarbs   = parsed.dailyCarbs   || 0;
                    State.data.nutri.goalFat     = parsed.dailyFat     || 0;
                }
                State.save();
 
                // Met à jour le profil sauvegardé
                if (!CoachProfile.data.program) CoachProfile.data.program = {};
                if (parsed.workoutPlan?.length) CoachProfile.data.program.workoutPlan = parsed.workoutPlan;
                if (parsed.mealPlan?.length)    CoachProfile.data.program.mealPlan    = parsed.mealPlan;
                CoachProfile.save(CoachProfile.data);
 
                window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: {
                    workoutPlan: parsed.workoutPlan,
                    mealPlan:    parsed.mealPlan,
                }}));
 
                extractedProgram = parsed;
            } catch (e) {
                console.warn('Chat save:', e);
            }
        }
 
        onDone?.(content, extractedProgram);
    } catch (err) {
        onError?.(err.message);
    }
}
 
// ── REMPLACEMENT D'UN REPAS ───────────────────────────────────
export async function replaceMeal(mealIndex, currentMeal, profile, onDone, onError) {
    const prompt = `Tu es un nutritionniste expert. Remplace ce repas par une alternative équivalente.
 
PROFIL : ${profile.age} ans, ${profile.weight} kg, objectif : ${profile.goal}
${profile.diet ? `Restrictions : ${profile.diet}` : ''}
 
REPAS À REMPLACER :
- ${currentMeal.meal} à ${currentMeal.time}
- ${currentMeal.kcal} kcal | P:${currentMeal.protein}g G:${currentMeal.carbs}g L:${currentMeal.fat}g
- Aliments actuels : ${currentMeal.foods?.join(', ')}
 
Génère UN repas de remplacement avec valeurs nutritionnelles similaires (±10%).
Réponds UNIQUEMENT avec ce JSON sans texte autour :
{"meal":"${currentMeal.meal}","time":"${currentMeal.time}","kcal":0,"protein":0,"carbs":0,"fat":0,"foods":["aliment 1","aliment 2"]}`;
 
    try {
        const content = await callProxy(prompt, profile);
        const newMeal = extractJSON(content);
 
        if (!newMeal?.meal) throw new Error('Format de réponse invalide');
 
        try {
            const { State } = await import('./state.js');
            if (State.data.aiMealPlan) {
                State.data.aiMealPlan[mealIndex] = newMeal;
                State.save();
                if (CoachProfile.data?.program?.mealPlan) {
                    CoachProfile.data.program.mealPlan[mealIndex] = newMeal;
                    CoachProfile.save(CoachProfile.data);
                }
            }
        } catch {}
 
        onDone?.(newMeal);
    } catch (err) {
        onError?.(err.message);
    }
}