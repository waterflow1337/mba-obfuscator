const t = require('@babel/types');
const { wrap, num32, binaryOp, unaryOp } = require('../utils/ast');

function obfuscateComparison32(operator, left, right) {
    switch (operator) {
        case '===':
        case '==':
            return t.unaryExpression('!',
                binaryOp('|',
                    binaryOp('^', wrap(left), wrap(right)),
                    unaryOp('-', binaryOp('^', wrap(left), wrap(right)))
                )
            );
            
        case '!==':
        case '!=':
            return t.unaryExpression('!',
                t.unaryExpression('!',
                    binaryOp('|',
                        binaryOp('^', wrap(left), wrap(right)),
                        unaryOp('-', binaryOp('^', wrap(left), wrap(right)))
                    )
                )
            );
            
        case '<':
            const diff = binaryOp('-', wrap(left), wrap(right));
            const xor_xy = binaryOp('^', wrap(left), wrap(right));
            const diff_xor_x = binaryOp('^', diff, wrap(left));
            
            return binaryOp('<',
                binaryOp('^', diff, binaryOp('&', xor_xy, diff_xor_x)),
                num32(0)
            );
            
        case '>':
            return obfuscateComparison32('<', right, left);
            
        case '<=':
            const greaterThan = obfuscateComparison32('<', right, left);
            return t.unaryExpression('!', greaterThan);
            
        case '>=':
            const lessThan = obfuscateComparison32('<', left, right);
            return t.unaryExpression('!', lessThan);
            
        default:
            return null;
    }
}


function obfuscateZeroCheck(expression) {
    return t.unaryExpression('!',
        binaryOp('|', wrap(expression), unaryOp('-', wrap(expression)))
    );
}

function obfuscateNonZeroCheck(expression) {
    return t.unaryExpression('!',
        t.unaryExpression('!',
            binaryOp('|', wrap(expression), unaryOp('-', wrap(expression)))
        )
    );
}

function obfuscateRangeCheck(value, min, max) {
    const minCheck = obfuscateComparison32('>=', value, min);
    const maxCheck = obfuscateComparison32('<=', value, max);
    
    return t.logicalExpression('&&', minCheck, maxCheck);
}

function bitManipulationComparison(operator, left, right) {
    switch (operator) {
        case '<':
            return binaryOp('<',
                binaryOp('>>>', 
                    binaryOp('-', wrap(left), wrap(right)),
                    num32(31)
                ),
                num32(1)
            );
            
        case '>':
            return binaryOp('<',
                binaryOp('>>>', 
                    binaryOp('-', wrap(right), wrap(left)),
                    num32(31)
                ),
                num32(1)
            );
            
        default:
            return null;
    }
}

module.exports = {
    obfuscateComparison32,
    obfuscateZeroCheck,
    obfuscateNonZeroCheck,
    obfuscateRangeCheck,
    bitManipulationComparison
};