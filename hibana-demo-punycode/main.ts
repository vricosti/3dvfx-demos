import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Animation state
let animationStarted = false;
let fullscreenProgress = 0;
let typingProgress = 0;
let zoomProgress = 0;
const targetUrl = 'tiéuntigre.fr';
let currentDisplayedUrl = '';

// Camera positions for fullscreen effect
// At z=5, visible height = 2 * 5 * tan(30°) = 5.77, browser (4.5) looks windowed
// At z=3.9, visible height = 4.5, browser fills the screen
const initialCameraZ = 5;
const fullscreenCameraZ = 3.9;

// Create browser frame using canvas texture
function createBrowserTexture(urlText: string = ''): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 1920;
  canvas.height = 1080;

  // Browser window background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Chrome title bar (dark gray)
  const titleBarHeight = 80;
  ctx.fillStyle = '#3c3c3c';
  ctx.fillRect(0, 0, canvas.width, titleBarHeight);

  // Tab
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(20, titleBarHeight);
  ctx.lineTo(40, 15);
  ctx.lineTo(280, 15);
  ctx.lineTo(300, titleBarHeight);
  ctx.closePath();
  ctx.fill();

  // Active tab background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(25, titleBarHeight);
  ctx.lineTo(45, 20);
  ctx.lineTo(275, 20);
  ctx.lineTo(295, titleBarHeight);
  ctx.closePath();
  ctx.fill();

  // Tab title
  ctx.fillStyle = '#333';
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('New Tab', 80, 55);

  // Window controls (right side)
  const controlsY = 35;
  const controlsStartX = canvas.width - 150;

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
  ctx.fillRect(0, addressBarY, canvas.width, addressBarHeight);

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
  const urlBarWidth = canvas.width - 400;
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
  const iconX = canvas.width - 180;

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
  ctx.fillRect(0, bookmarksY, canvas.width, 35);

  ctx.fillStyle = '#5f6368';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Bookmarks', 30, bookmarksY + 24);

  // Main content area (white)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, bookmarksY + 35, canvas.width, canvas.height - bookmarksY - 35);

  // Google logo placeholder in center
  const centerY = (canvas.height + bookmarksY + 35) / 2 - 50;
  ctx.fillStyle = '#4285f4';
  ctx.font = 'bold 120px "Product Sans", Arial, sans-serif';
  ctx.fillText('G', canvas.width / 2 - 180, centerY);
  ctx.fillStyle = '#ea4335';
  ctx.fillText('o', canvas.width / 2 - 100, centerY);
  ctx.fillStyle = '#fbbc05';
  ctx.fillText('o', canvas.width / 2 - 30, centerY);
  ctx.fillStyle = '#4285f4';
  ctx.fillText('g', canvas.width / 2 + 40, centerY);
  ctx.fillStyle = '#34a853';
  ctx.fillText('l', canvas.width / 2 + 110, centerY);
  ctx.fillStyle = '#ea4335';
  ctx.fillText('e', canvas.width / 2 + 140, centerY);

  // Search bar
  const searchBarWidth = 600;
  const searchBarX = (canvas.width - searchBarWidth) / 2;
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

  return canvas;
}

// Create browser mesh
let browserTexture: THREE.CanvasTexture;
let browserMaterial: THREE.MeshBasicMaterial;
let browserMesh: THREE.Mesh;

function createBrowserMesh(): void {
  const canvas = createBrowserTexture(currentDisplayedUrl);
  browserTexture = new THREE.CanvasTexture(canvas);
  browserTexture.minFilter = THREE.LinearFilter;
  browserTexture.magFilter = THREE.LinearFilter;

  browserMaterial = new THREE.MeshBasicMaterial({
    map: browserTexture,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(8, 4.5);
  browserMesh = new THREE.Mesh(geometry, browserMaterial);
  scene.add(browserMesh);

  // Add subtle shadow/depth
  const shadowGeometry = new THREE.PlaneGeometry(8.2, 4.7);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
  });
  const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowMesh.position.z = -0.1;
  scene.add(shadowMesh);
}

