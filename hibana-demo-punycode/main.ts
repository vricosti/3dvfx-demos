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

// Cyrillic letters info for comparison animation (grouped)
const cyrillicLettersGrouped = [
  { chars: 'а', code: 'U+0430', indices: [0], label: 'а' },
  { chars: 'рр', code: 'U+0440', indices: [1, 2], label: 'р' },
  { chars: 'ӏ', code: 'U+04CF', indices: [3], label: 'ӏ' }
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

// Create browser frame using canvas texture (Chrome macOS dark theme)
function createBrowserCanvas(
  urlText: string = '',
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0,
  canvasHeight: number = 1080
): HTMLCanvasElement {
  const canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d')!;
  canvasEl.width = 1920;
  canvasEl.height = canvasHeight;

  // Colors from Chrome dark theme
  const tabBarBg = '#1f2020';      // Tab bar background (with traffic lights)
  const tabActiveBg = '#3c3c3c';   // Active tab background
  const addressBarBg = '#3c3c3c';  // Address bar area background
  const urlFieldBg = '#202124';    // URL input field background
  const textColor = '#e8eaed';
  const textColorMuted = '#9aa0a6';
  const iconColor = '#9aa0a6';

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

  // Chrome icon in tab (aligned with traffic lights)
  const chromeIconX = tabStartX + 16;
  const chromeIconY = trafficLightY;
  ctx.fillStyle = '#4285f4';
  ctx.beginPath();
  ctx.arc(chromeIconX, chromeIconY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ea4335';
  ctx.beginPath();
  ctx.arc(chromeIconX, chromeIconY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbc05';
  ctx.beginPath();
  ctx.arc(chromeIconX, chromeIconY, 3, 0, Math.PI * 2);
  ctx.fill();

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

  // Blinking cursor (if typing or erasing)
  const step = getCurrentStep();
  if (step !== 'idle' && (step === 'typing1' || step === 'typing2' || step === 'typingEmoji' || step === 'erasing1' || step === 'erasingEmoji')) {
    const textWidth = ctx.measureText(urlText).width;
    ctx.fillStyle = textColor;
    ctx.fillRect(textX + textWidth + 2, urlBarY + 8, 2, 20);
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

  // Main content area (white)
  ctx.fillStyle = '#ffffff';
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
        ctx.fillText(group.chars, currentLetterX, currentLetterY);
      }

      // Show arrow and label when animation is complete
      if (animProgress >= 1 && comparisonState !== 'returnLetters' && comparisonState !== 'complete') {
        const arrowStartX = alignX + groupWidth + 15;
        const arrowLength = 25;
        const labelX = arrowStartX + arrowLength + 8;

        // Draw arrow pointing right
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(arrowStartX, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 5, targetY - 13);
        ctx.moveTo(arrowStartX + arrowLength, targetY - 8);
        ctx.lineTo(arrowStartX + arrowLength - 5, targetY - 3);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#e53935';
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText(`${group.label} cyrillique (${group.code})`, labelX, targetY - 4);
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

let currentTextureHeight = 1080;

function updateBrowserTexture(
  showComparison: boolean = false,
  animProgress: number = 0,
  comparisonState: ComparisonState = 'none',
  reverseProgress: number = 0
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
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl, showComparison, animProgress, comparisonState, reverseProgress, targetHeight);
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

    // Keep camera at zoomed position
    updateBrowserTransform(1);

    if (progress >= 1) stepAnimationComplete = true;
  }

  if (step === 'returnLetters') {
    const progress = Math.min(elapsed / returnLettersDuration, 1);
    returnLettersProgress = easeInOutCubic(progress);
    updateBrowserTexture(true, 1, 'returnLetters', returnLettersProgress);

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
      currentPhase = 'done';
      stepAnimationComplete = true;
    }
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
