import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Mesh,
} from '@babylonjs/core';

// Theme configuration
type Theme = 'dark' | 'light';
const currentTheme: Theme = 'dark';

const themes = {
  dark: {
    tabBarBg: '#1f2020',
    tabActiveBg: '#3c3c3c',
    addressBarBg: '#3c3c3c',
    urlFieldBg: '#202124',
    textColor: '#e8eaed',
    textColorMuted: '#9aa0a6',
    iconColor: '#9aa0a6',
    contentBg: '#3c3c3c',
    searchBarBg: '#ffffff',
    searchBarBorder: '#5f6368',
    comparisonTextColor: '#ffffff', // Arrows and labels color
  },
  light: {
    tabBarBg: '#dee1e6',
    tabActiveBg: '#ffffff',
    addressBarBg: '#ffffff',
    urlFieldBg: '#f1f3f4',
    textColor: '#202124',
    textColorMuted: '#5f6368',
    iconColor: '#5f6368',
    contentBg: '#ffffff',
    searchBarBg: '#ffffff',
    searchBarBorder: '#dfe1e5',
    comparisonTextColor: '#000000', // Arrows and labels color
  },
};

const theme = themes[currentTheme];

// Get the canvas element
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Create the Babylon.js engine
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color4(0.102, 0.102, 0.18, 1); // #1a1a2e

// Camera position (fixed)
const cameraZ = 5;

// Browser mesh base dimensions
const browserBaseWidth = 8;
const browserBaseHeight = 4.5;

// Calculate visible area at Z=0
function getVisibleArea(): { width: number; height: number } {
  const aspectRatio = canvas.width / canvas.height;
  const fovRad = camera.fov;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * cameraZ;
  const visibleWidth = visibleHeight * aspectRatio;
  return { width: visibleWidth, height: visibleHeight };
}

// Get viewport aspect ratio
function getViewportAspect(): number {
  return canvas.width / canvas.height;
}

// Calculate uniform scale to fill viewport width
function calculateBrowserScale(): number {
  const visible = getVisibleArea();
  // Scale to fill width completely
  return visible.width / browserBaseWidth;
}

// Create camera - positive Z looking at origin
const camera = new FreeCamera('camera', new Vector3(0, 0, cameraZ), scene);
camera.setTarget(Vector3.Zero());
camera.fov = (60 * Math.PI) / 180; // 60 degrees in radians

// Animation steps (triggered by Space key)
type AnimationStep = 'idle' | 'fullscreen' | 'zoom' | 'typing1' | 'erasing1' | 'typingEmoji' | 'erasingEmoji' | 'typing2' | 'comparison' | 'showAttack' | 'returnLetters' | 'dezoom' | 'flip' | 'flipBack' | 'zoomFinal' | 'typing3' | 'erasing4' | 'typing4' | 'dezoomFinal' | 'done';
const animationSteps: AnimationStep[] = ['idle', 'fullscreen', 'zoom', 'typing1', 'erasing1', 'typingEmoji', 'erasingEmoji', 'typing2', 'comparison', 'showAttack', 'returnLetters', 'dezoom', 'flip', 'flipBack', 'zoomFinal', 'typing3', 'erasing4', 'typing4', 'dezoomFinal', 'done'];
let currentStepIndex = 0;
let stepStartTime = 0;
let stepAnimationComplete = false;

// Animation progress variables
let fullscreenProgress = 0;
let typingProgress = 0;
let zoomProgress = 0;
let eraseProgress = 0;
let emojiTypingProgress = 0;
let emojiEraseProgress = 0;
let typing2Progress = 0;
let comparisonAnimProgress = 0;
let returnLettersProgress = 0;
let typing3Progress = 0;
let erase4Progress = 0;
let typing4Progress = 0;

// First URL: Chinese characters
const firstUrl = '例子.测试';
// Second URL: Emoji in domain
const emojiUrl = '😎🌴☀️🍹🌈✌️.com';
// Third URL: Cyrillic homograph (а, р, р, ӏ, е are Cyrillic, looks like "apple")
const secondUrl = 'аррӏе.com';
// Fourth URL: GitHub repo
const thirdUrl = 'https://github.com/vricosti/hibana-stack';
// Fifth URL: French accented domain
const fourthUrl = 'tiéuntigre.fr';

// Cyrillic letters info for comparison animation (grouped)
const cyrillicLettersGrouped = [
  { chars: 'а', code: 'U+0430', indices: [0], label: 'а' },
  { chars: 'рр', code: 'U+0440', indices: [1, 2], label: 'р' },
  { chars: 'ӏ', code: 'U+04CF', indices: [3], label: 'ӏ' }
];

let currentDisplayedUrl = '';

// Helper to get current step
function getCurrentStep(): AnimationStep {
  return animationSteps[currentStepIndex];
}

