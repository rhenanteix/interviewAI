import type {LlmProvider} from './pipeline.js';
import {ProviderError,providerFailure} from './provider-errors.js';

type Job={id:number;text:string;lang:string;context:string};

// Stable segments are translated independently of answers. Bounded queues keep
// a slow provider from creating an ever-growing number of concurrent requests.
export function createLiveTurns(provider:LlmProvider,send:(event:Record<string,unknown>)=>void){
 let utterance='',sequence=0,answered=0,closed=false,disabled=false;
 let translations=0,answering=false;
 let pendingTranslation:Job|undefined,pendingAnswer:Job|undefined;
 const tasks=new Set<Promise<void>>();
 const track=(task:Promise<void>)=>{tasks.add(task);void task.finally(()=>tasks.delete(task));};
 const fail=(error:unknown,fallback:string)=>{
  if(closed||disabled)return;
  if(error instanceof ProviderError&&error.permanent){disabled=true;pendingTranslation=undefined;pendingAnswer=undefined;}
  send(providerFailure(error,fallback));
 };
 function translate(job:Job){
  translations++;
  track(provider.translate(job.text,job.lang).then(text=>{
   if(!closed&&!disabled)send({type:'translation',id:job.id,text,original:job.text,final:true});
  }).catch(error=>fail(error,'TRANSLATION_FAILED')).finally(()=>{
   translations--;
   if(!closed&&!disabled&&pendingTranslation){const next=pendingTranslation;pendingTranslation=undefined;translate(next);}
  }));
 }
 function answer(job:Job){
  answering=true;const start=performance.now();
  track(provider.answer(job.text,job.context).then(text=>{
   if(closed||disabled||job.id<answered)return;
   answered=job.id;send({type:'answer',id:job.id,text,latency_ms:Math.round(performance.now()-start)});
  }).catch(error=>fail(error,'ANSWER_FAILED')).finally(()=>{
   answering=false;
   if(!closed&&!disabled&&pendingAnswer){const next=pendingAnswer;pendingAnswer=undefined;answer(next);}
  }));
 }
 return {
  close(){closed=true;utterance='';pendingTranslation=undefined;pendingAnswer=undefined;},
  async drain(){while(tasks.size)await Promise.all([...tasks]);},
  accept(text:string,final:boolean,speechFinal:boolean,lang:string,context:string,mode:'assist'|'translate'){
   if(closed||disabled||!final)return;
   const id=++sequence;
   if(text){
    utterance=[utterance,text].filter(Boolean).join(' ').slice(-12000);
    send({type:'processing',at:Date.now()});
    const job={id,text,lang,context};
    if(translations<6)translate(job);
    else pendingTranslation=job;
   }
   if(speechFinal&&utterance){
    const question=utterance;utterance='';
    if(mode!=='assist')return;
    const job={id,text:question,lang,context};
    if(answering)pendingAnswer=job;else answer(job);
   }
  }
 };
}
