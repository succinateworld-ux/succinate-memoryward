import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule} from '../js/scheduler.js';
import {validateImport} from '../js/validator.js';
import {createSampleState} from '../js/samplePack.js';
import {createStore,STORE_KEY} from '../js/store.js';
const NOW=1_800_000_000_000;
const check=state=>validateImport(JSON.stringify({version:'1',data:state}));
const reviewed=(c,value,timestamp,id)=>({...schedule(c,value,timestamp),assessments:[...c.assessments,{id,value,timestamp}]});

test('imports reject missing or non-string IDs rather than coercing them',()=>{
  for(const id of [undefined,123,null,{},[]]){
    const state=createSampleState(NOW);state.packs[0].cards[0].id=id;
    assert.equal(check(state).ok,false,'invalid ID '+String(id));
  }
});
test('imports enforce pack count and bounded session counter',()=>{
  const state=createSampleState(NOW);
  state.sessions=Number.MAX_SAFE_INTEGER;assert.equal(check(state).ok,false);
  state.sessions=0;
  state.packs=Array.from({length:11},(_,i)=>({id:'pack-'+i,name:'Pack',createdAt:NOW,cards:[]}));
  assert.equal(check(state).ok,false);
});
test('imports reject a fabricated next due time',()=>{
  const state=createSampleState(NOW), c=state.packs[0].cards[0];
  state.packs[0].cards[0]=reviewed(c,'Remembered',NOW,'review-1');
  state.packs[0].cards[0].dueAt+=60000;
  assert.equal(check(state).ok,false);
});
test('imports reject reviews that predate their card',()=>{
  const state=createSampleState(NOW),c=state.packs[0].cards[0];
  state.packs[0].cards[0]={...c,streak:1,dueAt:NOW-1+86400000,assessments:[{id:'early',value:'Remembered',timestamp:NOW-1}]};
  assert.equal(check(state).ok,false);
});
test('actual UTF-8 byte length is checked even with a false size hint',()=>{
  const raw=JSON.stringify({version:'1',data:createSampleState(NOW),padding:'x'.repeat(2097153)});
  assert.equal(validateImport(raw,0).ok,false);
});
test('scheduler rejects invalid streaks without mutating its input',()=>{
  for(const streak of [-1,NaN,Infinity,1.5,2147483647]){
    const c={...createSampleState(NOW).packs[0].cards[0],streak};
    const snapshot=structuredClone(c);
    assert.throws(()=>schedule(c,'Remembered',NOW));
    assert.deepEqual(c,snapshot);
  }
});
test('scheduler rejects dates it cannot safely represent',()=>{
  const c=createSampleState(NOW).packs[0].cards[0];
  assert.throws(()=>schedule(c,'Again',Number.MAX_SAFE_INTEGER));
  assert.throws(()=>schedule(c,'Remembered',8640000000000000));
});
test('scheduler rejects a backwards assessment clock',()=>{
  const initial=createSampleState(NOW).packs[0].cards[0];
  const c=reviewed(initial,'Remembered',NOW+1000,'r-1');
  assert.throws(()=>schedule(c,'Again',NOW));
});
test('rejected import candidates leave real store contents untouched',()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const store=createStore(storage), original=createSampleState(NOW);
  assert.equal(store.write(original).ok,true);const bytes=memory.get(STORE_KEY);
  const bad=structuredClone(original);bad.packs[0].cards[0].id=123;
  assert.equal(store.write(bad).ok,false);assert.equal(memory.get(STORE_KEY),bytes);
});
test('corrupt stored data is preserved and returned as a recovery error',()=>{
  let raw='{broken';const store=createStore({getItem:()=>raw,setItem:(_,v)=>{raw=v;}});
  const result=store.read();assert.equal(result.ok,false);assert.equal(result.raw,'{broken');assert.equal(raw,'{broken');
});
