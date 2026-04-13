import { UI } from './ui-render.js';
import { State } from './state.js';
import { AIEngine } from './ai-engine.js';
import { EXERCISES } from './db.js';
import { UICoach, initCoachControls } from './ui-coach.js';
import { replaceMeal, CoachProfile } from './coach.js';
 
// ── WAKE LOCK ─────────────────────────────────────────────────
let wakeLock = null;
const requestWakeLock = async () => {
    try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) {}
};
let isPageVisible = true;
document.addEventListener('visibilitychange', () => {
    isPageVisible = document.visibilityState === 'visible';
    if (isPageVisible) requestWakeLock();
});
 
// ── FOND CANVAS OLED ──────────────────────────────────────────
(function initBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx     = canvas.getContext('2d');
    const isMobile = window.innerWidth < 768;
    const N       = isMobile ? 14 : 28;
    const particles = [];
 
    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
 
    for (let i = 0; i < N; i++) {
        particles.push({
            x:     Math.random() * window.innerWidth,
            y:     Math.random() * window.innerHeight,
            r:     Math.random() * 1.5 + 0.5,
            vx:    (Math.random() - 0.5) * 0.3,
            vy:    (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.6 + 0.1,
            hue:   Math.random() > 0.7 ? 180 : 150,
        });
    }
 
    let lastFrame = 0;
    function draw(ts) {
        requestAnimationFrame(draw);
        if (!isPageVisible) return;
        if (isMobile && ts - lastFrame < 32) return;
        lastFrame = ts;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0)             p.x = canvas.width;
            if (p.x > canvas.width)  p.x = 0;
            if (p.y < 0)             p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${p.alpha})`;
            ctx.fill();
        }
    }
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
})();
 
// ── TIMER ─────────────────────────────────────────────────────
const Timer = {
    _int: null, _total: 0, _circ: 490.09,
 
    start(sec) {
        this.stop();
        this._total = sec;
        requestWakeLock();
        let left = sec;
        const overlay  = document.getElementById('timer-overlay');
        const clock    = document.getElementById('timer-number');
        const progress = document.getElementById('timer-progress');
        overlay.classList.remove('hidden');
 
        const tick = () => {
            clock.innerText = left < 10 ? '0' + left : String(left);
            if (progress) progress.style.strokeDashoffset = String(this._circ * (1 - left / this._total));
            if (left <= 0) {
                this.stop(); overlay.classList.add('hidden');
                _setMsg('⚡ Récupération terminée. Prêt pour la prochaine série.');
                _vibrate(50); return;
            }
            left--;
        };
        tick();
        this._int = setInterval(tick, 1000);
    },
 
    stop() {
        if (this._int) { clearInterval(this._int); this._int = null; }
        const o = document.getElementById('timer-overlay');
        if (o) o.classList.add('hidden');
    },
};
 
// ── PR TOAST ──────────────────────────────────────────────────
function showPRToast(exerciseName, weight) {
    const toast  = document.getElementById('pr-toast');
    const detail = document.getElementById('pr-detail');
    if (!toast || !detail) return;
    detail.innerText = `${exerciseName} · ${weight} kg`;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 350);
    }, 3200);
}
 
// ── TOAST GÉNÉRIQUE (sync programme) ─────────────────────────
function showSyncToast(msg) {
    let toast = document.getElementById('sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sync-toast';
        toast.style.cssText = `
            position:fixed;bottom:96px;left:50%;transform:translateX(-50%) translateY(20px);
            background:rgba(0,255,136,.12);border:1px solid rgba(0,255,136,.4);
            color:var(--g);padding:10px 18px;border-radius:50px;
            font-size:.72rem;font-weight:700;letter-spacing:.06em;
            z-index:4000;opacity:0;transition:opacity .3s,transform .3s;
            display:flex;align-items:center;gap:8px;white-space:nowrap;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="1 8 5 12 15 4"/></svg> ${msg}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
}
 
