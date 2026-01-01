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

// Get the canvas element
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Create the Babylon.js engine
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color4(0.102, 0.102, 0.18, 1); // #1a1a2e

// Camera positions for fullscreen effect
const initialCameraZ = 5;
const fullscreenCameraZ = 3.9;

// Create camera - positive Z looking at origin
const camera = new FreeCamera('camera', new Vector3(0, 0, initialCameraZ), scene);
camera.setTarget(Vector3.Zero());
camera.fov = (60 * Math.PI) / 180; // 60 degrees in radians

// Animation steps (triggered by Space key)
type AnimationStep = 'idle' | 'fullscreen' | 'zoom' | 'typing1' | 'erasing1' | 'typingEmoji' | 'erasingEmoji' | 'typing2' | 'comparison' | 'returnLetters' | 'dezoom' | 'done';
const animationSteps: AnimationStep[] = ['idle', 'fullscreen', 'zoom', 'typing1', 'erasing1', 'typingEmoji', 'erasingEmoji', 'typing2', 'comparison', 'returnLetters', 'dezoom', 'done'];
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
let comparisonProgress = 0;
let comparisonAnimProgress = 0;
let returnLettersProgress = 0;

// First URL: Chinese characters
const firstUrl = '例子.测试';
// Second URL: Emoji in domain
const emojiUrl = '💪.com';
// Third URL: Cyrillic homograph (а, р, р, ӏ, е are Cyrillic, looks like "apple")
const secondUrl = 'аррӏе.com';

// Cyrillic letters info for comparison animation
const cyrillicLetters = [
  { char: 'а', code: 'U+0430', latin: 'a' },
  { char: 'р', code: 'U+0440', latin: 'p' },
  { char: 'р', code: 'U+0440', latin: 'p' },
  { char: 'ӏ', code: 'U+04CF', latin: 'l' }
];

let currentDisplayedUrl = '';
let currentPhase: 'typing1' | 'pause1' | 'erasing' | 'typing2' | 'pause2' | 'comparison' | 'done' = 'typing1';

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
      currentPhase = 'typing1';
      typingProgress = 0;
    } else if (step === 'erasing1') {
      currentPhase = 'erasing';
      eraseProgress = 0;
    } else if (step === 'typingEmoji') {
      currentDisplayedUrl = '';
      emojiTypingProgress = 0;
    } else if (step === 'erasingEmoji') {
      emojiEraseProgress = 0;
    } else if (step === 'typing2') {
      currentDisplayedUrl = '';
      currentPhase = 'typing2';
      typing2Progress = 0;
    } else if (step === 'comparison') {
      currentPhase = 'comparison';
      comparisonProgress = 0;
      comparisonAnimProgress = 0;
    }

    updateBrowserTexture();
  }
}

// Comparison animation state
type ComparisonState = 'none' | 'animating' | 'full' | 'returnLetters' | 'complete';

