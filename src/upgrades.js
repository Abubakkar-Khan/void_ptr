export const UPGRADES = [
    { id: 'thread', icon: '⇶', title: 'MULTI-THREAD', description: 'Fire an additional 100% projectile stream.', maxLevel: 4 },
    { id: 'speed', icon: '⋙', title: 'OVERCLOCK', description: 'Increase movement speed by 15%.', maxLevel: 5 },
    { id: 'fire_rate', icon: '⇲', title: 'TURBO BOOST', description: 'Increase weapon firing rate by 20%.', maxLevel: 5 },
    { id: 'heal', icon: '♥', title: 'REPAIR SECTOR', description: 'Restore 40% Integrity points.', maxLevel: 999 },
    { id: 'drone', icon: '+', title: 'HELPER DRONE', description: 'Spawn a helper drone auto-firing homing rockets.', maxLevel: 3 },
    { id: 'electric', icon: '☇', title: 'TESLA OVERLOAD', description: 'Zap up to 3 nearby enemies. (+50% power per level).', maxLevel: 3 },
    { id: 'shield', icon: '🛡', title: 'SHIELD MATRIX', description: 'Deploy a shield blocking one hit. (-20% recharge delay per level).', maxLevel: 3 },
    { id: 'freeze', icon: '❅', title: 'SYSTEM FREEZE', description: 'Freeze all enemies for 3 seconds. (-16% cooldown per level).', maxLevel: 3 },
    { id: 'bomb', icon: '※', title: 'STACK FLUSH', description: 'Blast shockwave clearing bullets and dealing 5 damage.', maxLevel: 3 },
    { id: 'dash_dmg', icon: '⚡', title: 'DASH CORRUPTION', description: 'Dashing through enemies deals 6 damage. (+50% power per level).', maxLevel: 3 }
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
    getUpgradeDetails: (playerInstance, uId) => {
        const nextLvl = upgrades.getPlayerUpgradeLevel(playerInstance, uId) + 1;
        let title = '';
        let description = '';
        let icon = '';

        const baseUpgrade = UPGRADES.find(u => u.id === uId);
        if (baseUpgrade) {
            title = baseUpgrade.title;
            icon = baseUpgrade.icon;
        }

        switch (uId) {
            case 'thread':
                description = `Add +1 extra bullet stream (Total: ${nextLvl + 1} streams)`;
                break;
            case 'speed':
                description = `Increase movement speed by +15% (Total: +${nextLvl * 15}% speed)`;
                break;
            case 'fire_rate':
                description = `Increase weapon firing rate by +20% (Total: +${nextLvl * 20}% rate)`;
                break;
            case 'heal':
                description = 'Restore 40% Integrity points (+2 HP)';
                break;
            case 'drone':
                description = `Spawn ${nextLvl} helper drone(s) firing auto homing rockets`;
                break;
            case 'electric':
                description = `Zap up to 3 nearby enemies dealing ${nextLvl * 1.5} electric damage`;
                break;
            case 'shield':
                if (nextLvl === 1) {
                    description = 'Deploy active shield matrix blocking 1 hit';
                } else {
                    description = `Deploy active shield (recharges ${(nextLvl - 1) * 20}% faster)`;
                }
                break;
            case 'freeze':
                description = `Periodically freeze all enemies for 3 seconds every ${12 - nextLvl * 2}s`;
                break;
            case 'bomb':
                if (nextLvl === 1) {
                    description = 'Trigger shockwave clearing bullets & dealing 5 damage';
                } else {
                    description = `Trigger shockwave with +${(nextLvl - 1) * 20}% wider range`;
                }
                break;
            case 'dash_dmg':
                description = `Dashing through enemies deals ${nextLvl * 6} corruption damage`;
                break;
        }

        return { id: uId, icon, title, description };
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
            return upgrades.getUpgradeDetails(playerInstance, u.id);
        });
    }
};
