import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {registerPlatform} from './platform.js';
import {registerAudioStream} from './audio-stream.js';
import { input } from '@copilot/shared';
import { MockLlm,processTurn } from './pipeline.js';
import { AnthropicProvider } from './provider.js';
if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must be configured with at least 32 characters');
const app=Fastify({logger:true});await app.register(cors,{origin:(process.env.CORS_ORIGINS||'http://localhost:5173,http://localhost:5174').split(',')});await app.register(websocket);await registerPlatform(app);registerAudioStream(app);
const tickets=new Map<string,{expires:number,userId:string}>();const llm=process.env.ANTHROPIC_API_KEY?new AnthropicProvider():new MockLlm();
const demo=!process.env.ANTHROPIC_API_KEY;
app.get('/health',async()=>({status:'ok',mode:demo?'demo':'anthropic',time:new Date().toISOString()}));
app.get('/ready',async(_req,reply)=>{const ok=Boolean(process.env.JWT_SECRET&&process.env.JWT_SECRET.length>=32);if(!ok)return reply.code(503).send({ready:false,reason:'JWT_SECRET_REQUIRED'});return {ready:true,mode:demo?'demo':'anthropic',deepgram:!!process.env.DEEPGRAM_API_KEY}});
app.post('/v1/ws-ticket',async(request,reply)=>{
 const auth=request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!auth||!process.env.JWT_SECRET)return reply.code(401).send({error:'AUTH_REQUIRED'});
 let userId='';try{const payload=jwt.verify(auth,process.env.JWT_SECRET) as {sub?:string};userId=payload.sub||'';}catch{return reply.code(401).send({error:'INVALID_TOKEN'});}
 if(!userId)return reply.code(401).send({error:'INVALID_TOKEN'});
 for(const [k,v] of tickets)if(v.expires<Date.now())tickets.delete(k);
 if(tickets.size>1000)return reply.code(429).send({error:'TOO_MANY_TICKETS'});
 const ticket=randomUUID();tickets.set(ticket,{expires:Date.now()+30000,userId});return {ticket,expires_in:30};
});
app.get('/v1/realtime',{websocket:true},(socket,request)=>{
 const ticket=(request.query as {ticket?:string}).ticket;
 if(!ticket||!tickets.has(ticket)||tickets.get(ticket)!.expires<Date.now()){socket.close(1008,'Invalid or expired ticket');return}
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
