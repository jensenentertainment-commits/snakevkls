"use client";
import {useRef} from 'react';
// Retain the command identity across transport retries. New version/input = new command.
export function useViperCommand() {
 const last=useRef<{key:string;id:string}|null>(null);
 return async (url:string, version:number, payload:Record<string,unknown>={}) => {
   const key=JSON.stringify([url,version,payload]);
   if(last.current?.key!==key) last.current={key,id:crypto.randomUUID()};
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({commandId:last.current.id,expectedVersion:version,payload})});
   const body=await response.json();
   if(!response.ok) throw new Error(body.error ?? 'Handlingen ble avvist. Oppdater siden.');
   return body;
 };
}
