import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import {registerPlatform} from './platform.js';
import {registerAudioStream} from './audio-stream.js';
import { input } from '@copilot/shared';
import { MockLlm,processTurn } from './pipeline.js';
import { AnthropicProvider } from './provider.js';
const app=Fastify({logger:true});await app.register(cors,{origin:['http://localhost:5173']});await app.register(websocket);await registerPlatform(app);registerAudioStream(app);
const tickets=new Map<string,number>();const llm=process.env.ANTHROPIC_API_KEY?new AnthropicProvider():new MockLlm();
const demo=!process.env.ANTHROPIC_API_KEY;
app.get('/health',async()=>({status:'ok',mode:demo?'demo':'anthropic',time:new Date().toISOString()}));
app.get('/ready',async()=>({ready:true,dependencies:'not_checked',mode:'demo'}));
app.post('/v1/ws-ticket',async(_request,reply)=>{for(const [k,v] of tickets)if(v<Date.now())tickets.delete(k);if(tickets.size>1000)return reply.code(429).send({error:'Too many pending tickets'});const ticket=randomUUID();tickets.set(ticket,Date.now()+30000);reply.send({ticket,expires_in:30})});
app.get('/v1/realtime',{websocket:true},(socket,request)=>{
 const ticket=(request.query as {ticket?:string}).ticket;
 if(!ticket||!tickets.has(ticket)||tickets.get(ticket)!<Date.now()){socket.close(1008,'Invalid or expired ticket');return}
 tickets.delete(ticket);let active=false;let mode:'assist'|'translate'='assist';let paused=false;let revision=0;let context='';let targetLang='pt-BR';let previousText='';
 const send=(data:Record<string,unknown>)=>{if(socket.readyState===1)socket.send(JSON.stringify(data))};
 socket.on('message',async(raw,isBinary)=>{
  if(isBinary){send({type:'error',code:'AUDIO_NOT_CONFIGURED',action:'Configure um provedor STT para transcrição real.'});return}
  let msg;try{msg=input.parse(JSON.parse(raw.toString()))}catch{send({type:'error',code:'INVALID_MESSAGE'});return}
  if(msg.type==='start'){active=true;mode=msg.mode;context=msg.context||'';targetLang=msg.target_lang||'pt-BR';send({type:'session',id:randomUUID(),mode,source:msg.source});send({type:'status',state:'listening',demo});return}
  if(msg.type==='stop'){revision++;active=false;send({type:'done'});return}
  if(msg.type==='control'){if(msg.action==='regenerate'&&previousText){const result=await processTurn(previousText,targetLang,context,llm,mode);if(result.answer)send({type:'answer',text:result.answer,latency_ms:result.latency_ms,sources:[],demo});return}paused=msg.action==='pause'?true:msg.action==='resume'?false:paused;send({type:'status',state:paused?'paused':'listening'});return}
  if(msg.type==='text'){
   if(!active||paused){send({type:'error',code:'SESSION_INACTIVE'});return}
   previousText=msg.text;const current=++revision;send({type:'heard',text:msg.text,lang:msg.lang||'auto',speaker:'interlocutor'});
   try{const result=await processTurn(msg.text,targetLang,context,llm,mode);if(current!==revision)return;
    send({type:'translation',text:result.translation,final:true,demo});if(result.answer)send({type:'answer',text:result.answer,latency_ms:result.latency_ms,sources:[],demo});
   }catch{send({type:'error',code:'PIPELINE_FAILED'})}
  }
 });
});
await app.listen({port:Number(process.env.API_PORT||3001),host:'0.0.0.0'});
