#!/bin/bash

# Basic usage
node src/index.js input.js > output.js

# With options
node src/index.js input.js --degree 8 --output obfuscated.js

# Maximum obfuscation
node src/index.js input.js \
    --degree 15 \
    --identities affine,feistel,lcg \
    --max-nesting 3 \
    --comparison-ratio 0.8 \
    --output max-obfuscated.js

# Reproducible output
node src/index.js input.js --seed "key" --output deterministic.js

# Show statistics
node src/index.js input.js --stats --output result.js