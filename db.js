export const EXERCISES = [
    { id: 'sq', name: 'Squat Arrière', muscle: 'Jambes', rest: 180, target: 8, type: 'Power' },
    { id: 'dc', name: 'Développé Couché', muscle: 'Pectoraux', rest: 120, target: 10, type: 'Volume' },
    { id: 'pu', name: 'Tractions Lestées', muscle: 'Dos', rest: 150, target: 6, type: 'Power' },
    { id: 'el', name: 'Élévations Latérales', muscle: 'Épaules', rest: 60, target: 15, type: 'Isolation' },
    { id: 'rdl', name: 'Roumain Deadlift', muscle: 'Ischio', rest: 120, target: 10, type: 'Volume' },
    { id: 'dip', name: 'Dips Lestés', muscle: 'Triceps', rest: 90, target: 12, type: 'Volume' },
];

export const DEFAULT_WEIGHTS = {
    sq: 80, dc: 60, pu: 0, el: 10, rdl: 60, dip: 0
};