// Advance to next step
function nextStep(): void {
  if (currentStepIndex < animationSteps.length - 1) {
    currentStepIndex++;
    stepStartTime = Date.now();
    stepAnimationComplete = false;

    // Reset phase-specific progress
    const step = getCurrentStep();
    if (step === 'typing1') {
      currentDisplayedUrl = '';
      typingProgress = 0;
    } else if (step === 'erasing1') {
      eraseProgress = 0;
    } else if (step === 'typingEmoji') {
      currentDisplayedUrl = '';
      emojiTypingProgress = 0;
    } else if (step === 'erasingEmoji') {
      emojiEraseProgress = 0;
    } else if (step === 'typing2') {
      currentDisplayedUrl = '';
      typing2Progress = 0;
    } else if (step === 'comparison') {
      comparisonAnimProgress = 0;
    }

    updateBrowserTexture();
  }
}

// Comparison animation state
type ComparisonState = 'none' | 'animating' | 'full' | 'returnLetters' | 'complete';

// Create browser frame using canvas texture (Chrome macOS dark theme)
function createBrowserCanvas(
  urlText: string = '',
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0,
  canvasHeight: number = 1080,
  showAttack: boolean = false
): HTMLCanvasElement {
  const canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d')!;
  canvasEl.width = 1920;
  canvasEl.height = canvasHeight;

  // Colors from theme
  const tabBarBg = theme.tabBarBg;
  const tabActiveBg = theme.tabActiveBg;
  const addressBarBg = theme.addressBarBg;
  const urlFieldBg = theme.urlFieldBg;
  const textColor = theme.textColor;
  const textColorMuted = theme.textColorMuted;
  const iconColor = theme.iconColor;

  // Tab bar area
  const tabBarHeight = 46;
  ctx.fillStyle = tabBarBg;
  ctx.fillRect(0, 0, canvasEl.width, tabBarHeight);

  // macOS traffic lights (left side) - centered vertically
  const trafficLightY = tabBarHeight / 2;
  const trafficLightStartX = 20;
  const trafficLightRadius = 7;
  const trafficLightSpacing = 22;

  // Red (close)
  ctx.fillStyle = '#ff5f57';
  ctx.beginPath();
  ctx.arc(trafficLightStartX, trafficLightY, trafficLightRadius, 0, Math.PI * 2);
  ctx.fill();

  // Yellow (minimize)
  ctx.fillStyle = '#ffbd2e';
  ctx.beginPath();
  ctx.arc(trafficLightStartX + trafficLightSpacing, trafficLightY, trafficLightRadius, 0, Math.PI * 2);
  ctx.fill();

  // Green (maximize)
  ctx.fillStyle = '#28ca41';
  ctx.beginPath();
  ctx.arc(trafficLightStartX + trafficLightSpacing * 2, trafficLightY, trafficLightRadius, 0, Math.PI * 2);
  ctx.fill();

  // Active tab (rounded top corners) - less gap at top
  const tabStartX = 90;
  const tabWidth = 220;
  const tabHeight = 40;  // Taller tab to reduce gap
  const tabY = tabBarHeight - tabHeight;
  const tabRadius = 8;

  ctx.fillStyle = tabActiveBg;
  ctx.beginPath();
  ctx.moveTo(tabStartX, tabBarHeight);
  ctx.lineTo(tabStartX, tabY + tabRadius);
  ctx.quadraticCurveTo(tabStartX, tabY, tabStartX + tabRadius, tabY);
  ctx.lineTo(tabStartX + tabWidth - tabRadius, tabY);
  ctx.quadraticCurveTo(tabStartX + tabWidth, tabY, tabStartX + tabWidth, tabY + tabRadius);
  ctx.lineTo(tabStartX + tabWidth, tabBarHeight);
  ctx.closePath();
  ctx.fill();

  // Chrome logo in tab (from SVG)
  const chromeIconSize = 16;
  const chromeIconX = tabStartX + 16 - chromeIconSize / 2;
  const chromeIconY = trafficLightY - chromeIconSize / 2;

  if (chromeLogoImage) {
    ctx.drawImage(chromeLogoImage, chromeIconX, chromeIconY, chromeIconSize, chromeIconSize);
  }

  // Tab title
  ctx.fillStyle = textColor;
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Nouvel onglet', tabStartX + 34, tabY + 22);

  // Tab close button (X)
  ctx.strokeStyle = textColorMuted;
  ctx.lineWidth = 1.5;
  const closeX = tabStartX + tabWidth - 24;
  const closeY = tabY + tabHeight / 2 + 2;
  ctx.beginPath();
  ctx.moveTo(closeX - 4, closeY - 4);
  ctx.lineTo(closeX + 4, closeY + 4);
  ctx.moveTo(closeX + 4, closeY - 4);
  ctx.lineTo(closeX - 4, closeY + 4);
  ctx.stroke();

  // New tab button (+)
  const plusX = tabStartX + tabWidth + 15;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plusX - 6, trafficLightY);
  ctx.lineTo(plusX + 6, trafficLightY);
  ctx.moveTo(plusX, trafficLightY - 6);
  ctx.lineTo(plusX, trafficLightY + 6);
  ctx.stroke();

  // Address bar area
  const addressBarY = tabBarHeight;
  const addressBarHeight = 52;
  ctx.fillStyle = addressBarBg;
  ctx.fillRect(0, addressBarY, canvasEl.width, addressBarHeight);

  // Navigation buttons
  const navY = addressBarY + addressBarHeight / 2;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = 2;

  // Back arrow
  const backX = 28;
  ctx.beginPath();
  ctx.moveTo(backX + 6, navY - 6);
  ctx.lineTo(backX, navY);
  ctx.lineTo(backX + 6, navY + 6);
  ctx.stroke();

  // Forward arrow
  const forwardX = 60;
  ctx.beginPath();
  ctx.moveTo(forwardX - 6, navY - 6);
  ctx.lineTo(forwardX, navY);
  ctx.lineTo(forwardX - 6, navY + 6);
  ctx.stroke();

  // Refresh button (circular arrow)
  const refreshX = 100;
  ctx.beginPath();
  ctx.arc(refreshX, navY, 8, -Math.PI * 0.7, Math.PI * 0.9);
  ctx.stroke();
  // Arrow head on refresh
  ctx.beginPath();
  ctx.moveTo(refreshX + 6, navY - 6);
  ctx.lineTo(refreshX + 9, navY - 1);
  ctx.lineTo(refreshX + 3, navY - 1);
  ctx.closePath();
  ctx.fillStyle = iconColor;
  ctx.fill();

  // URL bar (rounded rectangle, dark background)
  const urlBarX = 140;
  const urlBarY = addressBarY + 8;
  const urlBarWidth = canvasEl.width - 280;
  const urlBarHeight = 36;
  const urlBarRadius = 18;

  ctx.fillStyle = urlFieldBg;
  ctx.beginPath();
  ctx.roundRect(urlBarX, urlBarY, urlBarWidth, urlBarHeight, urlBarRadius);
  ctx.fill();

  // Info/lock icon (circle with i)
  const infoIconX = urlBarX + 26;
  const infoIconY = urlBarY + urlBarHeight / 2;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(infoIconX, infoIconY, 8, 0, Math.PI * 2);
  ctx.stroke();
  // "i" inside
  ctx.fillStyle = iconColor;
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('i', infoIconX, infoIconY + 4);
  ctx.textAlign = 'left';

  // URL text
  ctx.fillStyle = textColor;
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  const textX = urlBarX + 48;
  const textY = urlBarY + 24;

  // Store values for comparison drawing later (after all UI elements)
  let comparisonData: { letterPositions: number[]; letterWidths: number[] } | null = null;

  if (showComparison && urlText === secondUrl) {
    // In comparison mode, draw URL with gaps for the 4 Cyrillic letters (а, р, р, ӏ)
    // URL is "аррӏе.com" - first 4 chars are Cyrillic, rest is "е.com"
    const cyrillicChars = ['а', 'р', 'р', 'ӏ'];
    const afterCyrillic = urlText.substring(4); // "е.com"

    // Calculate positions for each letter
    const letterPositions: number[] = [];
    const letterWidths: number[] = [];
    let currentX = textX;

    for (let i = 0; i < 4; i++) {
      letterPositions.push(currentX);
      const charWidth = ctx.measureText(cyrillicChars[i]).width;
      letterWidths.push(charWidth);
      currentX += charWidth;
    }

    // Draw the remaining text after the 4 Cyrillic letters
    ctx.fillText(afterCyrillic, currentX, textY);

    // Store for later drawing
    comparisonData = { letterPositions, letterWidths };
  } else {
    // Normal mode: just draw the URL
    ctx.fillText(urlText, textX, textY);
  }

  // Cursor (solid when typing/erasing, blinking when typing is done)
  const step = getCurrentStep();
  const typingSteps = ['typing1', 'typing2', 'typingEmoji', 'typing3', 'typing4'];
  const erasingSteps = ['erasing1', 'erasingEmoji', 'erasing3', 'erasing4'];
  const isTyping = typingSteps.includes(step);
  const isErasing = erasingSteps.includes(step);

  if (step !== 'idle' && (isTyping || isErasing)) {
    const textWidth = ctx.measureText(urlText).width;
    // Blink cursor when typing is complete (500ms on, 500ms off)
    const shouldShowCursor = isErasing || !stepAnimationComplete || (Math.floor(Date.now() / 500) % 2 === 0);
    if (shouldShowCursor) {
      ctx.fillStyle = textColor;
      ctx.fillRect(textX + textWidth + 2, urlBarY + 8, 2, 20);
    }
  }

  // Right side icons
  const rightIconsX = canvasEl.width - 100;

  // Download icon (arrow down with line)
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rightIconsX, navY - 6);
  ctx.lineTo(rightIconsX, navY + 4);
  ctx.lineTo(rightIconsX - 5, navY - 1);
  ctx.moveTo(rightIconsX, navY + 4);
  ctx.lineTo(rightIconsX + 5, navY - 1);
  ctx.moveTo(rightIconsX - 6, navY + 7);
  ctx.lineTo(rightIconsX + 6, navY + 7);
  ctx.stroke();

  // Three dots menu (vertical)
  ctx.fillStyle = iconColor;
  const menuX = rightIconsX + 45;
  ctx.beginPath();
  ctx.arc(menuX, navY - 7, 2, 0, Math.PI * 2);
  ctx.arc(menuX, navY, 2, 0, Math.PI * 2);
  ctx.arc(menuX, navY + 7, 2, 0, Math.PI * 2);
  ctx.fill();

  // Chevron (dropdown) at far right
  const chevronX = canvasEl.width - 25;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chevronX - 4, navY - 3);
  ctx.lineTo(chevronX, navY + 2);
  ctx.lineTo(chevronX + 4, navY - 3);
  ctx.stroke();

  // Total browser chrome height (no bookmarks bar to match image)
  const browserChromeHeight = tabBarHeight + addressBarHeight;

  // Main content area
  ctx.fillStyle = theme.contentBg;
  ctx.fillRect(0, browserChromeHeight, canvasEl.width, canvasEl.height - browserChromeHeight);

  // Google logo placeholder in center
  const centerY = (canvasEl.height + browserChromeHeight) / 2 - 50;
  ctx.fillStyle = '#4285f4';
  ctx.font = 'bold 120px "Product Sans", Arial, sans-serif';
  ctx.fillText('G', canvasEl.width / 2 - 210, centerY);
  ctx.fillStyle = '#ea4335';
  ctx.fillText('o', canvasEl.width / 2 - 115, centerY);
  ctx.fillStyle = '#fbbc05';
  ctx.fillText('o', canvasEl.width / 2 - 45, centerY);
  ctx.fillStyle = '#4285f4';
  ctx.fillText('g', canvasEl.width / 2 + 25, centerY);
  ctx.fillStyle = '#34a853';
  ctx.fillText('l', canvasEl.width / 2 + 95, centerY);
  ctx.fillStyle = '#ea4335';
  ctx.fillText('e', canvasEl.width / 2 + 125, centerY);

  // Search bar
  const searchBarWidth = 600;
  const searchBarX = (canvasEl.width - searchBarWidth) / 2;
  const searchBarY = centerY + 50;

  // Fill search bar
  ctx.fillStyle = theme.searchBarBg;
  ctx.beginPath();
  ctx.roundRect(searchBarX, searchBarY, searchBarWidth, 50, 25);
  ctx.fill();

  // Stroke border
  ctx.strokeStyle = theme.searchBarBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(searchBarX, searchBarY, searchBarWidth, 50, 25);
  ctx.stroke();

  // Search icon
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(searchBarX + 30, searchBarY + 22, 10, 0, Math.PI * 2);
  ctx.moveTo(searchBarX + 38, searchBarY + 30);
  ctx.lineTo(searchBarX + 45, searchBarY + 37);
  ctx.stroke();

  // Draw comparison animation ON TOP of everything else
  if (comparisonData && showComparison) {
    const { letterPositions, letterWidths } = comparisonData;

    // Comparison display area - stacked vertically below URL bar
    const baseY = textY + 50; // Start position below URL
    const rowHeight = 38; // Vertical spacing between rows
    const alignX = letterPositions[0]; // All letters align to first letter X position

    // Draw each grouped Cyrillic letter(s) on separate rows
    for (let groupIdx = 0; groupIdx < cyrillicLettersGrouped.length; groupIdx++) {
      const group = cyrillicLettersGrouped[groupIdx];
      const firstIdx = group.indices[0];
      const originalX = letterPositions[firstIdx];

      // Calculate total width for this group
      let groupWidth = 0;
      for (const idx of group.indices) {
        groupWidth += letterWidths[idx];
      }

      // Target Y for this row
      const targetY = baseY + groupIdx * rowHeight;

      // Calculate letter position based on state
      let currentLetterY: number;
      let currentLetterX: number;
      if (comparisonState === 'returnLetters') {
        // Animate back from comparison position to URL position
        currentLetterY = targetY - (targetY - textY) * reverseProgress;
        currentLetterX = alignX + (originalX - alignX) * reverseProgress;
      } else {
        currentLetterY = textY + (targetY - textY) * animProgress;
        currentLetterX = originalX + (alignX - originalX) * animProgress;
      }

      // Draw the animated letter(s)
      if (comparisonState !== 'complete') {
        // Transition font size and color when returning
        if (comparisonState === 'returnLetters') {
          const fontSize = 28 - (28 - 16) * reverseProgress; // Shrink from 28px to normal URL size (16px)
          const fontWeight = reverseProgress > 0.5 ? 'normal' : 'bold';
          ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

          // Fade red to URL text color (#e8eaed = rgb(232, 234, 237)) as it returns
          const redValue = Math.floor(229 + (232 - 229) * reverseProgress);
          const greenValue = Math.floor(57 + (234 - 57) * reverseProgress);
          const blueValue = Math.floor(53 + (237 - 53) * reverseProgress);
          ctx.fillStyle = `rgb(${redValue}, ${greenValue}, ${blueValue})`;
        } else {
          ctx.fillStyle = '#e53935'; // Red for Cyrillic
          ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        }
        ctx.fillText(group.chars, currentLetterX, currentLetterY);
      }

      // Show arrow and label when animation is complete
      if (animProgress >= 1 && comparisonState !== 'returnLetters' && comparisonState !== 'complete') {
        const arrowStartX = alignX + groupWidth + 15;
        const arrowLength = 25;
        const labelX = arrowStartX + arrowLength + 8;

        // Draw arrow pointing right
        ctx.strokeStyle = theme.comparisonTextColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(arrowStartX, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 5, targetY - 13);
        ctx.moveTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 5, targetY - 3);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = theme.comparisonTextColor;
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText(`${group.label} cyrillique (${group.code})`, labelX, targetY - 4);
      }
    }

    // Draw pirate flag and "attaque homographe" text when showAttack is true
    if (showAttack && animProgress >= 1 && comparisonState !== 'returnLetters' && comparisonState !== 'complete') {
      // Calculate X position after the longest label
      const attackX = alignX + 280;

      // Draw pirate flag
      if (pirateFlagImage) {
        const flagSize = 80;
        const flagX = attackX + 50;
        const flagY = baseY + 15; // Aligned below the text
        ctx.drawImage(pirateFlagImage, flagX, flagY, flagSize, flagSize);

        // Draw "Attaque homographe" text at same level as first letter (а)
        // "homographe" in LGBT rainbow colors
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.textAlign = 'center';

        const textCenterX = flagX + flagSize / 2;
        const attackeText = 'Attaque ';
        const homoText = 'homographe';

        // LGBT rainbow colors
        const rainbowColors = ['#E40303', '#FF8C00', '#FFED00', '#008026', '#24408E', '#732982'];

        // Measure widths
        const attackeWidth = ctx.measureText(attackeText).width;
        const homoWidth = ctx.measureText(homoText).width;
        const totalWidth = attackeWidth + homoWidth;

        let currentX = textCenterX - totalWidth / 2;

        // Draw "Attaque " in red
        ctx.fillStyle = '#e53935';
        ctx.textAlign = 'left';
        ctx.fillText(attackeText, currentX, baseY);
        currentX += attackeWidth;

        // Draw "homographe" with each letter in rainbow colors
        for (let i = 0; i < homoText.length; i++) {
          ctx.fillStyle = rainbowColors[i % rainbowColors.length];
          ctx.fillText(homoText[i], currentX, baseY);
          currentX += ctx.measureText(homoText[i]).width;
        }

        ctx.textAlign = 'left';
      }
    }
  }

  return canvasEl;
}

