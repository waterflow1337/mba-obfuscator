# MBA Obfuscator

JavaScript obfuscator using Mixed Boolean-Arithmetic transformations. Turns simple math into complex expressions.

## ⚠️ Disclaimer

This is an experimental research project. Not intended for production use. May have bugs and edge cases. Use at your own risk.

## What it does

Transforms code like this:
```javascript
let result = x + y;
if (result > 25) { /* ... */ }
```

Into this:
```javascript
let result = (Math.imul(3459867463, ((Math.imul(3871299191, (((((x) | (y)) + ((x) & (y))) >>> 0)))) + (870483952) >>> 0))) + (2636807280) >>> 0;
if (((((25)) - ((result))) >>> (31)) !== (0)) { /* ... */ }
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
- `--noise-ratio 0.0-1.0` - Probability of wrapping MBA expressions in neutral noise (default: 0.4)
- `--linear-basis-ratio 0.0-1.0` - Probability of synthesizing rewrites via linear systems (default: 0.35)
- `--identities affine,feistel,lcg,quadratic` - Identity transformations to apply
- `--stats` - Show what got transformed

## Examples

Check the `examples/` folder:
- `quickstart.js` - Simple example
- `crypto-example.js` - Hash functions

## How it works

Uses MBA (Mixed Boolean-Arithmetic) to replace arithmetic operations with equivalent but complex expressions. Supports both 32-bit and 64-bit (BigInt) operations.

### Transforms
- Addition, subtraction, multiplication
- Bitwise operations (XOR, AND, OR)
- Comparisons (>, <, ===, !==)
- Zero checks and range checks
- BigInt operations

### Identity Transformations
Optional wrappers that add complexity while preserving values:

- **affine** - Linear transformation `f(x) = a*x + b` with modular inverse
- **lcg** - Linear congruential generator wrapping
- **feistel** - 2-round Feistel network (64-bit only)
- **quadratic** - Quadratic permutation polynomial `f(x) = a₂x² + a₁x + a₀` over Z/(2³²)

### Linear MBA Synthesis
Can generate unique MBA expressions by solving linear systems over modular arithmetic, using a pool of Boolean basis functions (XOR, AND, OR, NAND, NOR, etc.).

## License

MIT
