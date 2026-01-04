import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, 'assets');
const OUTPUT_BASE_DIR = path.join(__dirname, 'robustness-images');
const TEST_IMAGE_PATH = path.join(ASSETS_DIR, 'test-image.png');

const RESOLUTIONS = [
    { name: 'vga_h', width: 320, height: 240 },
    { name: 'vga_v', width: 240, height: 320 },
    { name: 'sd_h', width: 640, height: 480 },
    { name: 'sd_v', width: 480, height: 640 },
    { name: 'hd_h', width: 1280, height: 720 },
    { name: 'hd_v', width: 720, height: 1280 },
    { name: 'fhd_h', width: 1920, height: 1080 },
    { name: 'fhd_v', width: 1080, height: 1920 },
];

const MARGIN = 10; // Pixels to avoid touching edges

async function generate() {
    if (!fs.existsSync(OUTPUT_BASE_DIR)) {
        fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
    }

    // Clean up old resolution folders but keep 'custom'
    const entries = fs.readdirSync(OUTPUT_BASE_DIR);
    for (const entry of entries) {
        if (entry !== 'custom') {
            const p = path.join(OUTPUT_BASE_DIR, entry);
            if (fs.statSync(p).isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
            }
        }
    }

    // Ensure custom folder exists
    const customDir = path.join(OUTPUT_BASE_DIR, 'custom');
    if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir);
    }

    console.log(`🚀 Loading base image: ${TEST_IMAGE_PATH}`);
    const baseImage = await Jimp.read(TEST_IMAGE_PATH);
    const originalWidth = baseImage.bitmap.width;
    const originalHeight = baseImage.bitmap.height;

    // Metadata structure for all test cases
    const allMetadata = {};

    for (const res of RESOLUTIONS) {
        const resDir = path.join(OUTPUT_BASE_DIR, res.name);
        if (!fs.existsSync(resDir)) {
            fs.mkdirSync(resDir);
        }
        console.log(`📁 Generating images for ${res.name} (${res.width}x${res.height})...`);

        const resMetadata = {};

        /**
         * Creates a test image and records metadata
         * @param {string} name - Test case name
         * @param {string} position - 'center', 'top', 'bottom', 'left', 'right', 'corner_tl', etc.
         * @param {number} scale - Scale factor (1.0 = original)
         * @param {number} rotZ - Rotation around Z axis (degrees)
         * @param {number} rotX - Rotation around X axis (perspective tilt, degrees)
         * @param {number} rotY - Rotation around Y axis (perspective tilt, degrees)
         * @param {Jimp} sourceImg - Image to use (can be pre-transformed)
         */
        const createTestCase = async (name, position, scale, rotZ, rotX, rotY, sourceImg = baseImage) => {
            const canvas = new Jimp({ width: res.width, height: res.height, color: 0xFFFFFFFF });

            let transformedImg = sourceImg.clone();
            const maxW = res.width - MARGIN * 2;
            const maxH = res.height - MARGIN * 2;

            // Ensure it fits
            if (transformedImg.bitmap.width > maxW || transformedImg.bitmap.height > maxH) {
                transformedImg.scaleToFit({ w: maxW, h: maxH });
            }

            const imgW = transformedImg.bitmap.width;
            const imgH = transformedImg.bitmap.height;

            // Calculate position
            let finalX, finalY;
            switch (position) {
                case 'center':
                    finalX = (res.width - imgW) / 2;
                    finalY = (res.height - imgH) / 2;
                    break;
                case 'top':
                    finalX = (res.width - imgW) / 2;
                    finalY = MARGIN;
                    break;
                case 'bottom':
                    finalX = (res.width - imgW) / 2;
                    finalY = res.height - imgH - MARGIN;
                    break;
                case 'left':
                    finalX = MARGIN;
                    finalY = (res.height - imgH) / 2;
                    break;
                case 'right':
                    finalX = res.width - imgW - MARGIN;
                    finalY = (res.height - imgH) / 2;
                    break;
                case 'corner_tl':
                    finalX = MARGIN;
                    finalY = MARGIN;
                    break;
                case 'corner_tr':
                    finalX = res.width - imgW - MARGIN;
                    finalY = MARGIN;
                    break;
                case 'corner_bl':
                    finalX = MARGIN;
                    finalY = res.height - imgH - MARGIN;
                    break;
                case 'corner_br':
                    finalX = res.width - imgW - MARGIN;
                    finalY = res.height - imgH - MARGIN;
                    break;
                default:
                    finalX = (res.width - imgW) / 2;
                    finalY = (res.height - imgH) / 2;
            }

            canvas.composite(transformedImg, Math.round(finalX), Math.round(finalY));
            await canvas.write(path.join(resDir, `${name}.png`));

            // Calculate actual scale relative to original
            const actualScale = imgW / originalWidth;

            // Expected center position in screen coordinates
            const expectedCenterX = Math.round(finalX + imgW / 2);
            const expectedCenterY = Math.round(finalY + imgH / 2);

            // Store metadata
            resMetadata[`${name}.png`] = {
                position: position,
                expectedCenter: {
                    x: expectedCenterX,
                    y: expectedCenterY,
                },
                expectedScale: actualScale,
                expectedRotation: {
                    z: rotZ, // degrees
                    x: rotX, // degrees (perspective tilt forward/back)
                    y: rotY, // degrees (perspective tilt left/right)
                },
                imageSize: {
                    width: imgW,
                    height: imgH,
                },
                bounds: {
                    left: Math.round(finalX),
                    top: Math.round(finalY),
                    right: Math.round(finalX + imgW),
                    bottom: Math.round(finalY + imgH),
                },
            };
        };

        // 1. POSITIONS (Normal Scale, 0 rotation)
        await createTestCase('center', 'center', 1.0, 0, 0, 0);
        await createTestCase('top', 'top', 1.0, 0, 0, 0);
        await createTestCase('bottom', 'bottom', 1.0, 0, 0, 0);
        await createTestCase('left', 'left', 1.0, 0, 0, 0);
        await createTestCase('right', 'right', 1.0, 0, 0, 0);
        await createTestCase('corner_tl', 'corner_tl', 1.0, 0, 0, 0);
        await createTestCase('corner_tr', 'corner_tr', 1.0, 0, 0, 0);
        await createTestCase('corner_bl', 'corner_bl', 1.0, 0, 0, 0);
        await createTestCase('corner_br', 'corner_br', 1.0, 0, 0, 0);

        // 2. ROTATIONS Z (Centered, Normal Scale)
        const rotationsZ = [15, -15, 30, -30, 45, -45];
        for (const deg of rotationsZ) {
            const rotated = baseImage.clone().rotate(deg);
            await createTestCase(`rot_z_${deg}`, 'center', 1.0, deg, 0, 0, rotated);
        }

        // 3. ROTATIONS X (Tilt forward/back) - Simulated by vertical squeeze
        const rotationsX = [15, -15, 30, -30];
        for (const deg of rotationsX) {
            const rad = deg * Math.PI / 180;
            const scaleY = Math.abs(Math.cos(rad));
            const tilted = baseImage.clone().resize({
                w: baseImage.bitmap.width,
                h: Math.round(baseImage.bitmap.height * scaleY)
            });
            await createTestCase(`rot_x_${deg}`, 'center', 1.0, 0, deg, 0, tilted);
        }

        // 4. ROTATIONS Y (Tilt left/right) - Simulated by horizontal squeeze
        const rotationsY = [15, -15, 30, -30];
        for (const deg of rotationsY) {
            const rad = deg * Math.PI / 180;
            const scaleX = Math.abs(Math.cos(rad));
            const tilted = baseImage.clone().resize({
                w: Math.round(baseImage.bitmap.width * scaleX),
                h: baseImage.bitmap.height
            });
            await createTestCase(`rot_y_${deg}`, 'center', 1.0, 0, 0, deg, tilted);
        }

        // 5. SCALES (Centered, 0 rotation)
        const scales = [0.5, 0.75, 1.25, 1.5];
        for (const s of scales) {
            const scaled = baseImage.clone().scale(s);
            await createTestCase(`scale_${Math.round(s * 100)}`, 'center', s, 0, 0, 0, scaled);
        }

        allMetadata[res.name] = {
            resolution: { width: res.width, height: res.height },
            originalImage: { width: originalWidth, height: originalHeight },
            testCases: resMetadata,
        };
    }

    // Write metadata JSON
    const metadataPath = path.join(OUTPUT_BASE_DIR, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
    console.log(`📄 Metadata saved to ${metadataPath}`);

    console.log('✅ All images generated successfully!');
}

generate().catch(err => {
    console.error('❌ Error generating images:', err);
    process.exit(1);
});
