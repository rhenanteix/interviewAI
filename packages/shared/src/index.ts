import { z } from 'zod';
export const sessionStart = z.object({ type:z.literal('start'), profile_id:z.string().optional(), mode:z.enum(['assist','translate']).default('assist'), source:z.enum(['mic','tab','system']).default('mic'), speaker_pref:z.string().optional(), context:z.string().max(16000).optional(),target_lang:z.enum(['pt-BR','en','es']).optional() });
export const control = z.object({ type:z.literal('control'), action:z.enum(['pause','resume','regenerate','shorter','longer','tone']) });
export const input = z.discriminatedUnion('type',[sessionStart,control,z.object({type:z.literal('stop')}),z.object({type:z.literal('text'),text:z.string().min(1).max(10000),lang:z.string().optional()})]);
export type ClientMessage = z.infer<typeof input>;
export type ServerMessage = {type:'session'|'status'|'heard'|'translation'|'answer'|'done'|'error';[key:string]:unknown};
