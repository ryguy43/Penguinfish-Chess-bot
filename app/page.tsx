"use client"

import { useState } from "react"
import { ChessGame } from "@/components/chess-game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ChessBot() {
  const [gameKey, setGameKey] = useState(0)

  const resetGame = () => {
    setGameKey((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Custom Chess Bot Arena</CardTitle>
            <p className="text-center text-muted-foreground">
              Watch two AI bots battle it out with 10-ply search depth
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={resetGame} size="lg">
              Start New Game
            </Button>
          </CardContent>
        </Card>

        <ChessGame key={gameKey} />
      </div>
    </div>
  )
}
