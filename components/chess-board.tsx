"use client"

import type { Piece, Position } from "@/lib/chess-types"

interface ChessBoardProps {
  board: (Piece | null)[][]
  lastMove?: { from: Position; to: Position } | null
  inCheck?: boolean
  kingPosition?: Position | null
  selectedPiece?: Position | null
  validMoves?: Position[]
  onSquareClick?: (position: Position) => void
}

export function ChessBoard({
  board,
  lastMove,
  inCheck,
  kingPosition,
  selectedPiece,
  validMoves = [],
  onSquareClick,
}: ChessBoardProps) {
  const pieceSymbols: Record<string, string> = {
    "white-king": "♔",
    "white-queen": "♕",
    "white-rook": "♖",
    "white-bishop": "♗",
    "white-knight": "♘",
    "white-pawn": "♙",
    "black-king": "♚",
    "black-queen": "♛",
    "black-rook": "♜",
    "black-bishop": "♝",
    "black-knight": "♞",
    "black-pawn": "♟",
  }

  const isHighlighted = (row: number, col: number) => {
    if (!lastMove) return false
    return (
      (lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col)
    )
  }

  const isKingInCheck = (row: number, col: number) => {
    return inCheck && kingPosition && kingPosition.row === row && kingPosition.col === col
  }

  const isSelected = (row: number, col: number) => {
    return selectedPiece && selectedPiece.row === row && selectedPiece.col === col
  }

  const isValidMove = (row: number, col: number) => {
    return validMoves.some((move) => move.row === row && move.col === col)
  }

  const handleSquareClick = (row: number, col: number) => {
    if (onSquareClick) {
      onSquareClick({ row, col })
    }
  }

  return (
    <div className="inline-block border-4 border-slate-600 rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-amber-50 to-amber-100">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {row.map((piece, colIndex) => {
            const isLight = (rowIndex + colIndex) % 2 === 0
            const highlighted = isHighlighted(rowIndex, colIndex)
            const selected = isSelected(rowIndex, colIndex)
            const validMove = isValidMove(rowIndex, colIndex)
            const kingCheck = isKingInCheck(rowIndex, colIndex)

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`
                  w-16 h-16 flex items-center justify-center text-4xl font-bold relative cursor-pointer
                  transition-all duration-200 transform hover:scale-105
                  ${
                    isLight
                      ? "bg-gradient-to-br from-amber-100 to-amber-200"
                      : "bg-gradient-to-br from-amber-700 to-amber-800"
                  }
                  ${highlighted ? "ring-4 ring-blue-400 ring-opacity-70 shadow-lg" : ""}
                  ${selected ? "bg-gradient-to-br from-green-300 to-green-400 shadow-lg" : ""}
                  ${kingCheck ? "bg-gradient-to-br from-red-400 to-red-500 animate-pulse" : ""}
                  hover:brightness-110 hover:shadow-md
                `}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
              >
                {/* Piece rendering with shadow */}
                {piece && (
                  <span
                    className="select-none z-10 drop-shadow-lg transition-transform duration-200 hover:scale-110"
                    style={{
                      filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                    }}
                  >
                    {pieceSymbols[`${piece.color}-${piece.type}`]}
                  </span>
                )}

                {/* Valid move indicators with animations */}
                {validMove && (
                  <div
                    className={`absolute transition-all duration-300 ${
                      piece
                        ? "w-14 h-14 border-4 border-green-500 rounded-full animate-pulse"
                        : "w-6 h-6 bg-green-500 rounded-full opacity-80 animate-bounce"
                    }`}
                  />
                )}

                {/* Coordinate labels with better styling */}
                {colIndex === 0 && (
                  <span className="absolute top-1 left-1 text-xs font-bold opacity-70 text-slate-700 bg-white/50 rounded px-1">
                    {8 - rowIndex}
                  </span>
                )}
                {rowIndex === 7 && (
                  <span className="absolute bottom-1 right-1 text-xs font-bold opacity-70 text-slate-700 bg-white/50 rounded px-1">
                    {String.fromCharCode(97 + colIndex)}
                  </span>
                )}

                {/* Subtle gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 pointer-events-none" />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
