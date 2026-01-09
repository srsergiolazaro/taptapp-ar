import { Jimp } from 'jimp';
import fs from 'fs';
import { OfflineCompiler } from '../dist/compiler/offline-compiler.js';

async function run() {
    console.log('Reading target image...');
    const img = await Jimp.read('tests/assets/test-image.png');

    console.log('Initializing OfflineCompiler...');
    const compiler = new OfflineCompiler();

    const targets = [{
        data: img.bitmap.data,
        width: img.bitmap.width,
        height: img.bitmap.height
    }];

    console.log('Starting compilation...');
    await compiler.compileImageTargets(targets, (p) => {
        if (Math.round(p) % 10 === 0) console.log(`Progress: ${Math.round(p)}%`);
    });

    console.log('Exporting .taar data...');
    const buffer = compiler.exportData();
    fs.writeFileSync('tests/assets/targets.taar', Buffer.from(buffer));

    console.log('DONE! targets.taar recompiled with improved parameters.');
}

run().catch(console.error);
