/** Nursing content revised by Codex; original state factory developed with Kiro. */
export const NURSING_PACK_ID='nursing-foundations-v1';
const sbar='https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html';
const cdc='https://www.cdc.gov/infection-control/hcp/basics/standard-precautions.html';
const hands='https://www.cdc.gov/clean-hands/hcp/clinical-safety/index.html';
const who='https://www.who.int/campaigns/world-hand-hygiene-day/2025/frequently-asked-questions';
export const SAMPLE_CARD_DATA=[
 {suffix:'sbar',topic:'Communication',question:'During a nursing handover, what does SBAR stand for?',answer:'Situation, Background, Assessment, and Recommendation (or Request). It gives a concise structure for sharing a concern with the team.',source:sbar,sourceName:'AHRQ · TeamSTEPPS: SBAR'},
 {suffix:'background',topic:'Communication',question:'In an SBAR handover, how does Background differ from Situation?',answer:'Situation states the immediate issue. Background adds relevant history and context, such as related findings or test results.',source:sbar,sourceName:'AHRQ · TeamSTEPPS: SBAR'},
 {suffix:'checkback',topic:'Communication',question:'What completes the loop in a check-back between team members?',answer:'The receiver repeats the message, then the original sender verifies or corrects that repeat-back. This checks that the information was understood.',source:'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html',sourceName:'AHRQ · TeamSTEPPS: Check-Back'},
 {suffix:'teachback',topic:'Patient education',question:'How does teach-back check a patient’s understanding?',answer:'Ask the patient or caregiver to explain the key information in their own words. Their explanation helps you identify what needs clearer teaching.',source:'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html',sourceName:'AHRQ · TeamSTEPPS: Teach-Back'},
 {suffix:'moments',topic:'Infection prevention',question:'What are the WHO Five Moments for Hand Hygiene?',answer:'Before patient contact; before a clean or aseptic task; after risk of body-fluid exposure; after patient contact; and after contact with the patient’s surroundings.',source:who,sourceName:'WHO · Hand hygiene and glove use'},
 {suffix:'gloves',topic:'Infection prevention',question:'Do gloves replace hand hygiene?',answer:'No. Gloves are a barrier, but hand hygiene is still needed at the appropriate moments, including immediately after glove removal.',source:hands,sourceName:'CDC · Clinical hand hygiene'},
 {suffix:'soiled',topic:'Infection prevention',question:'What hand-hygiene method does CDC recommend when hands are visibly soiled?',answer:'Wash with soap and water. The choice of method must also follow applicable infection-control guidance and local policy.',source:hands,sourceName:'CDC · Clinical hand hygiene'},
 {suffix:'standard',topic:'Patient safety',question:'Are Standard Precautions only for patients with a known infection?',answer:'No. Apply them in all patient care. Assess exposure risk to choose suitable protective measures.',source:cdc,sourceName:'CDC · Standard Precautions'},
 {suffix:'ppe',topic:'Patient safety',question:'What determines the need for PPE under Standard Precautions?',answer:'The anticipated contact with infectious material and the type of exposure guide PPE selection. Use the relevant guidance and your facility’s policy.',source:cdc,sourceName:'CDC · Standard Precautions'},
 {suffix:'equipment',topic:'Patient safety',question:'What do Standard Precautions require for patient-care equipment?',answer:'Handle, clean and disinfect equipment appropriately. Apply the relevant cleaning instructions and facility infection-control procedures.',source:cdc,sourceName:'CDC · Standard Precautions'}
];
export function createSampleState(nowMs){
 if(!Number.isSafeInteger(nowMs)||nowMs<0)throw new RangeError('nowMs must be a safe non-negative integer');
 return {version:'1',packs:[{id:NURSING_PACK_ID,name:'Nursing Foundations · Safety & Communication',createdAt:nowMs,cards:SAMPLE_CARD_DATA.map(c=>({id:'nursing-'+c.suffix,question:c.question,answer:c.answer+'\n\nSource: '+c.source,createdAt:nowMs,dueAt:nowMs,streak:0,assessments:[]}))}],sessions:0,motionEnabled:true};
}
export function nursingReference(card){
 return SAMPLE_CARD_DATA.find(c=>card.id==='nursing-'+c.suffix&&card.question===c.question&&card.answer===c.answer+'\n\nSource: '+c.source)||null;
}
/** Additive upgrade: never replaces legacy packs, ratings or custom material. */
export function withNursingStarter(state,nowMs){
 if(state.packs.some(p=>p.id===NURSING_PACK_ID))return {data:state,added:false};
 const starter=createSampleState(nowMs).packs[0];
 if(state.packs.length>=10||state.packs.some(p=>p.cards.some(c=>starter.cards.some(n=>n.id===c.id))))return {data:state,added:false,unavailable:true};
 const data=structuredClone(state);data.packs.unshift(starter);return {data,added:true};
}
