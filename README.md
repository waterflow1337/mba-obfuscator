# MBA Obfuscator

JavaScript obfuscator using Mixed Boolean-Arithmetic transformations. Turns simple math into complex expressions.

## What it does

Transforms code like this:
```javascript
let result = x + y;
if (result > 25) { /* ... */ }
```

Into this:
```javascript
let result = (Math.imul(3459867463, ((Math.imul(3871299191, (((((x) | (y)) + ((x) & (y))) >>> 0)))) + (870483952) >>> 0))) + (2636807280) >>> 0;
if (((((25)) - ((result))) >>> (31)) < (1)) { /* ... */ }
```

## Install

```bash
git clone https://github.com/waterflow1337/mba-obfuscator.git
cd mba-obfuscator
npm install
```

## Usage

### CLI
```bash
# Basic
node src/index.js input.js > output.js

# With options
node src/index.js input.js --degree 10 --output result.js

# Maximum obfuscation
node src/index.js input.js --degree 15 --comparison-ratio 1.0 -o obfuscated.js
```

### As a library
```javascript
const { transform } = require('./mba-obfuscator/src/index');

const code = `let x = a + b;`;
const obfuscated = transform(code, { 
    degree: 10,
    comparisonRatio: 1.0 
});
console.log(obfuscated.code);
```

## Options

- `--degree N` - How many transformations to apply (default: 4)
- `--mode auto|32|64` - Force 32-bit or 64-bit math (default: auto)
- `--seed "string"` - Make output deterministic
- `--comparison-ratio 0.0-1.0` - How many comparisons to obfuscate (default: 0.3)
- `--identities affine,feistel,lcg` - Which transformations to use
- `--stats` - Show what got transformed

## Examples

Check the `examples/` folder:
- `quickstart.js` - Simple example
- `crypto-example.js` - Hash functions

## How it works

Uses MBA (Mixed Boolean-Arithmetic) to replace arithmetic operations with equivalent but complex expressions. Supports both 32-bit and 64-bit (BigInt) operations.

Transforms:
- Addition, subtraction, multiplication
- Comparisons (>, <, ===, !==)
- Zero checks and range checks
- BigInt operations

## License

MIT