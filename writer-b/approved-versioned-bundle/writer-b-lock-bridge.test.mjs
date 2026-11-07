import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeApprovedRegistryPinBFromWriterReceiver}
 from './writer-b-lock-bridge.mjs';

// Importing a source-only shim cannot activate a B operation.
test('common Writer B bridge denies direct caller without installed owner authority',()=>{
 assert.throws(()=>makeApprovedRegistryPinBFromWriterReceiver(),
  {code:'B_PIN_WINDOWS_RECEIVER_AUTH_REQUIRED'});
});

test('common Writer B bridge still denies any non-Windows host',()=>{
 assert.throws(()=>makeApprovedRegistryPinBFromWriterReceiver({
  authenticatedReceiver:{approvalScope:'HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY',
   installedReceiverVerified:true,pathsFromInstalledHost:true},
 }),{code:'B_PIN_WINDOWS_PLATFORM_REQUIRED'});
});
