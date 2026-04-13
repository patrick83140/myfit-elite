import { DEFAULT_WEIGHTS } from './db.js';
 
const KEY = 'myfit_elite_v3';
 
export const State = {
    data: null,
    _statsCache: null,
    _statsCacheDate: null,
 
    init() {
        try {
            const raw = localStorage.getItem(KEY);
            this.data = raw ? JSON.parse(raw) : this._defaults();
        } catch {
            this.data = this._defaults();
        }
        // Garantit que toutes les clés d'exercices sont présentes
        Object.keys(DEFAULT_WEIGHTS).forEach(id => {
            if (this.data.weights[id] === undefined)    this.data.weights[id]    = DEFAULT_WEIGHTS[id];
            if (this.data.maxWeights[id] === undefined) this.data.maxWeights[id] = DEFAULT_WEIGHTS[id];
        });
        // Migration : assure la présence des champs macro objectifs
        const n = this.data.nutri;
        if (n.goalProtein === undefined) n.goalProtein = 0;
        if (n.goalCarbs   === undefined) n.goalCarbs   = 0;
        if (n.goalFat     === undefined) n.goalFat     = 0;
    },
 
    _defaults() {
        return {
            version: 3,
            weights: { ...DEFAULT_WEIGHTS },
            maxWeights: { ...DEFAULT_WEIGHTS },
            photos: [],
            nutri: {
                kcal: 0,
                goal: 2800,
                protein: 0,
                carbs: 0,
                fat: 0,
                goalProtein: 0,
                goalCarbs: 0,
                goalFat: 0,
            },
            history: [],
            sessionDates: [],
            aiWorkoutPlan: null,
        };
    },
 
    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.data));
            this._statsCache = null; // invalide le cache à chaque sauvegarde
        } catch (e) {
            console.error('State.save() :', e);
        }
    },
 
    checkPR(id, weight) {
        const w = parseFloat(weight) || 0;
        if (w > 0 && w > (this.data.maxWeights[id] ?? 0)) {
            this.data.maxWeights[id] = w;
            return true;
        }
        return false;
    },
 
    recordSet(id, weight, reps, target) {
        const today = this._localDateString();
        let session = this.data.history.find(h => h.date === today);
        if (!session) {
            session = { date: today, sets: [] };
            this.data.history.push(session);
            if (!this.data.sessionDates.includes(today)) {
                this.data.sessionDates.push(today);
                if (this.data.sessionDates.length > 365) this.data.sessionDates.shift();
            }
        }
        session.sets.push({
            id,
            weight: parseFloat(weight)  || 0,
            reps:   parseInt(reps)      || 0,
            target: parseInt(target)    || 0,
        });
        if (this.data.history.length > 90) this.data.history.shift();
        this.save();
    },
 
    // ── Calcul du streak en heure locale (évite le décalage UTC) ──────────
    getStreak() {
        const dates = [...this.data.sessionDates].sort().reverse();
        if (!dates.length) return 0;
        let streak = 0;
        const todayStr = this._localDateString();
        let refStr = todayStr;
        for (const d of dates) {
            const diffDays = this._daysBetween(d, refStr);
            if (diffDays <= 1) {
                streak++;
                refStr = d;
            } else {
                break;
            }
        }
        return streak;
    },
 
    addPhoto(dataUrl, weight) {
        this.data.photos.push({
            url: dataUrl,
            weight: parseFloat(weight) || null,
            date: this._localDateString(),
        });
        this.save();
    },
 
    getBeforeAfterPhotos() {
        const p = this.data.photos;
        if (!p.length)     return { before: null, after: null };
        if (p.length === 1) return { before: p[0], after: null };
        return { before: p[0], after: p[p.length - 1] };
    },
 
    // ── Stats avec cache (évite le recalcul complet à chaque appel) ────────
    getStats() {
        const today = this._localDateString();
        if (this._statsCache && this._statsCacheDate === today) return this._statsCache;
 
        const history = this.data.history;
        const totalSets = history.reduce((a, s) => a + s.sets.length, 0);
        const totalVol  = history.reduce((a, s) => a + s.sets.reduce((b, r) => b + r.weight * r.reps, 0), 0);
        const sessions  = history.length;
        const lastDate  = history.length ? history[history.length - 1].date : '—';
 
        this._statsCache = { sessions, totalSets, totalVol: Math.round(totalVol), lastDate };
        this._statsCacheDate = today;
        return this._statsCache;
    },
 
    getTodaySets() {
        const today = this._localDateString();
        return this.data.history.find(h => h.date === today)?.sets ?? [];
    },
 
    getWeightHistory(id, n = 10) {
        return this.data.history
            .filter(s => s.sets.some(r => r.id === id))
            .slice(-n)
            .map(s => ({
                date:   s.date,
                weight: Math.max(...s.sets.filter(r => r.id === id).map(r => r.weight)),
            }));
    },
 
    // ── Export JSON (backup) ───────────────────────────────────────────────
    exportData() {
        const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `myfit-backup-${this._localDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
 
    // ── Import JSON (restauration) ─────────────────────────────────────────
    importData(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.weights || !parsed.history) throw new Error('Format invalide');
            this.data = parsed;
            this.save();
            return true;
        } catch (e) {
            console.error('State.importData() :', e);
            return false;
        }
    },
 
    // ── Helpers date en heure locale ──────────────────────────────────────
    _localDateString(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },
 
    _daysBetween(dateStrA, dateStrB) {
        const a = new Date(dateStrA + 'T00:00:00');
        const b = new Date(dateStrB + 'T00:00:00');
        return Math.round(Math.abs((b - a) / 86400000));
    },
};
 
State.init();