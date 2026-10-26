import {authenticatedFetch,socketUrl} from './api';

export type SessionPhase='idle'|'preparing'|'connecting'|'listening'|'stopping'|'error';
export type SessionOptions={source:'mic'|'tab';deviceId:string;sourceLanguage:string;targetLanguage:string;mode:'assist'|'translate'};
export type AudioEvent={type:string;[key:string]:unknown};
export type SessionUpdate={
 phase?:SessionPhase;level?:number;sentBytes?:number;receivedBytes?:number;
 device?:string;notice?:string;error?:string;translationAvailable?:boolean;
};
const errors:Record<string,string>={
 DEEPGRAM_NOT_CONFIGURED:'Configure DEEPGRAM_API_KEY no servidor e reinicie a API para transcrever.',
 LOGIN_REQUIRED:'Sua sessão expirou. Saia da conta e entre novamente.',
 NotAllowedError:'Permissão negada. Libere o microfone nas configurações do navegador e tente novamente.',
 NotFoundError:'Nenhum microfone foi encontrado. Conecte um microfone e tente novamente.',
 NotReadableError:'Não foi possível abrir o microfone. Verifique se outro aplicativo está usando o dispositivo.',
 OverconstrainedError:'O microfone selecionado não está mais disponível. Escolha outro dispositivo.',
 SecurityError:'O navegador bloqueou a captura. Abra o app em localhost ou HTTPS.',
 AbortError:'A captura foi interrompida. Tente novamente.'
};
export function audioError(error:unknown){
 if(error instanceof Error)return errors[error.message]||errors[error.name]||error.message;
 return 'Não foi possível iniciar a captura. Tente novamente.';
}

