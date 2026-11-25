import { mountAtmosphere } from './atmosphere.js';
import { createReviewSession } from './session.js';
import { computeRoomState } from './roomState.js';
import { validateImport } from './validator.js';
import { createStore } from './store.js';
import { createSampleState, NURSING_PACK_ID, nursingReference, withNursingStarter } from './samplePack.js';

const root = document.querySelector('#app');
const KEY = 'succinate-memoryward-store';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid = () => crypto.randomUUID();
const now = () => Date.now();
const date = ms => new Date(ms).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
let state, store, activePackId, memoryOnly = false, recovery = null, externalChange = false;
let flash = null, revealed = false, recallDraft = '', currentCardId = '';
const reviewSession=createReviewSession({clock:now,idFactory:uuid,commit:save});
let renderCleanup = () => {};

function envelope(data) { return JSON.stringify({version:'1',data}); }
function announce(text) { document.querySelector('#announcer').textContent = text; }
function setNotice(text, kind='error') {
  flash = {text,kind};
  const slot = document.querySelector('#notice');
  if (slot) slot.innerHTML = noticeHTML();
  announce(text);
}
function noticeHTML() {
  let output = '';
  if (memoryOnly) output += '<div class="notice site-notice" role="status">Temporary session · changes are not being saved in this browser. Export a backup before closing.</div>';
  if (externalChange) output += '<div class="notice error site-notice" role="alert">Another tab changed your saved data. Reload before editing to avoid replacing its changes. <button class="btn btn-small" data-action="reload">Reload saved data</button></div>';
  if (flash) output += '<div class="notice '+esc(flash.kind)+' toast" role="status">'+esc(flash.text)+'</div>';
  return output;
}
function pack() { return state?.packs.find(p=>p.id===activePackId) || state?.packs[0]; }
function allCards() { return state?.packs.flatMap(p=>p.cards) || []; }
function dueCards() { return [...(pack()?.cards || [])].filter(c=>c.dueAt<=now()).sort((a,b)=>a.dueAt-b.dueAt); }
function findCard(id) {
  for (const p of state.packs) { const index=p.cards.findIndex(c=>c.id===id); if(index>=0)return {pack:p,index,card:p.cards[index]}; }
  return null;
}
function save(next, {force=false}={}) {
  if(externalChange){setNotice('Reload the newer saved data before making changes.');return false;}
  const checked=validateImport(envelope(next));
  if(!checked.ok){setNotice('This change could not be saved: '+checked.error);return false;}
  if(memoryOnly&&!force){state=next;return true;}
  const result=store.write(next);
  if(!result.ok){setNotice('Unsaved changes: '+result.error+'. Your previous saved data has been preserved.');return false;}
  state=next; memoryOnly=false; recovery=null; return true;
}
function navigate(route) {
  flash=null;
  if(location.hash==='#'+route)render(true);
  else location.hash=route;
}
function shell(content, section='map') {
  const navigation=[['map','Study ward'],['progress','Progress'],['data','Backups']].map(([route,label])=>'<a href="#'+route+'"'+((section===route||(route==='map'&&section==='list'))?' aria-current="page"':'')+'>'+label+'</a>').join('');
  root.innerHTML='<header class="topbar"><a class="brand" href="#map" aria-label="MemoryWard palace"><img src="assets/icon.svg" alt="" width="43" height="43"><div><strong>MemoryWard</strong><span>Nursing by SuccinateWorld</span></div></a><nav class="nav" aria-label="Main navigation">'+navigation+'<button class="nav-motion" data-action="motion" aria-label="Toggle animation" aria-pressed="'+(!!state?.motionEnabled&&!reduced.matches)+'"'+(reduced.matches?' disabled':'')+'>'+(state?.motionEnabled&&!reduced.matches?'◉ Motion on':'◎ Motion off')+'</button></nav></header><div id="notice">'+noticeHTML()+'</div><main id="main-content" tabindex="-1">'+content+'</main><footer class="footer"><p>For nursing revision, not patient-specific clinical decisions. Do not enter patient identifiers. Your study data stays in this browser. Clearing browser data removes it. Export a backup to keep a copy or move to another device.</p><a href="#data">Your data, your control</a></footer>';
  document.body.classList.toggle('motion-on',!!state?.motionEnabled&&!reduced.matches);
  renderCleanup=mountAtmosphere(root,!!state?.motionEnabled&&!reduced.matches);
}
function title(kicker,heading,description) {
  return '<div class="page-intro"><p class="eyebrow">'+esc(kicker)+'</p><h1 tabindex="-1" data-heading>'+esc(heading)+'</h1><p class="muted">'+esc(description)+'</p></div>';
}
function answerHTML(card){
  const reference=nursingReference(card);
  return '<div class="answer">'+esc(reference?reference.answer:card.answer)+'</div>'+(reference?'<div class="source-card"><span>STUDY REFERENCE · CHECKED 25 NOV 2026</span><a href="'+esc(reference.source)+'" target="_blank" rel="noopener noreferrer">'+esc(reference.sourceName)+' ↗</a></div>':'');
}
function palaceArt(cards) {
 const lit=cards.filter(c=>computeRoomState(c.assessments)!=='dim').length;
 return '<div class="palace-art" aria-hidden="true"><div class="scene-image"></div><div class="scene-shade"></div><div class="scene-portal"></div><div class="scene-fog fog-one"></div><div class="scene-fog fog-two"></div><canvas class="scene-dust"></canvas><div class="scene-coordinate">MEMORYWARD / NURSING LEARNING LAB</div><div class="scene-seal"><span>+</span><i></i></div><div class="medical-hud"><div class="hud-title"><span class="signal-dot"></span>LEARNING IN MOTION</div><svg viewBox="0 0 300 70" fill="none"><path class="ecg-base" d="M0 38H55L65 30L75 45L90 38H115L126 38L136 9L149 62L161 29L171 38H218L230 26L242 38H300"/><path class="ecg-trace" d="M0 38H55L65 30L75 45L90 38H115L126 38L136 9L149 62L161 29L171 38H218L230 26L242 38H300"/></svg><div class="hud-footer"><span>RECALL</span><span>REVEAL</span><span>RETURN</span></div></div><div class="floating-topic topic-one"><span>01</span> NURSING FOUNDATIONS</div><div class="floating-topic topic-two"><span>02</span> PATIENT COMMUNICATION</div><div class="scene-readout"><span class="signal-dot"></span>'+lit+' / '+cards.length+' ROOMS LIT<span>YOUR NEXT STUDY SESSION STARTS HERE</span></div></div>';
}

