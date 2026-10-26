import {expect,it,vi} from 'vitest';
import {createLiveTurns} from './live-turns.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
it('translates stable segments without waiting for silence or the answer',async()=>{
 const send=vi.fn();let finish!:(value:string)=>void;
 const provider={translate:vi.fn(async(text:string)=>'PT '+text),answer:vi.fn(()=>new Promise<string>(resolve=>{finish=resolve;}))};
 const turns=createLiveTurns(provider,send);
 turns.accept('Hello',false,false,'pt-BR','','assist');
 expect(provider.translate).not.toHaveBeenCalled();
 turns.accept('Hello',true,false,'pt-BR','','assist');
 await tick();
 expect(send).toHaveBeenCalledWith({type:'translation',text:'PT Hello',final:true});
 expect(provider.answer).not.toHaveBeenCalled();
 turns.accept('world',true,true,'pt-BR','profile','assist');
 await tick();
 expect(provider.answer).toHaveBeenCalledWith('Hello world','profile');
 expect(send).toHaveBeenCalledWith({type:'translation',text:'PT world',final:true});
 finish('Answer');await tick();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'answer',text:'Answer'}));
});
it('handles an empty endpoint and translation-only mode',async()=>{
 const provider={translate:vi.fn(async()=> 'Olá'),answer:vi.fn(async()=> 'Resposta')};
 const turns=createLiveTurns(provider,vi.fn());
 turns.accept('Hello',true,false,'pt-BR','','assist');
 turns.accept('',true,true,'pt-BR','','assist');
 expect(provider.answer).toHaveBeenCalledWith('Hello','');
 turns.accept('Goodbye',true,true,'pt-BR','','translate');
 expect(provider.answer).toHaveBeenCalledTimes(1);
});
it('does not discard pending output when new speech arrives or overwrite newer results',async()=>{
 const send=vi.fn();const pending:Array<(text:string)=>void>=[];
 const provider={translate:()=>new Promise<string>(resolve=>pending.push(resolve)),answer:async()=>''};
 const turns=createLiveTurns(provider,send);
 turns.accept('one',true,false,'pt-BR','','translate');
 turns.accept('two',true,false,'pt-BR','','translate');
 pending[0]('um');await tick();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({text:'um'}));
 turns.accept('three',true,false,'pt-BR','','translate');
 pending[2]('três');await tick();
 pending[1]('dois');await tick();
 expect(send).not.toHaveBeenCalledWith(expect.objectContaining({text:'dois'}));
 turns.accept('four',true,false,'pt-BR','','translate');
 turns.close();pending[3]('quatro');await tick();
 expect(send).not.toHaveBeenCalledWith(expect.objectContaining({text:'quatro'}));
});
