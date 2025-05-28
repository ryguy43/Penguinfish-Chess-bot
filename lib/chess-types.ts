export type Color = "white" | "black"
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn"

export interface Piece {
  type: PieceType
  color: Color
}

export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
  piece: Piece
  capturedPiece?: Piece | null
  isEnPassant?: boolean
  isCastling?: boolean
  promotionPiece?: PieceType
}

export interface GameState {
  board: (Piece | null)[][]
  turn: Color
  lastMove: Move | null
  castlingRights: {
    whiteKingSide: boolean
    whiteQueenSide: boolean
    blackKingSide: boolean
    blackQueenSide: boolean
  }
  enPassantTarget: Position | null
  halfMoveClock: number
  fullMoveNumber: number
}
