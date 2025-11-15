const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function parseJavaScript(sourceCode, options = {}) {
    const defaultOptions = {
        sourceType: 'unambiguous',
        plugins: [
            'jsx',
            'typescript', 
            'classProperties',
            'numericSeparator',
            'optionalChaining',
            'nullishCoalescingOperator',
            'decorators-legacy',
            'dynamicImport',
            'exportDefaultFrom',
            'functionBind'
        ],
        ranges: true,
        tokens: true,
        errorRecovery: true,
        ...options
    };
    
    try {
        return parser.parse(sourceCode, defaultOptions);
    } catch (error) {
        throw new Error(`Failed to parse JavaScript: ${error.message}`);
    }
}

function parseFile(filePath, options = {}) {
    try {
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        return parseJavaScript(sourceCode, options);
    } catch (error) {
        throw new Error(`Failed to parse file ${filePath}: ${error.message}`);
    }
}

function generateCode(ast, options = {}) {
    const defaultOptions = {
        compact: false,
        retainLines: false,
        comments: true,
        ...options
    };
    
    try {
        const result = generate(ast, defaultOptions);
        return result.code;
    } catch (error) {
        throw new Error(`Failed to generate code: ${error.message}`);
    }
}

function extractPragmaRanges(ast) {
    const ranges = [];
    
    if (!ast.comments) {
        return ranges;
    }
    
    let openPragma = null;
    
    for (const comment of ast.comments) {
        const content = String(comment.value || '').trim();
        
        if (/^@u64$/.test(content)) {
            openPragma = comment;
        } else if (/^@end$/.test(content) && openPragma) {
            ranges.push([openPragma.end, comment.start]);
            openPragma = null;
        }
    }
    
    return ranges;
}

function isInPragmaRange(node, ranges) {
    if (!node || typeof node.start !== 'number' || ranges.length === 0) {
        return false;
    }
    
    return ranges.some(([start, end]) => 
        node.start >= start && node.end <= end
    );
}

function findMBACandidates(ast, options = {}) {
    const {
        operators = ['+', '-', '^', '&', '|', '*'],
        pragmaRanges = [],
        scope = 'all' // 'all', 'pragma', 'auto'
    } = options;
    
    const candidates = [];
    
    traverse(ast, {
        BinaryExpression(path) {
            const { operator } = path.node;
            
            if (!operators.includes(operator)) {
                return;
            }

            if (!isNumericFriendlyBinary(path.node)) {
                return;
            }
            
            const inPragma = isInPragmaRange(path.node, pragmaRanges);
            
            let shouldInclude = false;
            switch (scope) {
                case 'all':
                    shouldInclude = true;
                    break;
                case 'pragma':
                    shouldInclude = inPragma;
                    break;
                case 'auto':
                    shouldInclude = inPragma || infersBigIntOperation(path.node);
                    break;
            }
            
            if (shouldInclude) {
                candidates.push({
                    path,
                    operator,
                    inPragma,
                    use64bit: inPragma || infersBigIntOperation(path.node)
                });
            }
        }
    });
    
    return candidates;
}

function findComparisonCandidates(ast, options = {}) {
    const {
        operators = ['==', '===', '!=', '!==', '<', '>', '<=', '>='],
        pragmaRanges = [],
        scope = 'all'
    } = options;
    
    const candidates = [];
    
    traverse(ast, {
        BinaryExpression(path) {
            const { operator } = path.node;
            
            if (!operators.includes(operator)) {
                return;
            }

            if (!isComparisonSafe(path.node)) {
                return;
            }
            
            const inPragma = isInPragmaRange(path.node, pragmaRanges);
            
            let shouldInclude = false;
            switch (scope) {
                case 'all':
                    shouldInclude = true;
                    break;
                case 'pragma':
                    shouldInclude = inPragma;
                    break;
                case 'auto':
                    shouldInclude = inPragma;
                    break;
            }
            
            if (shouldInclude) {
                candidates.push({
                    path,
                    operator,
                    inPragma
                });
            }
        }
    });
    
    return candidates;
}

function isStringLiteralLike(node) {
    if (!node) return false;
    if (t.isStringLiteral(node)) return true;
    if (t.isTemplateLiteral(node)) return true;
    if (t.isBinaryExpression(node) && node.operator === '+') {
        return isStringLiteralLike(node.left) || isStringLiteralLike(node.right);
    }
    if (t.isCallExpression(node)) {
        const callee = node.callee;
        if (t.isIdentifier(callee, { name: 'String' })) {
            return true;
        }
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const propertyName = callee.property.name;
            if (['join', 'concat', 'padStart', 'padEnd'].includes(propertyName)) {
                return true;
            }
        }
    }
    return false;
}

function isNumericFriendlyBinary(node) {
    if (node.operator === '+') {
        return !isStringLiteralLike(node.left) && !isStringLiteralLike(node.right);
    }
    return true;
}

function isComparisonSafe(node) {
    if (['===', '==', '!==', '!='].includes(node.operator)) {
        if (isStringLiteralLike(node.left) || isStringLiteralLike(node.right)) {
            return false;
        }
    }
    return true;
}

function infersBigIntOperation(node, cache = new Map()) {
    if (!node) return false;
    if (cache.has(node)) return cache.get(node);
    
    let result = false;
    
    if (node.type === 'BigIntLiteral') {
        result = true;
    }
    else if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'BigInt') {
            result = true;
        } else if (callee.type === 'MemberExpression' && 
            callee.object.type === 'Identifier' && callee.object.name === 'BigInt' &&
            callee.property.type === 'Identifier' && callee.property.name === 'asUintN') {
            result = true;
        } else {
            result = node.arguments.some(arg => infersBigIntOperation(arg, cache));
        }
    }
    else if (node.type === 'BinaryExpression') {
        const operatorSet = new Set(['+', '-', '^', '&', '|', '<<', '>>', '*']);
        if (operatorSet.has(node.operator)) {
            result = infersBigIntOperation(node.left, cache) || infersBigIntOperation(node.right, cache);
            
            if (!result && node.left.type === 'NumericLiteral' && node.left.value >= 0x100000000) {
                result = true;
            }
            if (!result && node.right.type === 'NumericLiteral' && node.right.value >= 0x100000000) {
                result = true;
            }
        }
    }
    else if (node.type === 'NumericLiteral') {
        result = node.value >= 0x100000000;
    }
    else if (node.type === 'ConditionalExpression') {
        result = infersBigIntOperation(node.test, cache) ||
                 infersBigIntOperation(node.consequent, cache) ||
                 infersBigIntOperation(node.alternate, cache);
    }
    
    cache.set(node, result);
    return result;
}

module.exports = {
    parseJavaScript,
    parseFile,
    generateCode,
    extractPragmaRanges,
    isInPragmaRange,
    findMBACandidates,
    findComparisonCandidates,
    infersBigIntOperation
};
