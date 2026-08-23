const snapshots=import.meta.glob('../../../../demos/*/docker/*.out.txt',{query:'?raw',eager:true})
export function dockerEvidence(product:string,kind:'inventory'|'session'|'assert'){const v=snapshots[`../../../../demos/${product}/docker/${kind}.out.txt`]as string|{default?:string}|undefined;return typeof v==='string'?v:v?.default||''}