// Create browser frame using canvas texture
function createBrowserCanvas(
  urlText: string = '',
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0
): HTMLCanvasElement {
  const canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d')!;
  canvasEl.width = 1920;
  canvasEl.height = 1080;

  // Browser window background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // Chrome title bar (gray)
  const titleBarHeight = 50;
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, canvasEl.width, titleBarHeight);

  // Tab
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(20, titleBarHeight);
  ctx.lineTo(40, 5);
  ctx.lineTo(280, 5);
  ctx.lineTo(300, titleBarHeight);
  ctx.closePath();
  ctx.fill();

  // Active tab background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(25, titleBarHeight);
  ctx.lineTo(45, 10);
  ctx.lineTo(275, 10);
  ctx.lineTo(295, titleBarHeight);
  ctx.closePath();
  ctx.fill();

  // Tab title
  ctx.fillStyle = '#333';
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('New Tab', 80, 38);

  // Window controls (right side)
  const controlsY = 25;
  const controlsStartX = canvasEl.width - 150;

  // Minimize
  ctx.fillStyle = '#888';
  ctx.fillRect(controlsStartX, controlsY, 20, 3);

  // Maximize
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(controlsStartX + 40, controlsY - 8, 16, 16);

  // Close (X)
  ctx.beginPath();
  ctx.moveTo(controlsStartX + 80, controlsY - 8);
  ctx.lineTo(controlsStartX + 96, controlsY + 8);
  ctx.moveTo(controlsStartX + 96, controlsY - 8);
  ctx.lineTo(controlsStartX + 80, controlsY + 8);
  ctx.stroke();

  // Address bar area
  const addressBarY = titleBarHeight;
  const addressBarHeight = 60;
  ctx.fillStyle = '#f1f3f4';
  ctx.fillRect(0, addressBarY, canvasEl.width, addressBarHeight);

  // Navigation buttons
  const navY = addressBarY + 20;
  ctx.fillStyle = '#5f6368';

  // Back arrow
  ctx.beginPath();
  ctx.moveTo(50, navY + 10);
  ctx.lineTo(35, navY);
  ctx.lineTo(50, navY - 10);
  ctx.stroke();

  // Forward arrow
  ctx.beginPath();
  ctx.moveTo(80, navY - 10);
  ctx.lineTo(95, navY);
  ctx.lineTo(80, navY + 10);
  ctx.stroke();

  // Refresh
  ctx.beginPath();
  ctx.arc(135, navY, 12, 0, Math.PI * 1.7);
  ctx.stroke();

  // Address bar (rounded rectangle)
  const urlBarX = 180;
  const urlBarY = addressBarY + 10;
  const urlBarWidth = canvasEl.width - 400;
  const urlBarHeight = 40;
  const radius = 20;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(urlBarX + radius, urlBarY);
  ctx.lineTo(urlBarX + urlBarWidth - radius, urlBarY);
  ctx.quadraticCurveTo(urlBarX + urlBarWidth, urlBarY, urlBarX + urlBarWidth, urlBarY + radius);
  ctx.lineTo(urlBarX + urlBarWidth, urlBarY + urlBarHeight - radius);
  ctx.quadraticCurveTo(urlBarX + urlBarWidth, urlBarY + urlBarHeight, urlBarX + urlBarWidth - radius, urlBarY + urlBarHeight);
  ctx.lineTo(urlBarX + radius, urlBarY + urlBarHeight);
  ctx.quadraticCurveTo(urlBarX, urlBarY + urlBarHeight, urlBarX, urlBarY + urlBarHeight - radius);
  ctx.lineTo(urlBarX, urlBarY + radius);
  ctx.quadraticCurveTo(urlBarX, urlBarY, urlBarX + radius, urlBarY);
  ctx.closePath();
  ctx.fill();

  // Lock icon (simplified)
  ctx.fillStyle = '#5f6368';
  ctx.beginPath();
  ctx.arc(210, urlBarY + 20, 6, Math.PI, 0);
  ctx.rect(204, urlBarY + 14, 12, 12);
  ctx.fill();

  // URL text with typing cursor
  ctx.fillStyle = '#202124';
  ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  const textX = 240;
  const textY = urlBarY + 30;

  // Store values for comparison drawing later (after all UI elements)
  let comparisonData: { letterPositions: number[]; letterWidths: number[] } | null = null;

  if (showComparison && urlText === secondUrl) {
    // In comparison mode, draw URL with gaps for the 4 Cyrillic letters (а, р, р, ӏ)
    // URL is "аррӏе.com" - first 4 chars are Cyrillic, rest is "е.com"
    const afterCyrillic = urlText.substring(4); // "е.com"

    // Calculate positions for each letter
    const letterPositions: number[] = [];
    const letterWidths: number[] = [];
    let currentX = textX;

    for (let i = 0; i < 4; i++) {
      letterPositions.push(currentX);
      const charWidth = ctx.measureText(cyrillicLetters[i].char).width;
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

  // Blinking cursor (if typing or erasing)
  const step = getCurrentStep();
  if (step !== 'idle' && (step === 'typing1' || step === 'typing2' || step === 'typingEmoji' || step === 'erasing1' || step === 'erasingEmoji')) {
    const textWidth = ctx.measureText(urlText).width;
    ctx.fillStyle = '#202124';
    ctx.fillRect(textX + textWidth + 2, urlBarY + 10, 2, 24);
  }

  // Browser icons on the right
  ctx.fillStyle = '#5f6368';
  const iconX = canvasEl.width - 180;

  // Extensions icon
  ctx.beginPath();
  ctx.arc(iconX, navY, 3, 0, Math.PI * 2);
  ctx.arc(iconX + 10, navY, 3, 0, Math.PI * 2);
  ctx.arc(iconX + 5, navY - 8, 3, 0, Math.PI * 2);
  ctx.arc(iconX + 5, navY + 8, 3, 0, Math.PI * 2);
  ctx.fill();

  // Profile icon
  ctx.beginPath();
  ctx.arc(iconX + 50, navY - 5, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(iconX + 50, navY + 15, 12, Math.PI * 1.2, Math.PI * 1.8);
  ctx.fill();

  // Menu dots
  ctx.beginPath();
  ctx.arc(iconX + 100, navY - 8, 3, 0, Math.PI * 2);
  ctx.arc(iconX + 100, navY, 3, 0, Math.PI * 2);
  ctx.arc(iconX + 100, navY + 8, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bookmarks bar
  const bookmarksY = addressBarY + addressBarHeight;
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, bookmarksY, canvasEl.width, 35);

  ctx.fillStyle = '#5f6368';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Bookmarks', 30, bookmarksY + 24);

  // Main content area (white)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, bookmarksY + 35, canvasEl.width, canvasEl.height - bookmarksY - 35);

  // Google logo placeholder in center
  const centerY = (canvasEl.height + bookmarksY + 35) / 2 - 50;
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

  ctx.strokeStyle = '#dfe1e5';
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

    // Comparison display area (in the white content area)
    const bookmarksEndY = titleBarHeight + addressBarHeight + 35;
    const comparisonBaseY = bookmarksEndY + 60;
    const rowHeight = 45;

    // Draw each of the 4 Cyrillic letters
    for (let i = 0; i < 4; i++) {
      const letter = cyrillicLetters[i];
      const letterX = letterPositions[i];
      const targetY = comparisonBaseY + i * rowHeight;

      // Calculate letter Y position based on state
      let currentLetterY: number;
      if (comparisonState === 'returnLetters') {
        // Animate back from comparison position to URL position
        currentLetterY = targetY - (targetY - textY) * reverseProgress;
      } else {
        currentLetterY = textY + (targetY - textY) * animProgress;
      }

      // Draw the animated letter
      if (comparisonState !== 'complete') {
        // Transition font size and color when returning
        if (comparisonState === 'returnLetters') {
          const fontSize = 28 - (28 - 26) * reverseProgress;
          const fontWeight = reverseProgress > 0.5 ? 'normal' : 'bold';
          ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

          // Fade red to black as it returns
          const redValue = Math.floor(229 - (229 - 32) * reverseProgress);
          const greenValue = Math.floor(57 - (57 - 33) * reverseProgress);
          const blueValue = Math.floor(53 - (53 - 36) * reverseProgress);
          ctx.fillStyle = `rgb(${redValue}, ${greenValue}, ${blueValue})`;
        } else {
          ctx.fillStyle = '#e53935'; // Red for Cyrillic
          ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        }
        ctx.fillText(letter.char, letterX, currentLetterY);
      }

      // Show arrow and label when animation is complete
      if (animProgress >= 1 && comparisonState !== 'returnLetters' && comparisonState !== 'complete') {
        const arrowStartX = letterX + letterWidths[i] + 10;
        const arrowLength = 30;
        const labelX = arrowStartX + arrowLength + 10;

        // Draw arrow
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(arrowStartX, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 6, targetY - 14);
        ctx.moveTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 6, targetY - 2);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#e53935';
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText(`${letter.char} cyrillique (${letter.code})`, labelX, targetY - 3);
      }
    }
  }

  return canvasEl;
}

