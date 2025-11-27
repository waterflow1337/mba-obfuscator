
const t = require('@babel/types');
const { num32, toUint32, binaryOp, unaryOp } = require('../utils/ast');
const { randomInt } = require('../utils/random');

function getMBARewrite32(operator, variant = 0) {
    const variants = {
        '+': [
            // x + y = (x ^ y) + ((x & y) << 1)
            (x, y) => toUint32(binaryOp('+',
                binaryOp('^', x, y),
                binaryOp('<<', binaryOp('&', x, y), num32(1))
            )),

            // x + y = (x | y) + (x & y)
            (x, y) => toUint32(binaryOp('+',
                binaryOp('|', x, y),
                binaryOp('&', x, y)
            )),

            // x + y = 2*(x | y) - (x ^ y)
            (x, y) => toUint32(binaryOp('-',
                binaryOp('<<', binaryOp('|', x, y), num32(1)),
                binaryOp('^', x, y)
            )),

            // Negated double-shift OR form: x + y = (x ^ y) - (~(x<<1) | ~(y<<1)) - 1
            // Uses identity: -2x - 1 = ~(2x) = ~(x<<1)
            (x, y) => toUint32(binaryOp('-',
                binaryOp('-',
                    binaryOp('^', x, y),
                    binaryOp('|',
                        unaryOp('~', binaryOp('<<', x, num32(1))),
                        unaryOp('~', binaryOp('<<', y, num32(1)))
                    )
                ),
                num32(1)
            ))
        ],
        
        '-': [
            (x, y) => toUint32(binaryOp('-',
                binaryOp('^', x, y),
                binaryOp('<<', binaryOp('&', unaryOp('~', x), y), num32(1))
            )),
            
            (x, y) => toUint32(binaryOp('-',
                binaryOp('&', x, unaryOp('~', y)),
                binaryOp('&', unaryOp('~', x), y)
            )),
            
            (x, y) => toUint32(binaryOp('-',
                binaryOp('-', binaryOp('|', x, y), y),
                binaryOp('&', unaryOp('~', x), y)
            ))
        ],
        
        '^': [
            (x, y) => toUint32(binaryOp('-', 
                binaryOp('|', x, y), 
                binaryOp('&', x, y)
            )),
            
            (x, y) => toUint32(binaryOp('-',
                binaryOp('+', x, y),
                binaryOp('<<', binaryOp('&', x, y), num32(1))
            )),
            
            (x, y) => toUint32(binaryOp('&',
                binaryOp('|', x, y),
                unaryOp('~', binaryOp('&', x, y))
            ))
        ],
        
        '&': [
  
            (x, y) => toUint32(binaryOp('-',
                binaryOp('|', unaryOp('~', x), y),
                unaryOp('~', x)
            )),
            
            (x, y) => toUint32(unaryOp('~',
                binaryOp('|', unaryOp('~', x), unaryOp('~', y))
            )),
            
            (x, y) => {
                const xor_xy = binaryOp('^', x, y);
                return toUint32(binaryOp('^',
                    binaryOp('^', xor_xy, x),
                    binaryOp('^', xor_xy, y)
                ));
            }
        ],
        
        '|': [
            (x, y) => toUint32(binaryOp('+',
                binaryOp('&', x, unaryOp('~', y)),
                y
            )),
            
            (x, y) => toUint32(binaryOp('-',
                binaryOp('+', x, y),
                binaryOp('&', x, y)
            )),
            
            (x, y) => toUint32(unaryOp('~',
                binaryOp('&', unaryOp('~', x), unaryOp('~', y))
            ))
        ],
        
        '*': [
            (x, y) => {
                if (!t.isNumericLiteral(y)) {
                    return toUint32(binaryOp('*', x, y));
                }
                
                const value = y.value & 0xFFFFFFFF;
                
                if ((value & (value - 1)) === 0 && value > 0) {
                    const shift = Math.log2(value);
                    return toUint32(binaryOp('<<', x, num32(shift)));
                }
                
                switch (value) {
                    case 3: return toUint32(binaryOp('+', 
                        binaryOp('<<', x, num32(1)), x));
                    case 5: return toUint32(binaryOp('+', 
                        binaryOp('<<', x, num32(2)), x));
                    case 7: return toUint32(binaryOp('-', 
                        binaryOp('<<', x, num32(3)), x));
                    case 9: return toUint32(binaryOp('+', 
                        binaryOp('<<', x, num32(3)), x));
                    default: return toUint32(binaryOp('*', x, y));
                }
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

const MBA_TRANSFORMS_32 = {
    '+': (x, y) => getMBARewrite32('+', randomInt(0, 3))(x, y),
    '-': (x, y) => getMBARewrite32('-', randomInt(0, 2))(x, y),
    '^': (x, y) => getMBARewrite32('^', randomInt(0, 2))(x, y),
    '&': (x, y) => getMBARewrite32('&', randomInt(0, 2))(x, y),
    '|': (x, y) => getMBARewrite32('|', randomInt(0, 2))(x, y),
    '*': (x, y) => getMBARewrite32('*', 0)(x, y)
};

function applyNestedMBA32(expression, depth = 1) {
    if (depth <= 0) return expression;
    
    if (randomInt(1, 10) <= 3 && t.isBinaryExpression(expression)) {
        const operator = expression.operator;
        if (MBA_TRANSFORMS_32[operator]) {
            const rewritten = MBA_TRANSFORMS_32[operator](expression.left, expression.right);
            return applyNestedMBA32(rewritten, depth - 1);
        }
    }
    return expression;
}

module.exports = {
    MBA_TRANSFORMS_32,
    applyNestedMBA32
};