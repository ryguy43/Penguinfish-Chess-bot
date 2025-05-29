import type { Color, Piece, Position, Move, GameState } from "./chess-types"

export class ChessEngine {
  private gameState: GameState

  constructor() {
    this.gameState = this.getInitialGameState()
  }

  private getInitialGameState(): GameState {
    const board: (Piece | null)[][] = [
      [
        { type: "rook", color: "black" },
        { type: "knight", color: "black" },
        { type: "bishop", color: "black" },
        { type: "queen", color: "black" },
        { type: "king", color: "black" },
        { type: "bishop", color: "black" },
        { type: "knight", color: "black" },
        { type: "rook", color: "black" },
      ],
      Array(8)
        .fill(null)
        .map(() => ({ type: "pawn", color: "black" }) as Piece),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8)
        .fill(null)
        .map(() => ({ type: "pawn", color: "white" }) as Piece),
      [
        { type: "rook", color: "white" },
        { type: "knight", color: "white" },
        { type: "bishop", color: "white" },
        { type: "queen", color: "white" },
        { type: "king", color: "white" },
        { type: "bishop", color: "white" },
        { type: "knight", color: "white" },
        { type: "rook", color: "white" },
      ],
    ]

    return {
      board,
      turn: "white",
      lastMove: null,
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true,
      },
      enPassantTarget: null,
      halfMoveClock: 0,
      fullMoveNumber: 1,
    }
  }

  getGameState(): GameState {
    return JSON.parse(JSON.stringify(this.gameState))
  }

  reset(): void {
    this.gameState = this.getInitialGameState()
  }

  copyState(): GameState {
    return JSON.parse(JSON.stringify(this.gameState))
  }

  setState(state: GameState): void {
    this.gameState = JSON.parse(JSON.stringify(state))
  }

  isValidPosition(pos: Position): boolean {
    return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8
  }

  getPiece(pos: Position): Piece | null {
    if (!this.isValidPosition(pos)) return null
    return this.gameState.board[pos.row][pos.col]
  }

  setPiece(pos: Position, piece: Piece | null): void {
    if (this.isValidPosition(pos)) {
      this.gameState.board[pos.row][pos.col] = piece
    }
  }

  generateMoves(color?: Color): Move[] {
    const moves: Move[] = []
    const currentColor = color || this.gameState.turn

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col]
        if (piece && piece.color === currentColor) {
          const pieceMoves = this.generatePieceMoves({ row, col }, piece)
          moves.push(...pieceMoves)
        }
      }
    }

    return moves.filter((move) => this.isLegalMove(move))
  }

  generateMovesForPiece(position: Position): Move[] {
    const piece = this.getPiece(position)
    if (!piece || piece.color !== this.gameState.turn) return []

    const moves = this.generatePieceMoves(position, piece)
    return moves.filter((move) => this.isLegalMove(move))
  }

  private generatePieceMoves(from: Position, piece: Piece): Move[] {
    switch (piece.type) {
      case "pawn":
        return this.generatePawnMoves(from, piece)
      case "rook":
        return this.generateRookMoves(from, piece)
      case "knight":
        return this.generateKnightMoves(from, piece)
      case "bishop":
        return this.generateBishopMoves(from, piece)
      case "queen":
        return this.generateQueenMoves(from, piece)
      case "king":
        return this.generateKingMoves(from, piece)
      default:
        return []
    }
  }

  // Separate method for attack generation (no castling to avoid recursion)
  private generateAttackMoves(from: Position, piece: Piece): Move[] {
    switch (piece.type) {
      case "pawn":
        return this.generatePawnAttacks(from, piece)
      case "rook":
        return this.generateRookMoves(from, piece)
      case "knight":
        return this.generateKnightMoves(from, piece)
      case "bishop":
        return this.generateBishopMoves(from, piece)
      case "queen":
        return this.generateQueenMoves(from, piece)
      case "king":
        return this.generateKingAttacks(from, piece)
      default:
        return []
    }
  }

  private generatePawnMoves(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const direction = piece.color === "white" ? -1 : 1
    const startRow = piece.color === "white" ? 6 : 1
    const promotionRow = piece.color === "white" ? 0 : 7

    // Forward move
    const oneStep = { row: from.row + direction, col: from.col }
    if (this.isValidPosition(oneStep) && !this.getPiece(oneStep)) {
      if (oneStep.row === promotionRow) {
        for (const promotionPiece of ["queen", "rook", "bishop", "knight"] as const) {
          moves.push({
            from,
            to: oneStep,
            piece,
            promotionPiece,
          })
        }
      } else {
        moves.push({ from, to: oneStep, piece })
      }

      // Two steps from starting position
      if (from.row === startRow) {
        const twoSteps = { row: from.row + 2 * direction, col: from.col }
        if (this.isValidPosition(twoSteps) && !this.getPiece(twoSteps)) {
          moves.push({
            from,
            to: twoSteps,
            piece,
            enPassantTarget: oneStep,
          })
        }
      }
    }

    // Captures
    for (const colOffset of [-1, 1]) {
      const capturePos = { row: from.row + direction, col: from.col + colOffset }
      if (this.isValidPosition(capturePos)) {
        const target = this.getPiece(capturePos)

        if (target && target.color !== piece.color) {
          if (capturePos.row === promotionRow) {
            for (const promotionPiece of ["queen", "rook", "bishop", "knight"] as const) {
              moves.push({
                from,
                to: capturePos,
                piece,
                capturedPiece: target,
                promotionPiece,
              })
            }
          } else {
            moves.push({ from, to: capturePos, piece, capturedPiece: target })
          }
        }

        // En passant capture
        const enPassantTarget = this.gameState.enPassantTarget
        if (enPassantTarget && capturePos.row === enPassantTarget.row && capturePos.col === enPassantTarget.col) {
          const capturedPawnPos = {
            row: capturePos.row - direction,
            col: capturePos.col,
          }
          const capturedPawn = this.getPiece(capturedPawnPos)
          if (capturedPawn && capturedPawn.type === "pawn" && capturedPawn.color !== piece.color) {
            moves.push({
              from,
              to: capturePos,
              piece,
              capturedPiece: capturedPawn,
              isEnPassant: true,
            })
          }
        }
      }
    }

    return moves
  }

  // Pawn attacks only (for attack detection)
  private generatePawnAttacks(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const direction = piece.color === "white" ? -1 : 1

    for (const colOffset of [-1, 1]) {
      const capturePos = { row: from.row + direction, col: from.col + colOffset }
      if (this.isValidPosition(capturePos)) {
        moves.push({ from, to: capturePos, piece })
      }
    }

    return moves
  }

  private generateRookMoves(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]

    for (const [rowDir, colDir] of directions) {
      for (let i = 1; i < 8; i++) {
        const to = { row: from.row + i * rowDir, col: from.col + i * colDir }
        if (!this.isValidPosition(to)) break

        const target = this.getPiece(to)
        if (!target) {
          moves.push({ from, to, piece })
        } else {
          if (target.color !== piece.color) {
            moves.push({ from, to, piece, capturedPiece: target })
          }
          break
        }
      }
    }

    return moves
  }

  private generateKnightMoves(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const knightMoves = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]

    for (const [rowOffset, colOffset] of knightMoves) {
      const to = { row: from.row + rowOffset, col: from.col + colOffset }
      if (this.isValidPosition(to)) {
        const target = this.getPiece(to)
        if (!target || target.color !== piece.color) {
          moves.push({ from, to, piece, capturedPiece: target })
        }
      }
    }

    return moves
  }

  private generateBishopMoves(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const directions = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]

    for (const [rowDir, colDir] of directions) {
      for (let i = 1; i < 8; i++) {
        const to = { row: from.row + i * rowDir, col: from.col + i * colDir }
        if (!this.isValidPosition(to)) break

        const target = this.getPiece(to)
        if (!target) {
          moves.push({ from, to, piece })
        } else {
          if (target.color !== piece.color) {
            moves.push({ from, to, piece, capturedPiece: target })
          }
          break
        }
      }
    }

    return moves
  }

  private generateQueenMoves(from: Position, piece: Piece): Move[] {
    return [...this.generateRookMoves(from, piece), ...this.generateBishopMoves(from, piece)]
  }

  private generateKingMoves(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]

    // Regular king moves
    for (const [rowOffset, colOffset] of directions) {
      const to = { row: from.row + rowOffset, col: from.col + colOffset }
      if (this.isValidPosition(to)) {
        const target = this.getPiece(to)
        if (!target || target.color !== piece.color) {
          moves.push({ from, to, piece, capturedPiece: target })
        }
      }
    }

    // Castling moves
    if (piece.color === "white") {
      // King-side castling
      if (this.gameState.castlingRights.whiteKingSide) {
        const kingSideClear = !this.getPiece({ row: 7, col: 5 }) && !this.getPiece({ row: 7, col: 6 })
        if (
          kingSideClear &&
          !this.isSquareAttacked({ row: 7, col: 4 }, "black") &&
          !this.isSquareAttacked({ row: 7, col: 5 }, "black") &&
          !this.isSquareAttacked({ row: 7, col: 6 }, "black")
        ) {
          moves.push({
            from,
            to: { row: 7, col: 6 },
            piece,
            isCastling: true,
          })
        }
      }

      // Queen-side castling
      if (this.gameState.castlingRights.whiteQueenSide) {
        const queenSideClear =
          !this.getPiece({ row: 7, col: 1 }) && !this.getPiece({ row: 7, col: 2 }) && !this.getPiece({ row: 7, col: 3 })
        if (
          queenSideClear &&
          !this.isSquareAttacked({ row: 7, col: 2 }, "black") &&
          !this.isSquareAttacked({ row: 7, col: 3 }, "black") &&
          !this.isSquareAttacked({ row: 7, col: 4 }, "black")
        ) {
          moves.push({
            from,
            to: { row: 7, col: 2 },
            piece,
            isCastling: true,
          })
        }
      }
    } else {
      // King-side castling for black
      if (this.gameState.castlingRights.blackKingSide) {
        const kingSideClear = !this.getPiece({ row: 0, col: 5 }) && !this.getPiece({ row: 0, col: 6 })
        if (
          kingSideClear &&
          !this.isSquareAttacked({ row: 0, col: 4 }, "white") &&
          !this.isSquareAttacked({ row: 0, col: 5 }, "white") &&
          !this.isSquareAttacked({ row: 0, col: 6 }, "white")
        ) {
          moves.push({
            from,
            to: { row: 0, col: 6 },
            piece,
            isCastling: true,
          })
        }
      }

      // Queen-side castling for black
      if (this.gameState.castlingRights.blackQueenSide) {
        const queenSideClear =
          !this.getPiece({ row: 0, col: 1 }) && !this.getPiece({ row: 0, col: 2 }) && !this.getPiece({ row: 0, col: 3 })
        if (
          queenSideClear &&
          !this.isSquareAttacked({ row: 0, col: 2 }, "white") &&
          !this.isSquareAttacked({ row: 0, col: 3 }, "white") &&
          !this.isSquareAttacked({ row: 0, col: 4 }, "white")
        ) {
          moves.push({
            from,
            to: { row: 0, col: 2 },
            piece,
            isCastling: true,
          })
        }
      }
    }

    return moves
  }

  // King attacks only (for attack detection, no castling)
  private generateKingAttacks(from: Position, piece: Piece): Move[] {
    const moves: Move[] = []
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]

    for (const [rowOffset, colOffset] of directions) {
      const to = { row: from.row + rowOffset, col: from.col + colOffset }
      if (this.isValidPosition(to)) {
        moves.push({ from, to, piece })
      }
    }

    return moves
  }

  private isSquareAttacked(pos: Position, byColor: Color): boolean {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col]
        if (piece && piece.color === byColor) {
          // Use attack-only move generation to avoid recursion
          const attacks = this.generateAttackMoves({ row, col }, piece)
          if (attacks.some((move) => move.to.row === pos.row && move.to.col === pos.col)) {
            return true
          }
        }
      }
    }
    return false
  }

  isLegalMove(move: Move): boolean {
    const originalState = this.copyState()

    try {
      this.setPiece(move.to, move.piece)
      this.setPiece(move.from, null)

      if (move.isEnPassant && move.capturedPiece) {
        const direction = move.piece.color === "white" ? 1 : -1
        this.setPiece({ row: move.to.row + direction, col: move.to.col }, null)
      }

      const isLegal = !this.isInCheck(move.piece.color)
      return isLegal
    } finally {
      this.setState(originalState)
    }
  }

  isInCheck(color?: Color): boolean {
    const checkColor = color || this.gameState.turn
    const kingPos = this.getKingPosition(checkColor)
    if (!kingPos) return false

    const opponentColor = checkColor === "white" ? "black" : "white"
    return this.isSquareAttacked(kingPos, opponentColor)
  }

  getKingPosition(color: Color): Position | null {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.gameState.board[row][col]
        if (piece && piece.type === "king" && piece.color === color) {
          return { row, col }
        }
      }
    }
    return null
  }

  makeMove(move: Move): boolean {
    if (!this.isLegalMove(move)) return false

    this.setPiece(move.to, move.piece)
    this.setPiece(move.from, null)

    if (move.isEnPassant && move.capturedPiece) {
      const direction = move.piece.color === "white" ? 1 : -1
      this.setPiece({ row: move.to.row + direction, col: move.to.col }, null)
    }

    if (move.isCastling) {
      if (move.to.col === 6) {
        // King-side castling
        const rookFrom = { row: move.from.row, col: 7 }
        const rookTo = { row: move.from.row, col: 5 }
        const rook = this.getPiece(rookFrom)
        if (rook) {
          this.setPiece(rookTo, rook)
          this.setPiece(rookFrom, null)
        }
      } else if (move.to.col === 2) {
        // Queen-side castling
        const rookFrom = { row: move.from.row, col: 0 }
        const rookTo = { row: move.from.row, col: 3 }
        const rook = this.getPiece(rookFrom)
        if (rook) {
          this.setPiece(rookTo, rook)
          this.setPiece(rookFrom, null)
        }
      }
    }

    if (move.promotionPiece) {
      this.setPiece(move.to, {
        type: move.promotionPiece,
        color: move.piece.color,
      })
    }

    this.updateCastlingRights(move)
    this.gameState.enPassantTarget = move.enPassantTarget || null
    this.gameState.lastMove = move
    this.gameState.turn = this.gameState.turn === "white" ? "black" : "white"

    if (this.gameState.turn === "white") {
      this.gameState.fullMoveNumber++
    }

    return true
  }

  private updateCastlingRights(move: Move): void {
    if (move.piece.type === "king") {
      if (move.piece.color === "white") {
        this.gameState.castlingRights.whiteKingSide = false
        this.gameState.castlingRights.whiteQueenSide = false
      } else {
        this.gameState.castlingRights.blackKingSide = false
        this.gameState.castlingRights.blackQueenSide = false
      }
    }

    if (move.piece.type === "rook") {
      if (move.piece.color === "white") {
        if (move.from.row === 7 && move.from.col === 0) {
          this.gameState.castlingRights.whiteQueenSide = false
        } else if (move.from.row === 7 && move.from.col === 7) {
          this.gameState.castlingRights.whiteKingSide = false
        }
      } else {
        if (move.from.row === 0 && move.from.col === 0) {
          this.gameState.castlingRights.blackQueenSide = false
        } else if (move.from.row === 0 && move.from.col === 7) {
          this.gameState.castlingRights.blackKingSide = false
        }
      }
    }

    if (move.capturedPiece && move.capturedPiece.type === "rook") {
      if (move.capturedPiece.color === "white") {
        if (move.to.row === 7 && move.to.col === 0) {
          this.gameState.castlingRights.whiteQueenSide = false
        } else if (move.to.row === 7 && move.to.col === 7) {
          this.gameState.castlingRights.whiteKingSide = false
        }
      } else {
        if (move.to.row === 0 && move.to.col === 0) {
          this.gameState.castlingRights.blackQueenSide = false
        } else if (move.to.row === 0 && move.to.col === 7) {
          this.gameState.castlingRights.blackKingSide = false
        }
      }
    }
  }

  isCheckmate(): boolean {
    return this.isInCheck() && this.generateMoves().length === 0
  }

  isStalemate(): boolean {
    return !this.isInCheck() && this.generateMoves().length === 0
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isStalemate()
  }

  moveToNotation(move: Move): string {
    const fromSquare = this.positionToAlgebraic(move.from)
    const toSquare = this.positionToAlgebraic(move.to)

    if (move.isCastling) {
      return move.to.col === 6 ? "O-O" : "O-O-O"
    }

    const piece = move.piece.type === "pawn" ? "" : move.piece.type.charAt(0).toUpperCase()
    const capture = move.capturedPiece || move.isEnPassant ? "x" : ""
    const promotion = move.promotionPiece ? `=${move.promotionPiece.charAt(0).toUpperCase()}` : ""

    const originalState = this.copyState()
    let checkNotation = ""

    try {
      this.makeMove(move)
      if (this.isCheckmate()) {
        checkNotation = "#"
      } else if (this.isInCheck()) {
        checkNotation = "+"
      }
    } finally {
      this.setState(originalState)
    }

    return `${piece}${fromSquare}${capture}${toSquare}${promotion}${checkNotation}`
  }

  private positionToAlgebraic(pos: Position): string {
    const file = String.fromCharCode(97 + pos.col)
    const rank = (8 - pos.row).toString()
    return file + rank
  }
}
