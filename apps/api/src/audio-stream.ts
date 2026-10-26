import type {FastifyInstance} from 'fastify';
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import type {LlmProvider} from './pipeline.js';
import {AnthropicProvider} from './provider.js';
import {ProviderError} from './provider-errors.js';
import {createLiveTurns} from './live-turns.js';

type Options={provider?:LlmProvider;connect?:(url:string,options:WebSocket.ClientOptions)=>WebSocket};
const sourceLanguages=new Set(['multi','pt-BR','en','es','zh-CN']);
const targetLanguages=new Set(['pt-BR','en','es','zh-CN']);
const missingProvider: LlmProvider={
 async translate(){throw new ProviderError('LLM_NOT_CONFIGURED','Configure ANTHROPIC_API_KEY no servidor para traduzir. A transcrição continua disponível.',true);},
 async answer(){throw new ProviderError('LLM_NOT_CONFIGURED','Configure ANTHROPIC_API_KEY no servidor para gerar respostas.',true);}
};

// Dedicated PCM16/16kHz streaming bridge. Credentials never reach the browser.
export function registerAudioStream(app:FastifyInstance,options:Options={}){
 const tickets=new Map<string,{expires:number,userId:string,language:string}>();
 const llm=options.provider||(process.env.ANTHROPIC_API_KEY?new AnthropicProvider():missingProvider);
 app.post('/v1/audio-ticket',async(req,reply)=>{
  let userId:string;
  try{
   const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
   if(!token)throw Error();
   const payload=jwt.verify(token,process.env.JWT_SECRET||'MISSING_SECRET') as {sub?:string,kind?:string};
   if(!payload.sub||payload.kind==='refresh')throw Error();
   userId=payload.sub;
  }catch{return reply.code(401).send({error:'LOGIN_REQUIRED'});}
  if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)return reply.code(503).send({error:'JWT_SECRET_REQUIRED'});
  if(!process.env.DEEPGRAM_API_KEY)return reply.code(503).send({error:'DEEPGRAM_NOT_CONFIGURED'});
  const language=(req.body as {source_lang?:string}|undefined)?.source_lang||'multi';
  if(!sourceLanguages.has(language))return reply.code(400).send({error:'INVALID_LANGUAGE'});
  for(const [key,value] of tickets)if(value.expires<Date.now())tickets.delete(key);
  if(tickets.size>=1000)return reply.code(429).send({error:'TOO_MANY_TICKETS'});
  const ticket=randomUUID();
  tickets.set(ticket,{expires:Date.now()+30000,userId,language});
  return {ticket,expires_in:30,translation:!!process.env.ANTHROPIC_API_KEY};
 });
 app.get('/v1/audio-stream',{websocket:true},(client,req)=>{
  const ticket=(req.query as {ticket?:string}).ticket;
  const entry=ticket?tickets.get(ticket):undefined;
  if(!ticket||!entry||entry.expires<Date.now()){client.close(1008,'Invalid ticket');return;}
  tickets.delete(ticket);
  const query=new URLSearchParams({
   model:'nova-3',language:entry.language,encoding:'linear16',sample_rate:'16000',channels:'1',
   interim_results:'true',punctuate:'true',smart_format:'true',diarize:'true',endpointing:'300',utterance_end_ms:'1000'
  });
  const connect=options.connect||((url,opts)=>new WebSocket(url,opts));
  const upstream=connect('wss://api.deepgram.com/v1/listen?'+query,{
   headers:{Authorization:'Token '+process.env.DEEPGRAM_API_KEY},handshakeTimeout:10000
  });
  let stopping=false,failed=false,configured=false,totalBytes=0,lastAck=0,lastAudio=Date.now();
  let targetLang='pt-BR',context='',mode:'assist'|'translate'='assist';
  const send=(event:unknown)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(event));};
  const turns=createLiveTurns(llm,send);
  const fail=(code:string,message:string)=>{
   if(failed)return;
   failed=true;send({type:'error',code,message,fatal:true});
   client.close(1011,code);
  };
  const stopTimer=setTimeout(()=>fail('AUDIO_CONNECTION_TIMEOUT','A conexão de áudio não iniciou. Verifique sua rede e tente novamente.'),15000);
  let closeTimer:ReturnType<typeof setTimeout>|undefined;
  upstream.on('open',()=>{
   clearTimeout(stopTimer);
   send({type:'audio_ready',sample_rate:16000,translation:!!process.env.ANTHROPIC_API_KEY});
  });
  upstream.on('unexpected-response',(_request,response)=>{
   response.resume();
   const status=response.statusCode;
   fail(status===401||status===403?'STT_AUTH_FAILED':status===402?'STT_CREDITS_REQUIRED':'STT_PROVIDER_ERROR',
    status===401||status===403?'A chave Deepgram não foi aceita. Verifique DEEPGRAM_API_KEY no servidor.':
    status===402?'A conta Deepgram precisa de créditos para transcrever.':'O serviço de transcrição recusou a conexão. Verifique a configuração e tente novamente.');
   upstream.terminate();
  });
  upstream.on('message',raw=>{
   try{
    const data=JSON.parse(raw.toString());
    if(data.type==='Error'){fail('STT_PROVIDER_ERROR','O serviço de transcrição retornou um erro. Reinicie a captura.');return;}
    if(data.type==='UtteranceEnd'){
     turns.accept('',true,true,targetLang,context,mode);
     return;
    }
    if(data.type!=='Results')return;
    const alternative=data.channel?.alternatives?.[0];
    const text=String(alternative?.transcript||'');
    const speakers=[...new Set((alternative?.words||[]).map((word:{speaker?:number})=>word.speaker).filter((speaker:unknown)=>typeof speaker==='number'))];
    if(text)send({type:'transcript',text,final:!!data.is_final,speech_final:!!data.speech_final,speakers,at:Date.now()});
    turns.accept(text,!!data.is_final,!!(data.speech_final||data.from_finalize),targetLang,context,mode);
   }catch{fail('UPSTREAM_INVALID_MESSAGE','Recebemos uma resposta inválida da transcrição. Reinicie a captura.');}
  });
  upstream.on('error',()=>fail('STT_CONNECTION_FAILED','Não foi possível conectar ao Deepgram. Verifique sua rede e a configuração do serviço.'));
  upstream.on('close',async(code)=>{
   clearTimeout(stopTimer);clearTimeout(closeTimer);clearInterval(keepAlive);
   if(!stopping&&!failed){fail('STT_DISCONNECTED','A transcrição foi desconectada. Inicie uma nova sessão.');return;}
   if(failed)return;
   turns.accept('',true,true,targetLang,context,mode);
   await turns.drain();
   send({type:'audio_closed',code});
   if(client.readyState===WebSocket.OPEN)client.close(1000,'Session complete');
  });
  client.on('message',(raw,isBinary)=>{
   if(isBinary){
    if(stopping||failed)return;
    const buffer=Buffer.isBuffer(raw)?raw:Buffer.from(raw as ArrayBuffer);
    if(buffer.length>64000||buffer.length%2||totalBytes+buffer.length>96000000){
     fail('AUDIO_QUOTA_EXCEEDED','O limite de áudio da sessão foi atingido ou o formato é inválido. Inicie outra sessão.');return;
    }
    if(!configured||upstream.readyState!==WebSocket.OPEN){fail('AUDIO_NOT_READY','O áudio chegou antes de a conexão estar pronta. Reinicie a captura.');return;}
    if(upstream.bufferedAmount>256000){fail('AUDIO_BACKPRESSURE','A rede está lenta demais para enviar áudio ao vivo. Verifique sua conexão e reinicie.');return;}
    totalBytes+=buffer.length;lastAudio=Date.now();
    upstream.send(buffer,{binary:true});
    if(!lastAck||Date.now()-lastAck>=1000){
     lastAck=Date.now();send({type:'audio_received',bytes:totalBytes,seconds:totalBytes/32000});
    }
    return;
   }
   try{
    const data=JSON.parse(raw.toString());
    if(data.type==='configure'&&!configured){
     targetLang=targetLanguages.has(data.target_lang)?data.target_lang:'pt-BR';
     context=String(data.context||'').slice(0,12000);
     mode=data.mode==='translate'?'translate':'assist';
     configured=true;send({type:'configured'});
    }
    if(data.type==='stop'&&!stopping){
     stopping=true;
     if(upstream.readyState===WebSocket.OPEN){
      upstream.send(JSON.stringify({type:'CloseStream'}));
      closeTimer=setTimeout(()=>upstream.close(),3000);
     }else upstream.terminate();
    }
   }catch{fail('INVALID_MESSAGE','A configuração da captura é inválida. Reinicie a sessão.');}
  });
  const keepAlive=setInterval(()=>{
   if(upstream.readyState===WebSocket.OPEN&&Date.now()-lastAudio>3000&&!stopping)upstream.send(JSON.stringify({type:'KeepAlive'}));
  },3000);
  client.on('close',()=>{
   clearTimeout(stopTimer);clearTimeout(closeTimer);clearInterval(keepAlive);turns.close();
   if(upstream.readyState===WebSocket.OPEN)upstream.close();
   else if(upstream.readyState===WebSocket.CONNECTING)upstream.terminate();
  });
 });
}