function roomHTML(card,index) {
  const roomState=computeRoomState(card.assessments), due=card.dueAt<=now();
  return '<button class="room" data-action="room" data-id="'+esc(card.id)+'" data-state="'+roomState+'" aria-label="'+esc(card.question)+'. '+roomState+'. '+(due?'Due for review':'Next review '+date(card.dueAt))+'"><span class="room-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span><span class="room-door" aria-hidden="true"></span><span class="room-question">'+esc(card.question)+'</span><span class="room-status"><span class="state-label">'+({dim:'Unlit',lit:'Lit',bright:'Bright'}[roomState])+'</span><span class="'+(due?'due':'')+'">'+(due?'Due now':'Scheduled')+'</span></span></button>';
}
function mapPage(list=false) {
  const p=pack(), cards=p?.cards || [], due=dueCards(), reviewed=cards.filter(c=>c.assessments.length).length, lit=cards.filter(c=>computeRoomState(c.assessments)!=='dim').length;
  const next=[...cards].sort((a,b)=>a.dueAt-b.dueAt)[0];
  const options=state.packs.map(item=>'<option value="'+esc(item.id)+'"'+(item.id===p?.id?' selected':'')+'>'+esc(item.name)+'</option>').join('');
  const hero=list?'': '<section class="hero page-enter"><div class="hero-copy"><p class="eyebrow">A memory palace for nursing minds</p><h1>For the nurse<br>you’re<br><em>becoming.</em></h1><p>Turn nursing knowledge into lasting recall. Practise recall, revisit what fades and make your next study session count.</p><div class="actions"><button class="btn btn-primary" data-action="start">'+(due.length?'Start nursing recall · '+due.length+' due':'Practise a room')+'</button><a class="btn btn-subtle" href="#create">Add nursing notes ↗</a></div><p class="privacy-line">No account. No paywall. Just you and your learning.</p><div class="strip"><span><strong>'+reviewed+'/'+cards.length+'</strong> rooms visited</span><span><strong>'+lit+'</strong> lights on</span></div></div>'+palaceArt(cards)+'<div class="hero-bottom"><span>01 — THE LEARNING WARD</span><a href="#rooms-heading" data-action="explore">EXPLORE YOUR ROOMS ↓</a><span>RECALL · REVEAL · RETURN</span></div></section>';
  const sorted=[...cards].sort((a,b)=>a.dueAt-b.dueAt);
  shell(hero+'<section class="'+(list?'page page-enter':'')+'"><div class="section-header"><div><p class="eyebrow">Your nursing learning lab</p><h2 tabindex="-1" data-heading id="rooms-heading">'+(list?'Every room, in focus.':'Step into your study ward.')+'</h2><p class="muted">The light reflects your recent self-assessments, not verified mastery.</p></div><div class="toggle-group" aria-label="Room view"><a class="btn '+(!list?'selected':'')+'" href="#map"'+(!list?' aria-current="page"':'')+'>Map</a><a class="btn '+(list?'selected':'')+'" href="#list"'+(list?' aria-current="page"':'')+'>List</a></div></div><div class="pack-bar"><label for="pack-select">Study pack</label><select id="pack-select">'+options+'</select><button class="text-link" data-action="refresh">Update due rooms</button><button class="btn btn-small right" data-action="motion" aria-pressed="'+(!!state.motionEnabled&&!reduced.matches)+'"'+(reduced.matches?' disabled':'')+'>'+(reduced.matches?'Motion reduced by your system':state.motionEnabled?'Ambient motion on':'Ambient motion off')+'</button></div>'+(!due.length?'<p class="notice">'+(next?'All caught up for now. Next review: '+esc(date(next.dueAt))+'. You can still practise any room.':'No rooms yet. Add a question and answer to begin.')+'</p>':'')+'<div class="'+(list?'room-list':'room-grid')+'">'+sorted.map(roomHTML).join('')+'</div><div class="actions"><a class="btn" href="#create">Create a room</a><a class="text-link" href="#progress">See your progress</a></div></section>',list?'list':'map');
}
function challengePage(id) {
  const found=findCard(id);
  if(!found){shell('<section class="page">'+title('Room not found','This room has moved.','Choose a room from your palace to continue.')+'<a class="btn" href="#map">Return to study ward</a></section>');return;}
  activePackId=found.pack.id;
  if(currentCardId!==id){revealed=false;recallDraft='';currentCardId=id;}
  const card=found.card;
  const intervals=['1 day','3 days','7 days','14 days','30 days'];
  const content='<section class="page page-enter"><div class="challenge"><div class="challenge-meta"><a class="text-link" href="#map">Back to study ward</a><span class="pill">'+esc(found.pack.name)+'</span></div><article class="panel"><p class="eyebrow">'+(revealed?'Compare your recall':'Recall before you reveal')+'</p><h1 tabindex="-1" data-heading>'+esc(card.question)+'</h1><div class="challenge-body">'+(revealed?answerHTML(card)+(recallDraft?'<details><summary>Your recall notes</summary><p class="content-line">'+esc(recallDraft)+'</p></details>':'')+'<h2 style="font-size:1.65rem;margin-top:25px">How did it feel?</h2><div class="assessment-grid">'+[['Again','Return in 10 minutes'],['Hard','Return in 1 day'],['Remembered','Return in '+intervals[Math.min(card.streak,4)]]].map(([value,label])=>'<button class="btn assessment" data-action="assess" data-value="'+value+'" data-id="'+esc(card.id)+'">'+value+'<span>'+label+'</span></button>').join('')+'</div><p class="small muted" style="margin-top:18px">Your rating is a self-assessment, not verified learning or mastery.</p>':'<label for="recall-notes">Your recall notes <span class="muted">(optional)</span></label><textarea id="recall-notes" maxlength="4000" placeholder="Take a moment. What comes to mind?" autocomplete="off">'+esc(recallDraft)+'</textarea><div class="actions"><button class="btn btn-primary" data-action="reveal">Reveal answer</button></div><p class="small muted">The answer stays hidden until you reveal it.</p>')+'</div></article></div></section>';
  shell(content,'challenge');
}
function createPage() {
  const p=pack();
  shell('<section class="page page-enter">'+title('Make it yours','A room for your nursing knowledge.','Turn a nursing lecture or trusted reference into a question and answer. Include your source; use fictional examples without patient identifiers.')+'<div class="two-col"><form id="create-form" class="panel form-stack" novalidate><div><label for="new-pack">New pack name <span class="muted">(optional)</span></label><input id="new-pack" name="newPack" maxlength="200" placeholder="e.g. Fundamentals, Maternal Health or Pharmacology"><p class="form-help">Current pack: '+esc(p?.name || 'None')+'. Up to 10 packs, 500 rooms each.</p></div><div><label for="question">Your question</label><textarea id="question" name="question" maxlength="2000" required></textarea><div class="field-meta"><span>One idea works best</span><span id="question-count">0 / 2,000</span></div></div><div><label for="answer">Source answer</label><textarea id="answer" name="answer" maxlength="2000" required></textarea><div class="field-meta"><span>Use your own notes or a trusted source</span><span id="answer-count">0 / 2,000</span></div></div><div id="form-error" class="field-error" role="alert"></div><div class="actions"><button class="btn btn-primary" type="submit">Create room</button><a class="btn" href="#map">Cancel</a></div></form><aside class="panel"><p class="eyebrow">A useful little ritual</p><h2>Recall. Reveal.<br>Return.</h2><p class="muted">Choose a question you can answer without looking. Compare with the source, then use your rating to plan the next visit.</p><hr class="divider"><p class="small muted">Use course materials and current references. Study practice supports revision; clinical decisions follow local policy and qualified supervision.</p></aside></div></section>','create');
}
function progressPage() {
  const cards=pack()?.cards || [], due=dueCards().length;
  const reviews=cards.reduce((n,c)=>n+c.assessments.length,0);
  const lit=cards.filter(c=>computeRoomState(c.assessments)!=='dim').length;
  const stats=[[cards.length,'Rooms in this pack'],[reviews,'Recorded reviews'],[due,'Due right now'],[state.sessions,'Study sessions · all packs']];
  const history=cards.filter(c=>c.assessments.length).sort((a,b)=>b.assessments.at(-1).timestamp-a.assessments.at(-1).timestamp);
  shell('<section class="page page-enter">'+title('Every return counts','Your light, over time.','A simple record of the practice you actually did. No scores or invented learning gains.')+'<p class="pill">'+esc(pack()?.name || 'Your pack')+'</p><div class="stats">'+stats.map(([n,label])=>'<div class="stat"><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div><div class="panel"><h2>Lights in your palace</h2><p class="muted">'+lit+' of '+cards.length+' rooms have a current Remembered streak.</p><div class="progress-track" role="img" aria-label="'+lit+' of '+cards.length+' rooms lit"><span style="width:'+(cards.length?Math.round(lit/cards.length*100):0)+'%"></span></div><p class="small muted">One or two consecutive Remembered ratings light a room; three make it bright. Again or Hard returns it to unlit.</p></div><div class="panel"><h2>Recent room visits</h2>'+(history.length?'<div class="table-wrap"><table><thead><tr><th scope="col">Room</th><th scope="col">Your last rating</th><th scope="col">Next review</th></tr></thead><tbody>'+history.map(c=>'<tr><td>'+esc(c.question)+'</td><td>'+esc(c.assessments.at(-1).value)+'</td><td>'+esc(date(c.dueAt))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No recorded reviews yet. Visit a room, reveal the answer and choose a rating to begin.</div>')+'<p class="small muted" style="margin-top:24px">A study session means one page visit with at least one recorded review. Reloading alone does not add a session. Ratings and room lights are self-reported.</p></div><div class="actions"><a class="btn btn-primary" href="#map">Return to palace</a></div></section>','progress');
}
function dataPage() {
  shell('<section class="page page-enter">'+title('Private by design','Keep what you create.','There is no account or cloud copy. Export your rooms and review history to keep a backup or transfer them to another browser.')+'<div class="two-col"><div><section class="panel"><h2>Export your palace</h2><p class="muted">Download all '+state.packs.length+' packs and '+allCards().length+' rooms, including your recorded reviews. Keep the file somewhere you trust.</p><button class="btn btn-primary" data-action="export">Download backup</button></section><section class="panel"><h2>Restore a backup</h2><p class="muted">Choose a MemoryWard JSON backup, up to 2 MB. We validate it first and ask before replacing anything.</p><label for="import-file">Backup file</label><input type="file" id="import-file" accept=".json,application/json"><div id="import-error" class="field-error" role="alert"></div></section></div><aside class="panel"><p class="eyebrow">A fresh start</p><h2>Reset this browser</h2><p class="muted">Replace your saved palace with the Nursing Foundations starter. Export your data first if you want to keep it.</p><button class="btn btn-danger" data-action="reset">Reset study data</button><hr class="divider"><h3>About the review schedule</h3><p class="small muted">Again: 10 minutes. Hard: 1 day. Consecutive Remembered ratings: 1, 3, 7, 14, then 30 days. This is a study aid, not a validated measure of learning.</p></aside></div></section>','data');
}
function recoveryPage() {
  shell('<section class="page recovery">'+title('Your saved data is protected','Let’s keep your work safe.','MemoryWard could not read the saved data. It has not replaced it with the sample pack.')+'<div class="notice error">'+esc(recovery?.error || 'Storage is unavailable.')+'</div><div class="actions"><button class="btn btn-primary" data-action="temporary">Study in a temporary session</button>'+(recovery?.raw?'<button class="btn" data-action="raw-export">Download unreadable saved data</button>':'')+'<button class="btn btn-danger" data-action="reset">Reset with sample pack</button></div><p class="muted">A temporary session does not overwrite the saved data. You can export its progress before closing.</p></section>','recovery');
}
function render(focus=false) {
  const notes=document.querySelector('#recall-notes');if(notes&&currentCardId)recallDraft=notes.value;
  renderCleanup(); renderCleanup=()=>{};
  if(recovery&&!state){recoveryPage();return;}
  const hash=location.hash.slice(1)||'map';
  if(hash==='main-content'){document.querySelector('main')?.focus();return;}
  if(!hash.startsWith('challenge/')){currentCardId='';revealed=false;recallDraft='';}
  if(hash.startsWith('challenge/'))challengePage(hash.slice(10));
  else if(hash==='create')createPage();
  else if(hash==='progress')progressPage();
  else if(hash==='data')dataPage();
  else mapPage(hash==='list');
  if(focus){document.querySelector('[data-heading]')?.focus({preventScroll:true});window.scrollTo(0,0);}
}
function download(content,name,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function confirmAction(heading,message,buttonLabel) {
  const dialog=document.querySelector('#confirm-dialog');
  dialog.innerHTML='<h2 id="dialog-title">'+esc(heading)+'</h2><p>'+esc(message)+'</p><form method="dialog"><div class="dialog-actions"><button class="btn" value="cancel" autofocus>Cancel</button><button class="btn btn-primary" value="confirm">'+esc(buttonLabel)+'</button></div></form>';
  const previousFocus=document.activeElement;
  dialog.onkeydown=event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    const first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus();resolve(dialog.returnValue==='confirm');},{once:true}));
}
async function assess(id,value) {
  const found=findCard(id);if(!found||!revealed)return;
  try{
    const result=reviewSession.record(state,id,value);
    if(!result.ok)return;
    revealed=false;currentCardId='';recallDraft='';
    flash={kind:'success',text:value+' recorded. Next visit: '+date(result.dueAt)+(memoryOnly?' · temporary session.':'.')};
    if(location.hash==='#map')render(true);else location.hash='map';announce(flash.text);
  }catch(error){setNotice(error.message);}
}
root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='explore'){event.preventDefault();document.querySelector('#rooms-heading')?.scrollIntoView({behavior:state.motionEnabled&&!reduced.matches?'smooth':'instant'});document.querySelector('#rooms-heading')?.focus({preventScroll:true});return;}
  if(action==='room')navigate('challenge/'+button.dataset.id);
  if(action==='start'){const c=dueCards()[0]||pack()?.cards[0];if(c)navigate('challenge/'+c.id);else navigate('create');}
  if(action==='reveal'){recallDraft=document.querySelector('#recall-notes')?.value || '';revealed=true;render();document.querySelector('.answer')?.setAttribute('tabindex','-1');document.querySelector('.answer')?.focus();announce('Source answer revealed. Compare your recall before choosing a rating.');}
  if(action==='assess'){button.disabled=true;await assess(button.dataset.id,button.dataset.value);if(button.isConnected)button.disabled=false;}
  if(action==='refresh'){flash=null;render();announce('Due rooms updated.');}
  if(action==='motion'&&state){const next=structuredClone(state);next.motionEnabled=!next.motionEnabled;if(save(next))render();}
  if(action==='export'){download(envelope(state),'succinate-memoryward-backup-'+new Date().toISOString().slice(0,10)+'.json');announce('Backup download started.');}
  if(action==='raw-export')download(recovery.raw,'memoryward-unreadable-data.txt','text/plain');
  if(action==='temporary'){state=createSampleState(now());activePackId=state.packs[0]?.id;memoryOnly=true;recovery=null;render();}
  if(action==='reload')location.reload();
  if(action==='reset'){
    if(await confirmAction('Reset your palace?','This replaces saved study data in this browser with the Nursing Foundations starter. Export a backup first if you want to keep it.','Reset study data')){
      const next=createSampleState(now());externalChange=false;
      if(save(next,{force:true})){reviewSession.reset();activePackId=state.packs[0]?.id;flash={kind:'success',text:'A fresh sample palace is ready.'};if(location.hash==='#map')render(true);else location.hash='map';}
    }
  }
});
root.addEventListener('submit',event=>{
  if(event.target.id!=='create-form')return;event.preventDefault();
  const form=event.target, fields=new FormData(form), question=String(fields.get('question')||'').trim(), answer=String(fields.get('answer')||'').trim(), name=String(fields.get('newPack')||'').trim();
  const error=document.querySelector('#form-error');
  function invalid(message,id){error.textContent=message;document.getElementById(id)?.focus();}
  if(!question)return invalid('Enter a question.','question');
  if(!answer)return invalid('Enter the source answer.','answer');
  if(question.length>2000||answer.length>2000)return invalid('Keep each field within 2,000 characters.','question');
  if(name.length>200)return invalid('Keep the pack name within 200 characters.','new-pack');
  if(name&&state.packs.length>=10)return invalid('You can keep up to 10 packs in this browser.','new-pack');
  const next=structuredClone(state), timestamp=now();
  let target=next.packs.find(p=>p.id===pack()?.id);
  if(name){target={id:uuid(),name,createdAt:timestamp,cards:[]};next.packs.push(target);}
  if(!target)return invalid('Create a new pack to hold your room.','new-pack');
  if(target.cards.length>=500)return invalid('This pack has reached its 500-room limit. Use a new pack.','new-pack');
  target.cards.push({id:uuid(),question,answer,createdAt:timestamp,dueAt:timestamp,streak:0,assessments:[]});
  if(save(next)){activePackId=target.id;flash={kind:'success',text:'Your new room is ready to visit.'};if(location.hash==='#map')render(true);else location.hash='map';announce('Room created.');}
});
root.addEventListener('input',event=>{
  if(['question','answer'].includes(event.target.id)){
    const counter=document.getElementById(event.target.id+'-count');if(counter)counter.textContent=event.target.value.length.toLocaleString()+' / 2,000';
  }
});
root.addEventListener('change',async event=>{
  if(event.target.id==='pack-select'){activePackId=event.target.value;flash=null;render();}
  if(event.target.id!=='import-file')return;
  const file=event.target.files[0];if(!file)return;
  const error=document.querySelector('#import-error');
  try{
    if(file.size>2097152)throw Error('Import file exceeds the 2 MB limit.');
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
    const checked=validateImport(raw,file.size);if(!checked.ok)throw Error(checked.error);
    const next=checked.data, count=next.packs.reduce((n,p)=>n+p.cards.length,0);
    if(await confirmAction('Replace your saved palace?',next.packs.length+' packs and '+count+' rooms will replace this browser’s saved data. Export a backup first if needed.','Import backup')){
      if(save(next,{force:true})){activePackId=state.packs[0]?.id;flash={kind:'success',text:'Backup restored. Your rooms and review history are ready.'};render(true);}
    }
  }catch(problem){error.textContent=problem.message;announce('Import rejected: '+problem.message);}
  finally{if(event.target.isConnected)event.target.value='';}
});
window.addEventListener('hashchange',()=>render(true));
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){externalChange=true;setNotice('Saved data changed in another tab. Reload before editing.');}});
reduced.addEventListener('change',()=>{document.body.classList.toggle('motion-on',!!state?.motionEnabled&&!reduced.matches);render();});
try{
  let storage;
  try{storage=window.localStorage;}catch{storage={getItem(){throw Error('Browser storage is unavailable');},setItem(){throw Error('Browser storage is unavailable');}};}
  store=createStore(storage);
  const result=store.read();
  if(!result.ok){recovery=result;}
  else if(result.data){
    state=result.data;
    const upgrade=withNursingStarter(state,now());
    if(upgrade.added){const written=store.write(upgrade.data);if(written.ok){state=upgrade.data;flash={kind:'success',text:'Your Nursing Foundations pack is ready. Your previous packs and progress are preserved.'};}else flash={kind:'error',text:'The nursing starter could not be saved. Your existing study data is preserved. Export a backup and check browser storage.'};}
    else if(upgrade.unavailable)flash={kind:'error',text:'The nursing starter needs a free pack slot and unused starter IDs. Your existing material is preserved.'};
  }
  else{
    const fresh=createSampleState(now()), written=store.write(fresh);
    state=fresh;if(!written.ok){memoryOnly=true;flash={kind:'error',text:'Browser storage is unavailable. You can study temporarily and export a backup.'};}
  }
  activePackId=state?.packs.find(p=>p.id===NURSING_PACK_ID)?.id||state?.packs[0]?.id;
  render();
}catch(error){
  root.innerHTML='<section class="page recovery"><h1>Something needs attention.</h1><p class="notice error">'+esc(error.message)+'</p><p>Your existing saved data has not been deliberately reset. Please reload, or keep a copy before clearing browser data.</p></section>';
}
