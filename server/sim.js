const { Game, STYLES } = require('./engine');
for (const n of [3,4,5,6]) {
  let emp=0, eras=0, N=1500, kid=0, child=0, ran=0, rolls=0;
  for (let k=0;k<N;k++){
    const g=new Game(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,bot:true,style:STYLES[(i+k)%6]})));
    let guard=0; while(!g.winner && guard++<20){ g.startEra(); g.openWindow(); g.resolve(); rolls+=g.ev.filter(e=>e.t==='roll').length;
      g.log.forEach(l=>{}); }
    if(g.winner.rank===5) emp++; eras+=g.era;
    kid+=g.log.filter(l=>l.includes('ลักพาตัวทายาท')).length; ran+=g.log.filter(l=>l.includes('ไถ่ทายาท')).length; child+=g.log.filter(l=>l.includes('ลูกลับ')).length;
  }
  console.log(n+'p: emperor',(emp/N*100).toFixed(0)+'%','avg era',(eras/N).toFixed(2),'| kidnap/game',(kid/N).toFixed(2),'ransom/game',(ran/N).toFixed(2),'child events/game',(child/N).toFixed(2));
}
