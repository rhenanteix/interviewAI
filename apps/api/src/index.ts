import { z } from 'zod';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {registerPlatform} from './platform.js';
import {registerAudioStream} from './audio-stream.js';
import {registerStream} from './stream.js';
import { input } from '@interviewia/shared';
import { MockLlm,processTurn } from './pipeline.js';
import { AnthropicProvider } from './provider.js';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  API_PORT: z.string().regex(/^\d+$/).transform(Number).optional().default('3001'),
  CORS_ORIGINS: z.string().optional().default('http://localhost:5173,http://localhost:5174'),
  DATA_FILE: z.string().optional().default('./data/local.json'),
  DEEPGRAM_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional().default('claude-haiku-4-5-20251001'),
  VITE_API_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  PUBLIC_URL: z.string().url().optional(),
});

const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  const missing = _env.error.issues.map(i => i.path.join('.')).join(', ');
  throw new Error(`Variáveis de ambiente inválidas ou faltando: ${missing}. Consulte .env.example.`);
}
const env = _env.data;

const app=Fastify({logger:true});await app.register(cors,{origin:env.CORS_ORIGINS.split(',')});await app.register(websocket);await registerPlatform(app);registerAudioStream(app);registerStream(app);
const tickets=new Map<string,{expires:number,userId:string}>();const llm=env.ANTHROPIC_API_KEY?new AnthropicProvider():new MockLlm();
const demo=!env.ANTHROPIC_API_KEY;
app.get('/health',async()=>({status:'ok',mode:demo?'demo':'anthropic',time:new Date().toISOString()}));
app.get('/ready',async(_req,reply)=>{const ok=Boolean(env.JWT_SECRET&&env.JWT_SECRET.length>=32);if(!ok)return reply.code(503).send({ready:false,reason:'JWT_SECRET_REQUIRED'});return {ready:true,mode:demo?'demo':'anthropic',deepgram:!!env.DEEPGRAM_API_KEY}});
app.post('/v1/ws-ticket',async(request,reply)=>{
 const auth=request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!auth||!env.JWT_SECRET)return reply.code(401).send({error:'AUTH_REQUIRED'});
 let userId='';try{const payload=jwt.verify(auth,env.JWT_SECRET) as {sub?:string};userId=payload.sub||'';}catch{return reply.code(401).send({error:'INVALID_TOKEN'});}
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
await app.listen({port:env.API_PORT,host:'0.0.0.0'});
