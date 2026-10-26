export const API=(import.meta.env.VITE_API_URL||`${location.protocol}//${location.hostname}:3001`).replace(/\/$/,'');
export const socketUrl=(path:string)=>API.replace(/^http/,'ws')+path;

let refreshing:Promise<string>|null=null;
async function refreshToken(){
 if(!refreshing)refreshing=(async()=>{
  const token=localStorage.getItem('interviewia-refresh');
  if(!token)throw Error('Sua sessão expirou. Saia da conta e entre novamente.');
  const response=await fetch(API+'/api/v1/auth/refresh',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refreshToken:token}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Sua sessão expirou. Saia da conta e entre novamente.');
  const data=await response.json();
  localStorage.setItem('interviewia-token',data.accessToken);
  return data.accessToken as string;
 })().finally(()=>{refreshing=null;});
 return refreshing;
}
export async function authenticatedFetch(path:string,init:RequestInit={}){
 const request=(token:string)=>fetch(API+path,{...init,headers:{...init.headers,Authorization:'Bearer '+token}});
 let response=await request(localStorage.getItem('interviewia-token')||'');
 if(response.status===401)response=await request(await refreshToken());
 return response;
}
