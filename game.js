// Princess Rescue — GitHub Pages build with touch controls & audio
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // UI
  const livesEl = document.getElementById('lives');
  const heartsEl = document.getElementById('hearts');
  const timeEl = document.getElementById('time');
  const dlgStart = document.getElementById('startScreen');
  const dlgAge = document.getElementById('ageGate');
  const dlgHow = document.getElementById('how');
  const dlgShop = document.getElementById('shop');
  const dlgRescue = document.getElementById('rescue');
  const btnStart = document.getElementById('btn-start');
  const btnHow = document.getElementById('btn-how');
  const btnShop = document.getElementById('btn-shop');
  const btnMembership = document.getElementById('btn-membership');
  const btnReplay = document.getElementById('btn-replay');
  const btnUpgrade = document.getElementById('btn-upgrade');
  const confirm18 = document.getElementById('confirm18');
  const enter = document.getElementById('enter');
  const audioBtn = document.getElementById('btn-audio');

  // Touch buttons
  const tLeft = document.getElementById('btn-left');
  const tRight = document.getElementById('btn-right');
  const tJump = document.getElementById('btn-jump');

  // Start screen first
  setTimeout(() => dlgStart.showModal(), 50);
  btnStart?.addEventListener('click', () => {
    // After start screen, show age gate if not confirmed
    const ok = localStorage.getItem('age_ok') === 'yes';
    if (!ok) setTimeout(() => dlgAge.showModal(), 30);
  });

  // Age gate
  enter?.addEventListener('click', (e) => {
    if (!confirm18.checked) { e.preventDefault(); alert('Du måste bekräfta 18+.'); }
    else localStorage.setItem('age_ok', 'yes');
  });

  // Dialogs
  btnHow.addEventListener('click', () => dlgHow.showModal());
  btnShop.addEventListener('click', () => dlgShop.showModal());
  btnMembership?.addEventListener('click', (e) => {
    e.preventDefault(); alert('Demo: koppla betalning i produktion.');
  });
  btnReplay?.addEventListener('click', () => { dlgRescue.close(); reset(); });
  btnUpgrade?.addEventListener('click', () => { dlgRescue.close(); dlgShop.showModal(); });

  // Audio (procedural)
  let ac, musicOn = true, musicTimer;
  function initAudio(){ if(ac) return; ac = new (window.AudioContext||window.webkitAudioContext)(); startMusic(); }
  function beep(freq=440,dur=0.12,type='square',gain=0.25){ if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=gain; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur); o.stop(ac.currentTime+dur+0.02); }
  function chord(freqs,d=0.25){ freqs.forEach(f=>beep(f,d,'triangle',0.2)); }
  function startMusic(){ if(!ac||!musicOn) return; stopMusic(); const seq=[262,330,392,523,392,330,294,330]; let i=0; musicTimer=setInterval(()=>{beep(seq[i%seq.length],0.15,'triangle',0.14); i++;},320); }
  function stopMusic(){ if(musicTimer) clearInterval(musicTimer); musicTimer=null; }
  audioBtn.addEventListener('click',()=>{ initAudio(); musicOn=!musicOn; audioBtn.textContent=musicOn?'🔊':'🔈'; if(musicOn) startMusic(); else stopMusic(); });
  document.body.addEventListener('keydown',()=>initAudio(),{once:true});

  // Input state
  const keys = {};
  addEventListener('keydown', e => keys[e.key] = true);
  addEventListener('keyup', e => keys[e.key] = false);

  // Touch → keys
  let leftHeld=false, rightHeld=false, jumpHeld=false;
  function bindTouch(btn, onDown, onUp) {
    const down = (e)=>{ e.preventDefault(); onDown(); };
    const up = (e)=>{ e.preventDefault(); onUp(); };
    btn.addEventListener('touchstart', down); btn.addEventListener('mousedown', down);
    btn.addEventListener('touchend', up); btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  }
  bindTouch(tLeft, ()=>{leftHeld=true;}, ()=>{leftHeld=false;});
  bindTouch(tRight, ()=>{rightHeld=true;}, ()=>{rightHeld=false;});
  bindTouch(tJump, ()=>{jumpHeld=true;}, ()=>{jumpHeld=false;});

  // Game state
  const sky='#ffeef7', ground='#d7f0ff', block='#ffe1ef', spike='#f6a0c1', blobC='#c6a3ff', heartC='#ff7aa2';
  let player, princess, platforms, movers, spikesArr, blobs, hearts, startTime, collectCount, lives, won;

  function reset(){
    player={x:60,y:420,w:28,h:36,vx:0,vy:0,onGround:false,dir:1};
    princess={x:840,y:140,w:28,h:44};
    platforms=[[0,500,960,40],[160,440,120,16],[320,380,120,16],[520,320,120,16],[720,260,120,16],[780,180,140,16]];
    movers=[{x:240,y:480,w:100,h:16,dx:0,dy:-1.2,range:60,t:0},{x:610,y:360,w:90,h:16,dx:1.4,dy:0,range:80,t:0}];
    spikesArr=[[220,500,28],[248,500,28],[276,500,28],[420,500,28],[448,500,28],[476,500,28],[520,500,28],[548,500,28],[400,364,28],[580,308,28]];
    blobs=[{x:330,y:364,w:26,h:18,vx:1,minX:320,maxX:440},{x:740,y:244,w:26,h:18,vx:-1,minX:720,maxX:840}];
    hearts=[{x:185,y:400,r:7,taken:false},{x:350,y:340,r:7,taken:false},{x:550,y:280,r:7,taken:false},{x:750,y:220,r:7,taken:false},{x:880,y:150,r:7,taken:false}];
    collectCount=0; lives=3; won=false; startTime=performance.now(); livesEl.textContent=lives; heartsEl.textContent=collectCount;
  }
  function rectsOverlap(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
  function pointInTriangle(px,py,ax,ay,bx,by,cx,cy){const v0x=cx-ax,v0y=cy-ay,v1x=bx-ax,v1y=by-ay,v2x=px-ax,v2y=py-ay;const dot00=v0x*v0x+v0y*v0y,dot01=v0x*v1x+v0y*v1y,dot02=v0x*v2x+v0y*v2y,dot11=v1x*v1x+v1y*v1y,dot12=v1x*v2x+v1y*v2y;const inv=1/(dot00*dot11-dot01*dot01);const u=(dot11*dot02-dot01*dot12)*inv,v=(dot00*dot12-dot01*dot02)*inv;return (u>=0)&&(v>=0)&&((u+v)<1);}
  const GRAV=0.5,JUMP=10.2,SPEED=2.4,MAX_VY=16;
  function update(dt){
    const left = keys['ArrowLeft']||keys['a']||keys['A']||leftHeld;
    const right= keys['ArrowRight']||keys['d']||keys['D']||rightHeld;
    const jump = keys['ArrowUp']||keys['w']||keys['W']||keys[' ']||jumpHeld;

    player.vx=0; if(left) player.vx=-SPEED,player.dir=-1; if(right) player.vx=SPEED,player.dir=1;
    player.vy+=GRAV; if(player.vy>MAX_VY) player.vy=MAX_VY;
    player.x+=player.vx;
    for(const p of platforms){const r={x:p[0],y:p[1],w:p[2],h:p[3]}; if(rectsOverlap(player,r)){ if(player.vx>0) player.x=r.x-player.w; else if(player.vx<0) player.x=r.x+r.w; }}
    player.y+=player.vy; player.onGround=false;
    for(const p of platforms){const r={x:p[0],y:p[1],w:p[2],h:p[3]}; if(rectsOverlap(player,r)){ if(player.vy>0){player.y=r.y-player.h;player.vy=0;player.onGround=true;} else if(player.vy<0){player.y=r.y+r.h;player.vy=0;} }}
    for(const m of movers){m.t+=dt;const ox=Math.sin(m.t*0.001)*m.range*m.dx,oy=Math.sin(m.t*0.001)*m.range*m.dy;const r={x:m.x+ox,y:m.y+oy,w:m.w,h:m.h}; if(rectsOverlap(player,r)&&player.vy>=0){player.y=r.y-player.h;player.vy=0;player.onGround=true;player.x+=(m.dx!==0?Math.cos(m.t*0.001)*m.range*0.03*m.dx:0);}}
    if(jump && player.onGround){player.vy=-JUMP; player.onGround=false; beep(660,0.08,'square',0.25);}

    for(const s of spikesArr){const[sx,sy,size]=s;const px=player.x+player.w/2,py=player.y+player.h-2; if(pointInTriangle(px,py,sx,sy,sx+size,sy,sx+size/2,sy-size)){die();break;}}
    for(const b of blobs){b.x+=b.vx; if(b.x<b.minX||b.x+b.w>b.maxX) b.vx*=-1; if(rectsOverlap(player,b)){die();break;}}
    for(const h of hearts){if(!h.taken){const dx=(player.x+player.w/2)-h.x,dy=(player.y+player.h/2)-h.y; if(Math.hypot(dx,dy)<20){h.taken=true;collectCount++;heartsEl.textContent=collectCount; chord([784,988],0.18);} }}
    const r={x:princess.x,y:princess.y,w:princess.w,h:princess.h}; if(collectCount>=5 && rectsOverlap(player,r)){showRescue(); chord([523,659,784],0.4);}
    const t=(performance.now()-startTime)/1000; timeEl.textContent=t.toFixed(1)+'s';
  }
  function die(){ livesEl.textContent=--lives; beep(196,0.25,'sawtooth',0.3); if(lives<=0) reset(); else {player.x=60;player.y=420;player.vx=0;player.vy=0;}}
  function showRescue(){ dlgRescue.showModal(); won=true; stopMusic(); }
  function draw(){
    // background sky + soft clouds
    ctx.fillStyle='#ffeef7'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; for(let i=0;i<6;i++){ const x=(i*180)%W; const y=60+((i%2)*30); ctx.globalAlpha=0.25; ctx.beginPath(); ctx.arc(x,y,40,0,Math.PI*2); ctx.arc(x+40,y+10,28,0,Math.PI*2); ctx.arc(x+80,y,36,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle='#d7f0ff'; ctx.fillRect(0, 440, W, 100);

    // platforms
    ctx.fillStyle = '#ffe1ef'; for (const p of platforms) ctx.fillRect(p[0], p[1], p[2], p[3]);
    // movers
    for (const m of movers) { const ox=Math.sin(m.t*0.001)*m.range*m.dx, oy=Math.sin(m.t*0.001)*m.range*m.dy; ctx.fillStyle='#ffd6ec'; ctx.fillRect(m.x+ox,m.y+oy,m.w,m.h); }
    // spikes
    ctx.fillStyle='#f6a0c1'; for (const s of spikesArr) { const [x,y,size]=s; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+size,y); ctx.lineTo(x+size/2,y-size); ctx.closePath(); ctx.fill(); }
    // blobs
    ctx.fillStyle='#c6a3ff'; for (const b of blobs) ctx.fillRect(b.x,b.y,b.w,b.h);
    // hearts
    for (const h of hearts) { if (h.taken) continue; ctx.fillStyle='#ff7aa2';
      ctx.fillRect(h.x-2,h.y,4,4); ctx.fillRect(h.x-4,h.y+2,8,4); ctx.fillRect(h.x-6,h.y+4,12,4); ctx.fillRect(h.x-4,h.y+8,8,4); ctx.fillRect(h.x-2,h.y+10,4,4); }

    // princess + player (placeholders — replace with sprites later)
    ctx.fillStyle='#ffb3c7'; ctx.fillRect(princess.x, princess.y, princess.w, princess.h);
    ctx.fillStyle='#222'; ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  let last = performance.now(), won=false; function loop(t){ const dt=t-last; last=t; if(!won) update(dt); draw(); requestAnimationFrame(loop); }
  let lives=3, blobs=[], hearts=[];
  function initActors(){ blobs=[{x:330,y:364,w:26,h:18,vx:1,minX:320,maxX:440},{x:740,y:244,w:26,h:18,vx:-1,minX:720,maxX:840}]; hearts=[{x:185,y:400,r:7,taken:false},{x:350,y:340,r:7,taken:false},{x:550,y:280,r:7,taken:false},{x:750,y:220,r:7,taken:false},{x:880,y:150,r:7,taken:false}]; }
  initActors(); reset(); requestAnimationFrame(loop);
})();