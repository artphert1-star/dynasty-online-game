'use strict';
const { Game, STYLES } = require('./engine');
const N = Math.max(1, Number(process.argv[2]) || 500);
for (const n of [3,4,5,6]) {
  let emperor=0,eras=0;
  for(let k=0;k<N;k++) {
    const g=new Game(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,bot:true,style:STYLES[(i+k)%6]})));
    let steps=0;
    while(!g.winner && steps++<1000) {
      if(['setup','between'].includes(g.phase))g.startEra();
      else if(g.botStep())continue;
      else if(g.phase==='negotiation')g.beginPlacement();
      else if(g.phase==='placement')g.beginTurns();
      else if(g.phase==='end')g.finishEra();
      else throw new Error('Simulation stalled: '+g.phase);
    }
    if(!g.winner)throw new Error('Simulation exceeded step limit');
    emperor+=g.winner.rank===5?1:0;eras+=g.era;
  }
  console.log(`${n} players / ${N} games: emperor ${(100*emperor/N).toFixed(1)}%, mean era ${(eras/N).toFixed(2)}`);
}
console.log('Bot simulations verify execution; they do not establish balance for human play.');
