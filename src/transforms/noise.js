const t = require('@babel/types');
const { 
    wrap, 
    num32, 
    bigIntFromValue, 
    toBigInt64, 
    toUint32, 
    asUint64Expr, 
    binaryOp 
} = require('../utils/ast');
const { randomInt, randomFloat, random64 } = require('../utils/random');

function pickOperand(operands, fallback) {
    const pool = [];
    if (operands.left) pool.push(operands.left);
    if (operands.right) pool.push(operands.right);
    if (pool.length === 0) {
        return fallback();
    }
    const choice = pool[randomInt(0, pool.length - 1)];
    return t.cloneNode(choice, true);
}

function buildNoiseTerm32(operands) {
    const mask = num32(randomInt(1, 0xffffffff));
    const base = pickOperand(operands, () => num32(randomInt(0, 0xffffffff)));
    
    const builders = [
        () => toUint32(binaryOp('&', base, mask)),
        () => toUint32(binaryOp('^', base, mask)),
        () => toUint32(binaryOp('-', base, mask))
    ];
    
    const selected = builders[randomInt(0, builders.length - 1)];
    return selected();
}

function buildNoiseTerm64(operands) {
    const mask = bigIntFromValue(random64());
    const base = pickOperand(operands, () => bigIntFromValue(random64()));
    const bigBase = toBigInt64(base);
    
    const builders = [
        () => asUint64Expr(binaryOp('&', bigBase, mask)),
        () => asUint64Expr(binaryOp('^', bigBase, mask)),
        () => asUint64Expr(binaryOp('+', bigBase, mask))
    ];
    
    const selected = builders[randomInt(0, builders.length - 1)];
    return selected();
}

function withNoise32(expression, operands) {
    const noise = buildNoiseTerm32(operands);
    const noiseClone = t.cloneNode(noise, true);
    
    const wrappers = [
        () => toUint32(binaryOp('-', binaryOp('+', wrap(expression), noise), noiseClone)),
        () => toUint32(binaryOp('^', binaryOp('^', wrap(expression), noise), noiseClone))
    ];
    
    return wrappers[randomInt(0, wrappers.length - 1)]();
}

function withNoise64(expression, operands) {
    const noise = buildNoiseTerm64(operands);
    const noiseClone = t.cloneNode(noise, true);
    
    const wrappers = [
        () => asUint64Expr(binaryOp('-', binaryOp('+', wrap(expression), noise), noiseClone)),
        () => asUint64Expr(binaryOp('^', binaryOp('^', wrap(expression), noise), noiseClone))
    ];
    
    return wrappers[randomInt(0, wrappers.length - 1)]();
}

function maybeAddNoise(expression, operands, ratio, use64bit) {
    if (!ratio || ratio <= 0) {
        return expression;
    }
    if (randomFloat() > ratio) {
        return expression;
    }
    
    return use64bit ? withNoise64(expression, operands) : withNoise32(expression, operands);
}

module.exports = {
    withNoise32,
    withNoise64,
    maybeAddNoise
};
