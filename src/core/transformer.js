const { initializeRandom, shuffleInPlace, randomInt, randomFloat } = require('../utils/random');
const { 
    parseJavaScript, 
    parseFile, 
    generateCode, 
    extractPragmaRanges, 
    findMBACandidates, 
    findComparisonCandidates 
} = require('./parser');
const { MBA_TRANSFORMS_32, applyNestedMBA32 } = require('../transforms/mba32');
const { MBA_TRANSFORMS_64, applyNestedMBA64 } = require('../transforms/mba64');
const { wrapWithAffine32, wrapWithAffine64, feistelIdentity64, lcgIdentity } = require('../transforms/identities');
const { 
    obfuscateComparison32, 
    obfuscateZeroCheck, 
    obfuscateNonZeroCheck,
    bitManipulationComparison,
    obfuscateRangeCheck
} = require('../transforms/comparisons');

const DEFAULT_CONFIG = {
    mode: 'auto',              // 'auto', '32', '64'
    degree: 4,                 // Number of transformations to apply
    seed: null,                // Random seed (null = use timestamp)
    identities: ['affine'],    // Identity transformations to apply
    scope: 'all',             // 'all', 'pragma', 'auto' - default to 'all' for automatic obfuscation
    maxNestingDepth: 2,       // Maximum nesting depth for MBA transformations
    comparisonRatio: 0.3,     // Ratio of comparisons to transform
    enableComparisons: true   // Whether to transform comparison operations
};

class MBATransformer {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.pragmaRanges = [];
        this.stats = {
            totalCandidates: 0,
            transformedExpressions: 0,
            transformedComparisons: 0,
            skippedExpressions: 0,
            errors: 0
        };
        
