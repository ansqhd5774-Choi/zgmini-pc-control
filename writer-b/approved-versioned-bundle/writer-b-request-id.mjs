// Matches the existing Writer-B Issue envelope contract's requestId UUID.
// The outer receiver must independently validate the Issue chatId UUID.
export const WRITER_B_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isWriterBRequestId=value=>
 typeof value==='string'&&WRITER_B_UUID.test(value);
