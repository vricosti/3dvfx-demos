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

// Animation state
let animationStarted = false;
let fullscreenProgress = 0;
let typingProgress = 0;
let zoomProgress = 0;
let eraseProgress = 0;
let typing2Progress = 0;
let comparisonProgress = 0;

// First URL: Chinese characters
const firstUrl = '例子.测试';
// Second URL: Cyrillic homograph (а, р, р, ӏ, е are Cyrillic, looks like "apple")
const secondUrl = 'аррӏе.com';
// The Cyrillic "l" character (palochka)
const cyrillicL = 'ӏ';
const latinL = 'l';
let currentDisplayedUrl = '';
let currentPhase: 'typing1' | 'pause1' | 'erasing' | 'typing2' | 'pause2' | 'comparison' | 'done' = 'typing1';
let comparisonAnimProgress = 0; // 0 to 1 for the letter moving out animation

// Create browser frame using canvas texture
function createBrowserCanvas(urlText: string = '', showComparison: boolean = false, animProgress: number = 0): HTMLCanvasElement {
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
  let comparisonData: { beforeWidth: number; lWidth: number; animatedLX: number } | null = null;

  if (showComparison && urlText === secondUrl) {
    // In comparison mode, draw URL with gap (letter will be drawn later on top)
    const beforeL = urlText.substring(0, 3); // "арр"
    const afterL = urlText.substring(4); // "е.com"

    const beforeWidth = ctx.measureText(beforeL).width;
    const lWidth = ctx.measureText(cyrillicL).width;

    // Draw text before the L
    ctx.fillText(beforeL, textX, textY);

    // Draw text after the L (with gap)
    ctx.fillText(afterL, textX + beforeWidth + lWidth, textY);

    // Store for later drawing
    comparisonData = { beforeWidth, lWidth, animatedLX: textX + beforeWidth };
  } else {
    // Normal mode: just draw the URL
    ctx.fillText(urlText, textX, textY);
  }

  // Blinking cursor (if typing or erasing)
  if (animationStarted && currentPhase !== 'done' && currentPhase !== 'pause1' && currentPhase !== 'pause2' && currentPhase !== 'comparison') {
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
    const { animatedLX } = comparisonData;

    // Comparison display area (in the white content area)
    const bookmarksEndY = titleBarHeight + addressBarHeight + 35;
    const comparisonStartY = bookmarksEndY + 80;
    const letterMoveDistance = comparisonStartY - textY;
    const currentLetterY = textY + letterMoveDistance * animProgress;

    // Draw the animated Cyrillic L
    ctx.fillStyle = '#e53935'; // Red for Cyrillic
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(cyrillicL, animatedLX, currentLetterY);

    // Once animation is complete, show the comparison labels
    if (animProgress >= 1) {
      const labelX = animatedLX + 60;
      const arrowLength = 40;

      // First row: Cyrillic L with arrow and label
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(animatedLX + 20, comparisonStartY - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength, comparisonStartY - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength - 8, comparisonStartY - 16);
      ctx.moveTo(animatedLX + 20 + arrowLength, comparisonStartY - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength - 8, comparisonStartY - 4);
      ctx.stroke();

      ctx.fillStyle = '#e53935';
      ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillText('ӏ cyrillique (U+04CF)', labelX + 20, comparisonStartY - 4);

      // Second row: Latin L with arrow and label
      const row2Y = comparisonStartY + 50;
      ctx.fillStyle = '#1e88e5'; // Blue for Latin
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillText(latinL, animatedLX, row2Y);

      ctx.strokeStyle = '#1e88e5';
      ctx.beginPath();
      ctx.moveTo(animatedLX + 20, row2Y - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength, row2Y - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength - 8, row2Y - 16);
      ctx.moveTo(animatedLX + 20 + arrowLength, row2Y - 10);
      ctx.lineTo(animatedLX + 20 + arrowLength - 8, row2Y - 4);
      ctx.stroke();

      ctx.fillStyle = '#1e88e5';
      ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillText('l standard (U+006C)', labelX + 20, row2Y - 4);
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

function updateBrowserTexture(showComparison: boolean = false, animProgress: number = 0): void {
  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl, showComparison, animProgress);
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

// Animation timing
const fullscreenDuration = 800;
const fullscreenDelay = 200;
const typing1Duration = 2500;  // Typing first URL (Chinese)
const pause1Duration = 2000;   // Pause to show first URL
const eraseDuration = 800;     // Erasing first URL
const typing2Duration = 2500;  // Typing second URL (Cyrillic)
const pause2Duration = 1000;   // Pause before comparison
const comparisonDuration = 1000; // Letter moving out animation
const comparisonHoldDuration = 3000; // Hold comparison display
const typingDelay = 300;
const zoomDelay = 500;
const zoomDuration = 2500;
const dezoomDuration = 2000;

let animationStartTime = 0;

// Animation loop
scene.registerBeforeRender(() => {
  if (animationStarted) {
    const elapsed = Date.now() - animationStartTime;

    // Fullscreen animation (move camera closer to fill screen)
    const fullscreenStartTime = fullscreenDelay;
    const fullscreenEndTime = fullscreenStartTime + fullscreenDuration;

    if (elapsed > fullscreenStartTime && elapsed < fullscreenEndTime) {
      const fullscreenElapsed = elapsed - fullscreenStartTime;
      fullscreenProgress = Math.min(fullscreenElapsed / fullscreenDuration, 1);
      const easedFullscreen = easeInOutCubic(fullscreenProgress);

      // Move camera closer to simulate fullscreen
      camera.position.z = initialCameraZ + (fullscreenCameraZ - initialCameraZ) * easedFullscreen;
    } else if (elapsed >= fullscreenEndTime && fullscreenProgress < 1) {
      fullscreenProgress = 1;
      camera.position.z = fullscreenCameraZ;
    }

    // Zoom animation (camera moves to focus on URL bar) - starts after fullscreen
    const zoomStartTime = fullscreenEndTime + zoomDelay;
    const zoomEndTime = zoomStartTime + zoomDuration;

    // Zoom target positions (X is positive because browser is flipped)
    const zoomEndZ = 1.5;
    const zoomEndY = 1.8;
    const zoomEndX = 2.2;

    if (elapsed > zoomStartTime && elapsed < zoomEndTime) {
      const zoomElapsed = elapsed - zoomStartTime;
      zoomProgress = Math.min(zoomElapsed / zoomDuration, 1);
      const easedZoom = easeInOutCubic(zoomProgress);

      camera.position.z = fullscreenCameraZ + (zoomEndZ - fullscreenCameraZ) * easedZoom;
      camera.position.y = 0 + zoomEndY * easedZoom;
      camera.position.x = 0 + zoomEndX * easedZoom;

      camera.setTarget(new Vector3(zoomEndX * easedZoom, zoomEndY * easedZoom, 0));
    }

    // Phase 1: Type first URL (Chinese characters)
    const typing1StartTime = zoomEndTime + typingDelay;
    const typing1EndTime = typing1StartTime + typing1Duration;

    if (elapsed > typing1StartTime && elapsed < typing1EndTime) {
      currentPhase = 'typing1';
      const typing1Elapsed = elapsed - typing1StartTime;
      typingProgress = Math.min(typing1Elapsed / typing1Duration, 1);
      const easedProgress = easeOutCubic(typingProgress);
      const charsToShow = Math.floor(easedProgress * firstUrl.length);

      if (currentDisplayedUrl.length !== charsToShow) {
        currentDisplayedUrl = firstUrl.substring(0, charsToShow);
        updateBrowserTexture();
      }
    } else if (elapsed >= typing1EndTime && currentPhase === 'typing1') {
      currentDisplayedUrl = firstUrl;
      currentPhase = 'pause1';
      updateBrowserTexture();
    }

    // Phase 2: Pause to show first URL
    const pause1EndTime = typing1EndTime + pause1Duration;

    // Phase 3: Erase first URL
    const eraseStartTime = pause1EndTime;
    const eraseEndTime = eraseStartTime + eraseDuration;

    if (elapsed > eraseStartTime && elapsed < eraseEndTime) {
      currentPhase = 'erasing';
      const eraseElapsed = elapsed - eraseStartTime;
      eraseProgress = Math.min(eraseElapsed / eraseDuration, 1);
      const easedProgress = easeOutCubic(eraseProgress);
      const charsToShow = Math.floor((1 - easedProgress) * firstUrl.length);

      if (currentDisplayedUrl.length !== charsToShow) {
        currentDisplayedUrl = firstUrl.substring(0, charsToShow);
        updateBrowserTexture();
      }
    } else if (elapsed >= eraseEndTime && currentPhase === 'erasing') {
      currentDisplayedUrl = '';
      currentPhase = 'typing2';
      updateBrowserTexture();
    }

    // Phase 4: Type second URL (Cyrillic homograph)
    const typing2StartTime = eraseEndTime;
    const typing2EndTime = typing2StartTime + typing2Duration;

    if (elapsed > typing2StartTime && elapsed < typing2EndTime) {
      currentPhase = 'typing2';
      const typing2Elapsed = elapsed - typing2StartTime;
      typing2Progress = Math.min(typing2Elapsed / typing2Duration, 1);
      const easedProgress = easeOutCubic(typing2Progress);
      const charsToShow = Math.floor(easedProgress * secondUrl.length);

      if (currentDisplayedUrl.length !== charsToShow) {
        currentDisplayedUrl = secondUrl.substring(0, charsToShow);
        updateBrowserTexture();
      }
    } else if (elapsed >= typing2EndTime && currentPhase === 'typing2') {
      currentDisplayedUrl = secondUrl;
      currentPhase = 'pause2';
      updateBrowserTexture();
    }

    // Phase 5: Pause before comparison
    const pause2EndTime = typing2EndTime + pause2Duration;

    // Phase 6: Comparison animation (letter moving out)
    const comparisonStartTime = pause2EndTime;
    const comparisonEndTime = comparisonStartTime + comparisonDuration;
    const comparisonHoldEndTime = comparisonEndTime + comparisonHoldDuration;

    if (elapsed > comparisonStartTime && elapsed < comparisonEndTime) {
      currentPhase = 'comparison';
      const compElapsed = elapsed - comparisonStartTime;
      comparisonProgress = Math.min(compElapsed / comparisonDuration, 1);
      comparisonAnimProgress = easeOutCubic(comparisonProgress);
      updateBrowserTexture(true, comparisonAnimProgress);
    } else if (elapsed >= comparisonEndTime && elapsed < comparisonHoldEndTime) {
      currentPhase = 'comparison';
      comparisonAnimProgress = 1;
      updateBrowserTexture(true, 1);
    } else if (elapsed >= comparisonHoldEndTime && currentPhase === 'comparison') {
      currentPhase = 'done';
    }

    // Dezoom animation - starts after comparison hold
    const dezoomStartTime = comparisonHoldEndTime;

    // Keep camera at zoomed position until dezoom starts
    if (elapsed >= zoomEndTime && elapsed <= dezoomStartTime) {
      camera.position.z = zoomEndZ;
      camera.position.y = zoomEndY;
      camera.position.x = zoomEndX;
      camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));
    }

    if (elapsed > dezoomStartTime) {
      const dezoomElapsed = elapsed - dezoomStartTime;
      const dezoomProgress = Math.min(dezoomElapsed / dezoomDuration, 1);
      const easedDezoom = easeInOutCubic(dezoomProgress);

      camera.position.z = zoomEndZ + (fullscreenCameraZ - zoomEndZ) * easedDezoom;
      camera.position.y = zoomEndY * (1 - easedDezoom);
      camera.position.x = zoomEndX * (1 - easedDezoom);

      camera.setTarget(new Vector3(
        zoomEndX * (1 - easedDezoom),
        zoomEndY * (1 - easedDezoom),
        0
      ));
    }
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});

// Auto-start animation after 1 second
setTimeout(() => {
  animationStarted = true;
  animationStartTime = Date.now();
  const infoElement = document.getElementById('info');
  if (infoElement) {
    infoElement.style.opacity = '0';
  }
}, 1000);

// Initialize
createBrowserMesh();

// Run the render loop
engine.runRenderLoop(() => {
  scene.render();
});
