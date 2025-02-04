# /// script
# dependencies = [
#   "python-chess>=1.999",
#   "requests"
# ]
# ///

import chess
from typing import Dict, Any, Optional, List

class CONFIG:
    pass

class INPUTS:
    fen: str
    depth: int = 15
    time_limit_ms: int = 1000  # fallback if depth is small

class OUTPUT:
    message: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    if not p.fen:
        raise ValueError("No FEN provided")
    # Validate FEN
    board = chess.Board()
    try:
        board.set_fen(p.fen)
    except ValueError:
        raise ValueError("Invalid FEN")

    # Basic evaluation based on material count and position
    def evaluate_position(board: chess.Board) -> float:
        # Material values
        piece_values = {
            chess.PAWN: 1,
            chess.KNIGHT: 3,
            chess.BISHOP: 3,
            chess.ROOK: 5,
            chess.QUEEN: 9,
            chess.KING: 0  # Not counted in material
        }
        
        score = 0
        
        # Count material
        for piece_type in piece_values:
            score += len(board.pieces(piece_type, chess.WHITE)) * piece_values[piece_type]
            score -= len(board.pieces(piece_type, chess.BLACK)) * piece_values[piece_type]
        
        # Position evaluation bonuses
        if board.is_checkmate():
            if board.turn == chess.WHITE:
                score = -1000  # Black wins
            else:
                score = 1000  # White wins
        elif board.is_stalemate() or board.is_insufficient_material():
            score = 0
        
        # Convert to centipawns
        score = score * 100
        
        return score

    # Get evaluation
    score = evaluate_position(board)
    
    # Format message
    if abs(score) >= 1000:
        if score > 0:
            message = "Mate for White"
        else:
            message = "Mate for Black"
    else:
        message = f"Evaluation: {int(score)} centipawns (White-positive)"

    out = OUTPUT()
    out.message = message
    return out 