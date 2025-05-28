import type { ChessEngine } from "./chess-engine"
import type { Move, Color } from "./chess-types"

interface TranspositionEntry {
  depth: number
  score: number
  flag: "exact" | "lowerbound" | "upperbound"
  bestMove?: Move
}

interface AnalysisResult {
  move: Move | null
  evaluation: number
  depth: number
  nodesSearched: number
}

export class ChessBot {
  private positionCount = 0
  private maxTime = 5000 // Increased thinking time
  private startTime = 0
  private difficulty = 7
  private maxDepth = 12 // Increased max depth
  private transpositionTable = new Map<string, TranspositionEntry>()
  private killerMoves: Move[][] = []
  private historyTable = new Map<string, number>()

  // Enhanced opening book
  private openingBook = new Map<string, Move[]>([
    // King's Pawn openings
    ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", []],
    // Queen's Pawn openings
    ["rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1", []],
    // English Opening
    ["rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1", []],
  ])

  // Advanced piece-square tables with more nuanced values
  private pawnTableOpening = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 27, 27, 10, 5, 5],
    [0, 0, 0, 25, 25, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -25, -25, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ]

  private pawnTableEndgame = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [80, 80, 80, 80, 80, 80, 80, 80],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [30, 30, 30, 30, 30, 30, 30, 30],
    [20, 20, 20, 20, 20, 20, 20, 20],
    [10, 10, 10, 10, 10, 10, 10, 10],
    [10, 10, 10, 10, 10, 10, 10, 10],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ]

  private knightTable = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ]

  private bishopTable = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ]

  private rookTable = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ]

  private queenTable = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ]

  private kingMiddlegameTable = [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ]

  private kingEndgameTable = [
    [-50, -40, -30, -20, -20, -30, -40, -50],
    [-30, -20, -10, 0, 0, -10, -20, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -30, 0, 0, 0, 0, -30, -30],
    [-50, -30, -30, -30, -30, -30, -30, -50],
  ]

  setDifficulty(level: number): void {
    this.difficulty = Math.max(1, Math.min(10, level))
    // Clear transposition table when difficulty changes
    this.transpositionTable.clear()
    this.killerMoves = Array(20)
      .fill(null)
      .map(() => [])
    this.historyTable.clear()
  }

  async getBestMoveWithAnalysis(
    engine: ChessEngine,
    difficulty?: number,
    currentPlayer?: Color,
  ): Promise<AnalysisResult> {
    if (difficulty !== undefined) {
      this.setDifficulty(difficulty)
    }

    this.positionCount = 0
    this.startTime = Date.now()

    const moves = engine.generateMoves()
    if (moves.length === 0) {
      return { move: null, evaluation: 0, depth: 0, nodesSearched: 0 }
    }

    // Check opening book first
    const bookMove = this.getOpeningBookMove(engine)
    if (bookMove && this.difficulty >= 3) {
      return {
        move: bookMove,
        evaluation: 0,
        depth: 1,
        nodesSearched: 1,
      }
    }

    // For very low difficulty, make random moves more often
    if (this.difficulty <= 2 && Math.random() < 0.4) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)]
      return {
        move: randomMove,
        evaluation: 0,
        depth: 1,
        nodesSearched: 1,
      }
    }

    // Iterative deepening search
    let bestMove = moves[0]
    let bestScore = Number.NEGATIVE_INFINITY
    let searchDepth = 1
    const maxSearchDepth = Math.min(this.maxDepth, Math.max(3, Math.floor(this.difficulty * 1.2)))

    try {
      for (let depth = 1; depth <= maxSearchDepth; depth++) {
        if (Date.now() - this.startTime > this.maxTime * 0.8) break

        const result = await this.searchAtDepth(engine, depth)
        if (result.move) {
          bestMove = result.move
          bestScore = result.score
          searchDepth = depth
        }

        // If we found a mate, no need to search deeper
        if (Math.abs(bestScore) > 19000) break
      }
    } catch (err) {
      console.error("Search error:", err)
    }

    // Add strategic randomness for lower difficulties
    if (this.difficulty < 7 && Math.random() < (8 - this.difficulty) * 0.06) {
      const goodMoves = moves.slice(0, Math.min(5, moves.length))
      bestMove = goodMoves[Math.floor(Math.random() * goodMoves.length)]
    }

    return {
      move: bestMove,
      evaluation: bestScore,
      depth: searchDepth,
      nodesSearched: this.positionCount,
    }
  }

  private async searchAtDepth(engine: ChessEngine, depth: number): Promise<{ move: Move | null; score: number }> {
    const moves = engine.generateMoves()
    if (moves.length === 0) return { move: null, score: 0 }

    let bestMove = moves[0]
    let bestScore = Number.NEGATIVE_INFINITY

    const orderedMoves = this.orderMovesAdvanced(engine, moves, depth)

    for (const move of orderedMoves) {
      if (Date.now() - this.startTime > this.maxTime) break

      const originalState = engine.copyState()
      try {
        if (engine.makeMove(move)) {
          const score = -this.alphaBetaWithEnhancements(
            engine,
            depth - 1,
            Number.NEGATIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            false,
            depth,
          )

          if (score > bestScore) {
            bestScore = score
            bestMove = move
          }
        }
      } catch (err) {
        continue
      } finally {
        engine.setState(originalState)
      }
    }

    return { move: bestMove, score: bestScore }
  }

  private getOpeningBookMove(engine: ChessEngine): Move | null {
    // Simple opening principles for early game
    const gameState = engine.getGameState()
    const moveCount = gameState.fullMoveNumber

    if (moveCount > 10) return null // Only use in opening

    const moves = engine.generateMoves()

    // Prioritize center control and piece development
    const goodOpeningMoves = moves.filter((move) => {
      // Central pawn moves
      if (move.piece.type === "pawn") {
        const isCenter = move.to.col >= 3 && move.to.col <= 4
        const isTwoSquares = Math.abs(move.to.row - move.from.row) === 2
        return isCenter && isTwoSquares
      }

      // Knight development
      if (move.piece.type === "knight") {
        const backRank = move.piece.color === "white" ? 7 : 0
        return move.from.row === backRank
      }

      // Bishop development
      if (move.piece.type === "bishop") {
        const backRank = move.piece.color === "white" ? 7 : 0
        return move.from.row === backRank
      }

      // Castling
      if (move.isCastling) return true

      return false
    })

    return goodOpeningMoves.length > 0 ? goodOpeningMoves[Math.floor(Math.random() * goodOpeningMoves.length)] : null
  }

  private alphaBetaWithEnhancements(
    engine: ChessEngine,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    originalDepth: number,
  ): number {
    this.positionCount++

    // Time cutoff
    if (Date.now() - this.startTime > this.maxTime) {
      return this.evaluatePositionAdvanced(engine)
    }

    // Transposition table lookup
    const positionKey = this.getPositionKey(engine)
    const ttEntry = this.transpositionTable.get(positionKey)
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === "exact") return ttEntry.score
      if (ttEntry.flag === "lowerbound" && ttEntry.score >= beta) return ttEntry.score
      if (ttEntry.flag === "upperbound" && ttEntry.score <= alpha) return ttEntry.score
    }

    // Base cases
    if (depth <= 0) {
      return this.quiescenceSearch(engine, alpha, beta, isMaximizing, 4)
    }

    if (engine.isGameOver()) {
      return this.evaluatePositionAdvanced(engine)
    }

    // Null move pruning for non-PV nodes
    if (depth >= 3 && !engine.isInCheck() && this.difficulty >= 6) {
      const originalState = engine.copyState()
      try {
        // Make a null move (skip turn)
        const nullGameState = { ...engine.getGameState() }
        nullGameState.turn = nullGameState.turn === "white" ? "black" : "white"
        engine.setState(nullGameState)

        const nullScore = -this.alphaBetaWithEnhancements(
          engine,
          depth - 3,
          -beta,
          -beta + 1,
          !isMaximizing,
          originalDepth,
        )

        if (nullScore >= beta) {
          return beta // Null move cutoff
        }
      } finally {
        engine.setState(originalState)
      }
    }

    const moves = engine.generateMoves()
    if (moves.length === 0) {
      return this.evaluatePositionAdvanced(engine)
    }

    const orderedMoves = this.orderMovesAdvanced(engine, moves, originalDepth)
    let bestScore = isMaximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
    let bestMove: Move | null = null
    let moveCount = 0

    for (const move of orderedMoves) {
      if (Date.now() - this.startTime > this.maxTime) break

      const originalState = engine.copyState()
      try {
        if (!engine.makeMove(move)) continue

        moveCount++
        let score: number

        // Late Move Reductions (LMR)
        if (moveCount > 4 && depth >= 3 && !move.capturedPiece && !engine.isInCheck() && this.difficulty >= 7) {
          // Search with reduced depth first
          score = isMaximizing
            ? -this.alphaBetaWithEnhancements(engine, depth - 2, -alpha - 1, -alpha, false, originalDepth)
            : -this.alphaBetaWithEnhancements(engine, depth - 2, -beta, -beta + 1, true, originalDepth)

          // If the reduced search suggests this move is good, re-search with full depth
          if ((isMaximizing && score > alpha) || (!isMaximizing && score < beta)) {
            score = isMaximizing
              ? -this.alphaBetaWithEnhancements(engine, depth - 1, -beta, -alpha, false, originalDepth)
              : -this.alphaBetaWithEnhancements(engine, depth - 1, -alpha, -beta, true, originalDepth)
          }
        } else {
          // Normal search
          score = isMaximizing
            ? -this.alphaBetaWithEnhancements(engine, depth - 1, -beta, -alpha, false, originalDepth)
            : -this.alphaBetaWithEnhancements(engine, depth - 1, -alpha, -beta, true, originalDepth)
        }

        if (isMaximizing) {
          if (score > bestScore) {
            bestScore = score
            bestMove = move
          }
          alpha = Math.max(alpha, score)
        } else {
          if (score < bestScore) {
            bestScore = score
            bestMove = move
          }
          beta = Math.min(beta, score)
        }

        if (beta <= alpha) {
          // Store killer move
          if (!move.capturedPiece && originalDepth < this.killerMoves.length) {
            this.killerMoves[originalDepth] = [move, ...this.killerMoves[originalDepth].slice(0, 1)]
          }
          break // Alpha-beta cutoff
        }
      } finally {
        engine.setState(originalState)
      }
    }

    // Store in transposition table
    const flag = bestScore <= alpha ? "upperbound" : bestScore >= beta ? "lowerbound" : "exact"
    this.transpositionTable.set(positionKey, {
      depth,
      score: bestScore,
      flag,
      bestMove,
    })

    return bestScore
  }

  private quiescenceSearch(
    engine: ChessEngine,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    depth: number,
  ): number {
    this.positionCount++

    if (depth <= 0 || Date.now() - this.startTime > this.maxTime) {
      return this.evaluatePositionAdvanced(engine)
    }

    const standPat = this.evaluatePositionAdvanced(engine)

    if (isMaximizing) {
      if (standPat >= beta) return beta
      alpha = Math.max(alpha, standPat)
    } else {
      if (standPat <= alpha) return alpha
      beta = Math.min(beta, standPat)
    }

    // Only consider captures and checks in quiescence search
    const moves = engine.generateMoves().filter((move) => move.capturedPiece || this.givesCheck(engine, move))

    const orderedMoves = this.orderMovesAdvanced(engine, moves, 0)

    for (const move of orderedMoves) {
      const originalState = engine.copyState()
      try {
        if (!engine.makeMove(move)) continue

        const score = isMaximizing
          ? -this.quiescenceSearch(engine, -beta, -alpha, false, depth - 1)
          : -this.quiescenceSearch(engine, -alpha, -beta, true, depth - 1)

        if (isMaximizing) {
          alpha = Math.max(alpha, score)
          if (alpha >= beta) break
        } else {
          beta = Math.min(beta, score)
          if (beta <= alpha) break
        }
      } finally {
        engine.setState(originalState)
      }
    }

    return isMaximizing ? alpha : beta
  }

  private givesCheck(engine: ChessEngine, move: Move): boolean {
    const originalState = engine.copyState()
    try {
      if (engine.makeMove(move)) {
        return engine.isInCheck()
      }
      return false
    } finally {
      engine.setState(originalState)
    }
  }

  private getPositionKey(engine: ChessEngine): string {
    const gameState = engine.getGameState()
    let key = ""

    // Board position
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece) {
          key += `${piece.color[0]}${piece.type[0]}`
        } else {
          key += "."
        }
      }
    }

    // Additional game state
    key += gameState.turn
    key += gameState.castlingRights.whiteKingSide ? "K" : ""
    key += gameState.castlingRights.whiteQueenSide ? "Q" : ""
    key += gameState.castlingRights.blackKingSide ? "k" : ""
    key += gameState.castlingRights.blackQueenSide ? "q" : ""

    if (gameState.enPassantTarget) {
      key += `${gameState.enPassantTarget.row}${gameState.enPassantTarget.col}`
    }

    return key
  }

  // Legacy method for backward compatibility
  getBestMove(engine: ChessEngine, difficulty?: number, currentPlayer?: Color): Move | null {
    return this.getBestMoveWithAnalysis(engine, difficulty, currentPlayer)
      .then((result) => result.move)
      .catch(() => null) as any
  }

  private orderMovesAdvanced(engine: ChessEngine, moves: Move[], depth: number): Move[] {
    return moves.sort((a, b) => {
      let scoreA = 0
      let scoreB = 0

      // Transposition table move gets highest priority
      const positionKey = this.getPositionKey(engine)
      const ttEntry = this.transpositionTable.get(positionKey)
      if (ttEntry?.bestMove) {
        if (this.movesEqual(a, ttEntry.bestMove)) scoreA += 10000
        if (this.movesEqual(b, ttEntry.bestMove)) scoreB += 10000
      }

      // MVV-LVA for captures
      if (a.capturedPiece) {
        scoreA += 1000 + 10 * this.getPieceValue(a.capturedPiece.type) - this.getPieceValue(a.piece.type)
      }
      if (b.capturedPiece) {
        scoreB += 1000 + 10 * this.getPieceValue(b.capturedPiece.type) - this.getPieceValue(b.piece.type)
      }

      // Killer moves
      if (depth < this.killerMoves.length) {
        if (this.killerMoves[depth].some((killer) => this.movesEqual(a, killer))) scoreA += 900
        if (this.killerMoves[depth].some((killer) => this.movesEqual(b, killer))) scoreB += 900
      }

      // History heuristic
      const historyKeyA = this.getMoveKey(a)
      const historyKeyB = this.getMoveKey(b)
      scoreA += this.historyTable.get(historyKeyA) || 0
      scoreB += this.historyTable.get(historyKeyB) || 0

      // Promotions
      if (a.promotionPiece) scoreA += 800
      if (b.promotionPiece) scoreB += 800

      // Castling
      if (a.isCastling) scoreA += 50
      if (b.isCastling) scoreB += 50

      // Central moves for pieces
      if (this.isCentralMove(a)) scoreA += 20
      if (this.isCentralMove(b)) scoreB += 20

      // Development moves
      if (this.isDevelopmentMove(a)) scoreA += 30
      if (this.isDevelopmentMove(b)) scoreB += 30

      return scoreB - scoreA
    })
  }

  private movesEqual(move1: Move, move2: Move): boolean {
    return (
      move1.from.row === move2.from.row &&
      move1.from.col === move2.from.col &&
      move1.to.row === move2.to.row &&
      move1.to.col === move2.to.col
    )
  }

  private getMoveKey(move: Move): string {
    return `${move.from.row}${move.from.col}${move.to.row}${move.to.col}`
  }

  private isCentralMove(move: Move): boolean {
    return (
      (move.piece.type === "knight" || move.piece.type === "bishop") &&
      move.to.row >= 2 &&
      move.to.row <= 5 &&
      move.to.col >= 2 &&
      move.to.col <= 5
    )
  }

  private isDevelopmentMove(move: Move): boolean {
    if (move.piece.type === "knight" || move.piece.type === "bishop") {
      const backRank = move.piece.color === "white" ? 7 : 0
      return move.from.row === backRank
    }
    return false
  }

  private evaluatePositionAdvanced(engine: ChessEngine): number {
    const gameState = engine.getGameState()

    if (engine.isCheckmate()) {
      return gameState.turn === "white" ? -30000 : 30000
    }

    if (engine.isStalemate()) {
      return 0
    }

    let score = 0

    // Material evaluation (30% weight)
    score += this.getMaterialScore(gameState) * 0.3

    // Positional evaluation (25% weight)
    score += this.getAdvancedPositionalScore(engine) * 0.25

    // Pawn structure (15% weight)
    score += this.getAdvancedPawnStructure(gameState) * 0.15

    // King safety (12% weight)
    score += this.getAdvancedKingSafety(engine) * 0.12

    // Piece activity and mobility (10% weight)
    score += this.getPieceActivity(engine) * 0.1

    // Strategic factors (8% weight)
    score += this.getStrategicFactors(engine) * 0.08

    return gameState.turn === "white" ? score : -score
  }

  private getMaterialScore(gameState: any): number {
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece) {
          let value = this.getPieceValue(piece.type)

          // Adjust piece values based on game phase
          if (this.isEndgame(gameState)) {
            if (piece.type === "queen") value *= 0.95
            if (piece.type === "rook") value *= 1.05
            if (piece.type === "pawn") value *= 1.3
            if (piece.type === "knight") value *= 0.9
            if (piece.type === "bishop") value *= 1.1
          }

          score += piece.color === "white" ? value : -value
        }
      }
    }

    return score
  }

  private getAdvancedPositionalScore(engine: ChessEngine): number {
    let score = 0
    const gameState = engine.getGameState()
    const isEndgamePhase = this.isEndgame(gameState)

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (!piece) continue

        let positionalValue = 0
        const adjustedRow = piece.color === "white" ? row : 7 - row

        switch (piece.type) {
          case "pawn":
            positionalValue = isEndgamePhase
              ? this.pawnTableEndgame[adjustedRow][col]
              : this.pawnTableOpening[adjustedRow][col]
            break
          case "knight":
            positionalValue = this.knightTable[adjustedRow][col]
            if (isEndgamePhase) positionalValue *= 0.8
            break
          case "bishop":
            positionalValue = this.bishopTable[adjustedRow][col]
            if (isEndgamePhase) positionalValue *= 1.1
            break
          case "rook":
            positionalValue = this.rookTable[adjustedRow][col]
            if (this.isOpenFile(gameState, col)) positionalValue += 25
            if (this.isSemiOpenFile(gameState, col, piece.color)) positionalValue += 15
            break
          case "queen":
            positionalValue = this.queenTable[adjustedRow][col]
            break
          case "king":
            positionalValue = isEndgamePhase
              ? this.kingEndgameTable[adjustedRow][col]
              : this.kingMiddlegameTable[adjustedRow][col]
            break
        }

        score += piece.color === "white" ? positionalValue : -positionalValue
      }
    }

    return score
  }

  private getAdvancedPawnStructure(gameState: any): number {
    let score = 0

    for (let col = 0; col < 8; col++) {
      const whitePawns: number[] = []
      const blackPawns: number[] = []

      for (let row = 0; row < 8; row++) {
        const piece = gameState.board[row][col]
        if (piece && piece.type === "pawn") {
          if (piece.color === "white") {
            whitePawns.push(row)
          } else {
            blackPawns.push(row)
          }
        }
      }

      // Doubled pawns penalty
      if (whitePawns.length > 1) score -= 30 * (whitePawns.length - 1)
      if (blackPawns.length > 1) score += 30 * (blackPawns.length - 1)

      // Isolated pawns penalty
      if (whitePawns.length === 1 && this.isIsolatedPawn(gameState, col, "white")) {
        score -= 25
      }
      if (blackPawns.length === 1 && this.isIsolatedPawn(gameState, col, "black")) {
        score += 25
      }

      // Passed pawns bonus
      if (whitePawns.length === 1 && this.isPassedPawn(gameState, col, whitePawns[0], "white")) {
        const bonus = 40 + (6 - whitePawns[0]) * 15
        score += bonus
      }
      if (blackPawns.length === 1 && this.isPassedPawn(gameState, col, blackPawns[0], "black")) {
        const bonus = 40 + (blackPawns[0] - 1) * 15
        score -= bonus
      }

      // Backward pawns penalty
      if (whitePawns.length === 1 && this.isBackwardPawn(gameState, col, whitePawns[0], "white")) {
        score -= 20
      }
      if (blackPawns.length === 1 && this.isBackwardPawn(gameState, col, blackPawns[0], "black")) {
        score += 20
      }
    }

    // Pawn chains and support
    score += this.evaluatePawnChains(gameState)

    return score
  }

  private isOpenFile(gameState: any, col: number): boolean {
    for (let row = 0; row < 8; row++) {
      const piece = gameState.board[row][col]
      if (piece && piece.type === "pawn") {
        return false
      }
    }
    return true
  }

  private isSemiOpenFile(gameState: any, col: number, color: string): boolean {
    let hasFriendlyPawn = false
    let hasEnemyPawn = false

    for (let row = 0; row < 8; row++) {
      const piece = gameState.board[row][col]
      if (piece && piece.type === "pawn") {
        if (piece.color === color) {
          hasFriendlyPawn = true
        } else {
          hasEnemyPawn = true
        }
      }
    }

    return !hasFriendlyPawn && hasEnemyPawn
  }

  private isIsolatedPawn(gameState: any, col: number, color: string): boolean {
    const adjacentFiles = [col - 1, col + 1].filter((c) => c >= 0 && c < 8)

    for (const adjCol of adjacentFiles) {
      for (let row = 0; row < 8; row++) {
        const piece = gameState.board[row][adjCol]
        if (piece && piece.type === "pawn" && piece.color === color) {
          return false
        }
      }
    }
    return true
  }

  private isPassedPawn(gameState: any, col: number, row: number, color: string): boolean {
    const direction = color === "white" ? -1 : 1
    const opponentColor = color === "white" ? "black" : "white"

    for (let checkCol = Math.max(0, col - 1); checkCol <= Math.min(7, col + 1); checkCol++) {
      for (let checkRow = row + direction; checkRow >= 0 && checkRow < 8; checkRow += direction) {
        const piece = gameState.board[checkRow][checkCol]
        if (piece && piece.type === "pawn" && piece.color === opponentColor) {
          return false
        }
      }
    }
    return true
  }

  private isBackwardPawn(gameState: any, col: number, row: number, color: string): boolean {
    const direction = color === "white" ? -1 : 1
    const advanceSquare = { row: row + direction, col }
    if (advanceSquare.row < 0 || advanceSquare.row >= 8) return false

    const opponentColor = color === "white" ? "black" : "white"
    const attackSquares = [
      { row: advanceSquare.row + direction, col: col - 1 },
      { row: advanceSquare.row + direction, col: col + 1 },
    ]

    for (const attackSquare of attackSquares) {
      if (attackSquare.row >= 0 && attackSquare.row < 8 && attackSquare.col >= 0 && attackSquare.col < 8) {
        const piece = gameState.board[attackSquare.row][attackSquare.col]
        if (piece && piece.type === "pawn" && piece.color === opponentColor) {
          return true
        }
      }
    }

    return false
  }

  private evaluatePawnChains(gameState: any): number {
    let score = 0

    for (let row = 1; row < 7; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece && piece.type === "pawn") {
          const supportSquares = [
            { row: row + 1, col: col - 1 },
            { row: row + 1, col: col + 1 },
          ]

          for (const supportSquare of supportSquares) {
            if (supportSquare.row < 8 && supportSquare.col >= 0 && supportSquare.col < 8) {
              const supportPiece = gameState.board[supportSquare.row][supportSquare.col]
              if (supportPiece && supportPiece.type === "pawn" && supportPiece.color === piece.color) {
                score += piece.color === "white" ? 15 : -15
              }
            }
          }
        }
      }
    }

    return score
  }

  private getAdvancedKingSafety(engine: ChessEngine): number {
    let score = 0
    const gameState = engine.getGameState()

    const whiteKing = engine.getKingPosition("white")
    const blackKing = engine.getKingPosition("black")

    if (whiteKing) {
      score += this.evaluateKingSafetyAdvanced(engine, whiteKing, "white")
    }

    if (blackKing) {
      score -= this.evaluateKingSafetyAdvanced(engine, blackKing, "black")
    }

    return score
  }

  private evaluateKingSafetyAdvanced(engine: ChessEngine, kingPos: any, color: string): number {
    let safety = 0
    const gameState = engine.getGameState()
    const isEndgamePhase = this.isEndgame(gameState)

    if (engine.isInCheck(color as Color)) {
      safety -= isEndgamePhase ? 60 : 120
    }

    if (!isEndgamePhase) {
      // Pawn shield evaluation
      const direction = color === "white" ? -1 : 1
      let pawnShield = 0

      for (let col = Math.max(0, kingPos.col - 1); col <= Math.min(7, kingPos.col + 1); col++) {
        for (
          let row = kingPos.row + direction;
          row >= 0 && row < 8 && row !== kingPos.row + 3 * direction;
          row += direction
        ) {
          const piece = gameState.board[row][col]
          if (piece && piece.type === "pawn" && piece.color === color) {
            pawnShield += 20
            break
          }
        }
      }
      safety += pawnShield

      // Penalty for exposed king
      if (kingPos.col >= 2 && kingPos.col <= 5) {
        safety -= 40
      }

      // Castling rights bonus
      const castlingRights = gameState.castlingRights
      if (color === "white") {
        if (castlingRights.whiteKingSide || castlingRights.whiteQueenSide) {
          safety += 25
        }
      } else {
        if (castlingRights.blackKingSide || castlingRights.blackQueenSide) {
          safety += 25
        }
      }

      // Attack evaluation around king
      safety -= this.evaluateKingAttacks(engine, kingPos, color) * 10
    } else {
      // In endgame, king should be active
      const centerDistance = Math.abs(kingPos.row - 3.5) + Math.abs(kingPos.col - 3.5)
      safety += (7 - centerDistance) * 8
    }

    return safety
  }

  private evaluateKingAttacks(engine: ChessEngine, kingPos: any, color: string): number {
    let attackCount = 0
    const opponentColor = color === "white" ? "black" : "white"

    // Check squares around the king
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const checkSquare = {
          row: kingPos.row + rowOffset,
          col: kingPos.col + colOffset,
        }

        if (checkSquare.row >= 0 && checkSquare.row < 8 && checkSquare.col >= 0 && checkSquare.col < 8) {
          if (this.isSquareAttackedBy(engine, checkSquare, opponentColor)) {
            attackCount++
          }
        }
      }
    }

    return attackCount
  }

  private isSquareAttackedBy(engine: ChessEngine, square: any, color: string): boolean {
    const gameState = engine.getGameState()

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece && piece.color === color) {
          const moves = engine.generateMovesForPiece({ row, col })
          if (moves.some((move) => move.to.row === square.row && move.to.col === square.col)) {
            return true
          }
        }
      }
    }

    return false
  }

  private getPieceActivity(engine: ChessEngine): number {
    let score = 0

    // Mobility evaluation
    const whiteMoves = engine.generateMoves("white").length
    const blackMoves = engine.generateMoves("black").length
    score += (whiteMoves - blackMoves) * 5

    // Piece coordination
    score += this.evaluatePieceCoordination(engine)

    return score
  }

  private evaluatePieceCoordination(engine: ChessEngine): number {
    let score = 0
    const gameState = engine.getGameState()

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (!piece) continue

        // Knight outposts
        if (piece.type === "knight") {
          if (this.isOutpost(gameState, { row, col }, piece.color)) {
            score += piece.color === "white" ? 30 : -30
          }
        }

        // Bishop pairs
        if (piece.type === "bishop") {
          if (this.hasBishopPair(gameState, piece.color)) {
            score += piece.color === "white" ? 20 : -20
          }
        }

        // Rook coordination
        if (piece.type === "rook") {
          if (this.areRooksConnected(gameState, { row, col }, piece.color)) {
            score += piece.color === "white" ? 25 : -25
          }
        }

        // Piece centralization bonus
        if (this.isCentralSquare({ row, col })) {
          const bonus = this.getPieceCentralizationBonus(piece.type)
          score += piece.color === "white" ? bonus : -bonus
        }
      }
    }

    return score
  }

  private isCentralSquare(pos: any): boolean {
    return pos.row >= 2 && pos.row <= 5 && pos.col >= 2 && pos.col <= 5
  }

  private getPieceCentralizationBonus(pieceType: string): number {
    const bonuses: Record<string, number> = {
      pawn: 5,
      knight: 15,
      bishop: 10,
      rook: 5,
      queen: 8,
      king: 0,
    }
    return bonuses[pieceType] || 0
  }

  private isOutpost(gameState: any, pos: any, color: string): boolean {
    const opponentColor = color === "white" ? "black" : "white"
    const direction = color === "white" ? 1 : -1

    const attackSquares = [
      { row: pos.row + direction, col: pos.col - 1 },
      { row: pos.row + direction, col: pos.col + 1 },
    ]

    for (const attackSquare of attackSquares) {
      if (attackSquare.row >= 0 && attackSquare.row < 8 && attackSquare.col >= 0 && attackSquare.col < 8) {
        const piece = gameState.board[attackSquare.row][attackSquare.col]
        if (piece && piece.type === "pawn" && piece.color === opponentColor) {
          return false
        }
      }
    }

    return color === "white" ? pos.row < 4 : pos.row > 3
  }

  private hasBishopPair(gameState: any, color: string): boolean {
    let bishopCount = 0
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece && piece.type === "bishop" && piece.color === color) {
          bishopCount++
        }
      }
    }
    return bishopCount >= 2
  }

  private areRooksConnected(gameState: any, rookPos: any, color: string): boolean {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece && piece.type === "rook" && piece.color === color && (row !== rookPos.row || col !== rookPos.col)) {
          if (row === rookPos.row) {
            const minCol = Math.min(col, rookPos.col)
            const maxCol = Math.max(col, rookPos.col)
            let clear = true
            for (let c = minCol + 1; c < maxCol; c++) {
              if (gameState.board[row][c]) {
                clear = false
                break
              }
            }
            if (clear) return true
          }

          if (col === rookPos.col) {
            const minRow = Math.min(row, rookPos.row)
            const maxRow = Math.max(row, rookPos.row)
            let clear = true
            for (let r = minRow + 1; r < maxRow; r++) {
              if (gameState.board[r][col]) {
                clear = false
                break
              }
            }
            if (clear) return true
          }
        }
      }
    }
    return false
  }

  private getStrategicFactors(engine: ChessEngine): number {
    let score = 0
    const gameState = engine.getGameState()

    // Square control evaluation
    score += this.evaluateSquareControl(engine)

    // Tempo bonus
    score += gameState.turn === "white" ? 15 : -15

    // Space advantage
    score += this.evaluateSpaceAdvantage(gameState)

    return score
  }

  private evaluateSquareControl(engine: ChessEngine): number {
    let score = 0

    const keySquares = [
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
    ]

    for (const square of keySquares) {
      const whiteAttacks = this.countAttacksOnSquare(engine, square, "white")
      const blackAttacks = this.countAttacksOnSquare(engine, square, "black")
      score += (whiteAttacks - blackAttacks) * 8
    }

    return score
  }

  private evaluateSpaceAdvantage(gameState: any): number {
    let whiteSpace = 0
    let blackSpace = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece) {
          if (piece.color === "white" && row < 4) {
            whiteSpace++
          } else if (piece.color === "black" && row > 3) {
            blackSpace++
          }
        }
      }
    }

    return (whiteSpace - blackSpace) * 3
  }

  private countAttacksOnSquare(engine: ChessEngine, square: any, color: string): number {
    let attacks = 0
    const gameState = engine.getGameState()

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece && piece.color === color) {
          const moves = engine.generateMovesForPiece({ row, col })
          if (moves.some((move) => move.to.row === square.row && move.to.col === square.col)) {
            attacks++
          }
        }
      }
    }

    return attacks
  }

  private isEndgame(gameState: any): boolean {
    let pieceCount = 0
    let majorPieces = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col]
        if (piece) {
          pieceCount++
          if (piece.type === "queen" || piece.type === "rook") {
            majorPieces++
          }
        }
      }
    }

    return pieceCount <= 12 || majorPieces <= 3
  }

  private getPieceValue(pieceType: string): number {
    const pieceValues: Record<string, number> = {
      pawn: 100,
      knight: 320,
      bishop: 330,
      rook: 500,
      queen: 900,
      king: 20000,
    }
    return pieceValues[pieceType] || 0
  }
}