// Table data for the back page
const tableData = [
  { domain: 'аррӏе.com', punycode: 'xn--80ak6aa92e.com', browser: 'xn--80ak6aa92e.com' },
  { domain: 'apple.com', punycode: 'apple.com', browser: 'apple.com' },
  { domain: 'café.fr', punycode: 'xn--caf-dma.fr', browser: 'café.fr' },
];

// Create back page canvas with table
function createBackCanvas(canvasHeight: number = 1080): HTMLCanvasElement {
  const canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d')!;
  canvasEl.width = 1920;
  canvasEl.height = canvasHeight;

  // Mirror horizontally so it displays correctly after 180° rotation
  ctx.translate(canvasEl.width, 0);
  ctx.scale(-1, 1);

  // Gray background
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Encodage Punycode des noms de domaine', canvasEl.width / 2, 100);

  // Table settings
  const tableX = 100;
  const tableY = 180;
  const tableWidth = canvasEl.width - 200;
  const rowHeight = 70;
  const colWidths = [tableWidth * 0.33, tableWidth * 0.34, tableWidth * 0.33];
  const headers = ['Domaine (Unicode)', 'Encodé DNS (Punycode réel)', 'Affichage navigateur'];

  // Draw table header
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(tableX, tableY, tableWidth, rowHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';

  let colX = tableX;
  for (let i = 0; i < headers.length; i++) {
    ctx.fillText(headers[i], colX + colWidths[i] / 2, tableY + rowHeight / 2 + 8);
    colX += colWidths[i];
  }

  // Draw table rows
  ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

  for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
    const row = tableData[rowIdx];
    const rowY = tableY + rowHeight * (rowIdx + 1);

    // Alternate row colors
    ctx.fillStyle = rowIdx % 2 === 0 ? '#5a5a5a' : '#4a4a4a';
    ctx.fillRect(tableX, rowY, tableWidth, rowHeight);

    // Draw cell borders
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, rowY, tableWidth, rowHeight);

    // Draw cell content
    colX = tableX;

    // Check if this is a homograph attack risk (Cyrillic characters that look like Latin)
    const isHomographRisk = row.domain === 'аррӏе.com' || row.domain === 'раураl.com';

    // Domain column - red for homograph risks
    if (isHomographRisk) {
      ctx.fillStyle = '#e57373'; // Red - dangerous homograph
    } else {
      ctx.fillStyle = '#ffffff'; // White - normal
    }
    ctx.fillText(row.domain, colX + colWidths[0] / 2, rowY + rowHeight / 2 + 8);
    colX += colWidths[0];

    // Punycode column
    ctx.fillStyle = '#90caf9'; // Light blue for punycode
    ctx.fillText(row.punycode, colX + colWidths[1] / 2, rowY + rowHeight / 2 + 8);
    colX += colWidths[1];

    // Browser display column - green if browser shows punycode (protection active)
    if (row.browser.startsWith('xn--')) {
      ctx.fillStyle = '#81c784'; // Green - safe (browser shows punycode)
    } else {
      ctx.fillStyle = '#ffffff'; // White - normal
    }
    ctx.fillText(row.browser, colX + colWidths[2] / 2, rowY + rowHeight / 2 + 8);
  }

  // Draw table border
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 3;
  ctx.strokeRect(tableX, tableY, tableWidth, rowHeight * (tableData.length + 1));

  // Draw vertical column separators
  colX = tableX;
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX += colWidths[i];
    ctx.beginPath();
    ctx.moveTo(colX, tableY);
    ctx.lineTo(colX, tableY + rowHeight * (tableData.length + 1));
    ctx.stroke();
  }

  // Legend at bottom
  ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  const legendY = tableY + rowHeight * (tableData.length + 1) + 50;

  ctx.fillStyle = '#81c784';
  ctx.fillRect(tableX, legendY - 15, 20, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Le navigateur affiche le Punycode (protection active)', tableX + 30, legendY);

  ctx.fillStyle = '#e57373';
  ctx.fillRect(tableX + 550, legendY - 15, 20, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Risque d\'attaque homographe', tableX + 580, legendY);

  ctx.textAlign = 'left';

  return canvasEl;
}

