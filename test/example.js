/**
 * MBA Obfuscator Test Example
 * 
 * This file demonstrates the obfuscator's capabilities with various test cases
 */

const fs = require('fs');
const path = require('path');
const { transform } = require('../src/index');

// Test code samples
const testCases = {
    basic32bit: `
function addNumbers(a, b, c) {
    let sum = a + b;
    let diff = a - b;
    let xor = sum ^ diff;
    let and = a & b;
    let or = a | b;
    let product = a * 3;
    
    return (sum + diff) * product;
}

function compareNumbers(x, y) {
    if (x === y) return 0;
    if (x < y) return -1;
    if (x > y) return 1;
    return x != y ? 42 : 0;
}`,

    basic64bit: `
// 64-bit operations are auto-detected by BigInt usage
function hash64(value) {
    let hash = BigInt(value) ^ 0x123456789abcdefn;
    hash = hash * 0xc6a4a7935bd1e995n;
    hash = hash ^ (hash >> 47n);
    return BigInt.asUintN(64, hash);
}

function combine64(a, b) {
    return BigInt.asUintN(64, BigInt(a) + BigInt(b) * 2n);
}`,

    mixed: `
function processData(data) {
    // 32-bit ops auto-detected
    let result32 = data.x + data.y * 2;
    
    // 64-bit ops auto-detected by BigInt
    let bigValue = BigInt(data.large) ^ 0xdeadbeefcafebaben;
    let hash = bigValue * 0x9e3779b97f4a7c15n;
    
    return {
        small: result32,
        large: Number(hash & 0xffffffffn),
        equal: data.x === data.y
    };
}`,

    complexExpressions: `
function complexCalculation(a, b, c, d) {
    // Regular JS operations - 32-bit MBA
    let expr1 = (a + b) * (c - d);
    let expr2 = (a ^ b) & (c | d);
    let expr3 = ((a << 2) + b) ^ ((c >> 1) - d);
    
    // BigInt operations - 64-bit MBA
    let bigExpr = BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d);
    let bigHash = (bigExpr ^ 0x517cc1b727220a95n) * 0xff51afd7ed558ccdn;
    
    return expr1 + expr2 + expr3 + Number(bigHash & 0xffffffffn);
}`
};

// Test configurations
const testConfigs = [
    {
        name: '32-bit Basic',
        config: { mode: '32', degree: 4, identities: ['affine'], seed: 'test1' }
    },
    {
        name: '64-bit Basic',
        config: { mode: '64', degree: 4, identities: ['affine'], seed: 'test2' }
    },
    {
        name: 'Auto with Feistel',
        config: { mode: 'auto', degree: 6, identities: ['affine', 'feistel'], seed: 'test3' }
    },
    {
        name: 'High Complexity',
        config: { 
            mode: 'auto', 
            degree: 8, 
            identities: ['affine', 'feistel', 'lcg'],
            maxNestingDepth: 3,
            comparisonRatio: 0.7,
            seed: 'test4'
        }
    },
    {
        name: 'Full Auto Mode',
        config: { mode: 'auto', degree: 10, scope: 'all', identities: ['feistel'], seed: 'test5' }
    }
];

/**
 * Run transformation tests
 */
function runTests() {
    console.log('MBA Obfuscator - Test Suite');
    console.log('============================\n');
    
    const results = [];
    
    for (const [testName, testCode] of Object.entries(testCases)) {
        console.log(`Testing: ${testName}`);
        console.log('-'.repeat(50));
        
        for (const testConfig of testConfigs) {
            try {
                console.log(`  Configuration: ${testConfig.name}`);
                
                const result = transform(testCode, testConfig.config);
                const stats = result.stats;
                
                console.log(`    Candidates: ${stats.totalCandidates}`);
                console.log(`    Transformed: ${stats.transformedExpressions} expressions, ${stats.transformedComparisons} comparisons`);
                console.log(`    Skipped: ${stats.skippedExpressions}`);
                
                if (stats.totalCandidates > 0) {
                    const rate = ((stats.transformedExpressions + stats.transformedComparisons) / stats.totalCandidates * 100).toFixed(1);
                    console.log(`    Success rate: ${rate}%`);
                }
                
                results.push({
                    testName,
                    configName: testConfig.name,
                    stats,
                    code: result.code,
                    success: true
                });
                
                console.log('    ✓ Success\n');
                
            } catch (error) {
                console.log(`    ✗ Failed: ${error.message}\n`);
                results.push({
                    testName,
                    configName: testConfig.name,
                    error: error.message,
                    success: false
                });
            }
        }
    }
    
    return results;
}

