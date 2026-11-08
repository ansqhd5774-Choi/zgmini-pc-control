// Synthetic Git Data API used only by B reporter unit tests.
import assert from 'node:assert/strict';
const digest=i=>i.toString(16).padStart(40,'0');

export function createGitPairFixture({rejectRefUpdate=false,throwAfterUpdate=false,
 malformedPatchResponse=false,
 existingPaths=[]}={}){
 const base=digest(10),baseTree=digest(20),files=new Map(),blobs=new Map();
 for(const p of existingPaths)files.set(p,Buffer.from('old result'));
 let count=100,commits=0,updates=0,comments=0,readbacks=0,treeEntries=[],
 current=base;
 const response=(status,obj)=>({status,async json(){return obj;}});
 async function fetchApi(url,opts){
  const pathname=new URL(url).pathname,method=opts.method;
  if(pathname.endsWith('/comments')&&method==='POST'){
   comments++;return response(201,{});
  }
  if(method==='GET'&&pathname.endsWith('/git/ref/heads/main'))
   return response(200,{object:{sha:current}});
  if(method==='GET'&&pathname.endsWith('/git/commits/'+base))
   return response(200,{tree:{sha:baseTree}});
  if(method==='POST'&&pathname.endsWith('/git/blobs')){
   const body=JSON.parse(opts.body),sha=digest(++count);
   assert.equal(body.encoding,'base64');
   blobs.set(sha,Buffer.from(body.content,'base64'));
   return response(201,{sha});
  }
  if(method==='POST'&&pathname.endsWith('/git/trees')){
   const body=JSON.parse(opts.body);
   assert.equal(body.base_tree,baseTree);
   treeEntries=body.tree;
   return response(201,{sha:digest(30)});
  }
  if(method==='POST'&&pathname.endsWith('/git/commits')){
   const body=JSON.parse(opts.body);commits++;
   assert.deepEqual(body.parents,[base]);
   assert.equal(body.tree,digest(30));
   return response(201,{sha:digest(40)});
  }
  if(method==='PATCH'&&pathname.endsWith('/git/refs/heads/main')){
   const body=JSON.parse(opts.body);updates++;
   assert.deepEqual(body,{sha:digest(40),force:false});
   if(rejectRefUpdate)return response(422,{message:'not a fast forward'});
   treeEntries.forEach(entry=>files.set(entry.path,blobs.get(entry.sha)));
   current=body.sha;
   if(throwAfterUpdate)throw Error('Simulated lost HTTP response after commit');
   if(malformedPatchResponse)return response(200,{object:{sha:'invalid'}});
   return response(200,{object:{sha:body.sha}});
  }
  if(method==='GET'&&pathname.includes('/compare/'))
   return response(200,{status:current===digest(40)?'identical':'diverged'});
  if(method==='GET'&&pathname.includes('/contents/')){
   readbacks++;
   const file=pathname.split('/contents/')[1],value=files.get(file);
   return response(value?200:404,
    {encoding:'base64',content:value?.toString('base64')});
  }
  throw Error(`Unexpected ${method} ${pathname}`);
 }
 return{fetchApi,files,get counts(){return{commits,updates,comments,readbacks};}};
}
