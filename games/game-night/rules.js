// "How to play" text for every table, keyed by scene name. Shown by the ? button on each game.

export const RULES = {
  TicTacToe: {
    title: 'Tic-Tac-Toe',
    sections: [
      { heading: 'Goal', text: 'Get three of your marks in a row: across, down or diagonally.' },
      { heading: 'How to play', items: ['X and O take turns placing one mark in an empty square.', 'Tap a square to place your mark.', 'If all nine squares fill with no line, the game is a draw.', 'Players swap who goes first each round.'] },
      { heading: 'Tip', text: 'Take the centre or a corner first, and always block your opponent when they have two in a row.' },
    ],
  },
  Reversi: {
    title: 'Reversi',
    sections: [
      { heading: 'Goal', text: 'Have more discs of your colour on the board when the game ends.' },
      { heading: 'How to play', items: ['Dark moves first. Place a disc so that it traps one or more straight lines of your opponent\'s discs between it and another of your discs (across, down or diagonally).', 'Every trapped disc flips to your colour.', 'A move must flip at least one disc. The dots show your legal moves.', 'If you have no legal move you must pass. The game ends when neither player can move.'] },
      { heading: 'Tip', text: 'Corners can never be flipped. Avoid the squares right next to an empty corner.' },
    ],
  },
  Checkers: {
    title: 'Checkers',
    sections: [
      { heading: 'Goal', text: 'Capture all of your opponent\'s pieces, or leave them with no legal move.' },
      { heading: 'Moving', items: ['Dark moves first. Pieces move one square diagonally forward onto an empty dark square.', 'Tap a piece, then tap where it should go.'] },
      { heading: 'Capturing', items: ['Jump diagonally over an opponent\'s piece onto the empty square beyond to capture it.', 'If you can capture, you must.', 'After a jump, keep jumping with the same piece if you can (a multi-jump).'] },
      { heading: 'Kings', items: ['A piece reaching the far row is crowned a king (shown stacked) and its turn ends.', 'Kings move and capture diagonally forward and backward.'] },
      { heading: 'Draw', text: 'If 40 moves pass for each player with no capture and no crowning, the game is a draw.' },
    ],
  },
  Chess: {
    title: 'Chess',
    sections: [
      { heading: 'Goal', text: 'Checkmate the enemy king: attack it so that it has no way to escape.' },
      { heading: 'How the pieces move', items: ['King: one square any direction.', 'Queen: any distance in a straight line or diagonal.', 'Rook: any distance in a straight line.', 'Bishop: any distance diagonally.', 'Knight: an L shape (two squares one way, one square to the side); it jumps over pieces.', 'Pawn: one square forward (two from its starting square), captures one square diagonally forward.'] },
      { heading: 'Special moves', items: ['Castling: move the king two squares toward a rook, and the rook jumps over it. Allowed only if neither has moved, the squares between are empty, and the king is not in, through or into check.', 'En passant: a pawn that just moved two squares can be captured by an enemy pawn beside it as if it had moved one.', 'Promotion: a pawn reaching the last row becomes a queen, rook, bishop or knight (you choose).'] },
      { heading: 'Check and draws', items: ['You may never leave your own king in check.', 'Stalemate (no legal move but not in check) is a draw.', 'Also drawn: not enough pieces to mate, 50 moves without a capture or pawn move, or the same position three times.'] },
      { heading: 'Controls', text: 'Tap a piece to see its moves, then tap a highlighted square. You play White at the bottom.' },
    ],
  },
  Go: {
    title: 'Go (9x9)',
    sections: [
      { heading: 'Goal', text: 'Surround more of the board than your opponent. Your score is your stones plus the empty points you completely surround. White gets 6.5 extra points (komi) for moving second.' },
      { heading: 'How to play', items: ['Black plays first. Players take turns placing one stone on an empty point. Stones never move.', 'A stone or connected group with no empty neighbouring points (liberties) is captured and removed.', 'Suicide is not allowed: you can\'t play where your stone would have no liberties, unless it captures.', 'Ko: you can\'t make a move that recreates the board position from just before your last turn.', 'You may pass instead of playing. Two passes in a row end the game.'] },
      { heading: 'Counting', items: ['After both pass, groups that can\'t avoid capture are marked dead (red X). The game suggests them; tap a group to change it.', 'Tap Score to remove the dead stones and count.'] },
    ],
  },
  Tables: {
    title: 'Tables (Backgammon)',
    sections: [
      { heading: 'Goal', text: 'Move all 15 of your checkers into your home board, then bear them all off before your opponent.' },
      { heading: 'Moving', items: ['You play Light. Your checkers travel from the top right, across the top to the left, then back along the bottom to your home board at the bottom right (points 1 to 6).', 'Each player rolls one die to start; the higher roll moves first using both numbers.', 'Each die is a separate move of that many points. Doubles are played four times.', 'You may land on an empty point, your own point, or a point with a single enemy checker (a blot). You can\'t land on a point with 2 or more enemy checkers.', 'You must use both dice if you can. If only one can be used, you must use the larger if possible.'] },
      { heading: 'Hitting and the bar', items: ['Landing on a blot hits it: it goes to the bar in the middle.', 'A checker on the bar must re-enter in the opponent\'s home board before any other move.'] },
      { heading: 'Bearing off', items: ['Once all your checkers are home, move them off with exact rolls.', 'A higher roll may bear off your furthest-back checker.'] },
      { heading: 'Winning', items: ['Single game: 1 point.', 'Gammon: the loser hasn\'t borne off any checkers (2 points).', 'Backgammon: also has a checker on the bar or in your home board (3 points).'] },
      { heading: 'Controls', text: 'Tap Roll, tap a highlighted point to pick a checker, then tap where it goes. Undo takes back the turn so far.' },
    ],
  },
  Dominoes: {
    title: 'Dominoes',
    sections: [
      { heading: 'Goal', text: 'Be first to play all your tiles. First to 100 points wins the match.' },
      { heading: 'Starting', items: ['Each player draws 7 tiles; the rest form the boneyard.', 'Whoever holds the highest double leads with it. That first double is the spinner.'] },
      { heading: 'Playing', items: ['Play a tile whose end matches an open end of the layout.', 'Tiles can go on the left and right of the spinner. Once both of those sides are covered, the top and bottom of the spinner open too, so you can build in all four directions.', 'Tap a glowing tile, then tap the glowing spot where you want it. Tiles fit only where the numbers match.', 'If you can\'t play, draw from the boneyard until you can. If the boneyard is empty, pass.'] },
      { heading: 'Scoring', items: ['Domino! The first player out scores the pips left in the opponent\'s hand.', 'If nobody can play (blocked), the lighter hand wins and scores the other hand\'s pips.'] },
    ],
  },
  SeaBattle: {
    title: 'Sea Battle',
    sections: [
      { heading: 'Goal', text: 'Sink all five enemy ships before they sink yours.' },
      { heading: 'Your fleet', items: ['Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.', 'Tap a ship to pick it, tap a square to move its front there, and tap Rotate to turn it. Ships lie in straight lines and may touch but not overlap.', 'Shuffle places them all at random.'] },
      { heading: 'Battle', items: ['Take turns firing one shot. Tap a square on the top grid.', 'An orange ring is a hit and a dark ring is a miss. When every square of a ship is hit, it sinks and its name is announced.', 'Your own grid, below, shows where the computer has fired.'] },
    ],
  },
  Yacht: {
    title: 'Yacht Dice',
    sections: [
      { heading: 'Goal', text: 'Score the most points over 13 rounds by filling each box of the scorecard once.' },
      { heading: 'Each round', items: ['Roll five dice up to three times. Tap dice to hold them between rolls.', 'Then pick one empty box to score in. You can take 0 in any box.'] },
      { heading: 'Boxes', items: ['Ones to Sixes: total of that number. 63 or more in these six earns a 35 point bonus.', '3 of a Kind / 4 of a Kind: total of all dice.', 'Full House (3 + 2): 25.', 'Small Straight (4 in a row): 30. Large Straight (5 in a row): 40.', 'Yacht (5 of a kind): 50.', 'Chance: total of all dice.'] },
      { heading: 'Extra Yachts', items: ['Each extra Yacht after scoring 50 in the Yacht box is worth +100.', 'Joker rule: if the Yacht box is already filled, you must use the matching upper box if it\'s open. Otherwise you may score any lower box at full value (Full House 25, Straights 30 and 40).'] },
    ],
  },
  Solitaire: {
    title: 'Solitaire (Klondike)',
    sections: [
      { heading: 'Goal', text: 'Build all four suits up from Ace to King on the foundations at the top right.' },
      { heading: 'The table', items: ['Seven columns, with the top card of each face up.', 'In a column, stack cards down in alternating colours (a red 6 on a black 7).', 'You can move a face-up card together with everything on top of it.', 'Only a King (or a stack starting with one) may go in an empty column.', 'When you move away the last face-up card in a column, the card under it turns up.'] },
      { heading: 'Stock and waste', items: ['Tap the deck at the top left to turn cards (one at a time, or three with Draw 3).', 'Only the top waste card can be played. When the deck runs out, tap it to turn the waste back over.'] },
      { heading: 'Controls', items: ['Tap a card to pick it up, then tap where it should go.', 'Tap the same card twice to send it to its best spot.', 'Undo takes back moves. New deal lets you choose Draw 1 or Draw 3. Finish plays out a solved game.'] },
    ],
  },
  WildCards: {
    title: 'Wild Cards',
    sections: [
      { heading: 'Goal', text: 'Be first to play all your cards. Rounds score points, and first to 500 wins the match.' },
      { heading: 'Your turn', items: ['Play a card that matches the top card by colour, number or symbol, or play a Wild.', 'You may draw a card instead. If the drawn card matches, you can play it straight away or keep it.'] },
      { heading: 'Action cards', items: ['Skip: the next player misses a turn.', 'Reverse: play changes direction.', 'Draw Two: the next player draws 2 and misses a turn.', 'Wild: you choose the colour.', 'Wild Draw Four: choose the colour; the next player draws 4 and misses a turn. You may only play it when you have no card of the current colour.'] },
      { heading: 'Challenging a Draw Four', items: ['If a +4 is played on you, you can challenge it.', 'If the player still had a card of the colour, they draw 4 instead and you take your turn.', 'If they didn\'t, you draw 6 and miss your turn.'] },
      { heading: 'UNO!', items: ['Tap UNO! before playing your second-to-last card. If you forget and get caught, you draw 2.', 'If a computer player forgets, tap Catch! quickly to make them draw 2.'] },
      { heading: 'Scoring', text: 'The winner scores the cards left in everyone else\'s hands: number cards count their face value, Skip, Reverse and Draw Two count 20, and Wilds count 50.' },
      { heading: 'First card', text: 'If the first card turned over is an action card, it takes effect on the first player. A Wild Draw Four goes back in the deck.' },
    ],
  },
  AirHockey: {
    title: 'Air Hockey',
    sections: [
      { heading: 'Goal', text: 'Hit the puck into the computer\'s goal at the top. First to 7 goals wins.' },
      { heading: 'Controls', items: ['Drag anywhere in your half to move your blue mallet.', 'Your mallet can\'t cross the centre line.', 'Swing through the puck to hit it harder, and bank shots off the side walls.'] },
    ],
  },
  BlockBreaker: {
    title: 'Block Breaker',
    sections: [
      { heading: 'Goal', text: 'Break every brick to clear the level. Score as many points as you can before your three balls run out.' },
      { heading: 'Controls', items: ['Drag left and right to move the paddle. Tap to launch the ball.', 'Where the ball hits the paddle sets its angle: the edges send it out sideways.'] },
      { heading: 'Bricks', items: ['Green and orange bricks break in one hit. Red takes 2 hits and lavender takes 3.', 'Higher bricks are worth more points.'] },
      { heading: 'Power-ups', text: 'Catch falling capsules with the paddle: W makes the paddle wide, M splits the ball into three, and S slows the ball down.' },
    ],
  },
  SpaceRocks: {
    title: 'Space Rocks',
    sections: [
      { heading: 'Goal', text: 'Blast every rock to clear the wave. Waves get bigger and faster.' },
      { heading: 'Controls', items: ['< and > rotate the ship. Go fires the thruster. Fire shoots.', 'Your ship drifts in space and wraps around the screen edges, and so do the rocks.'] },
      { heading: 'Rocks', items: ['Big rocks split into two medium ones, and medium rocks split into two small ones.', 'Big 20, medium 50, small 100 points.', 'Touching a rock costs a ship. You have three, and you blink (safe) for a moment after respawning.'] },
    ],
  },
  Bowling: {
    title: 'Bowling',
    sections: [
      { heading: 'Goal', text: 'Knock down as many pins as possible over 10 frames. A perfect game scores 300.' },
      { heading: 'Throwing', items: ['Tap once to stop the ball at your starting spot.', 'Tap again to set the angle as the arrow swings.', 'Tap a third time to set the power on the meter.'] },
      { heading: 'Scoring', items: ['Each frame you get two balls to knock down all 10 pins.', 'Strike (X): all 10 with the first ball. Scores 10 plus your next two balls.', 'Spare (/): all 10 with two balls. Scores 10 plus your next ball.', 'Otherwise, a frame scores the pins knocked down.', 'In the 10th frame, a strike or spare earns bonus balls (up to three balls in total).'] },
    ],
  },
  Pool: {
    title: 'Pool (8-Ball)',
    sections: [
      { heading: 'Goal', text: 'Pot all of your group (solids 1-7 or stripes 9-15), then sink the 8 ball in the pocket you call.' },
      { heading: 'Shooting', items: ['Put your finger down and drag back away from the cue ball, like pulling a slingshot. The dotted line shows where it will go and the bar shows power.', 'Let go to shoot.'] },
      { heading: 'Groups', items: ['The table is open after the break. Your first legal pot after that decides your group.', 'Keep shooting as long as you pot a ball of your group.'] },
      { heading: 'Fouls (ball in hand)', items: ['Potting the cue ball (scratch), missing every ball, hitting the other group (or the 8) first, or no ball reaching a rail or pocket after contact.', 'After a foul the other player gets ball in hand: drag the cue ball anywhere, then shoot.'] },
      { heading: 'The 8 ball', items: ['Once your group is cleared, tap a pocket to call it, then sink the 8 there to win.', 'You lose if the 8 goes in early, in a different pocket, or you scratch on it.', 'An 8 potted on the break is just put back on its spot.'] },
    ],
  },
  Tanks: {
    title: 'Tank Battle',
    sections: [
      { heading: 'Goal', text: 'Destroy all 12 enemy tanks in each stage while protecting your flag at the bottom of the map.' },
      { heading: 'Controls', items: ['Hold the arrows to drive. Hold FIRE to shoot.', 'You can have one shell in the air at a time.'] },
      { heading: 'The map', items: ['Brick walls break when shot. Steel blocks stop shells.', 'Water blocks tanks but not shells. Bushes hide tanks.', 'If any shell hits your flag, the game is over.'] },
      { heading: 'Enemies', text: 'Green tanks are basic, red tanks are fast, and white tanks take two hits. Shells cancel out when they collide.' },
    ],
  },
  BoxBox: {
    title: 'Box Box',
    sections: [
      { heading: 'Goal', text: 'Push every box onto a gold target square.' },
      { heading: 'Rules', items: ['Move with the arrows or by swiping on the board.', 'You can push one box at a time, and only push (never pull).', 'A box pushed into a corner can\'t be moved out, so plan ahead.'] },
      { heading: 'Controls', text: 'Undo takes back a move, Reset restarts the level. Finishing a level unlocks the next; all 16 can be solved.' },
    ],
  },
  SixBall: {
    title: 'Six Ball',
    sections: [
      { heading: 'Goal', text: 'Line up three or more gems of the same colour to clear them, and keep the well from filling up.' },
      { heading: 'Controls', items: ['< and > (or swipe) move the falling stack.', 'Turn (or tap the well) rotates the order of its three gems.', 'Drop (or swipe down) drops it instantly for bonus points.'] },
      { heading: 'Scoring', items: ['Lines count across, down and diagonally.', 'After gems clear, the ones above fall and can clear again: chains multiply your score.', 'Every 30 gems cleared, the level and speed go up.', 'The game ends when there is no room for a new stack at the top.'] },
    ],
  },
  MoleRunner: {
    title: 'Mole Runner',
    sections: [
      { heading: 'Goal', text: 'Collect every gem on the level without getting caught.' },
      { heading: 'Moving', items: ['Hold the arrows to run, climb ladders, and hang from ropes.', 'Press down on a rope to let go and drop.', 'Walking off a ledge makes you fall.'] },
      { heading: 'Digging', items: ['Dig left / Dig right makes a hole in the brick diagonally below you on that side. Stone can\'t be dug.', 'Holes fill back in after a few seconds. Don\'t be standing in one when it does!', 'Enemies that fall into a hole get stuck for a moment, and you can run across their heads. If the hole fills while they\'re in it, they reappear at the top.'] },
      { heading: 'Lives', text: 'You have three lives. Touching an enemy costs one and restarts the level.' },
    ],
  },
};