// Create browser mesh
let browserTexture: DynamicTexture;
let backTexture: DynamicTexture;
let browserMaterial: StandardMaterial;
let browserMesh: Mesh;
let isShowingBack = false;

function createBrowserMesh(): void {
  // Create dynamic texture from canvas
  browserTexture = new DynamicTexture('browserTexture', { width: 1920, height: 1080 }, scene, true);
  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl);
  textureContext.drawImage(sourceCanvas, 0, 0);
  browserTexture.update();

  // Create back texture for the table
  backTexture = new DynamicTexture('backTexture', { width: 1920, height: 1080 }, scene, true);
  const backContext = backTexture.getContext();
  const backCanvas = createBackCanvas(1080);
  backContext.drawImage(backCanvas, 0, 0);
  backTexture.update();

  // Create material
  browserMaterial = new StandardMaterial('browserMaterial', scene);
  browserMaterial.emissiveTexture = browserTexture; // Only emissive for exact colors
  browserMaterial.disableLighting = true;
  browserMaterial.backFaceCulling = false;

  // Create browser plane - sideOrientation DOUBLESIDE to be visible from both sides
  browserMesh = MeshBuilder.CreatePlane('browser', {
    width: 8,
    height: 4.5,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  browserMesh.material = browserMaterial;
  browserMesh.scaling.x = -1; // Flip horizontally
}

// Switch to back texture
function showBackTexture(): void {
  if (!isShowingBack) {
    browserMaterial.emissiveTexture = backTexture;
    isShowingBack = true;
  }
}

// Switch to front texture
function showFrontTexture(): void {
  if (isShowingBack) {
    browserMaterial.emissiveTexture = browserTexture;
    isShowingBack = false;
  }
}

let currentTextureHeight = 1080;

function updateBrowserTexture(
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0,
  showAttack: boolean = false
): void {
  const targetHeight = getCanvasHeight();

  // Recreate texture if height changed
  if (targetHeight !== currentTextureHeight) {
    currentTextureHeight = targetHeight;
    browserTexture.dispose();
    browserTexture = new DynamicTexture('browserTexture', { width: 1920, height: targetHeight }, scene, true);
    browserMaterial.emissiveTexture = browserTexture;
  }

  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl, showComparison, animProgress, comparisonState, reverseProgress, targetHeight, showAttack);
  textureContext.drawImage(sourceCanvas, 0, 0);
  browserTexture.update();
}

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Animation durations for each step
const fullscreenDuration = 800;
const zoomDuration = 2500;
const typing1Duration = 2500;
const eraseDuration = 200;
const emojiTypingDuration = 2000;
const emojiEraseDuration = 300;
const typing2Duration = 2500;
const comparisonDuration = 1000;
const returnLettersDuration = 1000;
const dezoomDuration = 2000;
const flipDuration = 1500;
const typing3Duration = 2000;
const erase4Duration = 200;
const typing4Duration = 3000;

