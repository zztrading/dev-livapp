// ============================================
// WEBGL CONTEXT RECOVERY
// Prevents flash when the WebGL context is lost
// (common on mobile / iframe previews with low VRAM).
//
// Strategy:
// 1. Listen to "webglcontextlost" on the canvas and call
//    event.preventDefault() — this is REQUIRED by the spec
//    for the browser to attempt automatic restoration.
//    Without it, the context stays dead and R3F unmounts/
//    remounts the scene, causing a visible flash.
// 2. On "webglcontextrestored", ask R3F to invalidate so
//    the next frame is rendered seamlessly.
// ============================================

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function WebGLContextRecovery() {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleLost = (event: Event) => {
      // CRITICAL: preventDefault keeps the context recoverable
      event.preventDefault();
      if (import.meta.env.DEV) {
        console.warn('[WebGL] Context lost — preventing default to allow restoration.');
      }
    };

    const handleRestored = () => {
      if (import.meta.env.DEV) {
        console.info('[WebGL] Context restored — invalidating frame.');
      }
      // Force a fresh render after the GPU returns
      invalidate();
    };

    canvas.addEventListener('webglcontextlost', handleLost, false);
    canvas.addEventListener('webglcontextrestored', handleRestored, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, invalidate]);

  return null;
}
