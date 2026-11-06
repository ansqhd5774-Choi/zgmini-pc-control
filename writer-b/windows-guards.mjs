// Windows Task evidence interpreters; no Task Scheduler calls or filesystem I/O.
// The live adapter obtains the bytes/probe and uses these exact pure guards.

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};

export function decodeTaskXmlBytes(raw){
 need(Buffer.isBuffer(raw)&&raw.length>=5,'WRITER_B_TASK_XML_BYTES_STOP');
 let xml;
 if(raw[0]===255&&raw[1]===254){
  need((raw.length-2)%2===0,'WRITER_B_TASK_XML_ENCODING_STOP');
  xml=raw.subarray(2).toString('utf16le');
 }else if(raw[0]===60&&raw[1]===0){
  need(raw.length%2===0,'WRITER_B_TASK_XML_ENCODING_STOP');
  xml=raw.toString('utf16le');
 }else if(raw[0]===254&&raw[1]===255){
  stop('WRITER_B_TASK_XML_ENCODING_STOP');
 }else{
  xml=raw.toString('utf8').replace(/^\ufeff/,'');
  need(Buffer.from(xml,'utf8').equals(raw[0]===239&&raw[1]===187&&raw[2]===191?
   raw.subarray(3):raw),'WRITER_B_TASK_XML_ENCODING_STOP');
 }
 need(/^\s*<\?xml|^\s*<Task\b/.test(xml),'WRITER_B_TASK_XML_STOP');
 return xml;
}

export function coreQuietFromProbe(probe,coreCycleLockExists){
 return probe?.enabled===false&&probe.state!==4&&
  probe.instances===0&&probe.relatedProcesses===0&&
  probe.unknownProcessLines===0&&coreCycleLockExists===false;
}