// ── HELPERS ───────────────────────────────────────────────────
function _setMsg(text) {
    const el = document.getElementById('ai-message');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => { el.innerText = text; el.style.opacity = '1'; }, 200);
}
function _vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
 
function _updateStreak() {
    const streak = State.getStreak();
    const badge  = document.getElementById('streak-badge');
    if (!badge) return;
    const msg = AIEngine.getStreakMessage(streak);
    if (msg && streak > 0) { badge.innerText = msg; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}
 
// ── NAVIGATION ────────────────────────────────────────────────
const viewPort = document.getElementById('view-port');
let currentView = null;
 
initCoachControls(viewPort);
 
function navigateTo(view) {
    if (view === currentView) return;
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const item = document.querySelector(`[data-view="${view}"]`);
    if (item) item.classList.add('active');
    viewPort.style.opacity = '0';
    setTimeout(() => {
        viewPort.style.opacity = '';
        switch (view) {
            case 'workout':   UI.renderWorkout(viewPort);   break;
            case 'nutrition': UI.renderNutrition(viewPort); break;
            case 'coach':     UICoach.render(viewPort);     break;
            case 'vision':    UI.renderVision(viewPort);    break;
            case 'stats':     UI.renderStats(viewPort);     break;
        }
    }, 120);
}
 
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.view));
    item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') navigateTo(item.dataset.view);
    });
});
 
// ── SYNC AUTO PROGRAMME ───────────────────────────────────────
// Écoute les mises à jour du Coach IA et rafraîchit l'onglet actif si pertinent
window.addEventListener('myfit:program-updated', (e) => {
    const program = e.detail;
    const parts = [];
    if (program?.workoutPlan) parts.push('entraînement');
    if (program?.mealPlan)    parts.push('nutrition');
    if (parts.length) {
        showSyncToast(`${parts.join(' + ')} mis à jour`);
        _setMsg(`✅ Programme IA appliqué : ${parts.join(' + ')} synchronisé${parts.length > 1 ? 's' : ''}.`);
    }
    // Rafraîchit l'onglet courant si concerné
    if (program?.workoutPlan) UI.renderWorkout(viewPort);
    if (currentView === 'nutrition' && program?.mealPlan) UI.renderNutrition(viewPort);
});
 
