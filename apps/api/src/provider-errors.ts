export class ProviderError extends Error {
 constructor(public code:string, message:string, public permanent=false){super(message);}
}

export function providerFailure(error:unknown, fallback:string){
 return error instanceof ProviderError
  ? {type:'error',code:error.code,message:error.message,permanent:error.permanent}
  : {type:'error',code:fallback,message:'Não foi possível concluir o processamento. Tente novamente.',permanent:false};
}
