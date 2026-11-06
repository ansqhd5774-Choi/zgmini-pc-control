// Pure parser for bounded, NUL-delimited Git --name-status --no-renames -z.
// Never opens user files and never returns Git diff content.
export function parseNameStatusZ(raw){
 const text=Buffer.isBuffer(raw)?raw.toString('utf8'):String(raw);
 if(text!==''&&!text.endsWith('\0'))throw Error('CAL_A_DIRTY_LIST_FORMAT_STOP');
 const tokens=text.split('\0');
 if(tokens.at(-1)==='')tokens.pop();
 if(tokens.length%2!==0||tokens.length>100)throw Error('CAL_A_DIRTY_LIST_FORMAT_STOP');
 const results=[];
 for(let i=0;i<tokens.length;i+=2){
  const status=tokens[i],file=tokens[i+1];
  if(!/^[AMDTU]$/.test(status)||
   !/^(?:worker|lib|scripts\/pc-writer)\/[A-Za-z0-9_.\/-]{1,180}$/.test(file)||
   file.includes('..')||file.includes('\\')||results.some(x=>x.path===file))
   throw Error('CAL_A_DIRTY_LIST_SCOPE_STOP');
  results.push({status,path:file});
 }
 return results;
}
