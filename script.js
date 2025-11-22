const canvas = document.getElementById('chess-board');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const menuDiv = document.getElementById('menu');
const gameAreaDiv = document.getElementById('game-area');

const WIDTH = 640;
const HEIGHT = 640;
const SQUARE_SIZE = WIDTH / 8;

const WHITE = '#f0d9b5';
const BLACK = '#b58863';
const HIGHLIGHT = 'rgba(186, 202, 68, 0.5)';
const VALID_MOVE = 'rgba(130, 151, 105, 0.5)';

const PIECE_VALUES = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 1000,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 1000
};

let images = {};
let game = null;
let aiMode = false;

// Load Images
const pieces = ['p', 'r', 'n', 'b', 'q', 'k'];
let imagesLoaded = 0;

function loadImages() {
    pieces.forEach(p => {
        // White pieces
        const wImg = new Image();
        wImg.src = `assets/w_${p}.png`;
        wImg.onload = () => {
            images[p.toUpperCase()] = wImg;
            checkAllImagesLoaded();
        };

        // Black pieces (using the same white images but we will filter them if possible, 
        // or for now just load the same images. 
        // WAIT, we copied the assets, so we should have the black pieces if they were generated?
        // Ah, in Python we generated black pieces programmatically.
        // In JS, we can't easily "darken" an image without drawing it to a temp canvas.
        // Let's try to load them if they exist, otherwise we might need a workaround.
        // The user's Python script SAVED them to assets/ so they SHOULD exist as files now.
        // Let's assume the Python script saved them as b_pawn.png etc.
        // Wait, the python script did: self.images[piece] = black_img (in memory).
        // It did NOT save them to disk.
        // I need to fix this. The assets folder only has w_*.png.
        // I will implement a helper to tint images in JS.

        const bImg = new Image();
        bImg.src = `assets/w_${p}.png`; // Load white image to be tinted
        bImg.onload = () => {
            // Create a tinted version
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = SQUARE_SIZE;
            tempCanvas.height = SQUARE_SIZE;
            const tCtx = tempCanvas.getContext('2d');

            // Draw original
            tCtx.drawImage(bImg, 0, 0, SQUARE_SIZE, SQUARE_SIZE);

            // Composite dark overlay
            tCtx.globalCompositeOperation = 'source-atop';
            tCtx.fillStyle = 'rgba(50, 50, 50, 0.8)';
            tCtx.fillRect(0, 0, SQUARE_SIZE, SQUARE_SIZE);

            // Reset composite
            tCtx.globalCompositeOperation = 'source-over';

            const tintedImg = new Image();
            tintedImg.src = tempCanvas.toDataURL();
            images[p] = tintedImg;
            checkAllImagesLoaded();
        };
    });
}

function checkAllImagesLoaded() {
    imagesLoaded++;
    if (imagesLoaded >= 12) {
        console.log("All images loaded");
    }
}

class Move {
    constructor(startRow, startCol, endRow, endCol, board) {
        this.startRow = startRow;
        this.startCol = startCol;
        this.endRow = endRow;
        this.endCol = endCol;
        this.pieceMoved = board[startRow][startCol];
        this.pieceCaptured = board[endRow][endCol];
        this.moveId = startRow * 1000 + startCol * 100 + endRow * 10 + endCol;
    }
}

class GameState {
    constructor() {
        this.board = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
        this.whiteToMove = true;
        this.moveLog = [];
        this.whiteKingLocation = [7, 4];
        this.blackKingLocation = [0, 4];
        this.checkmate = false;
        this.stalemate = false;
    }

    makeMove(move) {
        this.board[move.startRow][move.startCol] = null;
        this.board[move.endRow][move.endCol] = move.pieceMoved;
        this.moveLog.push(move);
        this.whiteToMove = !this.whiteToMove;

        if (move.pieceMoved === 'K') this.whiteKingLocation = [move.endRow, move.endCol];
        else if (move.pieceMoved === 'k') this.blackKingLocation = [move.endRow, move.endCol];
    }

