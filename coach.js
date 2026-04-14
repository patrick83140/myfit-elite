// ─────────────────────────────────────────────────────────────
// coach.js — Client IA · MYFIT AI ELITE
// Appelle le proxy Netlify qui sécurise la clé Groq
// ─────────────────────────────────────────────────────────────
 
const PROXY_URL = '/.netlify/functions/coach';
 
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
Tu es APEX COACH — coach expert en musculation et nutrition de niveau professionnel.
Génère un programme COMPLET, RÉALISTE et PROGRESSIF pour cet athlète.
 
═══ PROFIL ═══
• Âge : ${profile.age} ans | Poids : ${profile.weight} kg | Taille : ${profile.height} cm
• Niveau : ${profile.level}
• Objectif principal : ${profile.goal}
• Équipement : ${profile.equipment}
• Jours d'entraînement : ${profile.days} jours/semaine
• Durée de séance : ${profile.duration || '1 heure'}
${profile.diet ? `• Restrictions alimentaires : ${profile.diet}` : ''}
 
═══ RÈGLES STRICTES PROGRAMME MUSCULATION ═══
• Durée ${profile.duration || '1 heure'} → RESPECTE ABSOLUMENT :
  - 45min = exactement 4 exercices
  - 1 heure = exactement 5-6 exercices  
  - 1h15 = exactement 6-7 exercices
  - 1h30 = exactement 7-8 exercices
• Génère EXACTEMENT ${profile.days} jours dans workoutPlan
• Chaque exercice : 3-4 séries, reps adaptées au niveau, temps de repos précis
• Varie les groupes musculaires sur les différents jours (push/pull/legs ou full body)
• Exercices réalistes avec l'équipement disponible
• Tips techniques précis et utiles pour chaque exercice
 
═══ RÈGLES STRICTES NUTRITION ═══
• Calcule les besoins caloriques selon : poids, âge, objectif
• Répartis sur 5 repas minimum
• Macros cohérentes avec l'objectif (masse = surplus, sèche = déficit)
• Aliments concrets avec grammages précis
 
═══ INSTRUCTIONS ═══
1. Analyse le profil en 3-4 lignes motivantes
2. Génère TOUT dans UN SEUL bloc JSON :
 
\\`\\`\\`json
{
  "workoutPlan": [
    {
      "day": "Jour 1",
      "focus": "Pectoraux / Triceps",
      "exercises": [
        { "name": "Développé couché barre", "sets": 4, "reps": "6-8", "rest": 120, "tip": "Descends la barre jusqu'à effleurer le sternum, pousse explosif" },
        { "name": "Développé incliné haltères", "sets": 3, "reps": "10-12", "rest": 90, "tip": "Angle 30-45°, amplitude complète, contrôle la descente" },
        { "name": "Écarté à la poulie basse", "sets": 3, "reps": "12-15", "rest": 60, "tip": "Contracte les pectoraux en fin de mouvement" },
        { "name": "Dips lestés", "sets": 3, "reps": "8-10", "rest": 90, "tip": "Penche légèrement le buste pour cibler les pecs" },
        { "name": "Extension triceps poulie haute", "sets": 3, "reps": "12-15", "rest": 60, "tip": "Coudes fixes contre le corps, extension complète" }
      ]
    }
  ],
  "mealPlan": [
    {
      "meal": "Petit-déjeuner",
      "time": "07h00",
      "kcal": 650,
      "protein": 45,
      "carbs": 75,
      "fat": 15,
      "foods": ["Flocons d'avoine 90g", "Whey protéine 30g", "Banane 1", "Lait demi-écrémé 250ml", "Amandes 15g"]
    }
  ],
  "dailyKcal": 2800,
  "dailyProtein": 180,
  "dailyCarbs": 320,
  "dailyFat": 80
}
\\`\\`\\`
 
