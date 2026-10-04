import fs from 'fs';
import path from 'path';

const TEMP_DIR = process.env.DOWNLOAD_TEMP_DIR || '/tmp/kaydo-downloads';

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export function cleanupFile(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[DOWNLOADER] Nettoyage fichier réussi : ${path.basename(filePath)}`);
    }
  } catch (err: any) {
    console.warn(`[DOWNLOADER] Échec nettoyage fichier ${filePath}:`, err?.message || err);
  }
}

export function cleanupDirectory(dirPath: string): void {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[DOWNLOADER] Nettoyage dossier réussi : ${path.basename(dirPath)}`);
    }
  } catch (err: any) {
    console.warn(`[DOWNLOADER] Échec nettoyage dossier ${dirPath}:`, err?.message || err);
  }
}

export function cleanOldTempFiles(): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    const entries = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(TEMP_DIR, entry);
      try {
        const stats = fs.statSync(fullPath);
        // Clean temporary files or folders older than 30 minutes
        if (now - stats.mtimeMs > 1800000) {
          if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      } catch {}
    }
  } catch {}
}