// Camera target position when zoomed (to show address bar)
const zoomedCameraX = 2.5; // Positive to move camera right (shows left side of browser)
const zoomedCameraY = 1.8; // Move camera up to show top of browser
const zoomedCameraZ = 2.0; // Move camera closer

// Initial scale for idle state (smaller browser)
const idleScale = 0.7;

// Calculate required canvas height to fill viewport
function getCanvasHeight(): number {
  const viewportAspect = getViewportAspect();
  const browserAspect = browserBaseWidth / browserBaseHeight;

  if (viewportAspect < browserAspect) {
    // Viewport is taller - need taller canvas
    return Math.round(1920 / viewportAspect);
  }
  return 1080; // Default height for wider viewports
}

// Update browser mesh scale and camera position
function updateBrowserTransform(zoomProgress: number = 0, meshScale: number = 1.0): void {
  const baseScale = calculateBrowserScale();
  const canvasHeight = getCanvasHeight();

  // Mesh scale (for idle/fullscreen transition)
  browserMesh.scaling.x = -baseScale * meshScale; // Negative for horizontal flip
  browserMesh.scaling.y = baseScale * meshScale * (canvasHeight / 1080);
  browserMesh.position.x = 0;
  browserMesh.position.y = 0;

  // Move camera based on zoom progress
  const targetX = zoomedCameraX * zoomProgress;
  const targetY = zoomedCameraY * zoomProgress;
  const targetZ = cameraZ + (zoomedCameraZ - cameraZ) * zoomProgress;

  camera.position.x = targetX;
  camera.position.y = targetY;
  camera.position.z = targetZ;
  camera.setTarget(new Vector3(targetX, targetY, 0));
}

