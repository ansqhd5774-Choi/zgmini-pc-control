import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,selectGroups,ungroupedChangedTests} from '../tools/c996-source-checks.mjs';

test('C996 executes this newly introduced test even before it joins a fixed group',()=>{
 const own='tests/c996-ungrouped-autodiscovery.test.mjs';
 assert.equal(Object.values(GROUPS).flat().includes(own),false);
 assert.deepEqual(selectGroups([own]),[]);
 assert.deepEqual(ungroupedChangedTests([own],p=>p===own),[own]);
});
