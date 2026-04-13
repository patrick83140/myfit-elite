export const AIEngine = {
 
    calculateNextWeight(currentW, reps, target, type = 'Volume') {
        // Validation des entrées
        const w = parseFloat(currentW) || 0;
        const r = parseInt(reps) || 0;
        const t = parseInt(target) || 10;
        if (w < 0 || r < 1 || r > 100) return Math.max(0, w);
 
        let increment, boost;
        if (type === 'Isolation') {
            increment = 0.5;
            boost = 1.0;
        } else if (type === 'Power') {
            increment = 5;
            boost = 5;
        } else {
            increment = 1.25;
            boost = 2.5;
        }
 
        if (r >= t + 3) return +(w + boost).toFixed(2);
        if (r >= t)     return +(w + increment).toFixed(2);
        if (r <= t - 3) return +(Math.max(0, w - boost)).toFixed(2);
        return w;
    },
 
    getMotivationalMessage(reps, target) {
        const r = parseInt(reps) || 0;
        const t = parseInt(target) || 10;
        if (r >= t + 3) return '🔥 Force explosive détectée. Augmentation majeure planifiée.';
        if (r >= t)     return '✅ Objectif validé. On monte d\'un palier.';
        if (r === t - 1) return '💪 À une répétition du but. Ne lâche rien au prochain set.';
        return '📊 Session enregistrée. La régularité est ton armure.';
    },
 
    getSessionSummary(setsData) {
        if (!setsData?.length) return 'Aucune série aujourd\'hui. Lance ton entraînement.';
        const above = setsData.filter(s => s.reps >= s.target).length;
        const ratio = Math.round((above / setsData.length) * 100);
        const totalVol = setsData.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
        const volStr = totalVol >= 1000
            ? `${(totalVol / 1000).toFixed(1)}t`
            : `${totalVol}kg`;
        if (ratio >= 80) return `Session ELITE · ${ratio}% targets · ${volStr} de volume total. Progression confirmée.`;
        if (ratio >= 50) return `Session SOLIDE · ${ratio}% targets · ${volStr} de volume. Continue.`;
        return `Session de CONSTRUCTION · ${ratio}% targets · ${volStr}. Reste régulier.`;
    },
 
    getStreakMessage(days) {
        const d = parseInt(days) || 0;
        if (d >= 7) return `🔥 ${d}j STREAK`;
        if (d >= 3) return `⚡ ${d}j STREAK`;
        if (d === 1) return `1j STREAK`;
        return null;
    }
};