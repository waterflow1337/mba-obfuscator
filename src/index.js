#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MBATransformer, DEFAULT_CONFIG } = require('./core/transformer');

class CLI {
    constructor() {
        this.args = process.argv.slice(2);
        this.config = { ...DEFAULT_CONFIG };
        this.inputFile = null;
        this.outputFile = null;
        this.showStats = false;
    }
    
    parseArgs() {
        if (this.args.length === 0) {
            this.showUsage();
            process.exit(1);
        }
        
        this.inputFile = this.args[0];
        
        for (let i = 1; i < this.args.length; i++) {
            const arg = this.args[i];
            
            switch (arg) {
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
                    
                case '--version':
                case '-v':
                    this.showVersion();
                    process.exit(0);
                    break;
                    
                case '--mode':
                    this.config.mode = this.getNextArg(++i, 'mode');
                    if (!['auto', '32', '64'].includes(this.config.mode)) {
                        this.error('Invalid mode. Must be auto, 32, or 64');
                    }
                    break;
                    
                case '--degree':
                    this.config.degree = parseInt(this.getNextArg(++i, 'degree'), 10);
                    if (isNaN(this.config.degree) || this.config.degree < 0) {
                        this.error('Degree must be a non-negative integer');
                    }
                    break;
                    
                case '--seed':
                    this.config.seed = this.getNextArg(++i, 'seed');
                    break;
                    
                case '--identities':
                    const identityList = this.getNextArg(++i, 'identities');
                    this.config.identities = identityList.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                    break;
                    
                case '--scope':
                    this.config.scope = this.getNextArg(++i, 'scope');
                    if (!['pragma', 'all', 'auto'].includes(this.config.scope)) {
                        this.error('Invalid scope. Must be pragma, all, or auto');
                    }
                    break;
                    
                case '--output':
                case '-o':
                    this.outputFile = this.getNextArg(++i, 'output');
                    break;
                    
                case '--max-nesting':
                    this.config.maxNestingDepth = parseInt(this.getNextArg(++i, 'max-nesting'), 10);
                    if (isNaN(this.config.maxNestingDepth) || this.config.maxNestingDepth < 0) {
                        this.error('Max nesting depth must be a non-negative integer');
                    }
                    break;
                    
                case '--comparison-ratio':
                    this.config.comparisonRatio = parseFloat(this.getNextArg(++i, 'comparison-ratio'));
                    if (isNaN(this.config.comparisonRatio) || this.config.comparisonRatio < 0 || this.config.comparisonRatio > 1) {
                        this.error('Comparison ratio must be between 0 and 1');
                    }
                    break;
                    
                case '--noise-ratio':
                    this.config.noiseRatio = parseFloat(this.getNextArg(++i, 'noise-ratio'));
                    if (isNaN(this.config.noiseRatio) || this.config.noiseRatio < 0 || this.config.noiseRatio > 1) {
                        this.error('Noise ratio must be between 0 and 1');
                    }
                    break;
                    
                case '--linear-basis-ratio':
                    this.config.linearBasisRatio = parseFloat(this.getNextArg(++i, 'linear-basis-ratio'));
                    if (isNaN(this.config.linearBasisRatio) || this.config.linearBasisRatio < 0 || this.config.linearBasisRatio > 1) {
                        this.error('Linear basis ratio must be between 0 and 1');
                    }
                    break;
                    
                case '--disable-comparisons':
                    this.config.enableComparisons = false;
                    break;
                    
                case '--stats':
                    this.showStats = true;
                    break;
                    
                default:
                    if (arg.startsWith('--')) {
                        this.error(`Unknown option: ${arg}`);
                    } else {
                        this.error(`Unexpected argument: ${arg}`);
                    }
                    break;
            }
        }
        
        if (!this.inputFile) {
            this.error('Input file is required');
        }
        
        if (!fs.existsSync(this.inputFile)) {
            this.error(`Input file does not exist: ${this.inputFile}`);
        }
    }
    
    getNextArg(index, optionName) {
        if (index >= this.args.length) {
            this.error(`Missing value for --${optionName}`);
        }
        return this.args[index];
    }
    
    async run() {
        try {
            console.error(`Processing ${this.inputFile}...`);
            
            const transformer = new MBATransformer(this.config);
            const transformedCode = transformer.transformFile(this.inputFile);
            const stats = transformer.getStats();
            
            if (this.outputFile) {
                fs.writeFileSync(this.outputFile, transformedCode, 'utf8');
                console.error(`Output written to: ${this.outputFile}`);
            } else {
                process.stdout.write(transformedCode);
            }
            
            if (this.showStats) {
                this.displayStats(stats);
            }
            
        } catch (error) {
            this.error(`Transformation failed: ${error.message}`);
        }
    }
    
