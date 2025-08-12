function mulberry32(seed) {
    return function() {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str) {
    let hash = 2166136261 >>> 0;
    for (const char of str) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    }
    return hash >>> 0;
}

let rng = null;

function initializeRandom(seed) {
    const numericSeed = typeof seed === 'string' ? hashString(seed) : seed;
    rng = mulberry32(numericSeed);
}

function randomInt(min, max) {
    if (!rng) {
        throw new Error('Random generator not initialized. Call initializeRandom() first.');
    }
    return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat() {
    if (!rng) {
        throw new Error('Random generator not initialized. Call initializeRandom() first.');
    }
    return rng();
}

function shuffleInPlace(array) {
    if (!rng) {
        throw new Error('Random generator not initialized. Call initializeRandom() first.');
    }
    
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function randomOdd32() {
    let value;
    do {
        value = (randomInt(1, 0xffffffff) | 1) >>> 0;
    } while ((value & 1) === 0);
    return value >>> 0;
}

function random64() {
    const high = BigInt(randomInt(0, 0xffffffff));
    const low = BigInt(randomInt(0, 0xffffffff));
    return ((high << 32n) | low) & ((1n << 64n) - 1n);
}

function randomOdd64() {
    let value;
    do {
        value = (random64() | 1n) & ((1n << 64n) - 1n);
    } while ((value & 1n) === 0n);
    return value;
}

module.exports = {
    initializeRandom,
    randomInt,
    randomFloat,
    shuffleInPlace,
    randomOdd32,
    random64,
    randomOdd64,
    hashString
};