3. Termine par un message de motivation percutant (1-2 phrases max).
`;;
 
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
 
        // Construit l'objet programme attendu par ui-coach.js
        try {
            const match = content.match(/```json([\s\S]*?)```/);
            if (match) {
                const parsed = JSON.parse(match[1].trim());
                // Calcul TDEE approximatif
                const tdee = parsed.dailyKcal
                    ? Math.round(parsed.dailyKcal * 0.85)
                    : Math.round(profile.weight * 30);
                const program = {
                    workoutPlan: parsed.workoutPlan || [],
                    mealPlan:    parsed.mealPlan    || [],
                    targetKcal:  parsed.dailyKcal   || 2500,
                    tdee:        parsed.tdee        || tdee,
                    macros: {
                        protein: parsed.dailyProtein || Math.round((parsed.dailyKcal || 2500) * 0.30 / 4),
                        carbs:   parsed.dailyCarbs   || Math.round((parsed.dailyKcal || 2500) * 0.45 / 4),
                        fat:     parsed.dailyFat     || Math.round((parsed.dailyKcal || 2500) * 0.25 / 9),
                    },
                    coachTips: parsed.coachTips || [
                        'Dors 7 à 9 heures par nuit pour optimiser ta récupération.',
                        'Hydrate-toi avec au moins 2,5L d\'eau par jour.',
                        'La régularité prime sur l\'intensité — sois constant.',
                    ],
                };
                onDone?.(program);
                return;
            }
        } catch (e) {
            console.warn('Parse programme:', e);
        }
        onDone?.({
            workoutPlan: [],
            mealPlan: [],
            targetKcal: 2500,
            tdee: 2100,
            macros: { protein: 187, carbs: 281, fat: 69 },
            coachTips: ['Reste régulier dans ton entraînement.', 'Hydrate-toi suffisamment.', 'Dors 8h par nuit.'],
        });
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
Tu es APEX COACH — un coach expert en musculation, nutrition et performance physique de niveau professionnel.
Tu as accès à TOUTES les données de l'athlète et tu peux TOUT modifier dans son programme.
 
═══ PROFIL COMPLET DE L'ATHLÈTE ═══
• Âge : ${profile.age} ans | Poids : ${profile.weight} kg | Taille : ${profile.height} cm
• Niveau : ${profile.level} | Objectif : ${profile.goal}
• Équipement : ${profile.equipment}
• Durée de séance : ${profile.duration || '1 heure'}
• Jours d'entraînement : ${profile.days} jours/semaine
${profile.diet ? `• Régime alimentaire : ${profile.diet}` : ''}
 
═══ PROGRAMME MUSCULATION ACTUEL ═══
${profile.program?.workoutPlan ? JSON.stringify(profile.program.workoutPlan, null, 2) : 'Aucun programme généré'}
 
═══ PLAN NUTRITIONNEL ACTUEL ═══
${profile.program?.mealPlan ? JSON.stringify(profile.program.mealPlan, null, 2) : 'Aucun plan généré'}
 
═══ HISTORIQUE RÉCENT ═══
${historyText || 'Début de conversation.'}
 
═══ MESSAGE DE L\'ATHLÈTE ═══
${userMessage}
 
═══ TES CAPACITÉS ═══
Tu peux modifier :
- workoutPlan : exercices, séries, reps, repos, ordre, groupes musculaires
- mealPlan : repas, calories, macros, aliments
- targetKcal / dailyProtein / dailyCarbs / dailyFat : objectifs nutritionnels
- weights : charges recommandées pour chaque exercice (objet clé=nom exercice, valeur=kg)
- restTimes : temps de repos par exercice
 
═══ RÈGLES ABSOLUES ═══
1. Réponds TOUJOURS en français, de façon directe et motivante
2. Si tu modifies QUOI QUE CE SOIT, inclus UN SEUL bloc JSON complet à la fin
3. Le JSON doit contenir UNIQUEMENT les sections modifiées
4. Respecte TOUJOURS la durée de séance : ${profile.duration || '1 heure'}
   → 45min = 4 exercices | 1h = 5-6 ex | 1h15 = 6-7 ex | 1h30 = 7-8 ex
5. Chaque exercice doit avoir : name, sets (3-5), reps (format "8-10"), rest (secondes), tip
6. Génère des VRAIS programmes de musculation avec des exercices variés et progressifs
7. Si l'athlète se plaint d'une douleur ou d'un manque de résultats, adapte IMMÉDIATEMENT
8. Sois précis sur les charges : propose des valeurs réalistes selon le niveau
 
Si tu fais des modifications, réponds ainsi :
[Explication claire de ce que tu as changé et pourquoi]
 
\\`\\`\\`json
{
  "workoutPlan": [...programme complet si modifié...],
  "mealPlan": [...plan complet si modifié...],
  "targetKcal": 0,
  "dailyProtein": 0,
  "dailyCarbs": 0,
  "dailyFat": 0
}
\\`\\`\\`
 
Si tu ne fais PAS de modification, réponds directement sans JSON.
`;;
 
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
                    // Fusionne avec le plan existant si modification partielle
                    if (parsed.workoutPlan) {
                        // Si le coach renvoie un seul jour modifié, on fusionne
                        if (parsed.workoutPlan.length === 1 && State.data.aiWorkoutPlan?.length > 1) {
                            const dayName = parsed.workoutPlan[0].day;
                            const idx = State.data.aiWorkoutPlan.findIndex(d => d.day === dayName);
                            if (idx >= 0) {
                                State.data.aiWorkoutPlan[idx] = parsed.workoutPlan[0];
                            } else {
                                State.data.aiWorkoutPlan = parsed.workoutPlan;
                            }
                        } else {
                            State.data.aiWorkoutPlan = parsed.workoutPlan;
                        }
                    }
                    if (parsed.mealPlan) State.data.aiMealPlan = parsed.mealPlan;
                    State.save();
                    // Envoie le plan complet mis à jour
                    window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: {
                        workoutPlan: State.data.aiWorkoutPlan,
                        mealPlan: parsed.mealPlan,
                    }}));
                    extractedProgram = parsed;
                }
            }
        } catch (e) { console.warn('Chat extract:', e); }
 
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