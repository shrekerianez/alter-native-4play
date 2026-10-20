/* QR validation for both Android BarcodeDetector and Safari jsQR routes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={
 window:{},
 location:{search:'',origin:'https://shrekerianez.github.io',pathname:'/alter-native-4play/'},
 URL,URLSearchParams,console,addEventListener:()=>{}
};
vm.runInNewContext(fs.readFileSync('logic-qr-scan.js','utf8'),ctx);
const decode=ctx.window.FOURPLAY_QR_SCANNER.decodeCode;
assert.equal(decode('7KQ2A'),'7KQ2A');
assert.equal(decode('7kq2a'),'7KQ2A');
assert.equal(decode('https://shrekerianez.github.io/alter-native-4play/?logic-room=7KQ2A'),'7KQ2A');
assert.equal(decode('https://shrekerianez.github.io/alter-native-4play/?logic-room=7kq2a'),'7KQ2A');
assert.equal(decode('https://evil.example/alter-native-4play/?logic-room=7KQ2A'),'');
assert.equal(decode('https://shrekerianez.github.io/another/?logic-room=7KQ2A'),'');
assert.equal(decode('https://shrekerianez.github.io/alter-native-4play/?logic-room=AAAAI'),'');
assert.equal(decode('https://shrekerianez.github.io/alter-native-4play/?tv=7KQ2A'),'');
assert.equal(decode('no QR here'),'');
console.log('PASS: QR accepts only valid 4PLAY Logic room codes on the current site');
