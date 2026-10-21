const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/libsignal/src/session_cipher.js');

try {
  if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf8');
    const targetBlock = `        console.error("Failed to decrypt message with any known session...");
        for (const e of errs) {
            console.error("Session error:" + e, e.stack);
        }`;
    
    if (content.includes(targetBlock)) {
      content = content.replace(targetBlock, '        // Silently hand over to SessionError for Baileys auto-retry handshake');
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log('✅ [PATCH] libsignal/session_cipher.js successfully patched (console.error removed).');
    } else {
      console.log('ℹ️ [PATCH] libsignal/session_cipher.js already clean.');
    }
  }
} catch (err) {
  console.warn('⚠️ [PATCH] Could not patch libsignal:', err.message);
}
