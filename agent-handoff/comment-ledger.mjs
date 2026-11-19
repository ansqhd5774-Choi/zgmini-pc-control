// Per-issue complete comment history. Do not confuse a full page with a complete ledger.
export async function readIssueCommentLedger(readPage){
  if(typeof readPage!=='function')throw Error('HANDOFF_COMMENT_PAGE_IO');
  const comments=[],seen=new Set();
  for(let page=1;;page++){
    const rows=await readPage(page);
    if(!Array.isArray(rows)||rows.length>100)throw Error('HANDOFF_COMMENT_PAGE_INVALID');
    for(const item of rows){
      // GitHub supplies IDs. Some legacy test fixtures use comments without
      // IDs; their business-level provenance checks still apply.
      if(item?.id !== undefined){
        if(!Number.isSafeInteger(item.id)||item.id<1||seen.has(item.id))
          throw Error('HANDOFF_COMMENT_PAGE_IDENTITY');
        seen.add(item.id);
      }
      comments.push(item);
    }
    if(rows.length<100)return comments;
  }
}
