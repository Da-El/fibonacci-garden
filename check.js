const fs=require('fs');
const m=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/);
try{new Function(m[1]);console.log('PARSE OK ('+m[1].split('\n').length+' lines)');}
catch(e){console.log('PARSE ERROR: '+e.message);process.exit(1);}
