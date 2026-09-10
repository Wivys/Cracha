// Generator for authentic 8-bit pixel art avatars (VLi Railway Worker - Homem & Mulher)
import fs from 'fs';
import path from 'path';

function createPixelCanvas(width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill(null));

  function set(x, y, color) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = color;
    }
  }

  function rect(x1, y1, w, h, color) {
    for (let y = y1; y < y1 + h; y++) {
      for (let x = x1; x < x1 + w; x++) {
        set(x, y, color);
      }
    }
  }

  function hline(x1, x2, y, color) {
    for (let x = x1; x <= x2; x++) set(x, y, color);
  }

  function vline(x, y1, y2, color) {
    for (let y = y1; y <= y2; y++) set(x, y, color);
  }

  function circle(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) {
          set(x, y, color);
        }
      }
    }
  }

  function toSvg() {
    // Group adjacent pixels horizontally to minimize SVG size while preserving crisp 8-bit look
    const colorRuns = new Map();

    for (let y = 0; y < height; y++) {
      let runColor = null;
      let runStartX = 0;
      let runLen = 0;

      for (let x = 0; x <= width; x++) {
        const color = x < width ? grid[y][x] : null;

        if (color === runColor) {
          runLen++;
        } else {
          if (runColor) {
            if (!colorRuns.has(runColor)) colorRuns.set(runColor, []);
            colorRuns.get(runColor).push({ x: runStartX, y, w: runLen, h: 1 });
          }
          runColor = color;
          runStartX = x;
          runLen = 1;
        }
      }
    }

    let rectsSvg = '';
    for (const [color, rects] of colorRuns.entries()) {
      const paths = rects.map(r => `M${r.x},${r.y}h${r.w}v1h-${r.w}z`).join(' ');
      rectsSvg += `  <path fill="${color}" d="${paths}" />\n`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" width="100%" height="100%" style="image-rendering: pixelated;">
  <!-- VLi 8-bit Pixel Art Avatar -->
${rectsSvg}</svg>`;
  }

  return { set, rect, hline, vline, circle, toSvg, grid };
}

function drawBackground(c) {
  // Palette:
  const SKY_TOP = '#4A90E2';
  const SKY_MID = '#7FB3F5';
  const SKY_LOW = '#B9D7FB';
  const CLOUD = '#FFFFFF';
  const CLOUD_SHADOW = '#D9E6F2';
  const MTN_FAR = '#6B8299';
  const MTN_NEAR = '#4F687F';
  const GRASS_DARK = '#2E7D32';
  const GRASS_MID = '#4CAF50';
  const GRASS_LIGHT = '#81C784';
  const BALLAST = '#3E4A56';
  const BALLAST_LIGHT = '#546373';
  const RAIL_STEEL = '#CFD8DC';
  const RAIL_SHADOW = '#37474F';
  const TIE_WOOD = '#2A1C16';
  const TIE_LIGHT = '#4E342E';
  
  // Sky bands (Y: 0 to 24)
  c.rect(0, 0, 64, 8, SKY_TOP);
  c.rect(0, 8, 64, 8, SKY_MID);
  c.rect(0, 16, 64, 9, SKY_LOW);

  // 8-bit Clouds
  // Cloud 1
  c.rect(8, 3, 10, 3, CLOUD);
  c.rect(10, 2, 6, 1, CLOUD);
  c.rect(7, 4, 12, 2, CLOUD);
  c.hline(8, 17, 6, CLOUD_SHADOW);

  // Cloud 2
  c.rect(44, 4, 12, 3, CLOUD);
  c.rect(47, 3, 7, 1, CLOUD);
  c.rect(43, 5, 14, 2, CLOUD);
  c.hline(44, 55, 7, CLOUD_SHADOW);

  // Mountains in distance
  c.rect(0, 15, 64, 5, MTN_FAR);
  c.rect(0, 18, 64, 5, MTN_NEAR);

  // Ground ballast
  c.rect(0, 23, 64, 41, BALLAST);
  c.rect(0, 23, 64, 2, BALLAST_LIGHT);

  // Left background: VLi Freight Train (Locomotive + Wagons)
  const LOCO_BLUE = '#002B49';
  const LOCO_BLUE_LIGHT = '#004B7A';
  const LOCO_ORANGE = '#FF7A00';
  const LOCO_YELLOW = '#FFC72C';
  const CAB_GLASS = '#B3E5FC';
  const WAGON_GREY = '#263238';
  const WAGON_RUST = '#5D4037';

  // Wagons behind locomotive
  c.rect(0, 17, 7, 8, WAGON_GREY);
  c.rect(0, 18, 6, 6, WAGON_RUST);
  c.rect(0, 25, 7, 2, '#111827'); // wheels

  // Locomotive Body
  c.rect(7, 14, 18, 11, LOCO_BLUE);
  c.rect(7, 13, 11, 2, LOCO_BLUE_LIGHT); // cab roof
  c.rect(13, 15, 5, 3, CAB_GLASS); // cab window
  c.rect(19, 16, 6, 9, LOCO_BLUE);
  c.rect(21, 16, 4, 9, LOCO_ORANGE); // orange nose band
  c.rect(24, 19, 1, 2, '#FFFFFF'); // headlight
  c.set(24, 20, LOCO_YELLOW);
  c.set(24, 19, '#FFFFFF');
  // "VLi" pixel logo on train
  c.set(9, 18, '#FFFFFF'); // V
  c.set(10, 19, '#FFFFFF');
  c.set(11, 18, '#FFFFFF');
  c.set(12, 17, '#FFFFFF'); // L
  c.set(12, 18, '#FFFFFF');
  c.set(12, 19, '#FFFFFF');
  c.set(14, 18, '#FF7A00'); // dot

  // Locomotive wheels & cowcatcher
  c.rect(8, 24, 16, 2, '#111827');
  c.rect(22, 23, 3, 2, LOCO_YELLOW); // warning stripes

  // Right background: Railway Signal Mast & Catenary
  const MAST_GREY = '#607D8B';
  const SIGNAL_GREEN = '#00E676';
  const SIGNAL_BOX = '#1E293B';
  c.vline(56, 4, 25, MAST_GREY);
  c.hline(53, 56, 8, MAST_GREY);
  c.rect(52, 7, 3, 5, SIGNAL_BOX);
  c.set(53, 8, '#2E7D32');
  c.set(53, 9, SIGNAL_GREEN); // green aspect glowing
  c.set(53, 10, '#C62828');

  // Vegetation / Bushes on the right
  c.rect(48, 20, 16, 5, GRASS_DARK);
  c.rect(50, 19, 12, 3, GRASS_MID);
  c.rect(52, 18, 8, 2, GRASS_LIGHT);
  c.set(49, 21, GRASS_LIGHT);
  c.set(58, 20, GRASS_LIGHT);

  // Diagonal tracks and wooden ties (perspective on right side)
  c.hline(46, 63, 27, TIE_WOOD);
  c.hline(44, 63, 31, TIE_WOOD);
  c.hline(42, 63, 36, TIE_WOOD);
  c.hline(46, 63, 26, TIE_LIGHT);
  c.hline(44, 63, 30, TIE_LIGHT);
  c.hline(42, 63, 35, TIE_LIGHT);

  // Steel rails
  for (let i = 0; i < 18; i++) {
    c.set(48 + i, 25 + i, RAIL_STEEL);
    c.set(48 + i, 26 + i, RAIL_SHADOW);
    c.set(54 + i, 23 + i, RAIL_STEEL);
  }
}

function drawUniform(c, isFemale) {
  // Industrial Railway Uniform
  const UNIFORM_DARK = '#263238'; // Dark charcoal grey
  const UNIFORM_MID = '#37474F';
  const UNIFORM_SHADOW = '#1C2429';
  const COLLAR = '#455A64';
  const REFLECTIVE_ORANGE = '#FF7A00';
  const REFLECTIVE_SILVER = '#ECEFF1';
  const REFLECTIVE_BRIGHT = '#FFFFFF';

  // Torso base (Y: 37 to 63)
  for (let y = 37; y < 64; y++) {
    const spread = Math.floor((y - 37) * 0.7);
    const x1 = Math.max(0, 18 - spread);
    const x2 = Math.min(63, 45 + spread);
    c.hline(x1, x2, y, UNIFORM_MID);
    // Darker sides
    c.hline(x1, x1 + 2, y, UNIFORM_SHADOW);
    c.hline(x2 - 2, x2, y, UNIFORM_SHADOW);
  }

  // Neck area skin
  const SKIN_TONE = isFemale ? '#E8B48B' : '#E0A97A';
  const SKIN_SHADOW = isFemale ? '#CF966F' : '#C48B5F';
  c.rect(28, 33, 8, 6, SKIN_TONE);
  c.rect(28, 33, 8, 2, SKIN_SHADOW); // neck shadow under chin

  // Collar V-shape
  c.set(27, 36, COLLAR);
  c.set(28, 37, COLLAR);
  c.set(29, 38, COLLAR);
  c.set(30, 39, COLLAR);
  c.set(31, 40, COLLAR);
  c.set(32, 40, COLLAR);
  c.set(33, 39, COLLAR);
  c.set(34, 38, COLLAR);
  c.set(35, 37, COLLAR);
  c.set(36, 36, COLLAR);
  // Collar fill
  c.rect(30, 37, 4, 3, UNIFORM_DARK);

  // Main High-Vis Reflective Chest Band (Y: 48 to 53)
  // Orange outer bands + Center silver retroreflective stripe
  c.rect(10, 48, 44, 1, REFLECTIVE_ORANGE);
  c.rect(8, 49, 48, 2, REFLECTIVE_SILVER);
  c.rect(8, 50, 48, 1, REFLECTIVE_BRIGHT); // bright reflection
  c.rect(8, 51, 48, 1, REFLECTIVE_ORANGE);
  c.rect(6, 52, 52, 1, REFLECTIVE_ORANGE);

  // Sleeve High-Vis bands
  c.rect(4, 56, 12, 1, REFLECTIVE_ORANGE);
  c.rect(3, 57, 13, 2, REFLECTIVE_SILVER);
  c.rect(2, 59, 14, 1, REFLECTIVE_ORANGE);

  c.rect(48, 56, 12, 1, REFLECTIVE_ORANGE);
  c.rect(48, 57, 13, 2, REFLECTIVE_SILVER);
  c.rect(48, 59, 14, 1, REFLECTIVE_ORANGE);

  // Vertical reflective suspender stripes
  c.rect(22, 41, 3, 7, REFLECTIVE_ORANGE);
  c.rect(23, 41, 1, 7, REFLECTIVE_SILVER);
  c.rect(39, 41, 3, 7, REFLECTIVE_ORANGE);
  c.rect(40, 41, 1, 7, REFLECTIVE_SILVER);

  // Brazilian Flag on Right Sleeve (Left side of viewer, X: 8 to 15, Y: 40 to 45)
  c.rect(9, 40, 8, 6, '#009B3A'); // Green base
  // Yellow diamond
  c.set(13, 41, '#FEDF00');
  c.hline(11, 14, 42, '#FEDF00');
  c.hline(10, 15, 43, '#FEDF00');
  c.hline(11, 14, 44, '#FEDF00');
  c.set(13, 45, '#FEDF00');
  // Blue circle
  c.rect(12, 42, 2, 2, '#002776');
  c.set(12, 42, '#FFFFFF'); // White star/arc curve

  // VLi Chest Logo on Left Chest (Right side of viewer, X: 44 to 53, Y: 41 to 46)
  c.rect(44, 42, 10, 5, '#002B49'); // Navy badge
  c.rect(44, 42, 10, 1, '#FF7A00');
  c.rect(44, 46, 10, 1, '#FF7A00');
  // Pixel text "VLi"
  // V
  c.set(45, 43, '#FFFFFF');
  c.set(45, 44, '#FFFFFF');
  c.set(46, 45, '#FFFFFF');
  c.set(47, 44, '#FFFFFF');
  c.set(47, 43, '#FFFFFF');
  // L
  c.set(49, 43, '#FFFFFF');
  c.set(49, 44, '#FFFFFF');
  c.set(49, 45, '#FFFFFF');
  c.set(50, 45, '#FFFFFF');
  // i with orange dot
  c.set(52, 43, '#FF7A00');
  c.set(52, 44, '#FFFFFF');
  c.set(52, 45, '#FFFFFF');

  // Walkie-Talkie (Two-way radio) on Chest Pocket (X: 18 to 22, Y: 36 to 46)
  c.vline(19, 31, 38, '#111827'); // Antenna
  c.rect(18, 38, 5, 8, '#1F2937'); // Body
  c.rect(18, 38, 5, 1, '#37474F');
  c.set(21, 39, '#00E676'); // Green power LED
  c.hline(19, 21, 41, '#111827'); // Speaker slits
  c.hline(19, 21, 43, '#111827');
}

function drawHeadH(c) {
  // Homem VLi: Adulto, traços fortes, barba cheia e bem aparada, cabelo escuro
  const SKIN_BASE = '#E0A97A';
  const SKIN_SHADOW = '#C48B5F';
  const SKIN_HIGHLIGHT = '#EFC29A';
  const BEARD = '#1F2937';
  const BEARD_DARK = '#111827';
  const BEARD_LIGHT = '#374151';
  const HAIR = '#111827';
  const EYE = '#111827';
  const EYE_WHITE = '#FFFFFF';
  const LIPS = '#B45309';

  // Head base oval (X: 23 to 40, Y: 18 to 34)
  for (let y = 18; y <= 34; y++) {
    c.hline(24, 39, y, SKIN_BASE);
  }
  // Ears
  c.rect(21, 24, 3, 6, SKIN_BASE);
  c.rect(22, 25, 1, 4, SKIN_SHADOW);
  c.rect(40, 24, 3, 6, SKIN_BASE);
  c.rect(41, 25, 1, 4, SKIN_SHADOW);

  // Short dark hair at sides and temples
  c.rect(22, 18, 3, 6, HAIR);
  c.rect(39, 18, 3, 6, HAIR);
  c.rect(22, 23, 2, 3, HAIR); // sideburns
  c.rect(40, 23, 2, 3, HAIR);

  // Full Trimmed Beard (Traços fortes e barba cheia bem aparada)
  // Jawline and cheeks
  c.rect(23, 26, 2, 8, BEARD);
  c.rect(39, 26, 2, 8, BEARD);
  c.rect(24, 29, 2, 6, BEARD);
  c.rect(38, 29, 2, 6, BEARD);
  c.rect(25, 31, 14, 5, BEARD); // chin and jaw
  c.rect(26, 35, 12, 2, BEARD_DARK); // bottom edge

  // Mustache
  c.rect(28, 28, 8, 2, BEARD);
  c.rect(27, 29, 10, 2, BEARD);
  c.set(31, 28, BEARD_DARK);
  c.set(32, 28, BEARD_DARK);

  // Friendly confident mouth within beard
  c.hline(29, 34, 30, '#FFFFFF'); // Teeth highlight in smile
  c.hline(28, 35, 31, BEARD_DARK);

  // Strong nose
  c.rect(31, 23, 2, 4, SKIN_SHADOW);
  c.set(30, 26, SKIN_SHADOW);
  c.set(33, 26, SKIN_SHADOW);

  // Eyebrows
  c.rect(25, 20, 5, 2, HAIR);
  c.rect(34, 20, 5, 2, HAIR);

  // Eyes
  c.rect(26, 22, 4, 2, EYE_WHITE);
  c.rect(27, 22, 2, 2, EYE);
  c.set(27, 22, '#FFFFFF'); // highlight

  c.rect(34, 22, 4, 2, EYE_WHITE);
  c.rect(35, 22, 2, 2, EYE);
  c.set(35, 22, '#FFFFFF'); // highlight

  // Clear Safety Glasses (Óculos de proteção transparentes)
  const GLASS_FRAME = '#0F172A';
  const GLASS_TINT = 'rgba(178, 235, 242, 0.45)';
  const GLASS_SOLID = '#80DEEA';
  const GLASS_SPEC = '#FFFFFF';

  // Frames
  c.rect(24, 21, 7, 5, GLASS_FRAME);
  c.rect(33, 21, 7, 5, GLASS_FRAME);
  c.hline(30, 33, 22, GLASS_FRAME); // Bridge
  // Temples
  c.hline(21, 24, 23, GLASS_FRAME);
  c.hline(39, 42, 23, GLASS_FRAME);

  // Lens clear opening
  c.rect(25, 22, 5, 3, GLASS_SOLID);
  c.rect(34, 22, 5, 3, GLASS_SOLID);
  // Restore pupil behind glass
  c.rect(27, 22, 2, 2, EYE);
  c.rect(36, 22, 2, 2, EYE);
  // Glass reflections (specular)
  c.set(25, 22, GLASS_SPEC);
  c.set(26, 23, GLASS_SPEC);
  c.set(34, 22, GLASS_SPEC);
  c.set(35, 23, GLASS_SPEC);
}

function drawHeadM(c) {
  // Mulher VLi: Adulta jovem, traços suaves e definidos, cabelo castanho escuro preso em rabo de cavalo
  const SKIN_BASE = '#E8B48B';
  const SKIN_SHADOW = '#CF966F';
  const SKIN_ROSE = '#EF9A9A';
  const HAIR = '#3E2723';
  const HAIR_DARK = '#271206';
  const HAIR_LIGHT = '#5D4037';
  const EYE = '#3E2723';
  const EYE_WHITE = '#FFFFFF';
  const LIPS = '#D81B60';

  // Hair in back (Ponytail extending to the right shoulder)
  c.rect(40, 18, 5, 12, HAIR);
  c.rect(42, 26, 5, 14, HAIR);
  c.rect(44, 38, 4, 12, HAIR);
  c.rect(43, 48, 4, 6, HAIR);
  // Hair highlights on ponytail
  c.vline(43, 28, 40, HAIR_LIGHT);
  c.vline(45, 40, 50, HAIR_LIGHT);

  // Head base oval (X: 24 to 39, Y: 18 to 34)
  for (let y = 18; y <= 34; y++) {
    c.hline(25, 38, y, SKIN_BASE);
  }
  // Soft chin taper
  c.hline(27, 36, 33, SKIN_BASE);
  c.hline(29, 34, 34, SKIN_BASE);

  // Ears & Small Gold Earrings
  c.rect(22, 25, 3, 5, SKIN_BASE);
  c.set(23, 28, '#FBC02D'); // Gold earring
  c.rect(39, 25, 3, 5, SKIN_BASE);
  c.set(40, 28, '#FBC02D'); // Gold earring

  // Hair strands framing face and temples
  c.rect(23, 18, 3, 6, HAIR);
  c.rect(38, 18, 3, 6, HAIR);
  c.set(24, 24, HAIR);
  c.set(39, 24, HAIR);

  // Rosy cheeks / blush
  c.rect(25, 27, 3, 2, SKIN_ROSE);
  c.rect(36, 27, 3, 2, SKIN_ROSE);

  // Defined feminine eyebrows
  c.rect(26, 20, 4, 1, HAIR);
  c.set(25, 21, HAIR);
  c.rect(34, 20, 4, 1, HAIR);
  c.set(38, 21, HAIR);

  // Eyes (Big brown expressive eyes with eyelashes)
  c.rect(26, 22, 4, 2, EYE_WHITE);
  c.rect(27, 22, 2, 2, EYE);
  c.set(27, 22, '#FFFFFF'); // twinkle
  c.set(25, 21, '#111827'); // eyelash wing
  c.set(29, 21, '#111827');

  c.rect(34, 22, 4, 2, EYE_WHITE);
  c.rect(35, 22, 2, 2, EYE);
  c.set(35, 22, '#FFFFFF'); // twinkle
  c.set(34, 21, '#111827');
  c.set(38, 21, '#111827'); // eyelash wing

  // Delicate nose
  c.set(31, 26, SKIN_SHADOW);
  c.set(32, 26, SKIN_SHADOW);

  // Sympathetic friendly smile with defined lips
  c.hline(29, 34, 29, LIPS);
  c.hline(30, 33, 30, '#FFFFFF'); // Smile teeth
  c.hline(30, 33, 31, LIPS);

  // Clear Safety Glasses (Óculos de proteção transparentes)
  const GLASS_FRAME = '#0F172A';
  const GLASS_SOLID = '#80DEEA';
  const GLASS_SPEC = '#FFFFFF';

  // Frames
  c.rect(24, 21, 7, 5, GLASS_FRAME);
  c.rect(33, 21, 7, 5, GLASS_FRAME);
  c.hline(30, 33, 22, GLASS_FRAME); // Bridge
  c.hline(21, 24, 23, GLASS_FRAME);
  c.hline(39, 41, 23, GLASS_FRAME);

  // Lens clear opening
  c.rect(25, 22, 5, 3, GLASS_SOLID);
  c.rect(34, 22, 5, 3, GLASS_SOLID);
  // Restore eye pupils
  c.rect(27, 22, 2, 2, EYE);
  c.rect(35, 22, 2, 2, EYE);
  // Specular reflection
  c.set(25, 22, GLASS_SPEC);
  c.set(26, 23, GLASS_SPEC);
  c.set(34, 22, GLASS_SPEC);
  c.set(35, 23, GLASS_SPEC);
}

function drawHelmet(c) {
  // Capacete de proteção branco com logo VLi (White hard hat)
  const HELMET_WHITE = '#FFFFFF';
  const HELMET_SHADOW = '#CFD8DC';
  const HELMET_DARK = '#90A4AE';
  const HELMET_BRIM = '#FFFFFF';
  const LOGO_BLUE = '#002B49';
  const LOGO_ORANGE = '#FF7A00';

  // Dome (Y: 9 to 18, X: 21 to 42)
  c.rect(27, 9, 10, 2, HELMET_WHITE);
  c.rect(24, 11, 16, 2, HELMET_WHITE);
  c.rect(22, 13, 20, 4, HELMET_WHITE);
  c.rect(21, 17, 22, 2, HELMET_WHITE);

  // Shading on edges
  c.vline(21, 15, 18, HELMET_SHADOW);
  c.vline(22, 13, 14, HELMET_SHADOW);
  c.vline(42, 15, 18, HELMET_SHADOW);
  c.vline(41, 13, 14, HELMET_SHADOW);

  // Reinforcement center ridge
  c.vline(31, 9, 16, HELMET_SHADOW);
  c.vline(32, 9, 16, HELMET_WHITE);

  // Brim (Aba Frontal, X: 19 to 44, Y: 18 to 20)
  c.rect(19, 18, 26, 2, HELMET_BRIM);
  c.hline(18, 45, 19, HELMET_WHITE);
  c.hline(19, 44, 20, HELMET_SHADOW); // Brim bottom edge shadow

  // VLi Plaque and Logo on center front of helmet (X: 27 to 36, Y: 13 to 17)
  c.rect(27, 13, 10, 4, LOGO_BLUE);
  c.rect(27, 13, 10, 1, LOGO_ORANGE);
  // Pixel letters "VLi"
  // V
  c.set(28, 14, '#FFFFFF');
  c.set(28, 15, '#FFFFFF');
  c.set(29, 16, '#FFFFFF');
  c.set(30, 15, '#FFFFFF');
  c.set(30, 14, '#FFFFFF');
  // L
  c.set(32, 14, '#FFFFFF');
  c.set(32, 15, '#FFFFFF');
  c.set(32, 16, '#FFFFFF');
  c.set(33, 16, '#FFFFFF');
  // i
  c.set(35, 14, LOGO_ORANGE); // dot
  c.set(35, 15, '#FFFFFF');
  c.set(35, 16, '#FFFFFF');
}

function generateAvatarH() {
  const c = createPixelCanvas(64, 64);
  drawBackground(c);
  drawUniform(c, false);
  drawHeadH(c);
  drawHelmet(c);

  // Badge watermark in bottom right corner: "H" 8-bit badge
  c.rect(53, 53, 9, 9, '#002B49');
  c.rect(53, 53, 9, 1, '#FF7A00');
  c.rect(53, 61, 9, 1, '#FF7A00');
  c.rect(53, 53, 1, 9, '#FF7A00');
  c.rect(61, 53, 1, 9, '#FF7A00');
  // Letter "H"
  c.vline(55, 55, 59, '#FFB81C');
  c.vline(59, 55, 59, '#FFB81C');
  c.hline(56, 58, 57, '#FFB81C');

  return c.toSvg();
}

function generateAvatarM() {
  const c = createPixelCanvas(64, 64);
  drawBackground(c);
  drawUniform(c, true);
  drawHeadM(c);
  drawHelmet(c);

  // Badge watermark in bottom right corner: "M" 8-bit badge
  c.rect(53, 53, 9, 9, '#002B49');
  c.rect(53, 53, 9, 1, '#FF7A00');
  c.rect(53, 61, 9, 1, '#FF7A00');
  c.rect(53, 53, 1, 9, '#FF7A00');
  c.rect(61, 53, 1, 9, '#FF7A00');
  // Letter "M"
  c.vline(55, 55, 59, '#FFB81C');
  c.vline(59, 55, 59, '#FFB81C');
  c.set(56, 56, '#FFB81C');
  c.set(57, 57, '#FFB81C');
  c.set(58, 56, '#FFB81C');

  return c.toSvg();
}

const svgH = generateAvatarH();
const svgM = generateAvatarM();

fs.writeFileSync(path.resolve('public/avatar_h.svg'), svgH, 'utf-8');
fs.writeFileSync(path.resolve('public/avatar_m.svg'), svgM, 'utf-8');

console.log('Successfully generated public/avatar_h.svg and public/avatar_m.svg!');
