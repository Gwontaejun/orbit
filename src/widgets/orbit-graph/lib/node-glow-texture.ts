import * as THREE from 'three';

let sharedNodeGlowTexture: THREE.CanvasTexture | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sharedNodeGlowTexture?.dispose();
    sharedNodeGlowTexture = null;
  });
}

export function getNodeGlowTexture() {
  if (sharedNodeGlowTexture) return sharedNodeGlowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
  gradient.addColorStop(0.22, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(0.58, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  sharedNodeGlowTexture = new THREE.CanvasTexture(canvas);
  return sharedNodeGlowTexture;
}