// ── CONTRÔLES GLOBAUX ─────────────────────────────────────────
window.AppControls = {
 
    validateSet(id, rest, target, type) {
        const repsEl   = document.getElementById('r_' + id);
        const weightEl = document.getElementById('w_' + id);
        const reps     = parseInt(repsEl?.value);
        const weight   = parseFloat(weightEl?.value ?? 0);
 
        if (!reps || reps < 1 || reps > 100) {
            _setMsg('⚠️ Saisis un nombre de répétitions valide (1–100).');
            _vibrate(80); return;
        }
        if (weight < 0 || weight > 1000) {
            _setMsg('⚠️ La charge semble incorrecte. Vérifie la valeur.');
            _vibrate(80); return;
        }
 
        const isPR  = State.checkPR(id, weight);
        const nextW = AIEngine.calculateNextWeight(weight, reps, target, type);
        State.data.weights[id] = nextW;
        State.recordSet(id, weight, reps, target);
        State.save();
 
        if (weightEl && nextW !== weight) {
            weightEl.value = nextW;
            weightEl.classList.add('input-success');
            setTimeout(() => weightEl.classList.remove('input-success'), 1000);
        }
        if (repsEl) repsEl.value = '';
 
        _setMsg(AIEngine.getMotivationalMessage(reps, target));
        _vibrate(isPR ? [50, 30, 80] : 40);
        if (isPR) {
            const ex = EXERCISES.find(e => e.id === id);
            showPRToast(ex?.name ?? id, weight);
        }
        _updateStreak();
        Timer.start(rest);
    },
 
    skipRest() {
        Timer.stop();
        _setMsg('⚡ Repos sauté. Garde l\'intensité.');
        _vibrate(30);
    },
 
    addMeal() {
        const kcal    = parseInt(document.getElementById('in-kcal')?.value)  || 0;
        const protein = parseInt(document.getElementById('in-prot')?.value)  || 0;
        const carbs   = parseInt(document.getElementById('in-carb')?.value)  || 0;
        const fat     = parseInt(document.getElementById('in-fat')?.value)   || 0;
        if (!kcal) { _setMsg('⚠️ Saisis au moins les calories du repas.'); return; }
        State.data.nutri.kcal    += kcal;
        State.data.nutri.protein += protein;
        State.data.nutri.carbs   += carbs;
        State.data.nutri.fat     += fat;
        State.save();
        _setMsg(`🍽️ +${kcal} kcal · Total : ${State.data.nutri.kcal.toLocaleString('fr-FR')} kcal.`);
        UI.renderNutrition(viewPort);
    },
 
    resetNutri() {
        const n = State.data.nutri;
        State.data.nutri = {
            kcal: 0, goal: n.goal, protein: 0, carbs: 0, fat: 0,
            goalProtein: n.goalProtein, goalCarbs: n.goalCarbs, goalFat: n.goalFat,
        };
        State.save();
        _setMsg('🔄 Compteur nutritionnel remis à zéro.');
        UI.renderNutrition(viewPort);
    },
 
    // Remplacement repas depuis l'onglet Nutrition
    async replaceMeal(mealIndex) {
        const profile  = CoachProfile.data;
        const mealPlan = State.data.aiMealPlan;
        if (!mealPlan?.[mealIndex]) return;
 
        const card = document.getElementById(`meal-card-${mealIndex}`);
        const btn  = document.getElementById(`replace-btn-${mealIndex}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> En cours...';
        }
        if (card) card.style.opacity = '0.5';
 
        _setMsg('🔄 Le Coach cherche une alternative équivalente...');
 
        await replaceMeal(
            mealIndex,
            mealPlan[mealIndex],
            profile,
            (newMeal) => {
                // Remplace la carte dans le DOM sans re-render toute la page
                if (card) {
                    card.style.opacity = '1';
                    card.outerHTML = UI._mealCard(newMeal, mealIndex);
                    // Réattache le handler
                    document.getElementById(`replace-btn-${mealIndex}`)
                        ?.addEventListener('click', () => window.AppControls.replaceMeal(mealIndex));
                }
                _setMsg(`✅ Repas remplacé : ${newMeal.meal} · ${newMeal.kcal} kcal.`);
            },
            (err) => {
                if (card) card.style.opacity = '1';
                if (btn)  { btn.disabled = false; btn.innerHTML = '↺ Remplacer'; }
                _setMsg('⚠️ Impossible de remplacer ce repas. Réessaie.');
                console.error('replaceMeal:', err);
            }
        );
    },
 
    selectDay(index) {
        localStorage.setItem('myfit_selected_day', index);
        UI.renderWorkout(viewPort);
    },
 
    exportData() {
        State.exportData();
        _setMsg('💾 Sauvegarde exportée avec succès.');
    },
 
    importData(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const ok = State.importData(e.target.result);
            if (ok) { _setMsg('✅ Données restaurées avec succès.'); navigateTo('stats'); }
            else      _setMsg('⚠️ Fichier invalide. Vérifie que c\'est une sauvegarde MYFIT.');
        };
        reader.readAsText(file);
    },
};
 
// ── INIT ──────────────────────────────────────────────────────
navigateTo('workout');
_updateStreak();
 
setTimeout(() => {
    const stats  = State.getStats();
    const streak = State.getStreak();
    let msg = 'Protocole initialisé. Ton entraînement commence maintenant.';
    if (stats.sessions > 0) {
        msg = streak > 1
            ? `${streak} jours consécutifs. La régularité forge les champions.`
            : `Bienvenue. ${stats.sessions} sessions enregistrées. On continue.`;
    }
    _setMsg(msg);
}, 900)