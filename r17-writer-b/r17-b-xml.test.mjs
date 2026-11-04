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
test('changing trigger enabled is NEVER masked',()=>{
  assert.notEqual(normalize(task('true','true')),normalize(task('false','false')));
});
test('changing Core action is NEVER masked',()=>{
  assert.notEqual(normalize(task('true','true','node.exe')),
    normalize(task('false','true','cmd.exe')));
});
test('ambiguous Settings.Enabled or multiple Settings blocks are rejected',()=>{
  assert.throws(()=>normalize('<Task><Settings></Settings></Task>'));
  assert.throws(()=>normalize(task('true')+'<Settings><Enabled>false</Enabled></Settings>'));
  assert.throws(()=>normalize('<Task><Settings><Enabled>true</Enabled><Enabled>false</Enabled></Settings></Task>'));
});
