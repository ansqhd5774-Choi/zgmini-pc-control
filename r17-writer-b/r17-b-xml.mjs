// Task XML comparison: ONLY Settings.Enabled may vary while Core is paused.
// Windows Task Scheduler may omit Settings.Enabled when using its true default;
// disabling a task may materialize an explicit false tag. Other Settings values,
// Triggers and Actions must remain unchanged.
function stop(code){const error=new Error(code);error.code=code;throw error;}
export function sameTaskDefinitionExceptSettingsEnabled(xml){
  if(typeof xml!=='string')stop('R17_B_XML_TYPE_STOP');
  const sections=[...xml.matchAll(/<Settings(?:\s[^>]*)?>[\s\S]*?<\/Settings>/g)];
  if(sections.length!==1)stop('R17_B_XML_SETTINGS_STOP');
  const setting=sections[0];
  const enabled=[...setting[0].matchAll(/<Enabled>\s*(?:true|false)\s*<\/Enabled>/g)];
  // An absent tag is the normal Windows default, not a definition drift.
  // Duplicate or malformed Enabled tags remain a hard STOP.
  const allEnabled=[...setting[0].matchAll(/<Enabled\b/g)];
  if(enabled.length>1||allEnabled.length!==enabled.length)
    stop('R17_B_XML_SETTINGS_ENABLED_STOP');
  const normalized=setting[0]
    .replace(/<Enabled>\s*(?:true|false)\s*<\/Enabled>/g,'')
    .replace(/>\s+</g,'><'); // Ignore indentation only within Settings.
  return xml.slice(0,setting.index)+normalized+xml.slice(setting.index+setting[0].length);
}