function updateBrowserTexture(): void {
  const canvas = createBrowserTexture(currentDisplayedUrl);
  browserTexture.image = canvas;
  browserTexture.needsUpdate = true;
}

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Animation timing
const fullscreenDuration = 800; // 0.8 seconds for fullscreen animation
const fullscreenDelay = 200; // Small delay before fullscreen starts
const typingDuration = 2000; // 2 seconds for typing
const typingDelay = 300; // Delay after fullscreen before typing
const zoomDelay = 500; // Delay before zoom
const zoomDuration = 2500; // 2.5 seconds for zoom
const zoomPauseDuration = 2000; // 2 seconds pause after zoom
const dezoomDuration = 2000; // 2 seconds for dezoom

let animationStartTime = 0;

function animate(): void {
  requestAnimationFrame(animate);

  if (animationStarted) {
    const elapsed = Date.now() - animationStartTime;

    // Fullscreen animation (move camera closer to fill screen)
    const fullscreenStartTime = fullscreenDelay;
    const fullscreenEndTime = fullscreenStartTime + fullscreenDuration;

    if (elapsed > fullscreenStartTime && elapsed < fullscreenEndTime) {
      const fullscreenElapsed = elapsed - fullscreenStartTime;
      fullscreenProgress = Math.min(fullscreenElapsed / fullscreenDuration, 1);
      const easedFullscreen = easeInOutCubic(fullscreenProgress);

      // Move camera from initial position to fullscreen position
      camera.position.z = initialCameraZ + (fullscreenCameraZ - initialCameraZ) * easedFullscreen;
    } else if (elapsed >= fullscreenEndTime && fullscreenProgress < 1) {
      // Ensure we reach fullscreen position
      fullscreenProgress = 1;
      camera.position.z = fullscreenCameraZ;
    }

    // Typing animation (starts after fullscreen completes)
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

    // Zoom animation (starts after typing completes)
    const zoomStartTime = typingEndTime + zoomDelay;
    const zoomEndTime = zoomStartTime + zoomDuration;

    // Zoom target positions
    const zoomEndZ = 1.5;
    const zoomEndY = 1.8;
    const zoomEndX = -2.2;

    if (elapsed > zoomStartTime && elapsed < zoomEndTime) {
      const zoomElapsed = elapsed - zoomStartTime;
      zoomProgress = Math.min(zoomElapsed / zoomDuration, 1);
      const easedZoom = easeInOutCubic(zoomProgress);

      camera.position.z = fullscreenCameraZ + (zoomEndZ - fullscreenCameraZ) * easedZoom;
      camera.position.y = 0 + (zoomEndY - 0) * easedZoom;
      camera.position.x = 0 + (zoomEndX - 0) * easedZoom;

      // Keep looking at the URL area
      camera.lookAt(zoomEndX * easedZoom, zoomEndY * easedZoom, 0);
    } else if (elapsed >= zoomEndTime && elapsed < zoomEndTime + zoomPauseDuration) {
      // Pause at zoomed position
      camera.position.z = zoomEndZ;
      camera.position.y = zoomEndY;
      camera.position.x = zoomEndX;
      camera.lookAt(zoomEndX, zoomEndY, 0);
    }

    // Dezoom animation (starts after pause)
    const dezoomStartTime = zoomEndTime + zoomPauseDuration;
    if (elapsed > dezoomStartTime) {
      const dezoomElapsed = elapsed - dezoomStartTime;
      const dezoomProgress = Math.min(dezoomElapsed / dezoomDuration, 1);
      const easedDezoom = easeInOutCubic(dezoomProgress);

      // Animate from zoomed position back to fullscreen position
      camera.position.z = zoomEndZ + (fullscreenCameraZ - zoomEndZ) * easedDezoom;
      camera.position.y = zoomEndY + (0 - zoomEndY) * easedDezoom;
      camera.position.x = zoomEndX + (0 - zoomEndX) * easedDezoom;

      // Look at center as we dezoom
      camera.lookAt(zoomEndX * (1 - easedDezoom), zoomEndY * (1 - easedDezoom), 0);
    }
  }

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation on click
window.addEventListener('click', () => {
  if (!animationStarted) {
    animationStarted = true;
    animationStartTime = Date.now();
    const infoElement = document.getElementById('info');
    if (infoElement) {
      infoElement.style.opacity = '0';
    }
  }
});

// Also start on key press
window.addEventListener('keydown', () => {
  if (!animationStarted) {
    animationStarted = true;
    animationStartTime = Date.now();
    const infoElement = document.getElementById('info');
    if (infoElement) {
      infoElement.style.opacity = '0';
    }
  }
});

// Initialize
createBrowserMesh();
animate();