    displayStats(stats) {
        console.error('\n=== Transformation Statistics ===');
        console.error(`Total candidates found: ${stats.totalCandidates}`);
        console.error(`Expressions transformed: ${stats.transformedExpressions}`);
        console.error(`Comparisons transformed: ${stats.transformedComparisons}`);
        console.error(`Expressions skipped: ${stats.skippedExpressions}`);
        console.error(`Errors encountered: ${stats.errors}`);
        
        if (stats.totalCandidates > 0) {
            const transformationRate = ((stats.transformedExpressions + stats.transformedComparisons) / stats.totalCandidates * 100).toFixed(1);
            console.error(`Transformation rate: ${transformationRate}%`);
        }
    }
    
    showUsage() {
        console.error('Usage: mba-obfuscator <input.js> [options]');
        console.error('');
        console.error('For detailed help, use: mba-obfuscator --help');
    }
    
    showHelp() {
        const packageInfo = this.getPackageInfo();
        
        console.log(`${packageInfo.name} v${packageInfo.version}`);
        console.log(packageInfo.description);
        console.log('');
        console.log('Usage:');
        console.log('  mba-obfuscator <input.js> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --mode auto|32|64          Transformation mode (default: auto)');
        console.log('                              auto: Auto-detect 32/64-bit operations');
        console.log('                              32: Force 32-bit transformations');  
        console.log('                              64: Force 64-bit transformations');
        console.log('');
        console.log('  --degree N                 Number of transformations to apply (default: 4)');
        console.log('');
        console.log('  --seed S                   Random seed for deterministic output');
        console.log('                              (default: current timestamp)');
        console.log('');
        console.log('  --identities list          Comma-separated identity transformations');
        console.log('                              Available: affine, feistel, lcg');
        console.log('                              (default: affine,feistel)');
        console.log('');
        console.log('  --scope all|auto|pragma    Transformation scope (default: all)');
        console.log('                              all: Transform all applicable expressions');
        console.log('                              auto: Auto-detect 64-bit operations based on types');
        console.log('                              pragma: Only transform marked expressions');
        console.log('');
        console.log('  --output path, -o path     Output file path (default: stdout)');
        console.log('');
        console.log('  --max-nesting N            Maximum MBA nesting depth (default: 2)');
        console.log('');
        console.log('  --comparison-ratio R       Ratio of comparisons to transform (0-1, default: 0.3)');
        console.log('');
        console.log('  --noise-ratio R            Probability of injecting neutral noise (0-1, default: 0.4)');
        console.log('');
        console.log('  --linear-basis-ratio R     Chance to synthesize MBA via linear systems (0-1, default: 0.35)');
        console.log('');
        console.log('  --disable-comparisons      Disable comparison obfuscation');
        console.log('');
        console.log('  --stats                    Display transformation statistics');
        console.log('');
        console.log('  --help, -h                 Show this help message');
        console.log('  --version, -v              Show version information');
        console.log('');
        console.log('Examples:');
        console.log('  mba-obfuscator input.js --degree 6 > output.js');
        console.log('  mba-obfuscator script.js --identities affine,lcg --stats -o obfuscated.js');
        console.log('  mba-obfuscator code.js --seed 12345 --max-nesting 3');
        console.log('');
        console.log('Auto-detection:');
        console.log('  let x = a + b;                   // 32-bit');
        console.log('  let y = BigInt(a) + BigInt(b);   // 64-bit');
        console.log('  let z = 0x100000000 + x;         // 64-bit');
    }
    
    showVersion() {
        const packageInfo = this.getPackageInfo();
        console.log(`${packageInfo.name} v${packageInfo.version}`);
    }
    
    getPackageInfo() {
        try {
            const packagePath = path.join(__dirname, '..', 'package.json');
            return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        } catch (error) {
            return {
                name: 'mba-obfuscator',
                version: '1.0.0',
                description: 'MBA Obfuscator'
            };
        }
    }
    
    error(message) {
        console.error(`Error: ${message}`);
        process.exit(1);
    }
}

module.exports = {
    MBATransformer,
    transform: require('./core/transformer').transform,
    transformFile: require('./core/transformer').transformFile
};

if (require.main === module) {
    const cli = new CLI();
    cli.parseArgs();
    cli.run().catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}