        const seed = this.config.seed || Date.now().toString();
        initializeRandom(seed);
    }
    
    transformSource(sourceCode) {
        try {
            const ast = parseJavaScript(sourceCode);
            this.transformAST(ast);
            return generateCode(ast);
        } catch (error) {
            this.stats.errors++;
            throw new Error(`Transformation failed: ${error.message}`);
        }
    }
    
    transformFile(inputPath, outputPath = null) {
        try {
            const ast = parseFile(inputPath);
            this.transformAST(ast);
            const transformedCode = generateCode(ast);
            
            if (outputPath) {
                const fs = require('fs');
                fs.writeFileSync(outputPath, transformedCode, 'utf8');
            }
            
            return transformedCode;
        } catch (error) {
            this.stats.errors++;
            throw new Error(`File transformation failed: ${error.message}`);
        }
    }
    
    transformAST(ast) {
        if (this.config.scope === 'pragma') {
            this.pragmaRanges = extractPragmaRanges(ast);
        }
        
        const mbaCandidates = findMBACandidates(ast, {
            operators: ['+', '-', '^', '&', '|', '*'],
            pragmaRanges: this.pragmaRanges,
            scope: this.config.scope
        });
        
        const comparisonCandidates = this.config.enableComparisons ? 
            findComparisonCandidates(ast, {
                operators: ['==', '===', '!=', '!==', '<', '>', '<=', '>='],
                pragmaRanges: this.pragmaRanges,
                scope: this.config.scope
            }) : [];
        
        this.stats.totalCandidates = mbaCandidates.length + comparisonCandidates.length;
        
        this.transformBinaryExpressions(mbaCandidates);
        
        if (this.config.enableComparisons) {
            this.transformRangeChecks(ast);
            this.transformComparisonExpressions(comparisonCandidates);
        }
    }
    
    transformBinaryExpressions(candidates) {
        candidates.sort((a, b) => {
            const aScore = (a.use64bit ? 2 : 0) + (this.hasLargeConstant(a.path.node) ? 1 : 0);
            const bScore = (b.use64bit ? 2 : 0) + (this.hasLargeConstant(b.path.node) ? 1 : 0);
            return bScore - aScore;
        });
        
        const prioritized = candidates.slice(0, Math.ceil(candidates.length * 0.3));
        const rest = candidates.slice(Math.ceil(candidates.length * 0.3));
        shuffleInPlace(rest);
        const sorted = [...prioritized, ...rest];
        
        const selectedCandidates = sorted.slice(0, Math.min(this.config.degree, sorted.length));
        
        for (const candidate of selectedCandidates) {
            try {
                this.transformSingleExpression(candidate);
            } catch (error) {
                console.warn(`Failed to transform expression: ${error.message}`);
                this.stats.skippedExpressions++;
            }
        }
    }
    
    transformSingleExpression(candidate) {
        const { path, operator } = candidate;
        const { left, right } = path.node;
        
        let transformed;
        const is64bit = this.shouldUse64Bit(candidate);
        
        if (is64bit) {
            if (!MBA_TRANSFORMS_64[operator]) {
                this.stats.skippedExpressions++;
                return;
            }
            
            transformed = MBA_TRANSFORMS_64[operator](left, right);
            
            const nestingDepth = randomInt(0, this.config.maxNestingDepth);
            if (nestingDepth > 0) {
                transformed = applyNestedMBA64(transformed, nestingDepth);
            }
        } else {
            if (!MBA_TRANSFORMS_32[operator]) {
                this.stats.skippedExpressions++;
                return;
            }
            
            transformed = MBA_TRANSFORMS_32[operator](left, right);
            
            const nestingDepth = randomInt(0, this.config.maxNestingDepth);
            if (nestingDepth > 0) {
                transformed = applyNestedMBA32(transformed, nestingDepth);
            }
        }
        
        transformed = this.applyIdentityTransformations(transformed, is64bit);
        
        path.replaceWith(transformed);
        this.stats.transformedExpressions++;
    }
    
    applyIdentityTransformations(expression, use64bit) {
        let wrapped = expression;
        const identities = new Set(this.config.identities);
        
        if (use64bit) {
            if (identities.has('feistel') && randomFloat() < 0.7) {
                wrapped = feistelIdentity64(wrapped);
            }
            if (identities.has('affine') && randomFloat() < 0.8) {
                wrapped = wrapWithAffine64(wrapped);
            }
            if (identities.has('lcg') && randomFloat() < 0.5) {
                wrapped = lcgIdentity(wrapped, true);
            }
        } else {
            if (identities.has('affine') && randomFloat() < 0.8) {
                wrapped = wrapWithAffine32(wrapped);
            }
            if (identities.has('lcg') && randomFloat() < 0.5) {
                wrapped = lcgIdentity(wrapped, false);
            }
        }
        
        return wrapped;
    }
    
    transformRangeChecks(ast) {
        const traverse = require('@babel/traverse').default;
        const t = require('@babel/types');
        const self = this;
        
        traverse(ast, {
            LogicalExpression(path) {
                if (path.node.operator !== '&&') return;
                
                const left = path.node.left;
                const right = path.node.right;
                
                // Pattern: x >= min && x <= max or similar
                if (t.isBinaryExpression(left) && t.isBinaryExpression(right)) {
                    const isLeftComparison = ['>=', '>', '<=', '<'].includes(left.operator);
                    const isRightComparison = ['>=', '>', '<=', '<'].includes(right.operator);
                    
                    if (isLeftComparison && isRightComparison) {
                        // Check if same variable is being compared
                        const leftVar = self.getComparisonVariable(left);
                        const rightVar = self.getComparisonVariable(right);
                        
                        if (leftVar && rightVar && self.isSameVariable(leftVar, rightVar)) {
                            // This is a range check
                            let value, min, max;
                            
                            // Determine min, max, and value
                            if ((left.operator === '>=' || left.operator === '>') && 
                                (right.operator === '<=' || right.operator === '<')) {
                                value = leftVar;
                                min = left.right;
                                max = right.right;
                            } else if ((right.operator === '>=' || right.operator === '>') && 
                                       (left.operator === '<=' || left.operator === '<')) {
                                value = rightVar;
                                min = right.right;
                                max = left.right;
                            }
                            
                            if (value && min && max && randomFloat() < 0.7) {
                                const obfuscated = obfuscateRangeCheck(value, min, max);
                                path.replaceWith(obfuscated);
                                self.stats.transformedComparisons++;
                            }
                        }
                    }
                }
            }
        });
    }
    
    getComparisonVariable(node) {
        if (node.left.type === 'Identifier') return node.left;
        if (node.right.type === 'Identifier') return node.right;
        return null;
    }
    
    isSameVariable(node1, node2) {
        const t = require('@babel/types');
        if (t.isIdentifier(node1) && t.isIdentifier(node2)) {
            return node1.name === node2.name;
        }
        return false;
    }
    
    transformComparisonExpressions(candidates) {
        shuffleInPlace(candidates);
        
        const maxComparisons = Math.floor(candidates.length * this.config.comparisonRatio);
        const selectedCandidates = candidates.slice(0, Math.min(maxComparisons, candidates.length));
        
        for (const candidate of selectedCandidates) {
            try {
                const { path, operator } = candidate;
                const { left, right } = path.node;
                
                let obfuscated = null;
                
                // Special case: x === 0 or 0 === x
                if ((operator === '===' || operator === '==') && this.isZeroLiteral(right)) {
                    obfuscated = obfuscateZeroCheck(left);
                } else if ((operator === '===' || operator === '==') && this.isZeroLiteral(left)) {
                    obfuscated = obfuscateZeroCheck(right);
                }
                // Special case: x !== 0 or 0 !== x
                else if ((operator === '!==' || operator === '!=') && this.isZeroLiteral(right)) {
                    obfuscated = obfuscateNonZeroCheck(left);
                } else if ((operator === '!==' || operator === '!=') && this.isZeroLiteral(left)) {
                    obfuscated = obfuscateNonZeroCheck(right);
                }
                // Use bit manipulation for < and > (50% chance)
                else if ((operator === '<' || operator === '>') && randomFloat() < 0.5) {
                    const bitManip = bitManipulationComparison(operator, left, right);
                    obfuscated = bitManip || obfuscateComparison32(operator, left, right);
                }
                // Default comparison obfuscation
                else {
                    obfuscated = obfuscateComparison32(operator, left, right);
                }
                
                if (obfuscated) {
                    path.replaceWith(obfuscated);
                    this.stats.transformedComparisons++;
                }
            } catch (error) {
                console.warn(`Failed to transform comparison: ${error.message}`);
            }
        }
    }
    
    shouldUse64Bit(candidate) {
        switch (this.config.mode) {
            case '64':
                return true;
            case '32':
                return false;
            case 'auto':
            default:
                return candidate.use64bit || candidate.inPragma;
        }
    }
    
    hasLargeConstant(node) {
        const t = require('@babel/types');
        if (!node) return false;
        
        if (t.isNumericLiteral(node)) {
            return node.value >= 0x100000000;
        }
        
        if (t.isBinaryExpression(node)) {
            return this.hasLargeConstant(node.left) || this.hasLargeConstant(node.right);
        }
        
        return false;
    }
    
    isZeroLiteral(node) {
        const t = require('@babel/types');
        return t.isNumericLiteral(node) && node.value === 0;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    resetStats() {
        this.stats = {
            totalCandidates: 0,
            transformedExpressions: 0,
            transformedComparisons: 0,
            skippedExpressions: 0,
            errors: 0
        };
    }
}

function transform(sourceCode, config = {}) {
    const transformer = new MBATransformer(config);
    const transformedCode = transformer.transformSource(sourceCode);
    const stats = transformer.getStats();
    
    return {
        code: transformedCode,
        stats
    };
}

function transformFile(inputPath, outputPath = null, config = {}) {
    const transformer = new MBATransformer(config);
    const transformedCode = transformer.transformFile(inputPath, outputPath);
    const stats = transformer.getStats();
    
    return {
        code: transformedCode,
        stats
    };
}

module.exports = {
    MBATransformer,
    transform,
    transformFile,
    DEFAULT_CONFIG
};