    undoMove() {
        if (this.moveLog.length === 0) return;
        const move = this.moveLog.pop();
        this.board[move.startRow][move.startCol] = move.pieceMoved;
        this.board[move.endRow][move.endCol] = move.pieceCaptured;
        this.whiteToMove = !this.whiteToMove;

        if (move.pieceMoved === 'K') this.whiteKingLocation = [move.startRow, move.startCol];
        else if (move.pieceMoved === 'k') this.blackKingLocation = [move.startRow, move.startCol];

        this.checkmate = false;
        this.stalemate = false;
    }

    getValidMoves() {
        let moves = this.getAllPossibleMoves();
        for (let i = moves.length - 1; i >= 0; i--) {
            this.makeMove(moves[i]);
            this.whiteToMove = !this.whiteToMove;
            if (this.inCheck()) {
                moves.splice(i, 1);
            }
            this.whiteToMove = !this.whiteToMove;
            this.undoMove();
        }

        if (moves.length === 0) {
            if (this.inCheck()) this.checkmate = true;
            else this.stalemate = true;
        } else {
            this.checkmate = false;
            this.stalemate = false;
        }
        return moves;
    }

    inCheck() {
        if (this.whiteToMove) return this.squareUnderAttack(this.whiteKingLocation[0], this.whiteKingLocation[1]);
        else return this.squareUnderAttack(this.blackKingLocation[0], this.blackKingLocation[1]);
    }

    squareUnderAttack(r, c) {
        this.whiteToMove = !this.whiteToMove;
        const oppMoves = this.getAllPossibleMoves();
        this.whiteToMove = !this.whiteToMove;
        for (const move of oppMoves) {
            if (move.endRow === r && move.endCol === c) return true;
        }
        return false;
    }

