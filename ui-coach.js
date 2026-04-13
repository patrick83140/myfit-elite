import { CoachProfile, generateFullProgram, chatWithCoach, replaceMeal } from './coach.js';
 
let chatHistory  = [];
let currentProgram = null;
 
// ── VUE PRINCIPALE COACH ──────────────────────────────────────
export const UICoach = {
 
    render(container) {
        if (!CoachProfile.data) {
            this._renderProfileForm(container);
        } else {
            this._renderCoachDashboard(container);
        }
    },
 
    // ── FORMULAIRE DE PROFIL ──────────────────────────────────
    _renderProfileForm(container) {
        container.innerHTML = `
        <div class="coach-hero">
            <div class="coach-orb"></div>
            <div class="coach-hero-text">
                <div class="coach-tag">COACH IA · POWERED BY GROQ</div>
                <h1 class="coach-title">TON PROGRAMME<br><span class="coach-title-accent">SUR MESURE</span></h1>
                <p class="coach-subtitle">Analyse morphologique · Musculation · Nutrition</p>
            </div>
        </div>
 
        <div class="card coach-form-card">
            <div class="coach-form-header">
                <div class="coach-step-dot active"></div>
                <div class="coach-step-line"></div>
                <div class="coach-step-dot"></div>
                <div class="coach-step-line"></div>
                <div class="coach-step-dot"></div>
            </div>
            <div class="card-title" style="margin-top:16px">MON PROFIL PHYSIQUE</div>
 
            <div class="form-grid-2">
                <div class="form-field">
                    <label class="form-label">ÂGE</label>
                    <input type="number" id="cf-age" placeholder="25" min="14" max="80" class="form-input">
                </div>
                <div class="form-field">
                    <label class="form-label">POIDS (kg)</label>
                    <input type="number" id="cf-weight" placeholder="75" min="40" max="200" class="form-input">
                </div>
                <div class="form-field">
                    <label class="form-label">TAILLE (cm)</label>
                    <input type="number" id="cf-height" placeholder="178" min="140" max="220" class="form-input">
                </div>
                <div class="form-field">
                    <label class="form-label">JOURS / SEMAINE</label>
                    <input type="number" id="cf-days" placeholder="4" min="2" max="6" class="form-input">
                </div>
            </div>
 
            <div class="form-field" style="margin-top:12px">
                <label class="form-label">NIVEAU</label>
                <div class="radio-group" id="rg-level">
                    <div class="radio-btn active" data-val="Débutant (< 1 an)">Débutant</div>
                    <div class="radio-btn" data-val="Intermédiaire (1-3 ans)">Intermédiaire</div>
                    <div class="radio-btn" data-val="Avancé (3+ ans)">Avancé</div>
                </div>
            </div>
 
            <div class="form-field" style="margin-top:12px">
                <label class="form-label">OBJECTIF PRINCIPAL</label>
                <div class="radio-group" id="rg-goal">
                    <div class="radio-btn active" data-val="Prise de masse musculaire">💪 Masse</div>
                    <div class="radio-btn" data-val="Perte de gras tout en préservant le muscle">🔥 Sèche</div>
                    <div class="radio-btn" data-val="Recomposition corporelle">⚡ Recomp</div>
                    <div class="radio-btn" data-val="Force maximale">🏋️ Force</div>
                </div>
            </div>
 
            <div class="form-field" style="margin-top:12px">
                <label class="form-label">ÉQUIPEMENT DISPONIBLE</label>
                <div class="radio-group" id="rg-equip">
                    <div class="radio-btn active" data-val="Salle de sport complète (barres, haltères, machines)">🏋️ Salle complète</div>
                    <div class="radio-btn" data-val="Haltères et barre seulement">🔩 Poids libres</div>
                    <div class="radio-btn" data-val="Poids du corps uniquement">🤸 Corps</div>
                </div>
            </div>
 
            <div class="form-field" style="margin-top:12px">
                <label class="form-label">RESTRICTIONS ALIMENTAIRES <span style="color:var(--sub);font-size:.7rem">(optionnel)</span></label>
                <input type="text" id="cf-diet" placeholder="Ex : sans lactose, végétarien, halal..." class="form-input" style="text-align:left;padding-left:14px">
            </div>
 
            <button class="primary coach-generate-btn" id="btn-generate-profile" style="margin-top:20px">
                <span class="btn-icon">🧬</span>
                GÉNÉRER MON PROGRAMME IA
            </button>
        </div>`;
 
        this._setupRadioGroups(container);
        document.getElementById('btn-generate-profile').addEventListener('click', () => this._submitProfile(container));
    },
 
    _setupRadioGroups(container) {
        container.querySelectorAll('.radio-group').forEach(group => {
            group.querySelectorAll('.radio-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    },
 
    _submitProfile(container) {
        const age    = parseInt(document.getElementById('cf-age')?.value);
        const weight = parseFloat(document.getElementById('cf-weight')?.value);
        const height = parseInt(document.getElementById('cf-height')?.value);
        const days   = parseInt(document.getElementById('cf-days')?.value);
 
        if (!age || !weight || !height || !days) {
            this._showFormError('Remplis tous les champs obligatoires.');
            return;
        }
 
        const level = document.querySelector('#rg-level .radio-btn.active')?.dataset.val || 'Intermédiaire';
        const goal  = document.querySelector('#rg-goal .radio-btn.active')?.dataset.val  || 'Prise de masse musculaire';
        const equip = document.querySelector('#rg-equip .radio-btn.active')?.dataset.val || 'Salle de sport complète';
        const diet  = document.getElementById('cf-diet')?.value || '';
 
        const profile = { age, weight, height, days, level, goal, equipment: equip, diet };
        CoachProfile.save(profile);
        this._renderGenerating(container, profile);
    },
 
    _showFormError(msg) {
        let el = document.getElementById('form-error');
        if (!el) {
            el = document.createElement('div');
            el.id = 'form-error'; el.className = 'form-error';
            document.querySelector('.coach-form-card')?.appendChild(el);
        }
        el.textContent = '⚠️ ' + msg;
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 3000);
    },
 
    // ── ÉCRAN DE GÉNÉRATION ───────────────────────────────────
    _renderGenerating(container, profile) {
        container.innerHTML = `
        <div class="coach-generating">
            <div class="gen-orb">
                <div class="gen-ring g1"></div>
                <div class="gen-ring g2"></div>
                <div class="gen-ring g3"></div>
                <div class="gen-core">AI</div>
            </div>
            <div class="gen-title">ANALYSE EN COURS</div>
            <div class="gen-steps">
                <div class="gen-step active" id="gs-1">Analyse morphologique...</div>
                <div class="gen-step" id="gs-2">Calcul des besoins caloriques...</div>
                <div class="gen-step" id="gs-3">Construction du programme...</div>
                <div class="gen-step" id="gs-4">Optimisation nutritionnelle...</div>
            </div>
            <div class="gen-progress-bar"><div class="gen-progress-fill" id="gen-fill"></div></div>
        </div>`;
 
        const steps = ['gs-1', 'gs-2', 'gs-3', 'gs-4'];
        let si = 0;
        const stepInterval = setInterval(() => {
            if (si > 0) document.getElementById(steps[si - 1])?.classList.remove('active');
            if (si < steps.length) document.getElementById(steps[si])?.classList.add('active');
            const fill = document.getElementById('gen-fill');
            if (fill) fill.style.width = `${((si + 1) / steps.length) * 85}%`;
            si++;
            if (si >= steps.length) clearInterval(stepInterval);
        }, 800);
 
        generateFullProgram(
            profile,
            null,
            (program) => {
                clearInterval(stepInterval);
                const fill = document.getElementById('gen-fill');
                if (fill) fill.style.width = '100%';
                currentProgram = program;
                profile.program = program;
                CoachProfile.save(profile);
                // Notifie les autres onglets que le programme est dispo
                window.dispatchEvent(new CustomEvent('myfit:program-updated', { detail: program }));
                setTimeout(() => this._renderCoachDashboard(container), 400);
            },
            (err) => {
                clearInterval(stepInterval);
                container.innerHTML = `
                <div class="coach-error-screen">
                    <div style="font-size:3rem">⚠️</div>
                    <div class="coach-err-title">CONNEXION IA REQUISE</div>
                    <p class="coach-err-msg">Le Coach IA nécessite un endpoint proxy configuré.<br>
                    Ouvre <strong>coach.js</strong> et configure <code>COACH_PROXY_URL</code>.</p>
                    <p class="coach-err-detail">${err}</p>
                    <button class="primary" onclick="window.UICoachControls.resetProfile()">← Retour</button>
                </div>`;
            }
        );
    },
 
    // ── DASHBOARD COACH ───────────────────────────────────────
    _renderCoachDashboard(container) {
        const profile = CoachProfile.data;
        const program = profile?.program || currentProgram;
 
        if (!program) { this._renderProfileForm(container); return; }
 
        const imc = (profile.weight / ((profile.height / 100) ** 2)).toFixed(1);
 
        container.innerHTML = `
        <div class="coach-profile-bar">
            <div class="cpb-avatar">${profile.age}<span>ans</span></div>
            <div class="cpb-info">
                <div class="cpb-name">${profile.weight}kg · ${profile.height}cm · IMC ${imc}</div>
                <div class="cpb-goal">${program.summary}</div>
            </div>
            <button class="cpb-edit" onclick="window.UICoachControls.resetProfile()">✏️</button>
        </div>
 
        <!-- CALORIES & MACROS -->
        <div class="card coach-macros-card">
            <div class="macro-header">
                <div>
                    <div class="card-title" style="margin-bottom:2px">NUTRITION CIBLE</div>
                    <div style="font-size:.72rem;color:var(--sub)">Entretien : ${program.tdee} kcal</div>
                </div>
                <div class="macro-kcal-badge">${program.targetKcal}<span>kcal</span></div>
            </div>
            <div class="macro-bars">
                ${this._macroBar('PROTÉINES', program.macros.protein, 'g', '#00ff88', (program.macros.protein * 4 / program.targetKcal * 100).toFixed(0))}
                ${this._macroBar('GLUCIDES',  program.macros.carbs,   'g', '#ffd93d', (program.macros.carbs   * 4 / program.targetKcal * 100).toFixed(0))}
                ${this._macroBar('LIPIDES',   program.macros.fat,     'g', '#6bcfff', (program.macros.fat     * 9 / program.targetKcal * 100).toFixed(0))}
            </div>
        </div>
 
        <!-- PROGRAMME MUSCULATION -->
        <h2 class="section-header" style="margin-top:8px">PROGRAMME MUSCULATION</h2>
        ${program.workoutPlan.map((day, i) => this._workoutDayCard(day, i)).join('')}
 
        <!-- PLAN ALIMENTAIRE -->
        <h2 class="section-header">PLAN NUTRITIONNEL</h2>
        ${program.mealPlan.map((meal, i) => this._mealCardCoach(meal, i)).join('')}
 
        <!-- CONSEILS COACH -->
        <div class="card coach-tips-card">
            <div class="card-title">💡 CONSEILS DU COACH</div>
            ${program.coachTips.map(tip => `
            <div class="coach-tip-item">
                <div class="tip-bullet"></div>
                <p>${tip}</p>
            </div>`).join('')}
        </div>
 
        <!-- CHAT COACH -->
        <h2 class="section-header">PARLE À TON COACH</h2>
        <div class="card chat-card" id="chat-card">
            <div id="chat-messages" class="chat-messages">
                <div class="chat-msg assistant">
                    <div class="chat-bubble">Bonjour ! Programme généré et synchronisé. Tu peux me demander de modifier ton programme d'entraînement ou ton plan nutrition — les changements s'appliquent automatiquement dans les onglets TRAIN et EAT. 💪</div>
                </div>
            </div>
            <div class="chat-input-row">
                <input type="text" id="chat-input" class="chat-input" placeholder="Ex : change le lundi en push/pull...">
                <button class="chat-send-btn" id="chat-send" onclick="window.UICoachControls.sendChat()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
                        <path d="M22 2L11 13M22 2l-7 18-4-9-9-4 18-7z"/>
                    </svg>
                </button>
            </div>
        </div>
 
        <div style="height:20px"></div>`;
 
        document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.UICoachControls.sendChat(); }
        });
    },
 
    _macroBar(label, value, unit, color, pct) {
        return `
        <div class="macro-bar-row">
            <div class="mbr-label">${label}</div>
            <div class="mbr-bar-bg">
                <div class="mbr-bar-fill" style="width:${pct}%;background:${color};box-shadow:0 0 8px ${color}40"></div>
            </div>
            <div class="mbr-value" style="color:${color}">${value}${unit}</div>
        </div>`;
    },
 
    _workoutDayCard(day, index) {
        return `
        <div class="card workout-day-card" style="animation-delay:${index * 0.06}s">
            <div class="wdc-header">
                <div class="wdc-day">${day.day}</div>
                <div class="wdc-focus">${day.focus}</div>
            </div>
            <div class="wdc-exercises">
                ${day.exercises.map(ex => `
                <div class="wdc-ex">
                    <div class="wdc-ex-name">${ex.name}</div>
                    <div class="wdc-ex-meta">
                        <span class="wdc-badge">${ex.sets} × ${ex.reps}</span>
                        <span class="wdc-rest">⏱ ${ex.rest}s</span>
                    </div>
                    ${ex.tips ? `<div class="wdc-tip">💡 ${ex.tips}</div>` : ''}
                </div>`).join('')}
            </div>
        </div>`;
    },
 
    // Carte repas dans le dashboard coach (avec bouton remplacer)
    _mealCardCoach(meal, index) {
        return `
        <div class="card meal-card" id="coach-meal-${index}" style="animation-delay:${index * 0.05}s">
            <div class="meal-header">
                <div>
                    <div class="meal-name">${meal.meal}</div>
                    <div class="meal-time">🕐 ${meal.time}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                    <div class="meal-kcal">${meal.kcal}<span>kcal</span></div>
                    <button
                        id="replace-coach-btn-${index}"
                        onclick="window.UICoachControls.replaceMealCoach(${index})"
                        style="
                            background:rgba(255,255,255,.04);border:1px solid var(--brd);
                            color:var(--sub);padding:5px 10px;border-radius:50px;
                            font-size:.62rem;font-weight:700;letter-spacing:.06em;
                            cursor:pointer;display:flex;align-items:center;gap:5px;
                            transition:all .2s;white-space:nowrap;
                        "
                        onmouseover="this.style.borderColor='var(--g)';this.style.color='var(--g)'"
                        onmouseout="this.style.borderColor='var(--brd)';this.style.color='var(--sub)'"
                    >
                        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                            <path d="M1 9a8 8 0 1 0 16 0" stroke-linecap="round"/>
                            <path d="M13 5l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Remplacer
                    </button>
                </div>
            </div>
            <div class="meal-foods">
                ${meal.foods.map(f => `<span class="meal-food-tag">${f}</span>`).join('')}
            </div>
            <div class="meal-macros-mini">
                <span style="color:#00ff88">P: ${meal.protein}g</span>
                <span style="color:#ffd93d">G: ${meal.carbs}g</span>
                <span style="color:#6bcfff">L: ${meal.fat}g</span>
            </div>
        </div>`;
    },
 
    // ── CHAT ─────────────────────────────────────────────────
    appendChatMsg(role, text, isStreaming = false) {
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return null;
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        div.innerHTML = `<div class="chat-bubble">${this._formatChatText(text)}${isStreaming ? '<span class="cursor-blink">▊</span>' : ''}</div>`;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        return div;
    },
 
    updateLastMsg(text, done = false) {
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return;
        // Extrait la partie texte (sans le JSON) pour l'affichage dans le chat
        const displayText = text.replace(/```json[\s\S]*?```/g, '').trim() || text;
        const last = msgs.querySelector('.chat-msg:last-child .chat-bubble');
        if (last) {
            last.innerHTML = this._formatChatText(displayText) + (done ? '' : '<span class="cursor-blink">▊</span>');
            msgs.scrollTop = msgs.scrollHeight;
        }
    },
 
    // Badge affiché dans le chat quand le programme est mis à jour
    appendSyncBadge(hasWorkout, hasMeal) {
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return;
        const parts = [];
        if (hasWorkout) parts.push('Programme musculation');
        if (hasMeal)    parts.push('Plan nutrition');
        const badge = document.createElement('div');
        badge.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;margin:4px 0;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.25);border-radius:12px;font-size:.7rem;color:var(--g);font-weight:700;letter-spacing:.04em;';
        badge.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="1 8 5 12 15 4"/></svg> ${parts.join(' + ')} mis à jour automatiquement`;
        msgs.appendChild(badge);
        msgs.scrollTop = msgs.scrollHeight;
    },
 
    _formatChatText(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^### (.+)$/gm, '<div class="chat-h3">$1</div>')
            .replace(/^- (.+)$/gm, '<div class="chat-li">• $1</div>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    },
};
 
// ── CONTRÔLES GLOBAUX ─────────────────────────────────────────
export function initCoachControls(container) {
    window.UICoachControls = {
 
        resetProfile() {
            CoachProfile.clear();
            chatHistory    = [];
            currentProgram = null;
            UICoach.render(container);
        },
 
        // Remplacement repas depuis l'onglet Coach
        async replaceMealCoach(mealIndex) {
            const profile  = CoachProfile.data;
            const program  = profile?.program || currentProgram;
            if (!program?.mealPlan) return;
 
            const btn = document.getElementById(`replace-coach-btn-${mealIndex}`);
            const card = document.getElementById(`coach-meal-${mealIndex}`);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> En cours...';
            }
            if (card) card.style.opacity = '0.5';
 
            await replaceMeal(
                mealIndex,
                program.mealPlan[mealIndex],
                profile,
                (newMeal) => {
                    // Met à jour program en mémoire
                    program.mealPlan[mealIndex] = newMeal;
                    if (card) {
                        card.style.opacity = '1';
                        card.outerHTML = UICoach._mealCardCoach(newMeal, mealIndex);
                        // Réattache le handler après remplacement DOM
                        document.getElementById(`replace-coach-btn-${mealIndex}`)
                            ?.addEventListener('click', () => window.UICoachControls.replaceMealCoach(mealIndex));
                    }
                },
                (err) => {
                    if (card) card.style.opacity = '1';
                    if (btn)  { btn.disabled = false; btn.innerHTML = '↺ Remplacer'; }
                    console.error('Erreur remplacement :', err);
                }
            );
        },
 
        async sendChat() {
            const input   = document.getElementById('chat-input');
            const sendBtn = document.getElementById('chat-send');
            const msg     = input?.value?.trim();
            if (!msg || !CoachProfile.data) return;
 
            input.value   = '';
            input.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
 
            UICoach.appendChatMsg('user', msg);
            chatHistory.push({ role: 'user', content: msg });
 
            UICoach.appendChatMsg('assistant', '', true);
 
            await chatWithCoach(
                CoachProfile.data,
                chatHistory.slice(0, -1),
                msg,
                (partial) => UICoach.updateLastMsg(partial, false),
                (full, extractedProgram) => {
                    UICoach.updateLastMsg(full, true);
                    chatHistory.push({ role: 'assistant', content: full });
                    if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);
 
                    // Si un programme a été extrait, affiche un badge de confirmation
                    if (extractedProgram) {
                        UICoach.appendSyncBadge(!!extractedProgram.workoutPlan, !!extractedProgram.mealPlan);
                    }
                },
                (err) => {
                    UICoach.updateLastMsg(`⚠️ Erreur : ${err}`, true);
                }
            );
 
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        },
    };
}