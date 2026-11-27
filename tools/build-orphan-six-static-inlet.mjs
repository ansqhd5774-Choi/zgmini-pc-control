// Build-only static projection of fixed orphan-six source modules. No operational effects.
import fs from 'node:fs';
const specs=[
 [
  "flat",
  "supervisor-orphan-six-b-flat-request.mjs",
  []
 ],
 [
  "admission",
  "supervisor-orphan-six-b-admission.mjs",
  [
   [
    "node:crypto",
    "createHash",
    "crypto"
   ]
  ]
 ],
 [
  "receiver",
  "supervisor-orphan-six-b-receiver-source.mjs",
  [
   [
    "node:crypto",
    "createHash",
    "crypto"
   ],
   [
    "./supervisor-orphan-six-b-flat-request.mjs",
    "parseOrphanSixBFlatRequest",
    "flat"
   ],
   [
    "./supervisor-orphan-six-b-admission.mjs",
    "ORPHAN_SIX_B_TITLE,ORPHAN_SIX_B_OPERATION,ORPHAN_SIX_B_SCOPE,validateOrphanSixBRequest,validateOrphanSixBManifest",
    "admission"
   ]
  ]
 ],
 [
  "inlet",
  "supervisor-orphan-six-b-maintainer-inlet-source.mjs",
  [
   [
    "./supervisor-orphan-six-b-admission.mjs",
    "ORPHAN_SIX_B_TITLE,validateOrphanSixBRequest",
    "admission"
   ],
   [
    "./supervisor-orphan-six-b-receiver-source.mjs",
    "receiveOrphanSixBApprovalSource",
    "receiver"
   ],
   [
    "./supervisor-orphan-six-b-flat-request.mjs",
    "parseOrphanSixBFlatRequest",
    "flat"
   ]
  ]
 ],
 [
  "graceful",
  "supervisor-orphan-six-graceful-source.mjs",
  [
   [
    "node:crypto",
    "createHash",
    "crypto"
   ]
  ]
 ],
 [
  "journal",
  "supervisor-orphan-six-maintenance-journal.mjs",
  [
   [
    "node:crypto",
    "createHash,randomUUID",
    "crypto"
   ]
  ]
 ],
 [
  "coordinator",
  "supervisor-orphan-six-graceful-b-coordinator.mjs",
  [
   [
    "./supervisor-orphan-six-graceful-source.mjs",
    "assessOrphanGracefulSixPreflight,initialOrphanGracefulSixSourceJournal,advanceOrphanGracefulSixSourceJournal",
    "graceful"
   ]
  ]
 ]
];
const start="// BEGIN GENERATED ORPHAN SIX SOURCE INLET — STATIC BUILD ONLY",end="// END GENERATED ORPHAN SIX SOURCE INLET";
export function render(read=(name)=>fs.readFileSync(new URL('./'+name,import.meta.url),'utf8')){
 const parts=[start];
 for(const [alias,file,allowed] of specs){
  const original=read(file);let source=original;
  if(typeof source!=="string"||source.includes("\r"))throw Error("ORPHAN_BUNDLE_SOURCE_FORMAT");
  // The journal inherits only the existing installed agent's fs/path bindings.
  // These two exact native defaults are the sole whitelisted default imports.
  if(alias==='journal'){
   for(const native of ['fs','path']){
    const re=native==='fs'
      ? /^import fs from 'node:fs';[ \t]*$/gm
      : /^import path from 'node:path';[ \t]*$/gm;
    const matches=source.match(re)||[];
    if(matches.length!==1)throw Error('ORPHAN_BUNDLE_DEFAULT_IMPORT_SCOPE');
    source=source.replace(re,'');
   }
  }
  const found=[];
  source=source.replace(/^import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];[ \t]*$/gm,(_,names,from)=>{
   const keys=names.split(",").map(x=>x.trim()).join(",");
   const rule=allowed.find(([p,k])=>p===from&&k===keys);
   if(!rule||found.includes(from))throw Error("ORPHAN_BUNDLE_IMPORT_SCOPE");
   found.push(from);return "const {"+keys+"}="+(rule[2]==="crypto"?"crypto":"orphanSixStatic_"+rule[2])+";";
  });
  if(found.length!==allowed.length||/^\s*import\b/m.test(source))throw Error("ORPHAN_BUNDLE_IMPORT_CLOSURE");
  const exports=[...original.matchAll(/^export\s+(?:(?:async\s+)?function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  source=source.replace(/^export\s+(?=(?:async\s+)?function\s+|const\s+)/gm,"").replace(/^export\s*\{([\w,\s]+)\};[ \t]*$/gm,(_,names)=>{exports.push(...names.split(",").map(x=>x.trim()));return "";});
  if(/^\s*export\b/m.test(source)||!exports.length||new Set(exports).size!==exports.length)throw Error("ORPHAN_BUNDLE_EXPORT_SCOPE");
  parts.push("const orphanSixStatic_"+alias+"=(()=>{\n"+source.trimEnd()+"\nreturn Object.freeze({"+exports.join(",")+"});\n})();");
 }
 parts.push("export const inspectOrphanSixPackagedInletSource=orphanSixStatic_inlet.inspectOrphanSixBMaintainerInletSource;","export const parseOrphanSixPackagedRequest=orphanSixStatic_inlet.parseOrphanSixBFlatRequest;",
  "export const runOrphanSixPackagedCoordinatorSource=orphanSixStatic_coordinator.runOrphanSixGracefulB;",
  "export const createOrphanSixPackagedJournalSource=orphanSixStatic_journal.createOrphanSixMaintenanceJournal;",end);
 return parts.join("\n")+"\n";
}
