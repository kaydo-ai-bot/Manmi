import fs from 'fs';
import path from 'path';

const TGS_TEMP_DIR = process.env.TGS_TEMP_DIR || '/tmp/kaydo-tgs';

if (!fs.existsSync(TGS_TEMP_DIR)) {
  fs.mkdirSync(TGS_TEMP_DIR, { recursive: true });
}

export function cleanupTgsFile(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

export function cleanOldTgsTempFiles(): void {
  try {
    if (!fs.existsSync(TGS_TEMP_DIR)) return;
    const files = fs.readdirSync(TGS_TEMP_DIR);
    const now = Date.now();
    for (const file of files) {
      const fullPath = path.join(TGS_TEMP_DIR, file);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > 3600000) {
          fs.unlinkSync(fullPath);
        }
      } catch {}
    }
  } catch {}
}
