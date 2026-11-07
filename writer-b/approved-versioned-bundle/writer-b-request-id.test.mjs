import test from 'node:test';
import assert from 'node:assert/strict';
import {isWriterBRequestId} from './writer-b-request-id.mjs';

test('Writer-B UUID format matches existing Issue envelope v1-8 and RFC variant',()=>{
 assert.equal(isWriterBRequestId('a08a54e5-8f26-4875-a6c4-39c23b008111'),true);
 assert.equal(isWriterBRequestId('A08A54E5-8F26-4875-A6C4-39C23B008111'),true);
 assert.equal(isWriterBRequestId('a08a54e5-8f26-8875-b6c4-39c23b008111'),true);
 assert.equal(isWriterBRequestId('issue-765-request-1'),false);
 assert.equal(isWriterBRequestId('a08a54e5-8f26-9875-a6c4-39c23b008111'),false);
 assert.equal(isWriterBRequestId('a08a54e5-8f26-4875-76c4-39c23b008111'),false);
 assert.equal(isWriterBRequestId(null),false);
});
