import test from 'node:test';
import assert from 'node:assert/strict';
import {createSampleState,withNursingStarter,nursingReference,NURSING_PACK_ID} from '../js/samplePack.js';
import {validateImport} from '../js/validator.js';
const NOW=1795600000000;
function legacy(){return {version:'1',sessions:7,motionEnabled:false,packs:[{id:'my-notes',name:'My existing work',createdAt:NOW-1000,cards:[{id:'my-card',question:'My custom question',answer:'My answer',createdAt:NOW-1000,dueAt:NOW-1000,streak:0,assessments:[]}]}]};}
test('nursing upgrade preserves existing packs, sessions and motion preference without mutating input',()=>{
 const before=legacy(),snapshot=structuredClone(before),result=withNursingStarter(before,NOW);
 assert.equal(result.added,true);assert.deepEqual(before,snapshot);assert.deepEqual(result.data.packs[1],snapshot.packs[0]);assert.equal(result.data.sessions,7);assert.equal(result.data.motionEnabled,false);assert.equal(result.data.packs[0].id,NURSING_PACK_ID);
 assert.equal(validateImport(JSON.stringify({version:'1',data:result.data})).ok,true);
 assert.equal(withNursingStarter(result.data,NOW+100).data,result.data);
});
test('a full library or conflicting card ID never loses material to install the starter',()=>{
 const full=legacy();full.packs=Array.from({length:10},(_,i)=>({...full.packs[0],id:'p'+i,cards:[]}));assert.equal(withNursingStarter(full,NOW).data,full);
 const conflict=legacy();conflict.packs[0].cards[0].id='nursing-sbar';assert.equal(withNursingStarter(conflict,NOW).data,conflict);
});
test('each nursing starter answer carries its source; altered imported content cannot inherit a verified reference',()=>{
 for(const card of createSampleState(NOW).packs[0].cards){const ref=nursingReference(card);assert.ok(ref);assert.match(card.answer,/Source: https:\/\/www\.(ahrq\.gov|cdc\.gov|who\.int)\//);assert.equal(nursingReference({...card,answer:'Unverified replacement'}),null);}
});
