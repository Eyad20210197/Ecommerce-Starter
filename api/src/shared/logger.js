export const logger={
  info(message,fields={}){process.stdout.write(JSON.stringify({level:'info',time:new Date().toISOString(),message,...fields})+'\n');},
  error(message,fields={}){process.stderr.write(JSON.stringify({level:'error',time:new Date().toISOString(),message,...fields})+'\n');},
};
export function safeError(error){
  // Do not log SQL, bindings, request bodies, cookies, URLs or provider credentials.
  const frames=typeof error.stack==='string'?error.stack.split('\n').slice(1,9).join('\n'):'';
  return {name:error.name,code:error.original?.code || error.code,stack:frames};
}
