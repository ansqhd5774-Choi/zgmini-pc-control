import test from 'node:test';
import assert from 'node:assert/strict';
import {sameTaskDefinitionExceptSettingsEnabled as normalize} from './r17-b-xml.mjs';

const task=(taskEnabled,triggerEnabled='true',command='node.exe')=>
  `<Task><Triggers><CalendarTrigger><Enabled>${triggerEnabled}</Enabled></CalendarTrigger></Triggers>`+
  `<Actions><Exec><Command>${command}</Command></Exec></Actions>`+
  `<Settings><Enabled>${taskEnabled}</Enabled><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy></Settings></Task>`;

test('only Settings.Enabled may change during temporary Core disable/restore',()=>{
  assert.equal(normalize(task('true')),normalize(task('false')));
});
test('Windows default-true omitted Settings.Enabled compares to explicit false only',()=>{
  const omitted=task('true').replace('<Settings><Enabled>true</Enabled>', '<Settings>');
  const toggled=task('false').replace('<Settings><Enabled>false</Enabled>',
    '<Settings>\r\n    <Enabled>false</Enabled>\r\n    ');
  assert.equal(normalize(omitted),normalize(toggled));
  assert.equal(normalize(omitted),normalize(task('true')));
  assert.notEqual(normalize(omitted),normalize(toggled.replace('IgnoreNew','Parallel')));
});
test('changing trigger enabled is NEVER masked',()=>{
  assert.notEqual(normalize(task('true','true')),normalize(task('false','false')));
});
test('changing Core action is NEVER masked',()=>{
  assert.notEqual(normalize(task('true','true','node.exe')),
    normalize(task('false','true','cmd.exe')));
});
test('ambiguous Settings.Enabled or multiple Settings blocks are rejected',()=>{
  assert.equal(normalize('<Task><Settings></Settings></Task>'),'<Task><Settings></Settings></Task>');
  assert.throws(()=>normalize(task('true')+'<Settings><Enabled>false</Enabled></Settings>'),
    {code:'R17_B_XML_SETTINGS_STOP'});
  assert.throws(()=>normalize('<Task><Settings><Enabled>true</Enabled><Enabled>false</Enabled></Settings></Task>'),
    {code:'R17_B_XML_SETTINGS_ENABLED_STOP'});
  assert.throws(()=>normalize('<Task><Settings><Enabled>garbage</Enabled></Settings></Task>'),
    {code:'R17_B_XML_SETTINGS_ENABLED_STOP'});
});