// Create browser mesh
let browserTexture: DynamicTexture;
let browserMaterial: StandardMaterial;
let browserMesh: Mesh;

function createBrowserMesh(): void {
  // Create dynamic texture from canvas
  browserTexture = new DynamicTexture('browserTexture', { width: 1920, height: 1080 }, scene, true);
  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl);
  textureContext.drawImage(sourceCanvas, 0, 0);
  browserTexture.update();

  // Create material
  browserMaterial = new StandardMaterial('browserMaterial', scene);
  browserMaterial.diffuseTexture = browserTexture;
  browserMaterial.emissiveTexture = browserTexture; // Make it visible without lights
  browserMaterial.backFaceCulling = false;
  browserMaterial.disableLighting = true;

  // Create browser plane - sideOrientation DOUBLESIDE to be visible from both sides
  browserMesh = MeshBuilder.CreatePlane('browser', {
    width: 8,
    height: 4.5,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  browserMesh.material = browserMaterial;
  browserMesh.scaling.x = -1; // Flip horizontally
}

function updateBrowserTexture(
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0
): void {
  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl, showComparison, animProgress, comparisonState, reverseProgress);
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
const eraseDuration = 800;
const emojiTypingDuration = 1500;
const emojiEraseDuration = 800;
const typing2Duration = 2500;
const comparisonDuration = 1000;
const returnLettersDuration = 1000;
const dezoomDuration = 2000;

// Zoom target positions
const zoomEndZ = 1.5;
const zoomEndY = 1.8;
const zoomEndX = 2.2;

// Animation loop - step based
scene.registerBeforeRender(() => {
  const step = getCurrentStep();
  const elapsed = Date.now() - stepStartTime;

  if (step === 'idle') {
    // Waiting for first Space press
    return;
  }

  if (step === 'fullscreen') {
    const progress = Math.min(elapsed / fullscreenDuration, 1);
    fullscreenProgress = easeInOutCubic(progress);
    camera.position.z = initialCameraZ + (fullscreenCameraZ - initialCameraZ) * fullscreenProgress;

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'zoom') {
    const progress = Math.min(elapsed / zoomDuration, 1);
    zoomProgress = easeInOutCubic(progress);

    camera.position.z = fullscreenCameraZ + (zoomEndZ - fullscreenCameraZ) * zoomProgress;
    camera.position.y = zoomEndY * zoomProgress;
    camera.position.x = zoomEndX * zoomProgress;
    camera.setTarget(new Vector3(zoomEndX * zoomProgress, zoomEndY * zoomProgress, 0));

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

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

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

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

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

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

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

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

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

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

    if (progress >= 1) {
      currentDisplayedUrl = secondUrl;
      currentPhase = 'pause2';
      updateBrowserTexture();
      stepAnimationComplete = true;
    }
  }

  if (step === 'comparison') {
    currentPhase = 'comparison';
    const progress = Math.min(elapsed / comparisonDuration, 1);
    comparisonProgress = progress;
    comparisonAnimProgress = easeOutCubic(progress);
    updateBrowserTexture(true, comparisonAnimProgress, progress >= 1 ? 'full' : 'animating', 0);

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'returnLetters') {
    const progress = Math.min(elapsed / returnLettersDuration, 1);
    returnLettersProgress = easeInOutCubic(progress);
    updateBrowserTexture(true, 1, 'returnLetters', returnLettersProgress);

    // Keep camera at zoom position
    camera.position.z = zoomEndZ;
    camera.position.y = zoomEndY;
    camera.position.x = zoomEndX;
    camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'dezoom') {
    const progress = Math.min(elapsed / dezoomDuration, 1);
    const easedProgress = easeInOutCubic(progress);

    camera.position.z = zoomEndZ + (fullscreenCameraZ - zoomEndZ) * easedProgress;
    camera.position.y = zoomEndY * (1 - easedProgress);
    camera.position.x = zoomEndX * (1 - easedProgress);
    camera.setTarget(new Vector3(
      zoomEndX * (1 - easedProgress),
      zoomEndY * (1 - easedProgress),
      0
    ));

    // Show complete URL (letter is back in place)
    updateBrowserTexture(false, 0, 'complete', 1);

    if (progress >= 1) {
      currentPhase = 'done';
      stepAnimationComplete = true;
    }
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});

// Handle Space key to advance animation
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    nextStep();

    // Hide info on first press
    const infoElement = document.getElementById('info');
    if (infoElement) {
      infoElement.style.opacity = '0';
    }
  }
});

// Initialize
createBrowserMesh();

// Run the render loop
engine.runRenderLoop(() => {
  scene.render();
});
