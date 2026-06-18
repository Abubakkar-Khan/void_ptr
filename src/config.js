export const PALETTE = {
    background: '#000000',
    environment: '#00ff41',
    player: '#b8fff2',
    playerShot: '#4dff88',
    enemy: '#ff3366',
    enemyShot: '#ffb000',
    elite: '#ff5c8a',
    pickup: '#55dfff',
    boss: '#ff1744',
    ui: '#ffffff'
};

export const HULL_DEFS = {
    runner: {
        id: 'runner',
        name: 'THREAD.RUNNER',
        weapon: 'auto_blaster',
        maxHp: 12,
        baseSpeed: 1.1,
        acceleration: 0.08,
        dashDistance: 12,
        description: 'Balanced execution hull. Fast recovery, precise blaster and reliable dash.'
    },
    daemon: {
        id: 'daemon',
        name: 'DAEMON.POD',
        weapon: 'seeker_rockets',
        maxHp: 15,
        baseSpeed: 0.94,
        acceleration: 0.065,
        dashDistance: 9,
        description: 'Armored autonomous hull. Homing payloads trade speed for target control.'
    },
    cutter: {
        id: 'cutter',
        name: 'PTR.CUTTER',
        weapon: 'null_laser',
        maxHp: 9,
        baseSpeed: 1.22,
        acceleration: 0.095,
        dashDistance: 14,
        description: 'Fragile precision hull. Piercing beam uses heat and rewards clean lines.'
    }
};

export const WEAPON_DEFS = {
    auto_blaster: {
        name: 'AUTO-BLASTER',
        baseDamage: 10,
        damagePerLevel: 3,
        baseCooldown: 16,
        projectileSpeed: 1.6,
        description: 'Rapid linear fire. Stable, direct and highly scalable.'
    },
    seeker_rockets: {
        name: 'SEEKER PODS',
        baseDamage: 16,
        damagePerLevel: 5,
        cooldownMultiplier: 3,
        projectileSpeed: 0.45,
        blastRadius: 6,
        blastMultiplier: 0.8,
        description: 'Self-guided payloads that detonate in a six-cell blast.'
    },
    null_laser: {
        name: 'NULL LASER',
        baseDamage: 11,
        damagePerLevel: 3.5,
        cooldownMultiplier: 1.2,
        range: 90,
        heatPerShot: 15,
        maxHeat: 100,
        description: 'Instant piercing ray. Sustained fire builds heat.'
    }
};

export const ENEMY_DEFS = {
    drone: { hp: 8, xp: 18, width: 3, height: 1, mass: 0.8, cost: 1 },
    brute: { hp: 48, xp: 60, width: 5, height: 5, mass: 3, cost: 5 },
    brute_medium: { hp: 24, xp: 26, width: 3, height: 3, mass: 1.5, cost: 2 },
    shooter: { hp: 18, xp: 28, width: 3, height: 3, mass: 1, cost: 3 },
    worm: { hp: 22, xp: 34, width: 3, height: 1, mass: 1.1, cost: 3 },
    virus: { hp: 20, xp: 38, width: 3, height: 3, mass: 1.2, cost: 4 },
    kamikaze: { hp: 6, xp: 22, width: 3, height: 1, mass: 0.6, cost: 2 },
    shield_projector: { hp: 28, xp: 46, width: 3, height: 3, mass: 2, cost: 5 },
    boss_snake: { hp: 800, xp: 1000, width: 11, height: 11, mass: 15, cost: 0 },
    boss_eye: { hp: 900, xp: 1000, width: 15, height: 15, mass: 12, cost: 0 },
    boss_carrier: { hp: 1000, xp: 1200, width: 18, height: 11, mass: 12, cost: 0 }
};

export const COMBAT_CONFIG = {
    autoTargetDelayTicks: 15,
    autoTargetRadius: 24,
    manualAssistConeRadians: Math.PI * (40 / 180),
    manualAssistStrength: 0.32,
    projectileHitboxScale: 1.4
};

export const PROGRESSION_CONFIG = {
    startingXp: 70,
    xpGrowth: 1.32,
    pickupMagnetRadius: 28,
    pickupRadiusPerUpgrade: 7
};

export const BOSS_SCHEDULE_TICKS = [150 * 60, 330 * 60, 540 * 60];

export const BOSS_TYPES = new Set(['boss_snake', 'boss_eye', 'boss_carrier']);
export const NORMAL_ENEMY_TYPES = new Set([
    'drone', 'brute', 'brute_medium', 'shooter', 'worm', 'virus', 'kamikaze', 'shield_projector'
]);

export const isWeaponUpgradeApplicable = (upgradeId, weaponType) => {
    if (upgradeId === 'upg_blaster_dmg') return weaponType === 'auto_blaster';
    if (upgradeId === 'upg_seeker_dmg') return weaponType === 'seeker_rockets';
    if (upgradeId === 'upg_laser_dmg' || upgradeId === 'pointer_arithmetic') return weaponType === 'null_laser';
    if (upgradeId === 'fork_bomb') return weaponType === 'auto_blaster';
    return true;
};
