"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChessBoard } from "./chess-board"
import { ChessEngine } from "@/lib/chess-engine"
import { ChessBot } from "@/lib/chess-bot"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Clock, Target, TrendingUp, Zap, Crown, Shield, Swords } from "lucide-react"
import type { Position, Move } from "@/lib/chess-types"

type GameMode = "player-vs-bot" | "bot-vs-bot"

interface EvaluationData {
  score: number
  depth: number
  bestMove: string
  nodesSearched: number
  timeElapsed: number
}

export function ChessGame() {
  const engineRef = useRef<ChessEngine>()
  const botRef = useRef<ChessBot>()

  // Initialize refs only once
  if (!engineRef.current) {
    engineRef.current = new ChessEngine()
  }
  if (!botRef.current) {
    botRef.current = new ChessBot()
  }

  const [gameState, setGameState] = useState(() => engineRef.current!.getGameState())
  const [isPlaying, setIsPlaying] = useState(false)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [thinking, setThinking] = useState(false)
  const [thinkingProgress, setThinkingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [gameMode, setGameMode] = useState<GameMode>("player-vs-bot")
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [validMoves, setValidMoves] = useState<Position[]>([])
  const [botDifficulty, setBotDifficulty] = useState<number>(7)
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [gameStats, setGameStats] = useState({
    captures: { white: 0, black: 0 },
    checks: { white: 0, black: 0 },
    castled: { white: false, black: false },
  })

  const updateGameState = useCallback(() => {
    if (engineRef.current) {
      setGameState(engineRef.current.getGameState())
    }
  }, [])

  const makePlayerMove = useCallback(
    async (from: Position, to: Position) => {
      if (!engineRef.current || thinking) return false

      try {
        const piece = engineRef.current.getPiece(from)
        if (!piece) {
          setError("No piece at selected position")
          return false
        }

        const move: Move = {
          from,
          to,
          piece,
          capturedPiece: engineRef.current.getPiece(to),
        }

        const success = engineRef.current.makeMove(move)

        if (success) {
          const moveNotation = engineRef.current.moveToNotation(move)
          setMoveHistory((prev) => [...prev, moveNotation])

          // Update game statistics
          setGameStats((prev) => {
            const newStats = { ...prev }
            if (move.capturedPiece) {
              newStats.captures[piece.color]++
            }
            if (move.isCastling) {
              newStats.castled[piece.color] = true
            }
            return newStats
          })

          updateGameState()
          setError(null)
          return true
        } else {
          setError("Invalid move")
          return false
        }
      } catch (err) {
        setError("Error making move")
        console.error("Player move error:", err)
        return false
      }
    },
    [thinking, updateGameState],
  )

  const makeBotMove = useCallback(async () => {
    if (!engineRef.current || !botRef.current || thinking) return

    if (engineRef.current.isGameOver()) {
      setIsPlaying(false)
      return
    }

    setThinking(true)
    setThinkingProgress(0)
    setError(null)

    try {
      // Simulate thinking progress
      const progressInterval = setInterval(() => {
        setThinkingProgress((prev) => Math.min(prev + Math.random() * 15, 95))
      }, 100)

      const startTime = Date.now()
      const result = await botRef.current.getBestMoveWithAnalysis(engineRef.current, botDifficulty, gameState.turn)

      clearInterval(progressInterval)
      setThinkingProgress(100)

      if (result.move) {
        const moveNotation = engineRef.current.moveToNotation(result.move)
        const success = engineRef.current.makeMove(result.move)

        if (success) {
          setMoveHistory((prev) => [...prev, moveNotation])

          // Update evaluation data
          setEvaluation({
            score: result.evaluation,
            depth: result.depth,
            bestMove: moveNotation,
            nodesSearched: result.nodesSearched,
            timeElapsed: Date.now() - startTime,
          })

          // Update game statistics
          setGameStats((prev) => {
            const newStats = { ...prev }
            if (result.move.capturedPiece) {
              newStats.captures[result.move.piece.color]++
            }
            if (result.move.isCastling) {
              newStats.castled[result.move.piece.color] = true
            }
            if (engineRef.current?.isInCheck()) {
              const opponentColor = result.move.piece.color === "white" ? "black" : "white"
              newStats.checks[result.move.piece.color]++
            }
            return newStats
          })

          updateGameState()
        } else {
          setError("Bot made invalid move")
          setIsPlaying(false)
        }
      } else {
        setError("Bot has no valid moves")
        setIsPlaying(false)
      }
    } catch (err) {
      setError("Error during bot move calculation")
      setIsPlaying(false)
      console.error("Bot move error:", err)
    } finally {
      setThinking(false)
      setThinkingProgress(0)
    }
  }, [updateGameState, botDifficulty, thinking, gameState.turn])

  // Handle bot moves in bot vs bot mode
  useEffect(() => {
    if (isPlaying && gameMode === "bot-vs-bot" && !thinking && !engineRef.current?.isGameOver()) {
      const timer = setTimeout(makeBotMove, 1500)
      return () => clearTimeout(timer)
    }
  }, [isPlaying, gameState.turn, makeBotMove, thinking, gameMode])

  // Handle bot moves in player vs bot mode
  useEffect(() => {
    if (
      isPlaying &&
      gameMode === "player-vs-bot" &&
      gameState.turn === "black" &&
      !thinking &&
      !engineRef.current?.isGameOver()
    ) {
      const timer = setTimeout(makeBotMove, 1000)
      return () => clearTimeout(timer)
    }
  }, [isPlaying, gameState.turn, makeBotMove, thinking, gameMode])

  const handleSquareClick = async (position: Position) => {
    if (
      !engineRef.current ||
      thinking ||
      engineRef.current.isGameOver() ||
      !isPlaying ||
      (gameMode === "player-vs-bot" && gameState.turn !== "white")
    ) {
      return
    }

    const piece = engineRef.current.getPiece(position)

    if (selectedPiece) {
      if (validMoves.some((move) => move.row === position.row && move.col === position.col)) {
        const success = await makePlayerMove(selectedPiece, position)
        if (success) {
          setSelectedPiece(null)
          setValidMoves([])
        }
      } else if (piece && piece.color === gameState.turn) {
        selectPiece(position)
      } else {
        setSelectedPiece(null)
        setValidMoves([])
      }
    } else if (piece && piece.color === gameState.turn) {
      selectPiece(position)
    }
  }

  const selectPiece = (position: Position) => {
    if (!engineRef.current) return

    setSelectedPiece(position)

    try {
      const moves = engineRef.current.generateMovesForPiece(position)
      const validDestinations = moves.map((move) => move.to)
      setValidMoves(validDestinations)
    } catch (err) {
      console.error("Error generating moves:", err)
      setValidMoves([])
    }
  }

  const startGame = () => {
    setError(null)
    setIsPlaying(true)
    setSelectedPiece(null)
    setValidMoves([])
    setEvaluation(null)
  }

  const stopGame = () => {
    setIsPlaying(false)
    setThinking(false)
    setSelectedPiece(null)
    setValidMoves([])
  }

  const resetGame = () => {
    if (engineRef.current) {
      engineRef.current.reset()
      setMoveHistory([])
      setIsPlaying(false)
      setThinking(false)
      setError(null)
      setSelectedPiece(null)
      setValidMoves([])
      setEvaluation(null)
      setGameStats({
        captures: { white: 0, black: 0 },
        checks: { white: 0, black: 0 },
        castled: { white: false, black: false },
      })
      updateGameState()
    }
  }

  const getGameStatus = () => {
    if (!engineRef.current) return "Loading..."

    if (error) return `Error: ${error}`

    if (engineRef.current.isCheckmate()) {
      return `Checkmate! ${gameState.turn === "white" ? "Black" : "White"} wins!`
    }
    if (engineRef.current.isStalemate()) {
      return "Stalemate! It's a draw!"
    }
    if (engineRef.current.isInCheck()) {
      return `${gameState.turn === "white" ? "White" : "Black"} is in check!`
    }

    if (gameMode === "player-vs-bot") {
      return gameState.turn === "white" ? "Your turn (White)" : "Bot is thinking... (Black)"
    } else {
      return `${gameState.turn === "white" ? "White" : "Black"} to move`
    }
  }

  const handleGameModeChange = (value: string) => {
    setGameMode(value as GameMode)
    setSelectedPiece(null)
    setValidMoves([])
    setIsPlaying(false)
    setThinking(false)
  }

  const handleDifficultyChange = (value: number[]) => {
    setBotDifficulty(value[0])
  }

  const getDifficultyLabel = (level: number) => {
    const labels = [
      "Beginner",
      "Novice",
      "Amateur",
      "Club Player",
      "Expert",
      "Master",
      "International Master",
      "Grandmaster",
      "Super GM",
      "Stockfish",
    ]
    return labels[level - 1] || "Unknown"
  }

  const getEvaluationBar = () => {
    if (!evaluation) return 50
    const score = evaluation.score
    const normalizedScore = Math.max(0, Math.min(100, 50 + score / 200))
    return normalizedScore
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Advanced Chess AI Arena
          </h1>
          <p className="text-slate-300">Experience next-generation chess intelligence</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Chess Board - Takes up more space */}
          <div className="xl:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-400" />
                    Chess Board
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge
                      variant={gameState.turn === "white" ? "default" : "secondary"}
                      className="bg-white text-black"
                    >
                      {gameMode === "player-vs-bot" && gameState.turn === "white" ? "Player" : "White AI"}
                      {thinking && gameState.turn === "white" ? " (Thinking...)" : ""}
                    </Badge>
                    <Badge
                      variant={gameState.turn === "black" ? "default" : "secondary"}
                      className="bg-slate-900 text-white"
                    >
                      {gameMode === "player-vs-bot" ? "AI" : "Black AI"}
                      {thinking && gameState.turn === "black" ? " (Thinking...)" : ""}
                    </Badge>
                  </div>
                </div>
                <p className="text-slate-300">{getGameStatus()}</p>
                {thinking && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Brain className="h-4 w-4 animate-pulse" />
                      AI is calculating...
                    </div>
                    <Progress value={thinkingProgress} className="h-2" />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ChessBoard
                  board={gameState.board}
                  lastMove={gameState.lastMove}
                  inCheck={engineRef.current?.isInCheck() || false}
                  kingPosition={engineRef.current?.getKingPosition(gameState.turn) || null}
                  selectedPiece={selectedPiece}
                  validMoves={validMoves}
                  onSquareClick={handleSquareClick}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel */}
          <div className="xl:col-span-2 space-y-6">
            {/* Game Controls */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-400" />
                  Game Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="game-mode" className="text-slate-300">
                    Game Mode
                  </Label>
                  <Select value={gameMode} onValueChange={handleGameModeChange}>
                    <SelectTrigger id="game-mode" className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select game mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="player-vs-bot" className="text-white">
                        Player vs AI
                      </SelectItem>
                      <SelectItem value="bot-vs-bot" className="text-white">
                        AI vs AI
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="difficulty" className="text-slate-300">
                      AI Strength: {getDifficultyLabel(botDifficulty)}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      Level {botDifficulty}
                    </Badge>
                  </div>
                  <Slider
                    id="difficulty"
                    min={1}
                    max={10}
                    step={1}
                    value={[botDifficulty]}
                    onValueChange={handleDifficultyChange}
                    disabled={thinking}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Beginner</span>
                    <span>Stockfish Level</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button
                    onClick={startGame}
                    disabled={isPlaying || engineRef.current?.isGameOver() || thinking}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {thinking ? "Thinking..." : "Start"}
                  </Button>
                  <Button onClick={stopGame} disabled={!isPlaying} variant="outline">
                    Pause
                  </Button>
                  <Button onClick={resetGame} variant="destructive" disabled={thinking}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Panel */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-400" />
                  Game Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="evaluation" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-slate-700">
                    <TabsTrigger value="evaluation" className="text-xs">
                      Evaluation
                    </TabsTrigger>
                    <TabsTrigger value="moves" className="text-xs">
                      Moves
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="text-xs">
                      Statistics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="evaluation" className="space-y-4">
                    {evaluation ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Position Evaluation</span>
                          <Badge variant={evaluation.score > 0 ? "default" : "destructive"}>
                            {evaluation.score > 0 ? "+" : ""}
                            {(evaluation.score / 100).toFixed(2)}
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${getEvaluationBar()}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="text-slate-300">{evaluation.timeElapsed}ms</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-400" />
                            <span className="text-slate-300">Depth {evaluation.depth}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-green-400" />
                            <span className="text-slate-300">{evaluation.nodesSearched.toLocaleString()} nodes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Swords className="h-4 w-4 text-yellow-400" />
                            <span className="text-slate-300">{evaluation.bestMove}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 py-8">
                        <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Start playing to see AI analysis</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="moves" className="space-y-2">
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {moveHistory.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">No moves yet</p>
                      ) : (
                        moveHistory.map((move, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center text-sm bg-slate-700/50 rounded px-2 py-1"
                          >
                            <span className="font-mono text-slate-300">{Math.floor(index / 2) + 1}.</span>
                            <span className="font-mono text-white">{move}</span>
                            <Badge variant={index % 2 === 0 ? "default" : "secondary"} className="text-xs">
                              {index % 2 === 0 ? "White" : "Black"}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="stats" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          White Stats
                        </h4>
                        <div className="space-y-1 text-sm text-slate-300">
                          <div className="flex justify-between">
                            <span>Captures:</span>
                            <span>{gameStats.captures.white}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Checks:</span>
                            <span>{gameStats.checks.white}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Castled:</span>
                            <span>{gameStats.castled.white ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                          <Swords className="h-4 w-4" />
                          Black Stats
                        </h4>
                        <div className="space-y-1 text-sm text-slate-300">
                          <div className="flex justify-between">
                            <span>Captures:</span>
                            <span>{gameStats.captures.black}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Checks:</span>
                            <span>{gameStats.checks.black}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Castled:</span>
                            <span>{gameStats.castled.black ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-600">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Total Moves:</span>
                        <span className="text-white font-mono">{moveHistory.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Game Status:</span>
                        <span className="text-white font-mono">
                          {engineRef.current?.isGameOver() ? "Finished" : "In Progress"}
                        </span>
                      </div>
                    </div>
                    {error && (
                      <div className="bg-red-900/20 border border-red-500/50 rounded p-2">
                        <span className="text-red-400 text-sm">Error: {error}</span>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
