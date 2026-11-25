import {schedule} from './scheduler.js';

/** UI-shared review transaction. The page counter changes only after commit. */
export function createReviewSession({clock,idFactory,commit}){
  let counted=false;
  return {
    reset(){counted=false;},
    record(state,cardId,value){
      const source=state.packs.find(pack=>pack.cards.some(card=>card.id===cardId));
      if(!source)throw Error('This room no longer exists.');
      const index=source.cards.findIndex(card=>card.id===cardId),card=source.cards[index];
      const timestamp=clock(),updated=schedule(card,value,timestamp);
      updated.assessments=[...card.assessments,{id:idFactory(),value,timestamp}];
      const next=structuredClone(state);
      next.packs.find(pack=>pack.id===source.id).cards[index]=updated;
      if(!counted)next.sessions++;
      if(commit(next)!==true)return {ok:false};
      counted=true;
      return {ok:true,dueAt:updated.dueAt};
    }
  };
}
