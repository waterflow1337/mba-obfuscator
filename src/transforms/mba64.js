
const t = require('@babel/types');
const { bigIntLiteral, asUint64Expr, toBigInt64, binaryOp, unaryOp } = require('../utils/ast');
const { randomInt } = require('../utils/random');

function getMBARewrite64(operator, variant = 0) {
    const variants = {
        '+': [
            (x, y) => asUint64Expr(binaryOp('+',
                binaryOp('^', toBigInt64(x), toBigInt64(y)),
                binaryOp('<<', binaryOp('&', toBigInt64(x), toBigInt64(y)), bigIntLiteral('1'))
            )),
            
            (x, y) => asUint64Expr(binaryOp('+',
                binaryOp('|', toBigInt64(x), toBigInt64(y)),
                binaryOp('&', toBigInt64(x), toBigInt64(y))
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('<<', binaryOp('|', toBigInt64(x), toBigInt64(y)), bigIntLiteral('1')),
                binaryOp('^', toBigInt64(x), toBigInt64(y))
            )),
            
            (x, y) => asUint64Expr(binaryOp('+',
                binaryOp('*', binaryOp('&', toBigInt64(x), toBigInt64(y)), bigIntLiteral('2')),
                binaryOp('^', toBigInt64(x), toBigInt64(y))
            ))
        ],
        
        '-': [
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('^', toBigInt64(x), toBigInt64(y)),
                binaryOp('<<', binaryOp('&', unaryOp('~', toBigInt64(x)), toBigInt64(y)), bigIntLiteral('1'))
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('&', toBigInt64(x), unaryOp('~', toBigInt64(y))),
                binaryOp('&', unaryOp('~', toBigInt64(x)), toBigInt64(y))
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('|', toBigInt64(x), unaryOp('~', toBigInt64(y))),
                binaryOp('|', unaryOp('~', toBigInt64(x)), toBigInt64(y))
            ))
        ],
        
        '^': [
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('|', toBigInt64(x), toBigInt64(y)),
                binaryOp('&', toBigInt64(x), toBigInt64(y))
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('+', toBigInt64(x), toBigInt64(y)),
                binaryOp('<<', binaryOp('&', toBigInt64(x), toBigInt64(y)), bigIntLiteral('1'))
            )),
            
            (x, y) => asUint64Expr(binaryOp('&',
                binaryOp('|', toBigInt64(x), toBigInt64(y)),
                unaryOp('~', binaryOp('&', toBigInt64(x), toBigInt64(y)))
            ))
        ],
        
        '&': [
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('|', unaryOp('~', toBigInt64(x)), toBigInt64(y)),
                unaryOp('~', toBigInt64(x))
            )),
            
            (x, y) => asUint64Expr(unaryOp('~',
                binaryOp('|', unaryOp('~', toBigInt64(x)), unaryOp('~', toBigInt64(y)))
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('+', toBigInt64(x), toBigInt64(y)),
                binaryOp('|', toBigInt64(x), toBigInt64(y))
            ))
        ],
        
        '|': [
            (x, y) => asUint64Expr(binaryOp('+',
                binaryOp('&', toBigInt64(x), unaryOp('~', toBigInt64(y))),
                toBigInt64(y)
            )),
            
            (x, y) => asUint64Expr(binaryOp('-',
                binaryOp('+', toBigInt64(x), toBigInt64(y)),
                binaryOp('&', toBigInt64(x), toBigInt64(y))
            )),
            
            (x, y) => asUint64Expr(unaryOp('~',
                binaryOp('&', unaryOp('~', toBigInt64(x)), unaryOp('~', toBigInt64(y)))
            ))
        ],
        
        '*': [
            (x, y) => {
                if (t.isBigIntLiteral(y)) {
                    const value = BigInt(y.value);
                    
                    if (value > 0n && (value & (value - 1n)) === 0n) {
                        const shift = value.toString(2).length - 1;
                        return asUint64Expr(binaryOp('<<', toBigInt64(x), bigIntLiteral(shift.toString())));
                    }
                    
                    if (value === 3n) {
                        return asUint64Expr(binaryOp('+', 
                            binaryOp('<<', toBigInt64(x), bigIntLiteral('1')), toBigInt64(x)));
                    }
                    if (value === 5n) {
                        return asUint64Expr(binaryOp('+', 
                            binaryOp('<<', toBigInt64(x), bigIntLiteral('2')), toBigInt64(x)));
                    }
                }
                
                return asUint64Expr(binaryOp('*', toBigInt64(x), toBigInt64(y)));
            }
        ]
    };
    
    const operatorVariants = variants[operator];
    if (!operatorVariants || operatorVariants.length === 0) {
        return null;
    }
    
    const index = variant % operatorVariants.length;
    return operatorVariants[index];
}

const MBA_TRANSFORMS_64 = {
    '+': (x, y) => getMBARewrite64('+', randomInt(0, 3))(x, y),
    '-': (x, y) => getMBARewrite64('-', randomInt(0, 2))(x, y),
    '^': (x, y) => getMBARewrite64('^', randomInt(0, 2))(x, y),
    '&': (x, y) => getMBARewrite64('&', randomInt(0, 2))(x, y),
    '|': (x, y) => getMBARewrite64('|', randomInt(0, 2))(x, y),
    '*': (x, y) => getMBARewrite64('*', 0)(x, y)
};

function applyNestedMBA64(expression, depth = 1) {
    if (depth <= 0) return expression;
    
    if (randomInt(1, 10) <= 3 && t.isBinaryExpression(expression)) {
        const operator = expression.operator;
        if (MBA_TRANSFORMS_64[operator]) {
            const rewritten = MBA_TRANSFORMS_64[operator](expression.left, expression.right);
            return applyNestedMBA64(rewritten, depth - 1);
        }
    }
    return expression;
}

module.exports = {
    MBA_TRANSFORMS_64,
    applyNestedMBA64
};