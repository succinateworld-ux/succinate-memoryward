/** Decorative effects never read or write study data. */
export function mountAtmosphere(root, enabled) {
  const stage=root.querySelector('.hero');
  const canvas=root.querySelector('.scene-dust');
  if(!enabled) return ()=>{};
  const abort=new AbortController();
  const options={signal:abort.signal,passive:true};
  let frame=0, width=0, height=0, visible=true;
  const ctx=canvas?.getContext('2d');
  const points=Array.from({length:42},()=>({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.5,v:.006+Math.random()*.012,phase:Math.random()*6.28}));
  const resize=()=>{if(!canvas)return;const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx?.setTransform(dpr,0,0,dpr,0,0);};
  let last=0;
  const draw=time=>{
    if(!visible)return;
    const dt=Math.min((time-last)/1000,.05);last=time;
    if(ctx&&width&&height){ctx.clearRect(0,0,width,height);for(const p of points){p.y-=p.v*dt;if(p.y<0)p.y=1;const x=p.x*width+Math.sin(time*.00025+p.phase)*12,y=p.y*height;ctx.beginPath();ctx.fillStyle=`rgba(184,245,230,${.2+(Math.sin(time*.001+p.phase)+1)*.22})`;ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fill();}}
    frame=requestAnimationFrame(draw);
  };
  const visibility=()=>{visible=!document.hidden;root.classList.toggle('effects-paused',!visible);cancelAnimationFrame(frame);if(visible&&ctx){last=performance.now();frame=requestAnimationFrame(draw);}};
  document.addEventListener('visibilitychange',visibility,options);
  if(stage){stage.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const box=stage.getBoundingClientRect();stage.style.setProperty('--px',((e.clientX-box.left)/box.width-.5).toFixed(3));stage.style.setProperty('--py',((e.clientY-box.top)/box.height-.5).toFixed(3));},options);stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--px',0);stage.style.setProperty('--py',0);},options);}
  root.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const target=e.target.closest('.room,.btn-primary,.stat');if(!target)return;const rect=target.getBoundingClientRect();target.style.setProperty('--mx',`${e.clientX-rect.left}px`);target.style.setProperty('--my',`${e.clientY-rect.top}px`);},options);
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target);}}),{threshold:.08});
  root.querySelectorAll('.room,.panel,.stat,.section-header').forEach((el,i)=>{el.style.setProperty('--delay',`${Math.min(i%10,5)*55}ms`);el.classList.add('reveal-ready');observer.observe(el);});
  window.addEventListener('resize',resize,options);resize();if(ctx)frame=requestAnimationFrame(draw);
  return ()=>{abort.abort();observer.disconnect();cancelAnimationFrame(frame);};
}
