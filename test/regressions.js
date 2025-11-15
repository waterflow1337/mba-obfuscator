const assert = require('assert');
const vm = require('vm');
const { transform } = require('../src/index');

function runInVm(code) {
    const context = {
        module: { exports: {} },
        exports: {},
        require,
        console,
        Math,
        BigInt,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval
    };
    vm.createContext(context);
    new vm.Script(code).runInContext(context);
    return context;
}

function obfuscate(code, config = {}) {
    const result = transform(code, config);
    return result.code;
}

function testStringConcatenationSafety() {
    const snippet = `
function greet(name) {
    return 'hello ' + name;
}
`;
    const transformed = obfuscate(snippet, { degree: 3, noiseRatio: 0.9, seed: 'strings' });
    const originalCtx = runInVm(snippet);
    const obfuscatedCtx = runInVm(transformed);
    
    assert.strictEqual(originalCtx.greet('Alice'), obfuscatedCtx.greet('Alice'));
    assert.strictEqual(originalCtx.greet('Bob'), obfuscatedCtx.greet('Bob'));
}

function testSideEffectsEvaluatedOnce() {
    const snippet = `
var fooCalls = 0;
var barCalls = 0;
function foo() { fooCalls++; return 21; }
function bar() { barCalls++; return 21; }
function compute() {
    return foo() + bar();
}
`;
    const transformed = obfuscate(snippet, { degree: 1, noiseRatio: 0.6, seed: 'side-effects' });
    
    const context = runInVm(transformed);
    context.compute();
    assert.strictEqual(context.fooCalls, 1, 'foo() should be evaluated once');
    assert.strictEqual(context.barCalls, 1, 'bar() should be evaluated once');
}

function testNumericEquivalence() {
    const snippet = `
function mix(a, b, c) {
    const t1 = (a + b) ^ (b - c);
    const t2 = (a & c) | (b ^ c);
    return (t1 + t2) >>> 0;
}
`;
    const transformed = obfuscate(snippet, {
        degree: 6,
        maxNestingDepth: 3,
        noiseRatio: 0.9,
        comparisonRatio: 1.0,
        seed: 'equivalence'
    });
    
    const originalCtx = runInVm(snippet);
    const obfuscatedCtx = runInVm(transformed);
    
    for (let i = 0; i < 20; i++) {
        const a = (Math.random() * 0xffffffff) | 0;
        const b = (Math.random() * 0xffffffff) | 0;
        const c = (Math.random() * 0xffffffff) | 0;
        
        assert.strictEqual(
            originalCtx.mix(a, b, c),
            obfuscatedCtx.mix(a, b, c),
            'mix() should produce identical results'
        );
    }
}

function run() {
    testStringConcatenationSafety();
    testSideEffectsEvaluatedOnce();
    testNumericEquivalence();
    console.log('Regression tests passed');
}

if (require.main === module) {
    run();
}

module.exports = {
    run
};
