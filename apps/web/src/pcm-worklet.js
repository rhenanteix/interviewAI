// Resample to mono PCM16 at 16 kHz and send 20 ms frames (50 messages/sec).
class PcmWorklet extends AudioWorkletProcessor {
 constructor(){
  super();
  this.samples=[];
  this.phase=0;
  this.frame=new Int16Array(320);
  this.offset=0;
  this.port.onmessage=event=>{
   if(event.data==='flush'){
    if(this.offset){const tail=this.frame.slice(0,this.offset);this.port.postMessage(tail.buffer,[tail.buffer]);this.offset=0;}
    this.port.postMessage('flushed');
   }
  };
 }
 process(inputs){
  const channels=inputs[0];
  if(!channels?.length)return true;
  for(let i=0;i<channels[0].length;i++){
   let value=0;
   for(const channel of channels)value+=channel[i]||0;
   this.samples.push(value/channels.length);
  }
  const step=sampleRate/16000;
  while(this.phase+1<this.samples.length){
   const index=Math.floor(this.phase),fraction=this.phase-index;
   const value=Math.max(-1,Math.min(1,this.samples[index]*(1-fraction)+this.samples[index+1]*fraction));
   this.frame[this.offset++]=Math.round(value*(value<0?32768:32767));
   if(this.offset===this.frame.length){
    const buffer=this.frame.buffer;
    this.port.postMessage(buffer,[buffer]);
    this.frame=new Int16Array(320);
    this.offset=0;
   }
   this.phase+=step;
  }
  // Retain the fractional position across render quanta, including at 48 kHz.
  const consumed=Math.min(Math.floor(this.phase),this.samples.length);
  this.samples.splice(0,consumed);
  this.phase-=consumed;
  return true;
 }
}
registerProcessor('pcm16-capture',PcmWorklet);
