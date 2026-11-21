import {content} from './content.mjs';
export function trajectory(selected=[]){
 const ids=new Set(selected); const totals=[-2,-3,-1,0];
 for(const f of content.factors)if(ids.has(f.id))f.delta.forEach((v,i)=>totals[i]+=v);
 const [L,M,I,D]=totals;
 const outcome=M<=-2?'Coup':M===-1&&(L<=0||I<=0)?'Coup':L<=-1&&I<=-1?'Instability':(!ids.has('F3')||!ids.has('F6'))&&M>=0?'Personalised rule':D<=-1?'Struggling rule':'Consolidation';
 return {selected:[...ids],outcome,headlines:content.headlines[outcome]||[],totals};
}
export function evidenceReady(tags){return content.evidence.slice(0,16).filter(e=>tags[e.id]==='foundations').length>=14&&['E17','E18'].every(id=>['foundations','aside'].includes(tags[id]));}
export function sourcing(tags){const n=['E17','E18'].filter(id=>tags[id]==='foundations').length;return n===0?'Strong':n===1?'Mixed':'Fragile';}
export function findings(ids){const a=ids.includes('F2'), b=ids.includes('F3')||ids.includes('F6');return a&&b&&!ids.includes('F7')?'Strong':!a&&!b?'Fragile':'Mixed';}
export function climate(s1,s2){const n=[s1,s2].filter(s=>s==='Fragile').length;return ['Calm','Strained','Hostile'][n];}
export function response(choices,weather='Calm'){
 if(!content.levers.every(l=>l.options.some(o=>o.id===choices[l.id])))throw Error('Set all five response choices.');
 const scores=[0,0,0,0,0];
 for(const l of content.levers)l.options.find(o=>o.id===choices[l.id]).points.forEach((v,i)=>scores[i]+=v);
 const budget=weather==='Calm'?9:weather==='Hostile'?7:8;
 const over=scores[4]>budget;if(over){scores[2]-=2;scores[3]-=2;}
 const levels=scores.slice(0,4).map((v,i)=>i===3?(v<=-1?'Rising':v>=3?'Easing':'Steady'):(v<=-1?'Low':v>=3?'High':'Medium'));
 const lows=scores.slice(0,4).filter(v=>v<=-1).length;
 return {choices:{...choices},budget,cost:scores[4],over,scores,levels,strand:lows===0?'Strong':lows===1?'Mixed':'Fragile'};
}
export function forward(strands){const n=strands.filter(s=>s==='Strong').length;return n===3?0:n===2?1:2;}
export function briefingCheck(text){return Object.fromEntries(Object.entries({Roots:['colonial','boundary','independence','history','kingdom','inherited'],Drivers:['army','officers','succession','party','diversity','institutions'],Recommendation:['recommend','consultation','dialogue','review','report','hotline','oversight'],Uncertainty:['uncertain','unclear','not sure','further evidence','need to check','limits']}).map(([k,words])=>[k,words.some(w=>new RegExp('\\b'+w+'\\b','i').test(text))]));}
export const indicatorNames=['Evidence clarity','Participation','Public confidence','Tension'];
export function situation(result){const lines=[['Claims and facts are tangled together; no one can say what is known.','The Dialogue can show what is established, what is claimed and what is unknown.'],['The same voices dominate; the youth and women’s groups are outside the room.','Residents, youth and women’s groups, and local leaders all speak, and the record shows it.'],['People doubt the Dialogue’s fairness; some demand it be replaced.','People say they can see what the Dialogue is doing and why.'],['The rally grows; the barracks whisper louder; rumours spread.','The rally is called off in favour of talks; the whispers fade.']];return result.scores.slice(0,4).map((v,i)=>v<=-1?lines[i][0]:v>=3?lines[i][1]:'Mixed results');}
export function dialogue(result){return result.strand==='Strong'?'This is a response we can defend in public and carry out. The Dialogue will adopt it.':result.strand==='Fragile'?'This will not hold. We have to start again from the evidence.':'We will take most of this forward. One concern goes back to you: '+situation(result).find((_,i)=>result.scores[i]<=-1);}
