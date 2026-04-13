import { EXERCISES } from './db.js';
import { State } from './state.js';
import { AIEngine } from './ai-engine.js';
import { replaceMeal, CoachProfile } from './coach.js';
 
export const UI = {
 
    renderWorkout(container) {
        const stats   = State.getStats();
        const today   = State.getTodaySets();
 
        // Si un programme IA existe, l'afficher en premier
        const aiPlan  = State.data.aiWorkoutPlan;
        const todayDay = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
        const todayDayCap = todayDay.charAt(0).toUpperCase() + todayDay.slice(1);
        const aiDay   = aiPlan?.find(d =>
            d.day.toLowerCase().includes(todayDay.toLowerCase()) ||
            todayDay.toLowerCase().includes(d.day.toLowerCase().split(' ')[0])
        );
 
        container.innerHTML = `
            <h2 class="section-header">ENTRAÎNEMENT DU JOUR</h2>
            ${stats.sessions > 0 ? `
            <div style="padding:4px 18px 8px; display:flex; gap:16px; font-size:.72rem; color:var(--sub)">
                <span>📅 <strong style="color:var(--text)">${stats.sessions}</strong> sessions</span>
                <span>⚡ <strong style="color:var(--text)">${stats.totalSets}</strong> séries</span>
                <span>🏋️ <strong style="color:var(--text)">${(stats.totalVol / 1000).toFixed(1)}t</strong> volume</span>
            </div>` : ''}
 
            ${aiPlan ? this._renderAiWorkoutSection(aiPlan, aiDay, todayDayCap) : ''}
 
            <h2 class="section-header" style="margin-top:${aiPlan ? '8px' : '0'}">
                ${aiPlan ? 'MES CHARGES' : 'SÉANCES'}
            </h2>
            ${EXERCISES.map((ex, i) => this._exerciseCard(ex, i, today)).join('')}
        `;
        this._addRipples(container);
    },
 
    _renderAiWorkoutSection(aiPlan, aiDay, todayDayCap) {
        if (aiDay) {
            // Affiche le jour d'entraînement IA correspondant à aujourd'hui
            return `
            <div class="card" style="border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.03)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                    <div style="width:6px;height:6px;border-radius:50%;background:var(--g);box-shadow:0 0 8px var(--g)"></div>
                    <div class="card-title" style="margin-bottom:0">PROGRAMME IA · ${aiDay.day.toUpperCase()}</div>
                    <div style="font-size:.68rem;color:var(--sub);margin-left:auto">${aiDay.focus}</div>
                </div>
                ${aiDay.exercises.map(ex => `
                <div style="padding:10px 12px;background:rgba(255,255,255,.02);border-radius:12px;border:1px solid var(--brd);margin-bottom:8px">
                    <div style="font-weight:700;font-size:.88rem;margin-bottom:5px">${ex.name}</div>
                    <div style="display:flex;align-items:center;gap:10px">
                        <span class="wdc-badge">${ex.sets} × ${ex.reps}</span>
                        <span style="font-size:.68rem;color:var(--sub)">⏱ ${ex.rest}s</span>
                    </div>
                    ${ex.tips ? `<div style="margin-top:6px;font-size:.7rem;color:var(--sub);font-style:italic;line-height:1.4">💡 ${ex.tips}</div>` : ''}
                </div>`).join('')}
            </div>`;
        } else {
            // Affiche un aperçu de la semaine si pas de séance aujourd'hui
            return `
            <div class="card" style="border-color:rgba(0,255,136,.2)">
                <div class="card-title">PROGRAMME IA · SEMAINE</div>
                ${aiPlan.map(d => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
                    <span style="font-size:.8rem;font-weight:700;color:var(--g);min-width:80px">${d.day}</span>
                    <span style="font-size:.75rem;color:var(--sub)">${d.focus}</span>
                    <span style="font-size:.62rem;color:var(--sub2)">${d.exercises.length} ex.</span>
                </div>`).join('')}
            </div>`;
        }
    },
 
    _exerciseCard(ex, i, todaySets) {
        const w     = State.data.weights[ex.id] ?? 0;
        const isMax = w > 0 && w >= (State.data.maxWeights[ex.id] ?? 0);
        const done  = todaySets.filter(s => s.id === ex.id).length;
        const step  = ex.type === 'Power' ? 5 : (ex.type === 'Isolation' ? 0.5 : 1.25);
        return `
        <div class="card ex-card" style="animation-delay:${i * 0.07}s">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                    <div class="ex-meta">${ex.type} · ${ex.muscle}</div>
                    <div class="ex-name">${ex.name}${isMax && w > 0 ? '<span class="pr-badge">PR</span>' : ''}</div>
                    <div class="ex-target">Objectif : <strong>${ex.target}</strong> reps · Repos : ${ex.rest}s</div>
                </div>
                ${done > 0 ? `<div style="background:var(--g-dim);border:1px solid var(--brd2);border-radius:50px;padding:4px 10px;font-size:.62rem;color:var(--g);font-weight:700;white-space:nowrap">${done} série${done > 1 ? 's' : ''} ✓</div>` : ''}
            </div>
            <div class="input-row">
                <div class="input-wrap">
                    <label>KG</label>
                    <input type="number" id="w_${ex.id}" value="${w}" step="${step}" min="0" max="1000">
                </div>
                <div class="input-wrap">
                    <label>REPS</label>
                    <input type="number" id="r_${ex.id}" min="1" max="100" placeholder="—">
                </div>
            </div>
            <button class="primary" onclick="window.AppControls.validateSet('${ex.id}', ${ex.rest}, ${ex.target}, '${ex.type}')">
                ✓ VALIDER LA SÉRIE
            </button>
        </div>`;
    },
 
    renderNutrition(container) {
        const n   = State.data.nutri;
        const pct = Math.min(100, Math.round((n.kcal / n.goal) * 100));
        const hasGoals = n.goalProtein > 0 || n.goalCarbs > 0 || n.goalFat > 0;
 
        const macroBox = (value, goal, color, label) => {
            const p       = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
            const goalStr = goal > 0 ? ` / ${goal}g` : '';
            return `
            <div class="macro-box">
                <div class="macro-val" style="color:${color}">${value}g<span style="font-size:.6rem;color:var(--sub)">${goalStr}</span></div>
                ${hasGoals && goal > 0 ? `<div style="background:rgba(255,255,255,.05);border-radius:4px;height:4px;margin:5px 0 3px;overflow:hidden"><div style="width:${p}%;height:100%;background:${color};border-radius:4px;transition:width .6s"></div></div>` : ''}
                <div class="macro-name">${label}</div>
            </div>`;
        };
 
        // Plan repas IA si disponible
        const aiMealPlan = State.data.aiMealPlan;
 
        container.innerHTML = `
            <h2 class="section-header">NUTRITION</h2>
            <div class="card">
                <div class="nutri-header">
                    <div>
                        <div class="nutri-kcal">${n.kcal.toLocaleString('fr-FR')}</div>
                        <div class="nutri-goal">/ ${n.goal.toLocaleString('fr-FR')} kcal · ${pct}%</div>
                    </div>
                    <div style="text-align:right; font-size:.72rem; color:var(--sub)">
                        Reste<br><strong style="color:var(--g);font-size:1rem">${Math.max(0, n.goal - n.kcal).toLocaleString('fr-FR')}</strong> kcal
                    </div>
                </div>
                <div class="nutri-bar-bg"><div class="nutri-bar-fill" style="width:${pct}%"></div></div>
                <div class="nutri-macros">
                    ${macroBox(n.protein, n.goalProtein, '#ff6b6b', 'Protéines')}
                    ${macroBox(n.carbs,   n.goalCarbs,   '#ffd93d', 'Glucides')}
                    ${macroBox(n.fat,     n.goalFat,     '#6bcfff', 'Lipides')}
                </div>
                ${!hasGoals ? `<p style="font-size:.68rem;color:var(--sub2);text-align:center;margin-top:10px;font-style:italic">Active le Coach IA pour obtenir tes objectifs de macros personnalisés.</p>` : ''}
            </div>
 
            ${aiMealPlan?.length ? `
            <h2 class="section-header">PLAN NUTRITIONNEL IA</h2>
            ${aiMealPlan.map((meal, i) => this._mealCard(meal, i)).join('')}
            ` : ''}
 
            <h2 class="section-header">ENREGISTRER UN REPAS</h2>
            <div class="card">
                <div class="input-row">
                    <div class="input-wrap"><label>KCAL</label><input type="number" id="in-kcal" placeholder="0" min="0" max="5000"></div>
                    <div class="input-wrap"><label>PROT (g)</label><input type="number" id="in-prot" placeholder="0" min="0" max="500"></div>
                </div>
                <div class="input-row" style="margin-top:8px">
                    <div class="input-wrap"><label>GLUCIDES (g)</label><input type="number" id="in-carb" placeholder="0" min="0" max="1000"></div>
                    <div class="input-wrap"><label>LIPIDES (g)</label><input type="number" id="in-fat" placeholder="0" min="0" max="500"></div>
                </div>
                <button class="primary" onclick="window.AppControls.addMeal()">+ ENREGISTRER LE REPAS</button>
                <button class="ghost" onclick="window.AppControls.resetNutri()">🔄 Reset journalier</button>
            </div>`;
 
        this._addRipples(container);
    },
 
    _mealCard(meal, index) {
        return `
        <div class="card meal-card" id="meal-card-${index}" style="animation-delay:${index * 0.05}s">
            <div class="meal-header">
                <div>
                    <div class="meal-name">${meal.meal}</div>
                    <div class="meal-time">🕐 ${meal.time}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                    <div class="meal-kcal">${meal.kcal}<span>kcal</span></div>
                    <button
                        id="replace-btn-${index}"
                        onclick="window.AppControls.replaceMeal(${index})"
                        style="
                            background:rgba(255,255,255,.04);
                            border:1px solid var(--brd);
                            color:var(--sub);
                            padding:5px 10px;
                            border-radius:50px;
                            font-size:.62rem;
                            font-weight:700;
                            letter-spacing:.06em;
                            cursor:pointer;
                            display:flex;
                            align-items:center;
                            gap:5px;
                            transition:all .2s;
                            white-space:nowrap;
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
 
    renderVision(container) {
        const { before, after } = State.getBeforeAfterPhotos();
        const count = State.data.photos.length;
        container.innerHTML = `
            <h2 class="section-header">VISION TRANSFORMATION</h2>
            <div class="card">
                <div class="vision-grid">
                    <div class="v-slot">
                        <div class="v-label">AVANT · ${before?.date ?? '—'}</div>
                        ${before ? `<img src="${before.url}" class="v-img" alt="Photo avant">` : `<div class="v-placeholder"><span style="font-size:1.5rem">📷</span>Pas encore<br>de photo</div>`}
                        ${before?.weight ? `<div class="v-weight">${before.weight} kg</div>` : ''}
                    </div>
                    <div class="v-slot">
                        <div class="v-label">ACTUEL · ${after?.date ?? '—'}</div>
                        ${after ? `<img src="${after.url}" class="v-img" alt="Photo actuelle">` : `<div class="v-placeholder"><span style="font-size:1.5rem">📷</span>Ajoutez votre<br>première photo</div>`}
                        ${after?.weight ? `<div class="v-weight">${after.weight} kg</div>` : ''}
                    </div>
                </div>
                ${count > 0 ? `<p style="text-align:center;font-size:.72rem;color:var(--sub);margin-top:8px">${count} photo${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''}</p>` : ''}
            </div>
            <div class="card">
                <div class="card-title">NOUVELLE PHOTO</div>
                <div class="input-wrap" style="margin-top:4px; display:block">
                    <label style="position:static;background:transparent;display:block;margin-bottom:6px">POIDS ACTUEL (KG)</label>
                    <input type="number" id="up-weight" placeholder="Ex : 82.5" style="width:100%;text-align:center" min="30" max="300">
                </div>
                <input type="file" id="up-img" accept="image/*" capture="environment" style="display:none">
                <button class="primary" onclick="document.getElementById('up-img').click()">📸 AJOUTER UNE PHOTO</button>
                ${count > 0 ? `<button class="ghost" style="margin-top:10px; color:#ff4444" onclick="if(confirm('Supprimer la dernière photo ?')){ window.AppControls.deleteLastPhoto(); }">🗑️ Supprimer dernière photo</button>` : ''}
            </div>`;
        this._setupPhotoLogic(container);
        this._addRipples(container);
    },
 
    _setupPhotoLogic(container) {
        const inp = document.getElementById('up-img');
        if (!inp) return;
        inp.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            document.getElementById('ai-message').innerText = '⚡ Traitement de l\'image...';
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width, height = img.height;
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.7);
                    State.addPhoto(compressed, document.getElementById('up-weight')?.value ?? '');
                    this.renderVision(container);
                    document.getElementById('ai-message').innerText = '📸 Vision mise à jour. Continue tes efforts.';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };
        window.AppControls.deleteLastPhoto = () => {
            State.data.photos.pop();
            State.save();
            this.renderVision(container);
            document.getElementById('ai-message').innerText = '🗑️ Photo supprimée.';
        };
    },
 
    renderStats(container) {
        const stats  = State.getStats();
        const today  = State.getTodaySets();
        const streak = State.getStreak();
        const aiMsg  = AIEngine.getSessionSummary(today);
 
        const chartOptions = EXERCISES.map(ex =>
            `<option value="${ex.id}">${ex.name}</option>`
        ).join('');
 
        container.innerHTML = `
            <h2 class="section-header">DATA & PERFORMANCE</h2>
            <div class="card">
                <div class="card-title">ANALYSE IA</div>
                <p style="font-size:.82rem;color:var(--sub);line-height:1.65;border-left:1px solid var(--g);padding-left:12px;font-style:italic">${aiMsg}</p>
            </div>
            <div class="card">
                <div class="card-title">STATISTIQUES</div>
                <div class="stat-grid">
                    <div class="stat-box"><div class="stat-value">${stats.sessions}</div><div class="stat-label">Sessions</div></div>
                    <div class="stat-box"><div class="stat-value">${streak}</div><div class="stat-label">Jours streak</div></div>
                    <div class="stat-box"><div class="stat-value">${stats.totalSets}</div><div class="stat-label">Séries totales</div></div>
                    <div class="stat-box"><div class="stat-value">${stats.totalVol > 999 ? (stats.totalVol / 1000).toFixed(1) + 't' : stats.totalVol + 'kg'}</div><div class="stat-label">Volume total</div></div>
                </div>
            </div>
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <div class="card-title" style="margin-bottom:0">PROGRESSION</div>
                    <select id="chart-exercise-select" style="
                        background:rgba(255,255,255,.04);border:1px solid var(--brd);
                        color:var(--sub);padding:5px 10px;border-radius:10px;
                        font-family:var(--font-display);font-size:.6rem;font-weight:700;
                        letter-spacing:.08em;outline:none;cursor:pointer;
                    ">${chartOptions}</select>
                </div>
                <canvas id="progress-chart"></canvas>
                <p id="chart-no-data" style="display:none;text-align:center;font-size:.72rem;color:var(--sub2);padding:20px 0;font-style:italic">Pas encore assez de données pour cet exercice.</p>
            </div>
            <div class="card">
                <div class="card-title">CHARGES ACTUELLES</div>
                ${EXERCISES.map(ex => `
                <div class="weight-row">
                    <div><div class="weight-name">${ex.name}</div><div class="weight-muscle">${ex.muscle}</div></div>
                    <div class="weight-val">${State.data.weights[ex.id] ?? 0} kg</div>
                </div>`).join('')}
            </div>
            <div class="card">
                <div class="card-title">SAUVEGARDE & RESTAURATION</div>
                <p style="font-size:.75rem;color:var(--sub);line-height:1.6;margin-bottom:14px">Exporte tes données pour ne pas les perdre si tu vides le cache du navigateur.</p>
                <button class="primary" onclick="window.AppControls.exportData()">💾 EXPORTER MES DONNÉES</button>
                <input type="file" id="import-file" accept=".json" style="display:none" onchange="window.AppControls.importData(event)">
                <button class="ghost" onclick="document.getElementById('import-file').click()">📂 Restaurer une sauvegarde</button>
            </div>`;
 
        requestAnimationFrame(() => this._drawChart('sq'));
        document.getElementById('chart-exercise-select')?.addEventListener('change', (e) => {
            this._drawChart(e.target.value);
        });
    },
 
    _drawChart(exerciseId) {
        const canvas = document.getElementById('progress-chart');
        const noData = document.getElementById('chart-no-data');
        if (!canvas) return;
        const history = State.getWeightHistory(exerciseId, 10);
        if (history.length < 2) {
            canvas.style.display = 'none';
            if (noData) noData.style.display = 'block';
            return;
        }
        canvas.style.display = 'block';
        if (noData) noData.style.display = 'none';
 
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W   = canvas.offsetWidth;
        const H   = 120;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
 
        const values = history.map(h => h.weight);
        const min    = Math.min(...values) * 0.95;
        const max    = Math.max(...values) * 1.05;
        const padL = 10, padR = 10, padT = 14, padB = 20;
        const gW   = W - padL - padR;
        const gH   = H - padT - padB;
        const xOf  = (i) => padL + (i / (values.length - 1)) * gW;
        const yOf  = (v) => padT + gH - ((v - min) / (max - min || 1)) * gH;
 
        const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
        grad.addColorStop(0, 'rgba(0,255,136,.25)');
        grad.addColorStop(1, 'rgba(0,255,136,0)');
        ctx.beginPath();
        ctx.moveTo(xOf(0), yOf(values[0]));
        values.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
        ctx.lineTo(xOf(values.length - 1), H - padB);
        ctx.lineTo(xOf(0), H - padB);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
 
        ctx.beginPath();
        ctx.moveTo(xOf(0), yOf(values[0]));
        values.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 8;
        ctx.stroke(); ctx.shadowBlur = 0;
 
        values.forEach((v, i) => {
            const x = xOf(i), y = yOf(v);
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00ff88'; ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Rajdhani, sans-serif';
            ctx.textAlign = 'center'; ctx.fillText(v + 'kg', x, y - 8);
        });
    },
 
    _addRipples(container) {
        container.querySelectorAll('button.primary').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const r = document.createElement('span');
                r.className = 'ripple';
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
                this.appendChild(r);
                setTimeout(() => r.remove(), 600);
            });
        });
    },
};