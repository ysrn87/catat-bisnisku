/**
 * Generate placeholder PWA icons
 * This script creates basic placeholder icons for PWA testing
 * Replace these with your actual branded icons later
 * 
 * Usage: node scripts/generate-placeholder-icons.js
 * 
 * Note: This requires 'sharp' package. Install with:
 * npm install sharp --save-dev
 */

const fs = require('fs');
const path = require('path');

// Simple canvas-based fallback if sharp is not available
function generateSimpleSVGIcon(size, letter = '#') {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#106f7b"/>
  <text x="50%" y="50%" font-size="${size * 0.6}" fill="#ffffff" 
        font-family="Arial, sans-serif" font-weight="bold"
        text-anchor="middle" dominant-baseline="central">${letter}</text>
</svg>`;
}

// Create SVG placeholders
function generateSVGPlaceholders() {
  const sizes = [192, 384, 512];
  const publicDir = path.join(process.cwd(), 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  sizes.forEach(size => {
    const svgContent = generateSimpleSVGIcon(size);
    const filename = `icon-${size}x${size}.svg`;
    const filepath = path.join(publicDir, filename);
    
    fs.writeFileSync(filepath, svgContent);
    console.log(`✓ Created ${filename}`);
  });

  // Create favicon
  const faviconSVG = generateSimpleSVGIcon(32);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSVG);
  console.log('✓ Created favicon.svg');

  console.log('\n📌 Note: These are SVG placeholders.');
  console.log('For production, convert to PNG or create proper branded icons.');
  console.log('See ICON_GENERATION_GUIDE.md for more information.\n');
}

// Try to use sharp for PNG generation
async function generatePNGWithSharp() {
  try {
    const sharp = require('sharp');
    const sizes = [192, 384, 512];
    const publicDir = path.join(process.cwd(), 'public');

    console.log('Generating PNG icons with sharp...\n');

    for (const size of sizes) {
      // Create a solid color canvas with text
      const svgBuffer = Buffer.from(generateSimpleSVGIcon(size));
      
      await sharp(svgBuffer)
        .png()
        .toFile(path.join(publicDir, `icon-${size}x${size}.png`));
      
      console.log(`✓ Created icon-${size}x${size}.png`);
    }

    // Create favicon.ico (32x32)
    const faviconSVG = Buffer.from(generateSimpleSVGIcon(32));
    await sharp(faviconSVG)
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.ico'));
    
    console.log('✓ Created favicon.ico');
    console.log('\n✅ PNG icons generated successfully!');
    console.log('Replace these with your branded icons for production.\n');

    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('🎨 Generating placeholder PWA icons...\n');

  const sharpAvailable = await generatePNGWithSharp();
  
  if (!sharpAvailable) {
    console.log('⚠️  Sharp not installed. Generating SVG placeholders instead.\n');
    console.log('To generate PNG icons, install sharp:');
    console.log('  npm install sharp --save-dev\n');
    console.log('Then run this script again.\n');
    generateSVGPlaceholders();
  }
}

main().catch(console.error);
