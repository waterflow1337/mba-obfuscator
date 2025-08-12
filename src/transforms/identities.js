
const t = require('@babel/types');
const { wrap, num32, bigIntFromValue, asUint64Expr, imul32, binaryOp, variableDeclaration } = require('../utils/ast');
const { randomInt, randomOdd32, random64, randomOdd64 } = require('../utils/random');

function modInverse32(a) {
    const M = 2n ** 32n;
    let t0 = 0n, t1 = 1n;
    let r0 = M, r1 = BigInt(a >>> 0);
    
    while (r1 !== 0n) {
        const quotient = r0 / r1;
        [r0, r1] = [r1, r0 - quotient * r1];
        [t0, t1] = [t1, t0 - quotient * t1];
    }
    
    if (r0 !== 1n) {
        throw new Error('Modular inverse does not exist');
    }
    
    if (t0 < 0n) t0 += M;
    return Number(t0);
}

function modInverse64(a) {
    const MODULUS = 1n << 64n;
    if ((a & 1n) === 0n) {
        throw new Error('modInverse64 requires odd input');
    }
    
    let t0 = 0n, t1 = 1n;
    let r0 = MODULUS, r1 = a & (MODULUS - 1n);
    
    while (r1 !== 0n) {
        const quotient = r0 / r1;
        [r0, r1] = [r1, r0 - quotient * r1];
        [t0, t1] = [t1, t0 - quotient * t1];
    }
    
    if (r0 !== 1n) {
        throw new Error('Modular inverse does not exist');
    }
    
    if (t0 < 0n) t0 += MODULUS;
    return t0 & (MODULUS - 1n);
}

function wrapWithAffine32(expression) {
    const a = randomOdd32();  // Must be odd for modular inverse to exist
    const b = randomInt(0, 0xffffffff) >>> 0;
    const aInverse = modInverse32(a) >>> 0;
    
    const c = (Math.imul(-aInverse | 0, b >>> 0) >>> 0) >>> 0;
    
    const inner = t.binaryExpression('>>>', 
        binaryOp('+', imul32(a, wrap(expression)), num32(b)), 
        num32(0)
    );
    
    return t.binaryExpression('>>>',
        binaryOp('+', imul32(aInverse, inner), num32(c)),
        num32(0)
    );
}

function wrapWithAffine64(expression) {
    const a = randomOdd64();  // Must be odd for modular inverse
    const b = random64();
    const aInverse = modInverse64(a);
    
    const MODULUS_MASK = (1n << 64n) - 1n;
    const c = ((-aInverse) * b) & MODULUS_MASK;
    
    const inner = asUint64Expr(binaryOp('+',
        binaryOp('*', bigIntFromValue(a), asUint64Expr(wrap(expression))),
        bigIntFromValue(b)
    ));
    
    return asUint64Expr(binaryOp('+',
        binaryOp('*', bigIntFromValue(aInverse), inner),
        bigIntFromValue(c)
    ));
}

function feistelIdentity64(expression) {
    const K1 = random64();
    const K2 = random64(); 
    const M1 = randomOdd64();
    const M2 = randomOdd64();
    const C1 = random64();
    const C2 = random64();
    
    const mask32 = bigIntFromValue(0xffffffffn);
    
    const feistelFunc = (x, K, M, C) => asUint64Expr(
        binaryOp('+',
            binaryOp('*', bigIntFromValue(M), 
                asUint64Expr(binaryOp('^', wrap(x), bigIntFromValue(K)))),
            bigIntFromValue(C)
        )
    );
    
    const wId = t.identifier('_w');
    const L0 = t.identifier('_L0'), R0 = t.identifier('_R0');
    const L1 = t.identifier('_L1'), R1 = t.identifier('_R1');
    const L2 = t.identifier('_L2'), R2 = t.identifier('_R2');
    const R1p = t.identifier('_R1p'), L1p = t.identifier('_L1p');
    const R0p = t.identifier('_R0p'), L0p = t.identifier('_L0p');
    
    return t.callExpression(
        t.arrowFunctionExpression([], t.blockStatement([
            variableDeclaration('const', '_w', asUint64Expr(wrap(expression))),
            
            variableDeclaration('let', '_L0', asUint64Expr(binaryOp('&', wId, mask32))),
            variableDeclaration('let', '_R0', asUint64Expr(binaryOp('>>', wId, t.bigIntLiteral('32')))),
            
            variableDeclaration('let', '_L1', R0),
            variableDeclaration('let', '_R1', asUint64Expr(binaryOp('^', L0, feistelFunc(R0, K1, M1, C1)))),
            variableDeclaration('let', '_L2', R1), 
            variableDeclaration('let', '_R2', asUint64Expr(binaryOp('^', L1, feistelFunc(R1, K2, M2, C2)))),
            
            variableDeclaration('let', '_R1p', L2),
            variableDeclaration('let', '_L1p', asUint64Expr(binaryOp('^', R2, feistelFunc(R1p, K2, M2, C2)))),
            variableDeclaration('let', '_R0p', L1p),
            variableDeclaration('let', '_L0p', asUint64Expr(binaryOp('^', R1p, feistelFunc(R0p, K1, M1, C1)))),
            
            t.returnStatement(
                asUint64Expr(binaryOp('|',
                    asUint64Expr(binaryOp('<<', R0p, t.bigIntLiteral('32'))),
                    asUint64Expr(binaryOp('&', L0p, mask32))
                ))
            )
        ])),
        []
    );
}

function lcgIdentity(expression, use64bit = false) {
    if (use64bit) {
        const a = randomOdd64();
        const c = random64();
        const aInv = modInverse64(a);
        const MASK = (1n << 64n) - 1n;
        const cInv = ((-aInv) * c) & MASK;
        
        const forward = asUint64Expr(binaryOp('+',
            binaryOp('*', bigIntFromValue(a), asUint64Expr(wrap(expression))),
            bigIntFromValue(c)
        ));
        
        return asUint64Expr(binaryOp('+',
            binaryOp('*', bigIntFromValue(aInv), forward),
            bigIntFromValue(cInv)
        ));
    } else {
        const a = randomOdd32();
        const c = randomInt(0, 0xffffffff) >>> 0;
        const aInv = modInverse32(a) >>> 0;
        const cInv = (Math.imul(-aInv | 0, c >>> 0) >>> 0) >>> 0;
        
        const forward = t.binaryExpression('>>>',
            binaryOp('+', imul32(a, wrap(expression)), num32(c)),
            num32(0)
        );
        
        return t.binaryExpression('>>>',
            binaryOp('+', imul32(aInv, forward), num32(cInv)),
            num32(0)
        );
    }
}

module.exports = {
    wrapWithAffine32,
    wrapWithAffine64, 
    feistelIdentity64,
    lcgIdentity
};