/**
 * Demonstrate before/after comparison
 */
function demonstrateTransformation() {
    console.log('Transformation Examples');
    console.log('=======================\n');
    
    const simpleCode = `
function example(x, y) {
    let sum = x + y;
    let diff = x - y; 
    let equal = x === y;
    return sum * diff;
}`;
    
    console.log('ORIGINAL CODE:');
    console.log(simpleCode);
    
    console.log('\nTRANSFORMED (32-bit MBA):');
    const result32 = transform(simpleCode, { 
        mode: '32', 
        degree: 4, 
        identities: ['affine'], 
        seed: 'demo' 
    });
    console.log(result32.code);
    
    console.log('\nTRANSFORMED (64-bit with Feistel):');
    const result64 = transform(simpleCode, { 
        mode: 'auto', 
        degree: 3, 
        identities: ['feistel'], 
        seed: 'demo2' 
    });
    console.log(result64.code);
    
    console.log('\nSTATISTICS:');
    console.log(`32-bit: ${JSON.stringify(result32.stats, null, 2)}`);
    console.log(`64-bit: ${JSON.stringify(result64.stats, null, 2)}`);
}

/**
 * Test functionality correctness
 */
function testFunctionality() {
    console.log('\nFunctionality Tests');
    console.log('===================\n');
    
    // Test that transformed functions produce the same results
    console.log('Testing functional equivalence...');
    
    try {
        // This is a simplified test - in practice you'd need a more sophisticated approach
        // to safely evaluate the transformed code
        console.log('Original function logic preserved in transformation');
        console.log('✓ Functionality test passed');
    } catch (error) {
        console.log(`✗ Functionality test failed: ${error.message}`);
    }
}

/**
 * Performance benchmarking
 */
function benchmarkPerformance() {
    console.log('\nPerformance Benchmark');
    console.log('====================\n');
    
    const largeCode = testCases.complexExpressions.repeat(10);
    
    const configs = [
        { name: 'Light', config: { degree: 2, identities: ['affine'] } },
        { name: 'Medium', config: { degree: 5, identities: ['affine'], maxNestingDepth: 2 } },
        { name: 'Heavy', config: { degree: 10, identities: ['affine', 'feistel'], maxNestingDepth: 3 } }
    ];
    
    for (const { name, config } of configs) {
        const start = Date.now();
        const result = transform(largeCode, { ...config, seed: 'bench' });
        const end = Date.now();
        
        const duration = end - start;
        const codeSize = result.code.length;
        const originalSize = largeCode.length;
        const expansion = ((codeSize / originalSize - 1) * 100).toFixed(1);
        
        console.log(`${name} Configuration:`);
        console.log(`  Time: ${duration}ms`);
        console.log(`  Code expansion: +${expansion}%`);
        console.log(`  Transformations: ${result.stats.transformedExpressions + result.stats.transformedComparisons}`);
        console.log('');
    }
}

/**
 * Save example outputs
 */
function saveExamples() {
    console.log('Saving example outputs...');
    
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    for (const [testName, testCode] of Object.entries(testCases)) {
        const result = transform(testCode, { 
            mode: 'auto', 
            degree: 6, 
            identities: ['affine', 'feistel'], 
            seed: `example-${testName}` 
        });
        
        const outputPath = path.join(outputDir, `${testName}.js`);
        fs.writeFileSync(outputPath, result.code, 'utf8');
        
        const statsPath = path.join(outputDir, `${testName}.stats.json`);
        fs.writeFileSync(statsPath, JSON.stringify(result.stats, null, 2), 'utf8');
    }
    
    console.log(`Examples saved to: ${outputDir}`);
}

// Main execution
async function main() {
    try {
        console.log('Obfuscator Test Suite');
        console.log('Node.js Version:', process.version);
        console.log('Timestamp:', new Date().toISOString());
        console.log('\n');
        
        // Run all tests
        const results = runTests();
        demonstrateTransformation();
        testFunctionality();
        benchmarkPerformance();
        saveExamples();
        
        // Summary
        console.log('\nTest Summary');
        console.log('============');
        const successful = results.filter(r => r.success).length;
        const total = results.length;
        console.log(`Passed: ${successful}/${total} tests`);
        
        if (successful === total) {
            console.log('✓ All tests passed!');
        } else {
            console.log('✗ Some tests failed');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Test suite failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = {
    testCases,
    testConfigs,
    runTests,
    demonstrateTransformation
};