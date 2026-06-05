export const UPGRADES = [
    { id: 'thread', icon: '⇶', title: 'MULTI-THREAD', description: 'Fire an additional projectile stream.', maxLevel: 4 },
    { id: 'speed', icon: '⋙', title: 'OVERCLOCK', description: 'Increase movement speed.', maxLevel: 5 },
    { id: 'fire_rate', icon: '⇲', title: 'TURBO BOOST', description: 'Increase weapon firing rate significantly.', maxLevel: 5 },
    { id: 'heal', icon: '♥', title: 'REPAIR SECTOR', description: 'Restore 2 Integrity points.', maxLevel: 999 },
    { id: 'drone', icon: '+', title: 'HELPER DRONE', description: 'Spawn a helper drone that auto-fires homing missiles.', maxLevel: 3 },
    { id: 'electric', icon: '☇', title: 'TESLA OVERLOAD', description: 'Shock nearby enemies with passive lightning discharges.', maxLevel: 3 },
    { id: 'shield', icon: '🛡', title: 'SHIELD MATRIX', description: 'Deploy a shield that blocks one hit (recharges).', maxLevel: 3 },
    { id: 'freeze', icon: '❅', title: 'SYSTEM FREEZE', description: 'Periodically freeze all enemies for 3 seconds.', maxLevel: 3 },
    { id: 'bomb', icon: '※', title: 'STACK FLUSH', description: 'Trigger a shockwave clearing bullets and damaging enemies.', maxLevel: 3 },
    { id: 'dash_dmg', icon: '⚡', title: 'DASH CORRUPTION', description: 'Dashing through enemies deals heavy corruption damage.', maxLevel: 3 }
];

export const upgrades = {
    getPlayerUpgradeLevel: (playerInstance, upgradeId) => {
        switch (upgradeId) {
            case 'thread': return playerInstance.upgrades.extraThreads;
            case 'speed': return playerInstance.upgrades.speedBoost;
            case 'fire_rate': return playerInstance.upgrades.fireRateBoost;
            case 'drone': return playerInstance.hasHelperDrones;
            case 'electric': return playerInstance.hasElectricDischarge;
            case 'shield': return playerInstance.shieldLevel;
            case 'freeze': return playerInstance.freezeLevel;
            case 'bomb': return playerInstance.bombLevel;
            case 'dash_dmg': return playerInstance.dashDmgLevel || 0;
            case 'heal': return 0;
            default: return 0;
        }
    },
    getRandomSelection: (playerInstance, count) => {
        // Filter out fully upgraded ones
        const available = UPGRADES.filter(u => {
            const currentLevel = upgrades.getPlayerUpgradeLevel(playerInstance, u.id);
            // Only offer repair sector if the player's health is below maximum health
            if (u.id === 'heal') {
                return playerInstance.hp < playerInstance.maxHp;
            }
            return currentLevel < u.maxLevel;
        });

        // Fallback pool if all modules are maxed out
        const pool = available.length > 0 ? available : UPGRADES.filter(u => u.id === 'heal' || u.id === 'speed' || u.id === 'fire_rate');

        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(u => {
            const nextLvl = upgrades.getPlayerUpgradeLevel(playerInstance, u.id) + 1;
            const lvlSuffix = u.maxLevel < 999 ? ` [LVL ${nextLvl}/${u.maxLevel}]` : '';
            return {
                id: u.id,
                icon: u.icon,
                title: `${u.title}${lvlSuffix}`,
                description: u.description
            };
        });
    }
};
