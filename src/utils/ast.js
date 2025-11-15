const t = require('@babel/types');

function cloneNode(node) {
    return t.cloneNode(node, true);
}

function wrap(expression) {
    return t.parenthesizedExpression(cloneNode(expression));
}

function num32(value) {
    return t.numericLiteral(value >>> 0);
}

function bigIntLiteral(value) {
    return t.bigIntLiteral(String(value));
}

function bigIntFromValue(value) {
    return t.bigIntLiteral(String(value));
}

function asUint64Expr(expression) {
    return t.callExpression(
        t.memberExpression(t.identifier('BigInt'), t.identifier('asUintN')),
        [t.numericLiteral(64), wrap(expression)]
    );
}

function toBigInt64(expression) {
    return asUint64Expr(
        t.callExpression(t.identifier('BigInt'), [wrap(expression)])
    );
}

function toUint32(expression) {
    return t.binaryExpression('>>>', wrap(expression), t.numericLiteral(0));
}

function imul32(value, expression) {
    return t.callExpression(
        t.memberExpression(t.identifier('Math'), t.identifier('imul')),
        [num32(value >>> 0), wrap(expression)]
    );
}

function binaryOp(operator, left, right) {
    return t.binaryExpression(operator, wrap(left), wrap(right));
}

function unaryOp(operator, operand) {
    return t.unaryExpression(operator, wrap(operand));
}

function conditional(test, consequent, alternate) {
    return t.conditionalExpression(wrap(test), wrap(consequent), wrap(alternate));
}

function variableDeclaration(kind, name, init) {
    return t.variableDeclaration(kind, [
        t.variableDeclarator(t.identifier(name), init)
    ]);
}

function createIIFE(statements, returnExpr) {
    return t.callExpression(
        t.arrowFunctionExpression([], t.blockStatement([
            ...statements,
            t.returnStatement(returnExpr)
        ])),
        []
    );
}

function isNumericLiteralWithValue(node, value) {
    return t.isNumericLiteral(node) && node.value === value;
}

function infersBigInt(node, cache = new Map()) {
    if (!node) return false;
    if (cache.has(node)) return cache.get(node);
    
    let result = false;
    
    if (t.isBigIntLiteral(node)) {
        result = true;
    } else if (t.isCallExpression(node)) {
        const callee = node.callee;
        if (t.isMemberExpression(callee) && 
            t.isIdentifier(callee.object, { name: 'BigInt' }) && 
            t.isIdentifier(callee.property, { name: 'asUintN' })) {
            result = true;
        } else {
            result = node.arguments.some(arg => infersBigInt(arg, cache));
        }
    } else if (t.isBinaryExpression(node)) {
        const operatorSet = new Set(['+', '-', '^', '&', '|', '<<', '>>', '*']);
        if (operatorSet.has(node.operator)) {
            result = infersBigInt(node.left, cache) || infersBigInt(node.right, cache);
            
            if (!result && t.isNumericLiteral(node.left) && node.left.value >= 0x100000000) {
                result = true;
            }
            if (!result && t.isNumericLiteral(node.right) && node.right.value >= 0x100000000) {
                result = true;
            }
        }
    } else if (t.isNumericLiteral(node)) {
        result = node.value >= 0x100000000;
    } else if (t.isConditionalExpression(node)) {
        result = infersBigInt(node.test, cache) || 
                 infersBigInt(node.consequent, cache) || 
                 infersBigInt(node.alternate, cache);
    }
    
    cache.set(node, result);
    return result;
}

module.exports = {
    wrap,
    num32,
    bigIntLiteral,
    bigIntFromValue,
    asUint64Expr,
    toBigInt64,
    toUint32,
    imul32,
    binaryOp,
    unaryOp,
    conditional,
    variableDeclaration,
    createIIFE,
    isNumericLiteralWithValue,
    infersBigInt
};
