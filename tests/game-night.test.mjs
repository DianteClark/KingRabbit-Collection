import assert from 'node:assert/strict';
const R=new URL('../games/game-night/logic/', import.meta.url).href;
const T=await import(R+'tictactoe.js'), V=await import(R+'reversi.js'), Y=await import(R+'yacht.js');
// TTT
assert.deepEqual(T.result(['X','X','X',null,'O','O',null,null,null]).winner,'X');
assert.equal(T.result(['X','O','X','X','O','O','O','X','X']).winner,'draw');
// perfect CPU blocks
assert.equal(T.cpuMove(['X','X',null,null,'O',null,null,null,null],'O',{mistakeChance:0}),2);
// perfect CPU wins when it can
assert.equal(T.cpuMove(['O','O',null,'X','X',null,null,null,'X'],'O',{mistakeChance:0}),2);
// perfect vs perfect = draw
let b=Array(9).fill(null),turn='X'; while(!T.result(b)){b[T.cpuMove(b,turn,{mistakeChance:0})]=turn;turn=turn==='X'?'O':'X';}
assert.equal(T.result(b).winner,'draw');
// Reversi
let rb=V.newBoard(); assert.deepEqual(V.legalMoves(rb,1).sort((a,b)=>a-b),[19,26,37,44]);
let p=V.play(rb,19,1); assert.deepEqual(p.flips,[27]); assert.deepEqual(V.count(p.board),{dark:4,light:1});
// full CPU vs CPU game ends with 64 or over
let pl=1, passes=0, t0=Date.now(), maxMove=0;
while(!V.isOver(rb)){const s=Date.now(); const m=V.cpuMove(rb,pl); maxMove=Math.max(maxMove,Date.now()-s); if(m>=0) rb=V.play(rb,m,pl).board; pl=V.other(pl);}
console.log('reversi final',V.count(rb),'slowest move ms',maxMove,'total',Date.now()-t0);
// Yacht
assert.equal(Y.score('house',[2,2,3,3,3]),25); assert.equal(Y.score('house',[3,3,3,3,3]),0);
assert.equal(Y.score('small',[1,2,3,4,6]),30); assert.equal(Y.score('small',[1,2,3,5,6]),0);
assert.equal(Y.score('large',[2,3,4,5,6]),40); assert.equal(Y.score('yacht',[4,4,4,4,4]),50);
assert.equal(Y.score('three',[4,4,4,1,2]),15); assert.equal(Y.score('fours',[4,4,4,1,2]),12);
assert.deepEqual(Y.totals({ones:3,twos:6,threes:9,fours:12,fives:15,sixes:18,chance:20}),{upper:63,bonus:35,lower:20,total:118});
console.log('all logic tests passed');
