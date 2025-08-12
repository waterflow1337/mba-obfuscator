const { transform } = require('../src/index');

const cryptoCode = `
function simpleHash(data) {
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    
    for (let i = 0; i < data.length; i++) {
        const byte = data.charCodeAt(i);
        a = (a + byte) ^ (b << 3);
        b = (b - byte) ^ (a >> 5);
    }
    
    return (a ^ b) >>> 0;
}

function xorCipher(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
            text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
    }
    return result;
}

function checksum(buffer) {
    let sum = BigInt(0);
    for (let i = 0; i < buffer.length; i++) {
        sum = sum + BigInt(buffer[i]);
        sum = (sum * 0x100000001B3n) ^ (sum >> 64n);
    }
    return sum;
}
`;

const result = transform(cryptoCode, {
    mode: 'auto',
    degree: 10,
    identities: ['affine', 'lcg'],
    maxNestingDepth: 2,
    seed: 'crypto-seed'
});

console.log(result.code);
console.log('\nStats:', result.stats);