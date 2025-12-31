import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  Color3,
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
const targetUrl = 'tiéuntigre.fr';
let currentDisplayedUrl = '';

// Create browser frame using canvas texture
function createBrowserCanvas(urlText: string = ''): HTMLCanvasElement {
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
  ctx.fillText(urlText, textX, textY);

  // Blinking cursor (if typing)
  if (urlText.length < targetUrl.length && animationStarted) {
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

function updateBrowserTexture(): void {
  const textureContext = browserTexture.getContext();
  const sourceCanvas = createBrowserCanvas(currentDisplayedUrl);
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
const typingDuration = 2000;
const typingDelay = 300;
const zoomDelay = 500;
const zoomDuration = 2500;
const zoomPauseDuration = 2000;
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

    // Typing animation
    const typingStartTime = fullscreenEndTime + typingDelay;
    const typingEndTime = typingStartTime + typingDuration;

    if (elapsed > typingStartTime && elapsed < typingEndTime) {
      const typingElapsed = elapsed - typingStartTime;
      typingProgress = Math.min(typingElapsed / typingDuration, 1);
      const easedProgress = easeOutCubic(typingProgress);
      const charsToShow = Math.floor(easedProgress * targetUrl.length);

      if (currentDisplayedUrl.length !== charsToShow) {
        currentDisplayedUrl = targetUrl.substring(0, charsToShow);
        updateBrowserTexture();
      }
    } else if (elapsed >= typingEndTime && currentDisplayedUrl !== targetUrl) {
      currentDisplayedUrl = targetUrl;
      updateBrowserTexture();
    }

    // Zoom animation (camera moves to focus on URL bar)
    const zoomStartTime = typingEndTime + zoomDelay;
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
    } else if (elapsed >= zoomEndTime && elapsed < zoomEndTime + zoomPauseDuration) {
      camera.position.z = zoomEndZ;
      camera.position.y = zoomEndY;
      camera.position.x = zoomEndX;
      camera.setTarget(new Vector3(zoomEndX, zoomEndY, 0));
    }

    // Dezoom animation
    const dezoomStartTime = zoomEndTime + zoomPauseDuration;
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
