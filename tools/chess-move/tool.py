# /// script
# dependencies = [
#   "python-chess>=1.999"
# ]
# ///
import chess
from typing import Dict, Any, Optional, List

class CONFIG:
    pass

class INPUTS:
    fen: str
    move_uci: str

class OUTPUT:
    new_fen: str
    is_legal: bool

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    if not p.fen:
        raise ValueError("No FEN provided")
    if not p.move_uci:
        raise ValueError("No UCI move provided")

    board = chess.Board()
    try:
        board.set_fen(p.fen)
    except ValueError:
        raise ValueError("Invalid FEN")

    # Validate the move format, e.g. "e2e4", "e7e8q"
    if len(p.move_uci) < 4 or len(p.move_uci) > 5:
        raise ValueError(f"Move '{p.move_uci}' not in typical UCI format")

    move = None
    try:
        move = board.parse_uci(p.move_uci)
    except:
        pass

    result = OUTPUT()
    if move and move in board.legal_moves:
        board.push(move)
        result.is_legal = True
        result.new_fen = board.fen()
    else:
        result.is_legal = False
        result.new_fen = board.fen()  # unchanged

    return result 