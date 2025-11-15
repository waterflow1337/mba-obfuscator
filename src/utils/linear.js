const { strict: assert } = require('assert');

function solveInvertibleLinearSystemMod2(matrixInput, vectorInput) {
    const n = matrixInput.length;
    assert(n === vectorInput.length, 'Matrix and vector size mismatch');
    
    if (n === 0) {
        return [];
    }
    
    const matrix = matrixInput.map(row => row.slice());
    const vector = vectorInput.slice();
    
    for (let col = 0; col < n; col++) {
        let pivot = col;
        while (pivot < n && matrix[pivot][col] === 0) {
            pivot++;
        }
        if (pivot === n) {
            throw new Error('Matrix is singular modulo 2');
        }
        
        if (pivot !== col) {
            [matrix[pivot], matrix[col]] = [matrix[col], matrix[pivot]];
            const tmp = vector[pivot];
            vector[pivot] = vector[col];
            vector[col] = tmp;
        }
        
        for (let row = 0; row < n; row++) {
            if (row !== col && matrix[row][col] === 1) {
                for (let k = col; k < n; k++) {
                    matrix[row][k] ^= matrix[col][k];
                }
                vector[row] ^= vector[col];
            }
        }
    }
    
    return vector.map(v => v & 1);
}

function solveLinearSystemModPowerOfTwo(matrix, vector, width, matrixMod2 = null) {
    const n = matrix.length;
    if (n === 0) {
        return [];
    }
    
    if (!matrixMod2) {
        matrixMod2 = matrix.map(row => row.map(val => Number(val & 1n)));
    }
    let rhsMod2 = vector.map(val => Number(val & 1n));
    
    let solutionMod2;
    try {
        solutionMod2 = solveInvertibleLinearSystemMod2(matrixMod2, rhsMod2);
    } catch (error) {
        return null;
    }
    
    let solution = solutionMod2.map(v => BigInt(v));
    let currentMod = 2n;
    const targetMod = width >= 0 ? (1n << BigInt(width)) : 0n;
    if (targetMod === 0n) {
        return solution;
    }
    
    while (currentMod < targetMod) {
        const nextMod = currentMod * 2n > targetMod ? targetMod : currentMod * 2n;
        const residual = new Array(n).fill(0);
        
        for (let i = 0; i < n; i++) {
            let total = 0n;
            for (let j = 0; j < n; j++) {
                total = (total + matrix[i][j] * solution[j]) % nextMod;
            }
            let diff = (vector[i] - total) % nextMod;
            if (diff < 0n) diff += nextMod;
            const scaled = diff / currentMod;
            residual[i] = Number(scaled & 1n);
        }
        
        let delta;
        try {
            delta = solveInvertibleLinearSystemMod2(matrixMod2, residual);
        } catch (error) {
            return null;
        }
        
        for (let k = 0; k < n; k++) {
            solution[k] = (solution[k] + BigInt(delta[k]) * currentMod) % nextMod;
        }
        
        currentMod = nextMod;
    }
    
    return solution;
}

module.exports = {
    solveLinearSystemModPowerOfTwo
};
