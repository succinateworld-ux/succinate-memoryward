/**
 * Kiro-authored import validator, hardened during Codex integration review.
 * Validates an envelope before any storage write. Never mutates input/storage.
 */
import {INTERVALS_MS,MAX_TIMESTAMP} from './scheduler.js';
const MAX_BYTES=2097152,ID=/^[a-zA-Z0-9_-]{1,128}$/,VALUES=new Set(['Again','Hard','Remembered']);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_TIMESTAMP;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
function requireThat(condition,message){if(!condition)throw Error(message);}
function uniqueId(value,seen,label){
  requireThat(typeof value==='string'&&ID.test(value),label+' ID must be a URL-safe string of 1 to 128 characters.');
  requireThat(!seen.has(value),'Duplicate '+label+' ID: '+value);seen.add(value);
}
export function validateImport(raw,sizeBytes){
  try{
    if(sizeBytes!==undefined)requireThat(Number.isSafeInteger(sizeBytes)&&sizeBytes>=0&&sizeBytes<=MAX_BYTES,'Import file exceeds the 2 MB limit or has an invalid size.');
    requireThat(typeof raw==='string'&&raw.trim().length>0,'Import file is empty or not a string.');
    requireThat(new TextEncoder().encode(raw).length<=MAX_BYTES,'Import file exceeds the 2 MB limit.');
    let envelope;
    try{envelope=JSON.parse(raw);}catch{throw Error('Import file is not valid JSON.');}
    requireThat(object(envelope),'Import file must be a JSON object.');
    requireThat(envelope.version==='1','Unrecognised import version. Only version "1" is supported.');
    const state=envelope.data;
    requireThat(object(state),'Import file is missing a valid data object.');
    requireThat(state.version==='1','data.version must be "1".');
    requireThat(Array.isArray(state.packs)&&state.packs.length<=10,'data.packs must be an array of at most 10 packs.');
    requireThat(Number.isSafeInteger(state.sessions)&&state.sessions>=0&&state.sessions<=2147483647,'data.sessions must be a bounded non-negative integer.');
    requireThat(typeof state.motionEnabled==='boolean','data.motionEnabled must be a boolean.');
    const packs=new Set(),cards=new Set(),assessments=new Set();
    for(const pack of state.packs){
      requireThat(object(pack),'Each pack must be an object.');uniqueId(pack.id,packs,'pack');
      requireThat(text(pack.name,200),'Pack name must contain 1 to 200 characters.');
      requireThat(timestamp(pack.createdAt),'Invalid pack createdAt timestamp.');
      requireThat(Array.isArray(pack.cards)&&pack.cards.length<=500,'Pack cards must be an array of at most 500 rooms.');
      for(const card of pack.cards){
        requireThat(object(card),'Each card must be an object.');uniqueId(card.id,cards,'card');
        requireThat(text(card.question,2000)&&text(card.answer,2000),'Question and answer must contain 1 to 2,000 characters.');
        requireThat(timestamp(card.createdAt)&&card.createdAt>=pack.createdAt,'Invalid card createdAt timestamp.');
        requireThat(timestamp(card.dueAt),'Invalid card dueAt timestamp.');
        requireThat(Number.isSafeInteger(card.streak)&&card.streak>=0&&card.streak<=2147483647,'Invalid card streak.');
        requireThat(Array.isArray(card.assessments),'Assessment history must be an array.');
        let previous=card.createdAt, streak=0, expectedDue=card.createdAt;
        for(const rating of card.assessments){
          requireThat(object(rating),'Each assessment must be an object.');uniqueId(rating.id,assessments,'assessment');
          requireThat(VALUES.has(rating.value),'Assessment value must be Again, Hard, or Remembered.');
          requireThat(timestamp(rating.timestamp)&&rating.timestamp>=previous,'Assessment timestamp must not predate creation or previous history.');
          const interval=rating.value==='Again'?600000:rating.value==='Hard'?86400000:INTERVALS_MS[Math.min(streak,4)];
          expectedDue=rating.timestamp+interval;
          requireThat(timestamp(expectedDue),'Assessment produces an unsupported dueAt timestamp.');
          streak=rating.value==='Remembered'?streak+1:0;previous=rating.timestamp;
        }
        requireThat(card.streak===streak,'Card streak disagrees with trailing assessment history.');
        requireThat(card.dueAt===expectedDue,'Card dueAt disagrees with the recorded review schedule.');
      }
    }
    return {ok:true,data:state};
  }catch(error){return {ok:false,error:error.message||'Invalid backup.'};}
}
