export const UPGRADES = [
    { id: 'thread', icon: '⇶', title: 'MULTI-THREAD', description: 'Fire an additional projectile stream.', tier: 'rare' },
    { id: 'speed', icon: '⋙', title: 'OVERCLOCK', description: 'Increase movement speed.', tier: 'common' },
    { id: 'fire_rate', icon: '⇲', title: 'TURBO BOOST', description: 'Increase weapon firing rate significantly.', tier: 'common' },
    { id: 'heal', icon: '♥', title: 'REPAIR SECTOR', description: 'Restore 2 Integrity points.', tier: 'common' },
    { id: 'drone', icon: '+', title: 'HELPER DRONE', description: 'Spawn a helper drone that auto-fires homing missiles.', tier: 'epic' },
    { id: 'electric', icon: '☇', title: 'TESLA OVERLOAD', description: 'Shock nearby enemies with passive lightning discharges.', tier: 'rare' },
    { id: 'shield', icon: '🛡', title: 'SHIELD MATRIX', description: 'Deploy a shield that blocks one hit (recharges).', tier: 'epic' },
    { id: 'freeze', icon: '❅', title: 'SYSTEM FREEZE', description: 'Periodically freeze all enemies for 3 seconds.', tier: 'epic' },
    { id: 'bomb', icon: '※', title: 'STACK FLUSH', description: 'Trigger a shockwave clearing bullets and damaging enemies.', tier: 'epic' }
];

export const upgrades = {
    getRandomSelection: (count) => {
        const shuffled = [...UPGRADES].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
};
