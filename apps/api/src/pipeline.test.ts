import {it,expect} from 'vitest';import {MockLlm,processTurn} from './pipeline.js';
it('translation-only does not generate an answer',async()=>{const x=await processTurn('Hello','pt-BR','',new MockLlm(),'translate');expect(x.answer).toBeNull();expect(x.translation).toContain('DEMO')});
it('assist generates an answer',async()=>{const x=await processTurn('Tell me about yourself','pt-BR','',new MockLlm(),'assist');expect(x.answer).toBeTruthy()});
