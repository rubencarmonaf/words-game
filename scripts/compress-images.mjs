// Comprime y redimensiona las imágenes de client-angular/public/assets.
// Uso: npm run compress:images
import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'client-angular', 'public', 'assets');

// Los logos se muestran como mucho a ~60px de alto; 240px cubre pantallas retina de sobra.
const MAX_HEIGHT = 240;

async function compressPng(filePath) {
    const before = (await stat(filePath)).size;
    const image = sharp(filePath);
    const meta = await image.metadata();

    const pipeline = meta.height && meta.height > MAX_HEIGHT
        ? image.resize({ height: MAX_HEIGHT })
        : image;

    const buffer = await pipeline
        .png({ compressionLevel: 9, palette: true, effort: 10 })
        .toBuffer();

    if (buffer.length < before) {
        await sharp(buffer).toFile(filePath);
        const after = (await stat(filePath)).size;
        const saved = (100 - (after / before) * 100).toFixed(1);
        console.log(`✔ ${path.basename(filePath)}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${saved}%)`);
    } else {
        console.log(`- ${path.basename(filePath)}: ya está optimizada`);
    }
}

async function main() {
    const files = await readdir(ASSETS_DIR);
    const pngs = files.filter(f => f.toLowerCase().endsWith('.png'));

    for (const file of pngs) {
        await compressPng(path.join(ASSETS_DIR, file));
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
