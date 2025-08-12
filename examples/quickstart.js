#!/usr/bin/env node

const { transform } = require('../src/index');

const code = `
let x = 10;
let y = 20;
let result = x + y;

if (result > 25) {
    console.log('Large');
} else if (result === 0) {
    console.log('Zero');
} else {
    console.log('Normal');
}
`;

const obfuscated = transform(code, { 
    degree: 10,
    enableComparisons: true,
    comparisonRatio: 1.0  // transform all comparisons
});
console.log(obfuscated.code);