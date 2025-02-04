# /// script
# dependencies = [
#   "python-chess>=1.999",
#   "cairosvg>=2.5.2",
#   "requests"
# ]
# ///
import chess
import chess.svg
import cairosvg
import os
from typing import Dict, Any, Optional, List
from shinkai_local_support import get_home_path

class CONFIG:
    pass

class INPUTS:
    fen: str
    last_move_uci: Optional[str] = None  # highlight the last move, optional
    output_filename: str = "chess_position.png"  # allow customizing the output filename

class OUTPUT:
    image_path: str

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    if not p.fen:
        raise ValueError("No FEN provided")

    board = chess.Board()
    try:
        board.set_fen(p.fen)
    except ValueError:
        raise ValueError("Invalid FEN")

    # Optionally highlight the last move
    arrows = []
    if p.last_move_uci and len(p.last_move_uci) in (4,5):
        try:
            move = board.parse_uci(p.last_move_uci)
            arrows.append(chess.svg.Arrow(start=move.from_square, end=move.to_square, color="#FF0000"))
        except:
            pass

    svg_data = chess.svg.board(board, arrows=arrows)
    png_data = cairosvg.svg2png(bytestring=svg_data.encode("utf-8"))

    # Get home path and create output path
    home_path = await get_home_path()
    filename = p.output_filename
    file_path = os.path.join(home_path, filename)
    
    # Write the PNG data to file
    with open(file_path, "wb") as f:
        f.write(png_data)

    out = OUTPUT()
    out.image_path = file_path
    return out 