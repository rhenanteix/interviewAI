import type {FastifyInstance} from 'fastify';
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {MockLlm,processTurn} from './pipeline.js';
import {AnthropicProvider} from './provider.js';

// Dedicated PCM16/16kHz streaming bridge. API keys never reach browsers.
export function registerAudioStream(app:FastifyInstance){
 const tickets=new Map<string,{expires:number,userId:string}>();
 const llm=process.env.ANTHROPIC_API_KEY?new AnthropicProvider():new MockLlm();
 app.post('/v1/audio-ticket',async (req,reply)=>{
  let userId:string;
  try{const token=req.headers.authorization?.replace(/^Bearer\s+/,'');if(!token)throw Error();const payload=jwt.verify(token,process.env.JWT_SECRET||'MISSING_SECRET') as {sub:string};if(!payload.sub)throw Error();userId=payload.sub;}catch{return reply.code(401).send({error:'LOGIN_REQUIRED'});}

  if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)return reply.code(503).send({error:'JWT_SECRET_REQUIRED'});
  if(!process.env.DEEPGRAM_API_KEY)return reply.code(503).send({error:'DEEPGRAM_NOT_CONFIGURED'});
  for(const [k,v] of tickets)if(v.expires<Date.now())tickets.delete(k);
  const ticket=randomUUID();tickets.set(ticket,{expires:Date.now()+30000,userId});return {ticket,expires_in:30};
 });
 app.get('/v1/audio-stream',{websocket:true},(client,req)=>{
  const ticket=(req.query as {ticket?:string}).ticket;
  if(!ticket||!tickets.has(ticket)||tickets.get(ticket)!.expires<Date.now()){client.close(1008,'Invalid ticket');return;}
  tickets.delete(ticket);
  const query=new URLSearchParams({model:'nova-3',language:'multi',encoding:'linear16',sample_rate:'16000',channels:'1',interim_results:'true',punctuate:'true',smart_format:'true',diarize:'true',endpointing:'300'});
  const upstream=new WebSocket(`wss://api.deepgram.com/v1/listen?${query}`,{headers:{Authorization:`Token ${process.env.DEEPGRAM_API_KEY}`}});
  let ended=false;let totalBytes=0;let audioQueue:Buffer[]=[];let queueBytes=0;let lastActivity=Date.now();let revision=0;let targetLang='pt-BR';let context='';let mode:'assist'|'translate'='assist';
  const send=(o:unknown)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(o));};
  upstream.on('open',()=>{for(const frame of audioQueue)upstream.send(frame,{binary:true});audioQueue=[];queueBytes=0;send({type:'audio_ready',sample_rate:16000});});
  upstream.on('message',raw=>{
   try{const d=JSON.parse(raw.toString());if(d.type!=='Results')return;
    const alternative=d.channel?.alternatives?.[0];const text=alternative?.transcript||'';
    const speakers=[...new Set((alternative?.words||[]).map((w:{speaker?:number})=>w.speaker).filter((s:unknown)=>typeof s==='number'))];
    if(text)send({type:'transcript',text,final:!!d.is_final,speech_final:!!d.speech_final,speakers,at:Date.now()});
    if(text && d.is_final && (d.speech_final || d.from_finalize || d.speech_final===undefined)){ const current=++revision;send({type:'processing',at:Date.now()});void processTurn(text,targetLang,context,llm,mode).then(result=>{if(current!==revision)return;send({type:'translation',text:result.translation,final:true});if(result.answer)send({type:'answer',text:result.answer,latency_ms:result.latency_ms,demo:!process.env.ANTHROPIC_API_KEY});}).catch(()=>send({type:'error',code:'TRANSLATION_FAILED'}));}
   }catch{send({type:'error',code:'UPSTREAM_INVALID_MESSAGE'});}
  });
  upstream.on('error',()=>send({type:'error',code:'STT_PROVIDER_ERROR'}));
  upstream.on('close',(code)=>{send({type:'audio_closed',code});if(client.readyState===WebSocket.OPEN)client.close(1012,'Upstream disconnected');});
  client.on('message',(raw,isBinary)=>{
    const buf: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as ArrayBuffer);
    if(isBinary){if(buf.length>64000||totalBytes>96000000){client.close(1009,'Audio quota exceeded');return;}totalBytes+=buf.length;if(upstream.readyState===WebSocket.OPEN)upstream.send(buf as Uint8Array,{binary:true});else if(upstream.readyState===WebSocket.CONNECTING && queueBytes<64000){audioQueue.push(buf);queueBytes+=buf.length;}return;}
   try{const d=JSON.parse(raw.toString());if(d.type==='configure'){targetLang=['pt-BR','en','es','zh-CN'].includes(d.target_lang)?d.target_lang:'pt-BR';context=String(d.context||'').slice(0,12000);mode=d.mode==='translate'?'translate':'assist';}if(d.type==='stop'&&!ended){ended=true;if(upstream.readyState===WebSocket.OPEN)upstream.send(JSON.stringify({type:'CloseStream'}));}}catch{}
  });
  const keepAlive=setInterval(()=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(JSON.stringify({type:'KeepAlive'}));},8000);
  client.on('close',()=>{clearInterval(keepAlive);if(upstream.readyState===WebSocket.OPEN)upstream.close();else if(upstream.readyState===WebSocket.CONNECTING)upstream.terminate();});
 });
}