// Animation loop - step based
scene.registerBeforeRender(() => {
  const step = getCurrentStep();
  const elapsed = Date.now() - stepStartTime;

  if (step === 'idle') {
    // Initial state - smaller browser, no zoom
    updateBrowserTransform(0, idleScale);
    return;
  }

  if (step === 'fullscreen') {
    const progress = Math.min(elapsed / fullscreenDuration, 1);
    fullscreenProgress = easeInOutCubic(progress);
    // Animate from idleScale to 1.0 (fullscreen)
    const currentScale = idleScale + (1.0 - idleScale) * fullscreenProgress;
    updateBrowserTransform(0, currentScale);
    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'zoom') {
    const progress = Math.min(elapsed / zoomDuration, 1);
    zoomProgress = easeInOutCubic(progress);

    // Move camera to focus on address bar
    updateBrowserTransform(zoomProgress);

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'typing1') {
    const progress = Math.min(elapsed / typing1Duration, 1);
    typingProgress = progress; // Linear for consistent typing speed
    const charsToShow = Math.floor(typingProgress * firstUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = firstUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = firstUrl;
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'erasing1') {
    const progress = Math.min(elapsed / eraseDuration, 1);
    eraseProgress = progress; // Linear for consistent speed
    const charsToShow = Math.floor((1 - eraseProgress) * firstUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = firstUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = '';
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'typingEmoji') {
    const progress = Math.min(elapsed / emojiTypingDuration, 1);
    emojiTypingProgress = progress; // Linear for consistent typing speed
    const charsToShow = Math.floor(emojiTypingProgress * emojiUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = emojiUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = emojiUrl;
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'erasingEmoji') {
    const progress = Math.min(elapsed / emojiEraseDuration, 1);
    emojiEraseProgress = progress; // Linear for consistent speed
    const charsToShow = Math.floor((1 - emojiEraseProgress) * emojiUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = emojiUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = '';
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'typing2') {
    const progress = Math.min(elapsed / typing2Duration, 1);
    typing2Progress = progress; // Linear for consistent typing speed
    const charsToShow = Math.floor(typing2Progress * secondUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = secondUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = secondUrl;
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'comparison') {
    const progress = Math.min(elapsed / comparisonDuration, 1);
    comparisonAnimProgress = easeOutCubic(progress);
    updateBrowserTexture(true, comparisonAnimProgress, progress >= 1 ? 'full' : 'animating', 0, false);

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'showAttack') {
    // Show comparison with pirate flag and "attaque homographe" text
    updateBrowserTexture(true, 1, 'full', 0, true);

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    // This step just waits for next Space press
    stepAnimationComplete = true;
  }

  if (step === 'returnLetters') {
    const progress = Math.min(elapsed / returnLettersDuration, 1);
    returnLettersProgress = easeInOutCubic(progress);
    updateBrowserTexture(true, 1, 'returnLetters', returnLettersProgress, false);

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'dezoom') {
    const progress = Math.min(elapsed / dezoomDuration, 1);
    const easedProgress = easeInOutCubic(progress);

    // Move camera back to initial position
    updateBrowserTransform(1 - easedProgress);

    // Show complete URL (letter is back in place)
    updateBrowserTexture(false, 0, 'complete', 1);

    if (progress >= 1) {
      stepAnimationComplete = true;
    }
  }

  if (step === 'flip') {
    const progress = Math.min(elapsed / flipDuration, 1);
    const easedProgress = easeInOutCubic(progress);

    // Rotate around Y axis (180 degrees = PI radians)
    const rotation = easedProgress * Math.PI;
    browserMesh.rotation.y = rotation;

    // Switch texture at halfway point (90 degrees)
    if (rotation > Math.PI / 2) {
      showBackTexture();
    } else {
      showFrontTexture();
    }

    // Keep camera at initial position
    updateBrowserTransform(0);

    if (progress >= 1) {
      stepAnimationComplete = true;
    }
  }

  if (step === 'flipBack') {
    const progress = Math.min(elapsed / flipDuration, 1);
    const easedProgress = easeInOutCubic(progress);

    // Rotate back from PI to 0 (reverse direction)
    const rotation = Math.PI - easedProgress * Math.PI;
    browserMesh.rotation.y = rotation;

    // Switch texture at halfway point (90 degrees)
    if (rotation < Math.PI / 2) {
      showFrontTexture();
    } else {
      showBackTexture();
    }

    // Keep camera at initial position
    updateBrowserTransform(0);

    if (progress >= 1) {
      browserMesh.rotation.y = 0; // Ensure exact 0
      // Clear URL when returning from table
      currentDisplayedUrl = '';
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'zoomFinal') {
    const progress = Math.min(elapsed / zoomDuration, 1);
    zoomProgress = easeInOutCubic(progress);

    // Move camera to focus on address bar
    updateBrowserTransform(zoomProgress);

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'typing3') {
    const progress = Math.min(elapsed / typing3Duration, 1);
    typing3Progress = progress;
    const charsToShow = Math.floor(typing3Progress * thirdUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = thirdUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = thirdUrl;
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'erasing4') {
    const progress = Math.min(elapsed / erase4Duration, 1);
    erase4Progress = progress;
    const charsToShow = Math.floor((1 - erase4Progress) * thirdUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = thirdUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = '';
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'typing4') {
    const progress = Math.min(elapsed / typing4Duration, 1);
    typing4Progress = progress;
    const charsToShow = Math.floor(typing4Progress * fourthUrl.length);

    if (currentDisplayedUrl.length !== charsToShow) {
      currentDisplayedUrl = fourthUrl.substring(0, charsToShow);
      updateBrowserTexture();
    }

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) {
      currentDisplayedUrl = fourthUrl;
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'dezoomFinal') {
    const progress = Math.min(elapsed / dezoomDuration, 1);
    const easedProgress = easeInOutCubic(progress);

    // Move camera back to initial position
    updateBrowserTransform(1 - easedProgress);

    if (progress >= 1) {
      stepAnimationComplete = true;
    }
  }

  // Continuously update texture for cursor blinking when typing is done
  const typingSteps = ['typing1', 'typing2', 'typingEmoji', 'typing3', 'typing4'];
  if (typingSteps.includes(step) && stepAnimationComplete) {
    updateBrowserTexture();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
  // Update texture for new viewport size
  updateBrowserTexture();
});

// Handle Space key to advance animation
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    nextStep();
  }
});

// Load Chrome logo SVG
let chromeLogoImage: HTMLImageElement | null = null;
// Load pirate flag image
let pirateFlagImage: HTMLImageElement | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Initialize
async function init() {
  try {
    chromeLogoImage = await loadImage('assets/chrome-logo-8797.svg');
  } catch (e) {
    console.warn('Could not load Chrome logo SVG:', e);
  }
  try {
    pirateFlagImage = await loadImage('assets/pirate-flag-edward.png');
  } catch (e) {
    console.warn('Could not load pirate flag image:', e);
  }
  createBrowserMesh();

  // Run the render loop
  engine.runRenderLoop(() => {
    scene.render();
  });
}

init();
