const t = require('@babel/types');
const { solveLinearSystemModPowerOfTwo } = require('../utils/linear');
const { randomInt, shuffleInPlace } = require('../utils/random');
const { 
    wrap, 
    num32, 
    toUint32, 
    binaryOp, 
    unaryOp, 
    imul32 
} = require('../utils/ast');

const TARGETS_32 = {
    '+': (x, y) => (x + y) >>> 0,
    '-': (x, y) => (x - y) >>> 0
};

const REQUIRED_BASIS = new Set(['x', 'y', 'carry']);

const BASIS_POOL_32 = [
    {
        name: 'x',
        evaluate: (x) => x >>> 0,
        build: ctx => toUint32(ctx.left)
    },
    {
        name: 'y',
        evaluate: (_, y) => y >>> 0,
        build: ctx => toUint32(ctx.right)
    },
    {
        name: 'xor',
        evaluate: (x, y) => (x ^ y) >>> 0,
        build: ctx => toUint32(binaryOp('^', ctx.left, ctx.right))
    },
    {
        name: 'and',
        evaluate: (x, y) => (x & y) >>> 0,
        build: ctx => toUint32(binaryOp('&', ctx.left, ctx.right))
    },
    {
        name: 'or',
        evaluate: (x, y) => (x | y) >>> 0,
        build: ctx => toUint32(binaryOp('|', ctx.left, ctx.right))
    },
    {
        name: 'carry',
        evaluate: (x, y) => ((x & y) << 1) >>> 0,
        build: ctx => toUint32(binaryOp('<<', binaryOp('&', ctx.left, ctx.right), num32(1)))
    },
    {
        name: 'propagate',
        evaluate: (x, y) => ((x ^ y) << 1) >>> 0,
        build: ctx => toUint32(binaryOp('<<', binaryOp('^', ctx.left, ctx.right), num32(1)))
    },
    {
        name: 'andNotX',
        evaluate: (x, y) => ((~x) & y) >>> 0,
        build: ctx => toUint32(binaryOp('&', unaryOp('~', ctx.left), ctx.right))
    },
    {
        name: 'andNotY',
        evaluate: (x, y) => (x & (~y)) >>> 0,
        build: ctx => toUint32(binaryOp('&', ctx.left, unaryOp('~', ctx.right)))
    },
    {
        name: 'ones',
        evaluate: () => 0xffffffff,
        build: () => num32(0xffffffff)
    },
    {
        name: 'xShift',
        evaluate: (x) => (x << 1) >>> 0,
        build: ctx => toUint32(binaryOp('<<', ctx.left, num32(1)))
    },
    {
        name: 'yShift',
        evaluate: (_, y) => (y << 1) >>> 0,
        build: ctx => toUint32(binaryOp('<<', ctx.right, num32(1)))
    },
    // Additional Boolean basis functions
    {
        // NAND: ~(x & y) = ~x | ~y
        name: 'nand',
        evaluate: (x, y) => (~(x & y)) >>> 0,
        build: ctx => toUint32(unaryOp('~', binaryOp('&', ctx.left, ctx.right)))
    },
    {
        // NOR: ~(x | y) = ~x & ~y
        name: 'nor',
        evaluate: (x, y) => (~(x | y)) >>> 0,
        build: ctx => toUint32(unaryOp('~', binaryOp('|', ctx.left, ctx.right)))
    },
    {
        // ~(x<<1) | ~(y<<1) - negated double-shift OR basis
        name: 'notShiftOr',
        evaluate: (x, y) => ((~(x << 1)) | (~(y << 1))) >>> 0,
        build: ctx => toUint32(binaryOp('|',
            unaryOp('~', binaryOp('<<', ctx.left, num32(1))),
            unaryOp('~', binaryOp('<<', ctx.right, num32(1)))
        ))
    },
    {
        // x | ~y (implication-like)
        name: 'orNotY',
        evaluate: (x, y) => (x | (~y)) >>> 0,
        build: ctx => toUint32(binaryOp('|', ctx.left, unaryOp('~', ctx.right)))
    },
    {
        // ~x | y (reverse implication-like)
        name: 'orNotX',
        evaluate: (x, y) => ((~x) | y) >>> 0,
        build: ctx => toUint32(binaryOp('|', unaryOp('~', ctx.left), ctx.right))
    }
];

const BASIS_BY_NAME = Object.fromEntries(BASIS_POOL_32.map(item => [item.name, item]));

function pickBasisSet(size) {
    const required = Array.from(REQUIRED_BASIS).map(name => BASIS_BY_NAME[name]);
    if (size <= required.length) {
        return required.slice(0, size);
    }
    
    const optional = BASIS_POOL_32.filter(item => !REQUIRED_BASIS.has(item.name));
    const shuffled = optional.slice();
    shuffleInPlace(shuffled);
    
    const result = required.slice();
    for (const item of shuffled) {
        if (result.length >= size) break;
        result.push(item);
    }
    return result;
}

function evaluateBasisRow(basisSet, x, y) {
    return basisSet.map(fn => BigInt(fn.evaluate(x, y) >>> 0));
}

function buildLinearCombinationAst(basisSet, coefficients, ctx) {
    const terms = [];
    
    for (let i = 0; i < basisSet.length; i++) {
        const coeff = coefficients[i] >>> 0;
        if (coeff === 0) {
            continue;
        }
        const expr = basisSet[i].build(ctx);
        const term = imul32(coeff, expr);
        terms.push(term);
    }
    
    if (terms.length === 0) {
        return num32(0);
    }
    
    let combined = terms[0];
    for (let i = 1; i < terms.length; i++) {
        combined = t.binaryExpression('+', wrap(combined), wrap(terms[i]));
    }
    
    return toUint32(combined);
}

function buildLinearMBA32(left, right, operator, options = {}) {
    const targetFn = TARGETS_32[operator];
    if (!targetFn) {
        return null;
    }
    
    const basisSize = Math.max(4, Math.min(options.basisSize || 6, BASIS_POOL_32.length));
    const maxAttempts = options.maxAttempts || 8;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const basisSet = pickBasisSet(basisSize);
        const matrix = [];
        const rhs = [];
        const matrixMod2 = [];
        const usedKeys = new Set();
        
        for (let row = 0; row < basisSet.length; row++) {
            const x = randomInt(0, 0xffffffff) >>> 0;
            const y = randomInt(0, 0xffffffff) >>> 0;
            const key = (BigInt(x) << 32n) | BigInt(y);
            if (usedKeys.has(key)) {
                row--;
                continue;
            }
            usedKeys.add(key);
            const basisValues = evaluateBasisRow(basisSet, x, y);
            const targetValue = BigInt(targetFn(x, y));
            matrix.push(basisValues);
            matrixMod2.push(basisValues.map(val => Number(val & 1n)));
            rhs.push(targetValue);
        }
        
        const solution = solveLinearSystemModPowerOfTwo(matrix, rhs, 32, matrixMod2);
        if (!solution) {
            continue;
        }
        
        const numericCoefficients = solution.map(val => Number(val & 0xffffffffn));
        const ctx = { left, right };
        const expression = buildLinearCombinationAst(basisSet, numericCoefficients, ctx);
        return expression;
    }
    
    return null;
}

module.exports = {
    buildLinearMBA32
};
