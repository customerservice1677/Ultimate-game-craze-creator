
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Play, Pause, Zap, Star, Trophy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type GemType = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'bomb' | 'star';

interface Gem {
  id: string;
  type: GemType;
  row: number;
  col: number;
  isMatched: boolean;
  isPowerUp: boolean;
  isAnimating: boolean;
}

const BOARD_SIZE = 8;
const GEM_COLORS = {
  red: 'bg-gradient-to-br from-red-400 to-red-600',
  blue: 'bg-gradient-to-br from-blue-400 to-blue-600',
  green: 'bg-gradient-to-br from-green-400 to-green-600',
  yellow: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
  purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
  orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
  bomb: 'bg-gradient-to-br from-gray-700 to-black border-2 border-red-500',
  star: 'bg-gradient-to-br from-yellow-300 to-yellow-500 border-2 border-yellow-600'
};

const ChainBurstGame = () => {
  const [board, setBoard] = useState<Gem[][]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => 
    parseInt(localStorage.getItem('chainBurstHighScore') || '0')
  );
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedGem, setSelectedGem] = useState<{row: number, col: number} | null>(null);
  const [moves, setMoves] = useState(30);
  const [target, setTarget] = useState(1000);
  const [isAnimating, setIsAnimating] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const generateRandomGem = useCallback((row: number, col: number): Gem => {
    const types: GemType[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    // 5% chance for power-up gems at higher levels
    const isPowerUp = level > 3 && Math.random() < 0.05;
    const finalType = isPowerUp ? (Math.random() < 0.5 ? 'bomb' : 'star') : randomType;
    
    return {
      id: `${row}-${col}-${Date.now()}-${Math.random()}`,
      type: finalType,
      row,
      col,
      isMatched: false,
      isPowerUp: finalType === 'bomb' || finalType === 'star',
      isAnimating: false
    };
  }, [level]);

  const initializeBoard = useCallback(() => {
    const newBoard: Gem[][] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      newBoard[row] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        newBoard[row][col] = generateRandomGem(row, col);
      }
    }
    setBoard(newBoard);
  }, [generateRandomGem]);

  const findMatches = useCallback((currentBoard: Gem[][]) => {
    const matches: Gem[] = [];
    
    // Check horizontal matches
    for (let row = 0; row < BOARD_SIZE; row++) {
      let count = 1;
      let currentType = currentBoard[row][0].type;
      
      for (let col = 1; col < BOARD_SIZE; col++) {
        if (currentBoard[row][col].type === currentType && !currentBoard[row][col].isPowerUp) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = col - count; i < col; i++) {
              matches.push(currentBoard[row][i]);
            }
          }
          count = 1;
          currentType = currentBoard[row][col].type;
        }
      }
      
      if (count >= 3) {
        for (let i = BOARD_SIZE - count; i < BOARD_SIZE; i++) {
          matches.push(currentBoard[row][i]);
        }
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < BOARD_SIZE; col++) {
      let count = 1;
      let currentType = currentBoard[0][col].type;
      
      for (let row = 1; row < BOARD_SIZE; row++) {
        if (currentBoard[row][col].type === currentType && !currentBoard[row][col].isPowerUp) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = row - count; i < row; i++) {
              matches.push(currentBoard[i][col]);
            }
          }
          count = 1;
          currentType = currentBoard[row][col].type;
        }
      }
      
      if (count >= 3) {
        for (let i = BOARD_SIZE - count; i < BOARD_SIZE; i++) {
          matches.push(currentBoard[i][col]);
        }
      }
    }
    
    return matches;
  }, []);

  const handlePowerUp = useCallback((gem: Gem, currentBoard: Gem[][]) => {
    const affected: Gem[] = [];
    
    if (gem.type === 'bomb') {
      // Bomb destroys 3x3 area
      for (let r = Math.max(0, gem.row - 1); r <= Math.min(BOARD_SIZE - 1, gem.row + 1); r++) {
        for (let c = Math.max(0, gem.col - 1); c <= Math.min(BOARD_SIZE - 1, gem.col + 1); c++) {
          affected.push(currentBoard[r][c]);
        }
      }
    } else if (gem.type === 'star') {
      // Star destroys entire row and column
      for (let c = 0; c < BOARD_SIZE; c++) {
        affected.push(currentBoard[gem.row][c]);
      }
      for (let r = 0; r < BOARD_SIZE; r++) {
        affected.push(currentBoard[r][gem.col]);
      }
    }
    
    return affected;
  }, []);

  const removeMatches = useCallback((currentBoard: Gem[][]) => {
    let matches = findMatches(currentBoard);
    let allMatches: Gem[] = [];
    
    // Handle power-ups
    const powerUps = matches.filter(gem => gem.isPowerUp);
    powerUps.forEach(powerUp => {
      const powerUpMatches = handlePowerUp(powerUp, currentBoard);
      matches = [...matches, ...powerUpMatches];
    });
    
    if (matches.length === 0) return { newBoard: currentBoard, matchCount: 0 };
    
    allMatches = [...allMatches, ...matches];
    
    // Remove duplicates
    const uniqueMatches = allMatches.filter((gem, index, self) => 
      index === self.findIndex(g => g.row === gem.row && g.col === gem.col)
    );
    
    const newBoard = currentBoard.map(row => row.map(gem => {
      const isMatched = uniqueMatches.some(match => 
        match.row === gem.row && match.col === gem.col
      );
      return isMatched ? { ...gem, isMatched: true, isAnimating: true } : gem;
    }));
    
    return { newBoard, matchCount: uniqueMatches.length };
  }, [findMatches, handlePowerUp]);

  const dropGems = useCallback((currentBoard: Gem[][]) => {
    const newBoard = currentBoard.map(row => [...row]);
    
    for (let col = 0; col < BOARD_SIZE; col++) {
      const column = [];
      const emptySpaces = [];
      
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        if (!newBoard[row][col].isMatched) {
          column.push(newBoard[row][col]);
        } else {
          emptySpaces.push(row);
        }
      }
      
      // Fill empty spaces with new gems
      while (column.length < BOARD_SIZE) {
        column.push(generateRandomGem(0, col));
      }
      
      // Update positions
      for (let i = 0; i < BOARD_SIZE; i++) {
        newBoard[BOARD_SIZE - 1 - i][col] = {
          ...column[i],
          row: BOARD_SIZE - 1 - i,
          col: col,
          isMatched: false,
          isAnimating: i >= column.length - emptySpaces.length
        };
      }
    }
    
    return newBoard;
  }, [generateRandomGem]);

  const processMatches = useCallback(async () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    let currentBoard = [...board];
    let totalMatches = 0;
    let currentCombo = 0;
    
    while (true) {
      const { newBoard, matchCount } = removeMatches(currentBoard);
      
      if (matchCount === 0) break;
      
      totalMatches += matchCount;
      currentCombo++;
      
      // Animate matches
      setBoard(newBoard);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Drop gems
      const droppedBoard = dropGems(newBoard);
      setBoard(droppedBoard);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      currentBoard = droppedBoard;
    }
    
    if (totalMatches > 0) {
      const baseScore = totalMatches * 100;
      const comboBonus = currentCombo > 1 ? (currentCombo - 1) * 200 : 0;
      const newScore = score + baseScore + comboBonus;
      
      setScore(newScore);
      setCombo(currentCombo);
      
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('chainBurstHighScore', newScore.toString());
        toast({
          title: "🎉 New High Score!",
          description: `Amazing! You scored ${newScore} points!`,
        });
      }
      
      if (currentCombo > 1) {
        toast({
          title: `🔥 ${currentCombo}x Combo!`,
          description: `Bonus: +${comboBonus} points`,
        });
      }
      
      // Trigger score pulse animation
      const scoreElement = document.querySelector('.score-display');
      if (scoreElement) {
        scoreElement.classList.add('score-pulse');
        setTimeout(() => scoreElement.classList.remove('score-pulse'), 300);
      }
      
      // Shake board for big combos
      if (currentCombo >= 3 && boardRef.current) {
        boardRef.current.classList.add('board-shake');
        setTimeout(() => boardRef.current?.classList.remove('board-shake'), 500);
      }
    }
    
    setIsAnimating(false);
  }, [board, score, highScore, removeMatches, dropGems, isAnimating]);

  const swapGems = useCallback((row1: number, col1: number, row2: number, col2: number) => {
    if (isAnimating) return;
    
    const newBoard = board.map(row => [...row]);
    const temp = newBoard[row1][col1];
    newBoard[row1][col1] = { ...newBoard[row2][col2], row: row1, col: col1 };
    newBoard[row2][col2] = { ...temp, row: row2, col: col2 };
    
    setBoard(newBoard);
    setMoves(moves - 1);
    
    // Process matches after a short delay
    setTimeout(() => processMatches(), 100);
  }, [board, moves, processMatches, isAnimating]);

  const handleGemClick = useCallback((row: number, col: number) => {
    if (!isPlaying || isAnimating || moves <= 0) return;
    
    if (!selectedGem) {
      setSelectedGem({ row, col });
    } else {
      const { row: selectedRow, col: selectedCol } = selectedGem;
      
      // Check if gems are adjacent
      const isAdjacent = 
        (Math.abs(row - selectedRow) === 1 && col === selectedCol) ||
        (Math.abs(col - selectedCol) === 1 && row === selectedRow);
      
      if (isAdjacent) {
        swapGems(selectedRow, selectedCol, row, col);
      }
      
      setSelectedGem(null);
    }
  }, [selectedGem, isPlaying, moves, swapGems, isAnimating]);

  const startGame = useCallback(() => {
    initializeBoard();
    setScore(0);
    setCombo(0);
    setLevel(1);
    setMoves(30);
    setTarget(1000);
    setIsPlaying(true);
    setSelectedGem(null);
  }, [initializeBoard]);

  const resetGame = useCallback(() => {
    setIsPlaying(false);
    setBoard([]);
    setScore(0);
    setCombo(0);
    setLevel(1);
    setMoves(30);
    setTarget(1000);
    setSelectedGem(null);
  }, []);

  useEffect(() => {
    if (isPlaying && score >= target) {
      setLevel(level + 1);
      setTarget(target * 2);
      setMoves(moves + 10);
      toast({
        title: `🎯 Level ${level + 1}!`,
        description: `New target: ${target * 2} points`,
      });
    }
  }, [score, target, level, moves, isPlaying]);

  useEffect(() => {
    if (isPlaying && moves <= 0 && score < target) {
      setIsPlaying(false);
      toast({
        title: "💀 Game Over",
        description: `Final score: ${score} points`,
      });
    }
  }, [moves, score, target, isPlaying]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            ⚡ Chain Burst ⚡
          </h1>
          <p className="text-white/80">Match 3+ gems to create explosive chain reactions!</p>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-3 bg-white/10 border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-white score-display">{score.toLocaleString()}</div>
              <div className="text-sm text-white/60">Score</div>
            </div>
          </Card>
          
          <Card className="p-3 bg-white/10 border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</div>
              <div className="text-sm text-white/60">High Score</div>
            </div>
          </Card>
          
          <Card className="p-3 bg-white/10 border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{level}</div>
              <div className="text-sm text-white/60">Level</div>
            </div>
          </Card>
          
          <Card className="p-3 bg-white/10 border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{moves}</div>
              <div className="text-sm text-white/60">Moves</div>
            </div>
          </Card>
          
          <Card className="p-3 bg-white/10 border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{target.toLocaleString()}</div>
              <div className="text-sm text-white/60">Target</div>
            </div>
          </Card>
        </div>

        {/* Combo Display */}
        {combo > 1 && (
          <div className="text-center mb-4">
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg px-4 py-2">
              🔥 {combo}x COMBO!
            </Badge>
          </div>
        )}

        {/* Game Board */}
        <div className="flex justify-center mb-6">
          <div 
            ref={boardRef}
            className="grid grid-cols-8 gap-1 p-4 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm"
          >
            {board.map((row, rowIndex) =>
              row.map((gem, colIndex) => (
                <div
                  key={gem.id}
                  className={`
                    w-12 h-12 rounded-lg cursor-pointer transition-all duration-200 border-2
                    ${GEM_COLORS[gem.type]}
                    ${selectedGem?.row === rowIndex && selectedGem?.col === colIndex 
                      ? 'border-white scale-110 shadow-lg' 
                      : 'border-transparent hover:scale-105'
                    }
                    ${gem.isAnimating ? (gem.isMatched ? 'gem-pop' : 'gem-fall') : ''}
                    ${gem.isPowerUp ? 'powerup-glow' : ''}
                  `}
                  onClick={() => handleGemClick(rowIndex, colIndex)}
                >
                  <div className="w-full h-full flex items-center justify-center text-white font-bold">
                    {gem.type === 'bomb' && '💣'}
                    {gem.type === 'star' && '⭐'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Game Controls */}
        <div className="flex justify-center gap-4">
          {!isPlaying ? (
            <Button 
              onClick={startGame}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 text-lg"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          ) : (
            <Button 
              onClick={resetGame}
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 px-8 py-3 text-lg"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Reset
            </Button>
          )}
        </div>

        {/* Instructions */}
        <Card className="mt-6 p-4 bg-white/10 border-white/20">
          <h3 className="text-white font-bold mb-2 flex items-center">
            <Star className="mr-2 h-5 w-5 text-yellow-400" />
            How to Play
          </h3>
          <div className="text-white/80 text-sm space-y-1">
            <p>• Click two adjacent gems to swap them</p>
            <p>• Match 3+ gems in a row or column to score points</p>
            <p>• 💣 Bomb gems destroy a 3x3 area</p>
            <p>• ⭐ Star gems destroy entire rows and columns</p>
            <p>• Create chain reactions for massive combo bonuses!</p>
            <p>• Reach the target score to advance to the next level</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChainBurstGame;
