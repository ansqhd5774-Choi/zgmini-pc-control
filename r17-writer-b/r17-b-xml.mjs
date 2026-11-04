// Task XML comparison: ONLY Settings.Enabled may vary while Core is paused.
// Do not mask Enabled nodes inside Triggers, Actions or other sections.
export function sameTaskDefinitionExceptSettingsEnabled(xml){
  if(typeof xml!=='string')throw new Error('R17_B_XML_TYPE_STOP');
  const sections=[...xml.matchAll(/<Settings(?:\s[^>]*)?>[\s\S]*?<\/Settings>/g)];
  if(sections.length!==1)throw new Error('R17_B_XML_SETTINGS_STOP');
  const setting=sections[0];
  const enabled=[...setting[0].matchAll(/<Enabled>\s*(?:true|false)\s*<\/Enabled>/g)];
  if(enabled.length!==1)throw new Error('R17_B_XML_SETTINGS_ENABLED_STOP');
  const normalized=setting[0].replace(/(<Enabled>)\s*(?:true|false)\s*(<\/Enabled>)/,'$1__R17_TASK_ENABLED__$2');
  return xml.slice(0,setting.index)+normalized+xml.slice(setting.index+setting[0].length);
}