    getAllPossibleMoves() {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const turn = this.board[r][c];
                if (turn) {
                    if ((this.isUpper(turn) && this.whiteToMove) || (!this.isUpper(turn) && !this.whiteToMove)) {
                        const piece = turn.toLowerCase();
                        if (piece === 'p') this.getPawnMoves(r, c, moves);
                        else if (piece === 'r') this.getRookMoves(r, c, moves);
                        else if (piece === 'n') this.getKnightMoves(r, c, moves);
                        else if (piece === 'b') this.getBishopMoves(r, c, moves);
                        else if (piece === 'q') this.getQueenMoves(r, c, moves);
                        else if (piece === 'k') this.getKingMoves(r, c, moves);
                    }
                }
            }
        }
        return moves;
    }

    isUpper(char) {
        return char === char.toUpperCase();
    }

    isLower(char) {
        return char === char.toLowerCase();
    }

    getPawnMoves(r, c, moves) {
        if (this.whiteToMove) {
            if (r - 1 >= 0 && this.board[r - 1][c] === null) {
                moves.push(new Move(r, c, r - 1, c, this.board));
                if (r === 6 && this.board[r - 2][c] === null) {
                    moves.push(new Move(r, c, r - 2, c, this.board));
                }
            }
            if (c - 1 >= 0 && r - 1 >= 0 && this.board[r - 1][c - 1] && this.isLower(this.board[r - 1][c - 1])) {
                moves.push(new Move(r, c, r - 1, c - 1, this.board));
            }
            if (c + 1 <= 7 && r - 1 >= 0 && this.board[r - 1][c + 1] && this.isLower(this.board[r - 1][c + 1])) {
                moves.push(new Move(r, c, r - 1, c + 1, this.board));
            }
        } else {
            if (r + 1 <= 7 && this.board[r + 1][c] === null) {
                moves.push(new Move(r, c, r + 1, c, this.board));
                if (r === 1 && this.board[r + 2][c] === null) {
                    moves.push(new Move(r, c, r + 2, c, this.board));
                }
            }
            if (c - 1 >= 0 && r + 1 <= 7 && this.board[r + 1][c - 1] && this.isUpper(this.board[r + 1][c - 1])) {
                moves.push(new Move(r, c, r + 1, c - 1, this.board));
            }
            if (c + 1 <= 7 && r + 1 <= 7 && this.board[r + 1][c + 1] && this.isUpper(this.board[r + 1][c + 1])) {
                moves.push(new Move(r, c, r + 1, c + 1, this.board));
            }
        }
    }

    getRookMoves(r, c, moves) {
        const directions = [[-1, 0], [0, -1], [1, 0], [0, 1]];
        for (const d of directions) {
            for (let i = 1; i < 8; i++) {
                const endRow = r + d[0] * i;
                const endCol = c + d[1] * i;
                if (endRow >= 0 && endRow < 8 && endCol >= 0 && endCol < 8) {
                    const endPiece = this.board[endRow][endCol];
                    if (endPiece === null) {
                        moves.push(new Move(r, c, endRow, endCol, this.board));
                    } else if ((this.whiteToMove && this.isLower(endPiece)) || (!this.whiteToMove && this.isUpper(endPiece))) {
                        moves.push(new Move(r, c, endRow, endCol, this.board));
                        break;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }

    getKnightMoves(r, c, moves) {
        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const m of knightMoves) {
            const endRow = r + m[0];
            const endCol = c + m[1];
            if (endRow >= 0 && endRow < 8 && endCol >= 0 && endCol < 8) {
                const endPiece = this.board[endRow][endCol];
                if (endPiece === null || (this.whiteToMove && this.isLower(endPiece)) || (!this.whiteToMove && this.isUpper(endPiece))) {
                    moves.push(new Move(r, c, endRow, endCol, this.board));
                }
            }
        }
    }

    getBishopMoves(r, c, moves) {
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const d of directions) {
            for (let i = 1; i < 8; i++) {
                const endRow = r + d[0] * i;
                const endCol = c + d[1] * i;
                if (endRow >= 0 && endRow < 8 && endCol >= 0 && endCol < 8) {
                    const endPiece = this.board[endRow][endCol];
                    if (endPiece === null) {
                        moves.push(new Move(r, c, endRow, endCol, this.board));
                    } else if ((this.whiteToMove && this.isLower(endPiece)) || (!this.whiteToMove && this.isUpper(endPiece))) {
                        moves.push(new Move(r, c, endRow, endCol, this.board));
                        break;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }

    getQueenMoves(r, c, moves) {
        this.getRookMoves(r, c, moves);
        this.getBishopMoves(r, c, moves);
    }

    getKingMoves(r, c, moves) {
        const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const m of kingMoves) {
            const endRow = r + m[0];
            const endCol = c + m[1];
            if (endRow >= 0 && endRow < 8 && endCol >= 0 && endCol < 8) {
                const endPiece = this.board[endRow][endCol];
                if (endPiece === null || (this.whiteToMove && this.isLower(endPiece)) || (!this.whiteToMove && this.isUpper(endPiece))) {
                    moves.push(new Move(r, c, endRow, endCol, this.board));
                }
            }
        }
    }
}

class AI {
    static findBestMove(gs, validMoves) {
        // Shuffle moves
        for (let i = validMoves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validMoves[i], validMoves[j]] = [validMoves[j], validMoves[i]];
        }

        let nextMove = null;
        this.minimax(gs, validMoves, 2, gs.whiteToMove, -100000, 100000, (move) => {
            nextMove = move;
        });
        return nextMove;
    }

    static minimax(gs, validMoves, depth, whiteToMove, alpha, beta, callback) {
        if (depth === 0) return this.scoreBoard(gs);

        if (whiteToMove) {
            let maxScore = -100000;
            for (const move of validMoves) {
                gs.makeMove(move);
                const nextMoves = gs.getValidMoves();
                const score = this.minimax(gs, nextMoves, depth - 1, false, alpha, beta);
                gs.undoMove();
                if (score > maxScore) {
                    maxScore = score;
                    if (depth === 2 && callback) callback(move);
                }
                alpha = Math.max(alpha, maxScore);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = 100000;
            for (const move of validMoves) {
                gs.makeMove(move);
                const nextMoves = gs.getValidMoves();
                const score = this.minimax(gs, nextMoves, depth - 1, true, alpha, beta);
                gs.undoMove();
                if (score < minScore) {
                    minScore = score;
                    if (depth === 2 && callback) callback(move);
                }
                beta = Math.min(beta, minScore);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    static scoreBoard(gs) {
        if (gs.checkmate) return gs.whiteToMove ? -100000 : 100000;
        if (gs.stalemate) return 0;

        let score = 0;
        for (const row of gs.board) {
            for (const square of row) {
                if (square) {
                    if (gs.isUpper(square)) score += PIECE_VALUES[square];
                    else score -= PIECE_VALUES[square];
                }
            }
        }
        return score;
    }
}

// UI Logic
let selectedSquare = null;
let validMoves = [];

function initGame() {
    loadImages();
    document.getElementById('btn-ai').addEventListener('click', () => startGame(true));
    document.getElementById('btn-offline').addEventListener('click', () => startGame(false));
    document.getElementById('btn-menu').addEventListener('click', showMenu);

    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        handleInput(e.touches[0]);
    }, { passive: false });
}

function startGame(isAi) {
    aiMode = isAi;
    game = new GameState();
    validMoves = game.getValidMoves();
    selectedSquare = null;

    menuDiv.style.display = 'none';
    gameAreaDiv.style.display = 'block';

    gameLoop();
}

function showMenu() {
    gameAreaDiv.style.display = 'none';
    menuDiv.style.display = 'block';
    game = null;
}

function handleInput(e) {
    if (!game) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / SQUARE_SIZE);
    const row = Math.floor(y / SQUARE_SIZE);

    if (row < 0 || row > 7 || col < 0 || col > 7) return;

    // Human turn?
    const humanTurn = (game.whiteToMove) || (!game.whiteToMove && !aiMode);

    if (!humanTurn) return;

    if (selectedSquare) {
        const move = new Move(selectedSquare[0], selectedSquare[1], row, col, game.board);
        let moveFound = false;
        for (const m of validMoves) {
            if (m.moveId === move.moveId) {
                game.makeMove(m);
                moveFound = true;
                selectedSquare = null;
                validMoves = game.getValidMoves();

                // Check game over
                checkGameOver();

                // AI Turn
                if (aiMode && !game.checkmate && !game.stalemate) {
                    setTimeout(makeAiMove, 100);
                }
                break;
            }
        }

        if (!moveFound) {
            // Deselect or select new piece
            const piece = game.board[row][col];
            if (piece && ((game.whiteToMove && game.isUpper(piece)) || (!game.whiteToMove && game.isLower(piece)))) {
                selectedSquare = [row, col];
            } else {
                selectedSquare = null;
            }
        }
    } else {
        const piece = game.board[row][col];
        if (piece && ((game.whiteToMove && game.isUpper(piece)) || (!game.whiteToMove && game.isLower(piece)))) {
            selectedSquare = [row, col];
        }
    }

    draw();
}

function makeAiMove() {
    if (!game) return;
    const move = AI.findBestMove(game, validMoves);
    if (move) {
        game.makeMove(move);
        validMoves = game.getValidMoves();
        checkGameOver();
        draw();
    }
}

function checkGameOver() {
    if (game.checkmate) {
        statusDiv.innerText = game.whiteToMove ? "Black Wins!" : "White Wins!";
    } else if (game.stalemate) {
        statusDiv.innerText = "Stalemate!";
    } else {
        statusDiv.innerText = game.whiteToMove ? "White's Turn" : "Black's Turn";
    }
}

function draw() {
    if (!game) return;

    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw Board
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const color = (r + c) % 2 === 0 ? WHITE : BLACK;
            ctx.fillStyle = color;
            ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }
    }

    // Highlight Selected
    if (selectedSquare) {
        ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
        ctx.fillRect(selectedSquare[1] * SQUARE_SIZE, selectedSquare[0] * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);

        // Highlight Moves
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        for (const m of validMoves) {
            if (m.startRow === selectedSquare[0] && m.startCol === selectedSquare[1]) {
                ctx.fillRect(m.endCol * SQUARE_SIZE, m.endRow * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
        }
    }

    // Draw Pieces
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = game.board[r][c];
            if (piece) {
                if (images[piece]) {
                    ctx.drawImage(images[piece], c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
                } else {
                    // Fallback text
                    ctx.fillStyle = game.isUpper(piece) ? 'white' : 'black';
                    ctx.font = '40px Arial';
                    ctx.fillText(piece, c * SQUARE_SIZE + 20, r * SQUARE_SIZE + 50);
                }
            }
        }
    }
}

function gameLoop() {
    if (game) {
        draw();
        requestAnimationFrame(gameLoop);
    }
}

initGame();