export class AudioSession {
 private context?:AudioContext;
 private media?:MediaStream;
 private node?:AudioWorkletNode;
 private socket?:WebSocket;
 private input?:MediaStreamAudioSourceNode;
 private silence?:GainNode;
 private cancelled=false;
 private stopping=false;
 private ready=false;
 private configured=false;
 private started=false;
 private received=false;
 private bytes=0;
 private lastMeter=0;
 private lastVoice=Date.now();
 private startedAt=Date.now();
 private monitor?:ReturnType<typeof setInterval>;
 private timeout?:ReturnType<typeof setTimeout>;
 private flushDone?:()=>void;
 private request=new AbortController();
 constructor(private update:(update:SessionUpdate)=>void,private event:(event:AudioEvent)=>void){}
 async start(options:SessionOptions){
  try{
   this.update({phase:'preparing',error:'',notice:'',level:0,sentBytes:0,receivedBytes:0});
   if(!window.isSecureContext||!navigator.mediaDevices)throw Error('Abra o app em localhost ou HTTPS para permitir a captura de áudio.');
   if(!window.AudioContext)throw Error('Este navegador não oferece captura de áudio compatível. Use uma versão atual do Chrome ou Edge.');
   if(options.source==='tab'&&!navigator.mediaDevices.getDisplayMedia)throw Error('Este navegador não permite compartilhar áudio de abas. Use o microfone ou abra no Chrome.');
   this.context=new AudioContext({latencyHint:'interactive'});
   // Resume directly from the click, before permission/network awaits.
   void this.context.resume().catch(()=>{});
   const media=await (options.source==='mic'
    ? navigator.mediaDevices.getUserMedia({audio:{deviceId:options.deviceId?{exact:options.deviceId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})
    : navigator.mediaDevices.getDisplayMedia({video:true,audio:true}));
   if(this.cancelled){media.getTracks().forEach(track=>track.stop());return;}
   this.media=media;
   const track=media.getAudioTracks()[0];
   if(!track)throw Error('A aba não compartilhou áudio. Selecione uma aba do navegador e marque “Compartilhar áudio”. Para traduzir sua voz, escolha Microfone.');
   this.update({device:track.label||'Dispositivo conectado'});
   track.onended=()=>void this.stop();
   track.onmute=()=>this.update({notice:'A fonte de áudio está silenciada. Ative o microfone ou o som da aba.'});
   track.onunmute=()=>this.update({notice:''});
   if(!this.context.audioWorklet)throw Error('A captura de áudio não é suportada neste navegador. Use Chrome ou Edge em localhost/HTTPS.');
   await this.context.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url).href);
   if(this.cancelled)return;
   this.node=new AudioWorkletNode(this.context,'pcm16-capture');
   this.input=this.context.createMediaStreamSource(new MediaStream([track]));
   this.silence=this.context.createGain();this.silence.gain.value=0;
   this.node.onprocessorerror=()=>this.fail('O processador de áudio parou. Reinicie a captura.');
   this.node.port.onmessage=message=>{
    if(message.data==='flushed'){this.flushDone?.();return;}
    if(this.cancelled||!(message.data instanceof ArrayBuffer))return;
    const pcm=new Int16Array(message.data);
    let energy=0;for(const value of pcm)energy+=(value/32768)**2;
    const rms=Math.sqrt(energy/Math.max(1,pcm.length));
    if(rms>0.005)this.lastVoice=Date.now();
    if(Date.now()-this.lastMeter>100){
     this.lastMeter=Date.now();
     this.update({level:Math.min(100,Math.sqrt(rms)*180)});
    }
    if(this.socket?.readyState===WebSocket.OPEN&&this.ready&&this.configured){
     if(this.socket.bufferedAmount>256000){this.fail('A rede não está acompanhando o áudio. Verifique a conexão e reinicie.');return;}
     this.socket.send(message.data);this.bytes+=message.data.byteLength;
    }
   };
   this.update({phase:'connecting'});
   const response=await authenticatedFetch('/v1/audio-ticket',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({source_lang:options.sourceLanguage}),signal:this.request.signal
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível conectar à API.');
   if(this.cancelled)return;
   this.update({translationAvailable:!!data.translation});
   const socket=new WebSocket(socketUrl('/v1/audio-stream?ticket='+encodeURIComponent(data.ticket)));
   this.socket=socket;
   this.timeout=setTimeout(()=>this.fail('A conexão de áudio demorou demais. Verifique sua rede e tente novamente.'),15000);
   socket.onopen=()=>socket.send(JSON.stringify({
    type:'configure',target_lang:options.targetLanguage,mode:options.mode,
    context:localStorage.getItem('copilot-context')||''
   }));
   socket.onmessage=message=>{
    if(this.cancelled)return;
    try{
     const data=JSON.parse(message.data) as AudioEvent;
     if(data.type==='audio_ready')this.ready=true;
     if(data.type==='configured')this.configured=true;
     if(this.ready&&this.configured&&!this.started&&!this.stopping){
      this.started=true;clearTimeout(this.timeout);
      this.input!.connect(this.node!);this.node!.connect(this.silence!);this.silence!.connect(this.context!.destination);
      void this.context!.resume().then(()=>{
       if(!this.cancelled&&!this.stopping)this.update({phase:'listening'});
      }).catch(()=>this.fail('O navegador suspendeu o áudio. Reinicie a captura.'));
      this.startedAt=Date.now();this.lastVoice=Date.now();
      this.monitor=setInterval(()=>{
       const elapsed=Date.now()-this.startedAt;
       let notice='';
       if(elapsed>8000&&Date.now()-this.lastVoice>8000)notice=options.source==='mic'
        ? 'Não detectamos som. Fale perto do microfone ou encerre e escolha outro dispositivo.'
        : 'A aba está sem som. Confira se ela está reproduzindo áudio e se o compartilhamento foi ativado.';
       if(elapsed>5000&&!this.received&&this.bytes>0)notice='O áudio saiu do navegador, mas o servidor ainda não confirmou o recebimento.';
       if(this.context?.state==='suspended')notice='O áudio foi suspenso pelo navegador. Encerre e inicie a captura novamente.';
       this.update({notice,sentBytes:this.bytes});
      },1000);
     }
     if(data.type==='audio_received'){this.received=true;this.update({receivedBytes:Number(data.bytes),sentBytes:this.bytes});}
     if(data.type==='error'){
      this.update({error:String(data.message||errors[String(data.code)]||data.code),...(data.permanent?{translationAvailable:false}:{})});
      if(data.fatal){this.fail(String(data.message||data.code));return;}
     }
     if(data.type==='audio_closed'){this.dispose();this.update({phase:'idle',level:0,notice:''});}
     this.event(data);
    }catch{this.fail('Recebemos uma resposta inválida do servidor. Reinicie a sessão.');}
   };
   socket.onerror=()=>this.fail('Não foi possível abrir a conexão de áudio. Verifique se a API está rodando.');
   socket.onclose=()=>{
    if(this.cancelled)return;
    if(this.stopping){this.dispose();this.update({phase:'idle',level:0,notice:''});}
    else this.fail('A conexão de áudio foi encerrada. Inicie uma nova sessão.');
   };
  }catch(error){if(!this.cancelled)this.fail(audioError(error));}
 }
 private fail(error:string){this.dispose();this.update({phase:'error',error,level:0,notice:''});}
 async stop(){
  if(this.cancelled||this.stopping)return;
  this.stopping=true;this.update({phase:'stopping',notice:''});clearInterval(this.monitor);
  if(!this.started){this.dispose();this.update({phase:'idle',level:0});return;}
  if(this.node){
   await new Promise<void>(resolve=>{
    const timer=setTimeout(resolve,150);
    this.flushDone=()=>{clearTimeout(timer);resolve();};
    this.node!.port.postMessage('flush');
   });
  }
  this.stopCapture();
  if(this.socket?.readyState===WebSocket.OPEN){
   this.socket.send(JSON.stringify({type:'stop'}));
   this.timeout=setTimeout(()=>{this.dispose();this.update({phase:'idle',level:0});},20000);
  }else{this.dispose();this.update({phase:'idle',level:0});}
 }
 private stopCapture(){
  this.input?.disconnect();this.node?.disconnect();this.silence?.disconnect();
  this.media?.getTracks().forEach(track=>{track.onended=null;track.stop();});
  if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});
 }
 dispose(){
  this.cancelled=true;this.request.abort();clearInterval(this.monitor);clearTimeout(this.timeout);
  this.stopCapture();
  if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.onmessage=null;this.socket.onopen=null;this.socket.close();}
 }
}
