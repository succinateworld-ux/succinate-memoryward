/**
 * Kiro-authored store factory, hardened during Codex integration review.
 * Missing, corrupt and inaccessible storage are distinct states.
 */
import {validateImport} from './validator.js';
export const STORE_KEY='succinate-memoryward-store';
export function createStore(storage){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new TypeError('createStore requires getItem/setItem.');
  function read(){
    let raw;
    try{raw=storage.getItem(STORE_KEY);}catch(error){return {ok:false,error:'Storage read failed: '+error.message};}
    if(raw===null||raw===undefined)return {ok:true,data:null};
    try{
      const parsed=JSON.parse(raw);
      const check=validateImport(JSON.stringify({version:'1',data:parsed}));
      if(!check.ok)return {ok:false,error:'Saved data failed validation: '+check.error,raw};
      return {ok:true,data:check.data};
    }catch(error){return {ok:false,error:'Saved data is not valid JSON or could not be read: '+error.message,raw};}
  }
  function write(state){
    try{
      const serialized=JSON.stringify(state);
      const checked=validateImport('{"version":"1","data":'+serialized+'}');
      if(!checked.ok)return {ok:false,error:'State validation failed: '+checked.error};
      storage.setItem(STORE_KEY,serialized);
      return {ok:true};
    }catch(error){return {ok:false,error:'Storage write failed: '+error.message};}
  }
  return {read,write};
}
