import { HULL_DEFS, WEAPON_DEFS, isWeaponUpgradeApplicable } from './config.js';

export const UPGRADES = [
    { id: 'thread', icon: '⇶', title: 'MULTI-THREAD', maxLevel: 4, weight: 8, tag: 'WEAPON' },
    { id: 'speed', icon: '⋙', title: 'OVERCLOCK', maxLevel: 5, weight: 8, tag: 'MOBILITY' },
    { id: 'fire_rate', icon: '⇲', title: 'TURBO BOOST', maxLevel: 5, weight: 8, tag: 'WEAPON' },
    { id: 'heal', icon: '♥', title: 'REPAIR SECTOR', maxLevel: 999, weight: 5, tag: 'REPAIR' },
    { id: 'drone', icon: '+', title: 'HELPER DAEMON', maxLevel: 3, weight: 6, tag: 'AUTONOMOUS' },
    { id: 'electric', icon: '☇', title: 'TESLA OVERLOAD', maxLevel: 3, weight: 6, tag: 'AUTONOMOUS' },
    { id: 'shield', icon: 'O', title: 'SHIELD MATRIX', maxLevel: 3, weight: 6, tag: 'DEFENSE' },
    { id: 'freeze', icon: '*', title: 'SYSTEM FREEZE', maxLevel: 3, weight: 4, tag: 'CONTROL' },
    { id: 'bomb', icon: '※', title: 'STACK FLUSH', maxLevel: 3, weight: 5, tag: 'DEFENSE' },
    { id: 'dash_dmg', icon: '>', title: 'DASH CORRUPTION', maxLevel: 3, weight: 6, tag: 'MOBILITY' },
    { id: 'bios_cache', icon: 'C', title: 'L1 CACHE OVERCLOCK', maxLevel: 1, weight: 3, tag: 'UTILITY' },
    { id: 'bios_kernel', icon: 'K', title: 'KERNEL OVERCLOCK', maxLevel: 2, weight: 4, tag: 'CORE' },
    { id: 'bios_swap', icon: 'S', title: 'SWAP PARTITION', maxLevel: 1, weight: 2, tag: 'PANIC' },
    { id: 'upg_blaster_dmg', icon: '>', title: 'BLASTER AMPLIFIER', maxLevel: 4, weight: 9, tag: 'WEAPON' },
    { id: 'upg_seeker_dmg', icon: '*', title: 'SEEKER PROPULSION', maxLevel: 4, weight: 9, tag: 'WEAPON' },
    { id: 'upg_laser_dmg', icon: '|', title: 'LASER WIDENER', maxLevel: 4, weight: 9, tag: 'WEAPON' },
    { id: 'garbage_collector', icon: '@', title: 'GARBAGE COLLECTOR', maxLevel: 3, weight: 5, tag: 'UTILITY' },
    { id: 'stack_canary', icon: '!', title: 'STACK CANARY', maxLevel: 1, weight: 3, tag: 'DEFENSE' },
    { id: 'segfault', icon: '/', title: 'SEGFAULT TRAIL', maxLevel: 3, weight: 5, tag: 'MOBILITY' },
    { id: 'pointer_arithmetic', icon: '\\', title: 'POINTER ARITHMETIC', maxLevel: 1, weight: 3, tag: 'WEAPON' },
    { id: 'undefined_behavior', icon: '?', title: 'UNDEFINED BEHAVIOR', maxLevel: 2, weight: 2, tag: 'CHAOS' },
    { id: 'fork_bomb', icon: 'Y', title: 'FORK BOMB', maxLevel: 2, weight: 4, tag: 'WEAPON' },
    { id: 'memory_leak', icon: '$', title: 'MEMORY LEAK', maxLevel: 2, weight: 3, tag: 'CHAOS' }
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
            case 'bios_cache': return playerInstance.upgrades.cacheOverclock || 0;
            case 'bios_kernel': return playerInstance.upgrades.kernelOverclock || 0;
            case 'bios_swap': return playerInstance.upgrades.swapPartition || 0;
            case 'upg_blaster_dmg': return playerInstance.upgrades.blasterDmg || 0;
            case 'upg_seeker_dmg': return playerInstance.upgrades.seekerDmg || 0;
            case 'upg_laser_dmg': return playerInstance.upgrades.laserDmg || 0;
            case 'garbage_collector': return playerInstance.upgrades.garbageCollector || 0;
            case 'stack_canary': return playerInstance.upgrades.stackCanary || 0;
            case 'segfault': return playerInstance.upgrades.segfault || 0;
            case 'pointer_arithmetic': return playerInstance.upgrades.pointerArithmetic || 0;
            case 'undefined_behavior': return playerInstance.upgrades.undefinedBehavior || 0;
            case 'fork_bomb': return playerInstance.upgrades.forkBomb || 0;
            case 'memory_leak': return playerInstance.upgrades.memoryLeak || 0;
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
                description = `Increase movement speed by 15% of hull base (Total: +${nextLvl * 15}%)`;
                break;
            case 'fire_rate':
                description = `Weapon delay ${Math.max(5, 16 - (nextLvl - 1) * 3)} -> ${Math.max(5, 16 - nextLvl * 3)} ticks`;
                break;
            case 'heal':
                description = `Restore 40% hull integrity (+${Math.max(1, Math.ceil(playerInstance.maxHp * 0.4))} HP)`;
                break;
            case 'drone':
                description = `Spawn ${nextLvl} helper drone(s) firing auto homing rockets`;
                break;
            case 'electric':
                description = `Zap the ${2 + nextLvl} nearest threats for ${(nextLvl * 1.5).toFixed(1)} damage`;
                break;
            case 'shield':
                if (nextLvl === 1) {
                    description = 'Deploy active shield matrix blocking 1 hit';
                } else {
                    description = `Deploy active shield (recharges ${(nextLvl - 1) * 20}% faster)`;
                }
                break;
            case 'freeze':
                description = `Freeze standard threats for 3 seconds every ${14 - nextLvl * 2}s`;
                break;
            case 'bomb':
                if (nextLvl === 1) {
                    description = 'Trigger shockwave clearing bullets & dealing 5 damage';
                } else {
                    description = `Shockwave radius grows to ${20 + (nextLvl - 1) * 4} cells`;
                }
                break;
            case 'dash_dmg':
                description = `Each dash damages a threat once for ${nextLvl * 6} corruption`;
                break;
            case 'upg_blaster_dmg':
                description = `Damage ${WEAPON_DEFS.auto_blaster.baseDamage + (nextLvl - 1) * WEAPON_DEFS.auto_blaster.damagePerLevel} -> ${WEAPON_DEFS.auto_blaster.baseDamage + nextLvl * WEAPON_DEFS.auto_blaster.damagePerLevel}${nextLvl === 4 ? ' // EVOLVE: piercing rounds' : ''}`;
                break;
            case 'upg_seeker_dmg':
                description = `Damage ${WEAPON_DEFS.seeker_rockets.baseDamage + (nextLvl - 1) * WEAPON_DEFS.seeker_rockets.damagePerLevel} -> ${WEAPON_DEFS.seeker_rockets.baseDamage + nextLvl * WEAPON_DEFS.seeker_rockets.damagePerLevel}${nextLvl === 4 ? ' // EVOLVE: nova payload' : ''}`;
                break;
            case 'upg_laser_dmg':
                description = `Damage ${WEAPON_DEFS.null_laser.baseDamage + (nextLvl - 1) * WEAPON_DEFS.null_laser.damagePerLevel} -> ${WEAPON_DEFS.null_laser.baseDamage + nextLvl * WEAPON_DEFS.null_laser.damagePerLevel}${nextLvl === 4 ? ' // EVOLVE: cold overdrive' : ''}`;
                break;
            case 'bios_cache':
                description = `Grow level up upgrade selection cards to 4 choices`;
                break;
            case 'bios_kernel':
                description = `Increase base player speed & acceleration by +10% (Total: +${nextLvl * 10}%)`;
                break;
            case 'bios_swap':
                description = `Fully repair ship integrity & wipe out all standard enemies`;
                break;
            case 'garbage_collector':
                description = `Memory pickup radius 28 -> ${28 + nextLvl * 7} cells`;
                break;
            case 'stack_canary':
                description = 'Breaking Shield Matrix flushes nearby hostile projectiles';
                break;
            case 'segfault':
                description = `Dash leaves a ${nextLvl * 2}-damage corruption trail`;
                break;
            case 'pointer_arithmetic':
                description = 'Null Laser reflects once when it hits a memory barrier';
                break;
            case 'undefined_behavior':
                description = 'Install a powerful random stat mutation. Exact result is intentionally unstable';
                break;
            case 'fork_bomb':
                description = `Killing shots fork into ${nextLvl + 1} smaller projectiles`;
                break;
            case 'memory_leak':
                description = `Uncollected memory grows up to +${nextLvl * 50}% value but attracts threats`;
                break;
        }

        let currentValue = `L${nextLvl - 1}`;
        let nextValue = `L${nextLvl}`;
        let evolutionText = '';
        if (uId === 'upg_blaster_dmg') {
            currentValue = `${WEAPON_DEFS.auto_blaster.baseDamage + (nextLvl - 1) * WEAPON_DEFS.auto_blaster.damagePerLevel} DMG`;
            nextValue = `${WEAPON_DEFS.auto_blaster.baseDamage + nextLvl * WEAPON_DEFS.auto_blaster.damagePerLevel} DMG`;
            if (nextLvl === 4) evolutionText = 'EVOLUTION: PIERCING ROUNDS';
        } else if (uId === 'upg_seeker_dmg') {
            currentValue = `${WEAPON_DEFS.seeker_rockets.baseDamage + (nextLvl - 1) * WEAPON_DEFS.seeker_rockets.damagePerLevel} DMG`;
            nextValue = `${WEAPON_DEFS.seeker_rockets.baseDamage + nextLvl * WEAPON_DEFS.seeker_rockets.damagePerLevel} DMG`;
            if (nextLvl === 4) evolutionText = 'EVOLUTION: NOVA PAYLOAD';
        } else if (uId === 'upg_laser_dmg') {
            currentValue = `${WEAPON_DEFS.null_laser.baseDamage + (nextLvl - 1) * WEAPON_DEFS.null_laser.damagePerLevel} DMG`;
            nextValue = `${WEAPON_DEFS.null_laser.baseDamage + nextLvl * WEAPON_DEFS.null_laser.damagePerLevel} DMG`;
            if (nextLvl === 4) evolutionText = 'EVOLUTION: COLD OVERDRIVE';
        }
        const shortDescription = description.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
        return { id: uId, icon, title, description, shortDescription, currentValue, nextValue, evolutionText, tag: baseUpgrade?.tag || 'MODULE', level: nextLvl };
    },
    getRandomSelection: (playerInstance, count) => {
        // Filter out fully upgraded ones
        const available = UPGRADES.filter(u => {
            const currentLevel = upgrades.getPlayerUpgradeLevel(playerInstance, u.id);
            // Only offer repair sector if the player's health is below maximum health
            if (u.id === 'heal') {
                return playerInstance.hp < playerInstance.maxHp;
            }
            if (u.id === 'stack_canary' && playerInstance.shieldLevel <= 0) return false;
            return currentLevel < u.maxLevel && isWeaponUpgradeApplicable(u.id, playerInstance.weaponType);
        });

        // Fallback pool if all modules are maxed out
        const pool = available.length > 0 ? available : UPGRADES.filter(u => u.id === 'heal' || u.id === 'speed' || u.id === 'fire_rate');

        const weighted = [];
        for (const upgrade of pool) {
            const weight = upgrade.weight || 1;
            weighted.push({ upgrade, key: Math.pow(Math.random(), 1 / weight) });
        }
        weighted.sort((a, b) => b.key - a.key);
        return weighted.slice(0, count).map(({ upgrade: u }) => {
            return upgrades.getUpgradeDetails(playerInstance, u.id);
        });
    }
};
