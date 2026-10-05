const { chromium } = require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {Game}=require('./server/engine');
(async()=>{
 const server=spawn(process.execPath,['server/server.js'],{env:{...process.env,PORT:'3102'},stdio:'pipe'});
 let browser;
 try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.goto('http://localhost:3102');
  await page.locator('#name').fill('ราชวงศ์ทดสอบ');
  await page.getByRole('button',{name:'⚜ สร้างห้องใหม่',exact:true}).click();
  await page.getByRole('button',{name:/Balanced/}).click();
  await page.getByRole('button',{name:/Climber/}).click();
  await page.getByRole('button',{name:'⚔️ เริ่มเกม!',exact:true}).click();
  await page.getByRole('button',{name:'พร้อมจบเจรจา',exact:true}).waitFor();
  fs.mkdirSync('qa',{recursive:true});
  await page.screenshot({path:'qa/desktop-negotiation.png',fullPage:true});
  await page.getByRole('button',{name:'พร้อมจบเจรจา',exact:true}).click();
  await page.getByRole('button',{name:'ล็อกซองลับ',exact:true}).waitFor();
  await page.screenshot({path:'qa/desktop-placement.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'qa/mobile-placement.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
  await page.getByRole('button',{name:'ล็อกซองลับ',exact:true}).click();
  for(let i=0;i<20;i++){
    const response=page.getByRole('button',{name:'🎲 ทอยตอนนี้',exact:true});
    const defend=page.getByRole('button',{name:'ยืนยันและทอย',exact:true});
    const end=page.getByRole('button',{name:'จบตา',exact:true});
    if(await response.count())await response.click();
    else if(await defend.count())await defend.click();
    else if(await end.count())break;
    else await page.waitForTimeout(100);
  }
  await page.getByRole('button',{name:'ประกาศขอเลื่อนยศ',exact:true}).click();
  for(let i=0;i<20;i++){
    if(await page.getByRole('button',{name:'🎲 ทอยตอนนี้',exact:true}).count())break;
    await page.waitForTimeout(100);
  }
  await page.getByRole('button',{name:'🎲 ทอยตอนนี้',exact:true}).click();
  await page.waitForTimeout(200);
  await page.getByRole('button',{name:'🏛️ กิจการเมือง',exact:true}).click();
  await page.getByRole('button',{name:'ยืนยันการกระทำและเปิดการ์ด',exact:true}).click();
  await page.screenshot({path:'qa/mobile-turn.png',fullPage:true});
  await page.getByRole('button',{name:'📖 คู่มือ',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({path:'qa/mobile-help.png',fullPage:true});
  assert.deepEqual(errors,[],'JavaScript browser errors');
  // Render every decision panel with real engine views, including branches rarely reached by bots.
  const g=new Game([{id:'test0',name:'ฝ่ายทดสอบ'},{id:'test1',name:'เป้าหมาย'},{id:'test2',name:'คู่แข่ง'}]);
  g.startEra();g.beginPlacement();for(const p of g.players)g.submit(p.id,[{type:'guard'}]);g.beginTurns();
  for(const kind of ['lobby','defense','petition','rebellion','birth','destroy']){
    g.P('test0').secrets=[{v:2,about:'test1'}];
    g.pending={kind,actor:kind==='petition'||kind==='rebellion'||kind==='birth'?'test0':'test1',responder:'test0',order:{type:'intrigue',pay:1},cards:[g.drawHeir(),g.drawHeir(),g.drawHeir()],keepSpare:true};
    const state={code:'UITEST',me:'test0',host:'test0',started:true,members:g.players.map(p=>({pid:p.id,name:p.name})),game:g.view('test0'),waiting:[],replay:null};
    await page.evaluate(s=>{S=s;helpOpen=false;render();},state);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,kind+' overflow');
  }
  assert.deepEqual(errors,[],'decision panel errors');
  console.log('Browser checks passed: live flow, mobile overflow, help, six decision panels; screenshots in qa/');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
