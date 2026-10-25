export interface SttProvider { transcribe(audio:Uint8Array):Promise<{text:string;lang:string}> }
export interface LlmProvider { translate(text:string,lang:string):Promise<string>; answer(text:string,context:string):Promise<string> }
export class MockLlm implements LlmProvider {
 async translate(text:string,lang:string){return `[DEMO · tradução simulada para ${lang}] ${text}`}
 async answer(text:string,context:string){return `Sugestão demonstrativa: responda objetivamente à pergunta sobre “${text.slice(0,90)}”. ${context?'Considere apenas o contexto autorizado.':'Adicione seu currículo para respostas fundamentadas.'}`}
}
export async function processTurn(text:string,lang:string,context:string,provider:LlmProvider,mode:'assist'|'translate'){
 const start=performance.now();const [translation,answer]=await Promise.all([provider.translate(text,lang),mode==='assist'?provider.answer(text,context):Promise.resolve(null)]);
 return {translation,answer,latency_ms:Math.round(performance.now()-start)};
}
