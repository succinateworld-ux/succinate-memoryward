/**
 * Kiro-authored scheduler, hardened during Codex integration review.
 * Fixed intervals; injected UTC milliseconds; immutable updates.
 */
export const INTERVALS_MS=Object.freeze([1,3,7,14,30].map(days=>days*86400000));
export const MAX_TIMESTAMP=8640000000000000; // JavaScript Date's supported range
const VALUES=new Set(['Again','Hard','Remembered']);
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_TIMESTAMP;
export function schedule(card,assessment,nowMs){
  if(!timestamp(nowMs))throw new RangeError('nowMs must be a safe, supported non-negative timestamp.');
  if(!VALUES.has(assessment))throw new TypeError('Unknown assessment value: '+assessment);
  if(!card||typeof card!=='object'||Array.isArray(card))throw new TypeError('card must be an object.');
  if(!timestamp(card.createdAt)||nowMs<card.createdAt)throw new RangeError('Review timestamp must not predate card creation.');
  if(!Number.isSafeInteger(card.streak)||card.streak<0||card.streak>2147483647)throw new RangeError('Invalid streak.');
  if(!Array.isArray(card.assessments))throw new TypeError('Assessment history must be an array.');
  let previous=card.createdAt;
  for(const item of card.assessments){
    if(!item||!VALUES.has(item.value)||!timestamp(item.timestamp)||item.timestamp<previous)throw new RangeError('Assessment history has an invalid or backwards timestamp.');
    previous=item.timestamp;
  }
  if(nowMs<previous)throw new RangeError('Review timestamp is earlier than the last assessment.');
  const nextStreak=assessment==='Remembered'?card.streak+1:0;
  if(nextStreak>2147483647)throw new RangeError('Streak limit reached.');
  const interval=assessment==='Again'?600000:assessment==='Hard'?86400000:INTERVALS_MS[Math.min(card.streak,4)];
  const dueAt=nowMs+interval;
  if(!timestamp(dueAt))throw new RangeError('Resulting review date is outside the supported range.');
  return {...card,streak:nextStreak,dueAt};
}
