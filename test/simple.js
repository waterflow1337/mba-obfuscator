const { transform, transformFile } = require('../src/index');
const fs = require('fs');

const code = `
function calculate(a, b) {
    let sum = a + b;
    let diff = a - b;
    let product = a * b;
    
    if (sum === 0) {
        return 'zero sum';
    }
    
    if (a > b && a < 100) {
        return product;
    }
    
    return sum + diff;
}

function hash(value) {
    let h = BigInt(value) ^ 0x123456789abcdefn;
    h = h * 0xc6a4a7935bd1e995n;
    return h;
}
`;

console.log('Basic transformation:');
const result1 = transform(code);
console.log(result1.code);

console.log('\nHigh obfuscation:');
const result2 = transform(code, {
    degree: 10,
    identities: ['affine', 'feistel'],
    seed: 'myseed'
});
console.log(result2.code);

const inputFile = 'example.js';
const outputFile = 'example.obfuscated.js';

if (fs.existsSync(inputFile)) {
    transformFile(inputFile, outputFile, {
        degree: 8,
        maxNestingDepth: 3
    });
    console.log(`\nTransformed ${inputFile} -> ${outputFile}`);
}