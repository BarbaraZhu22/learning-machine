"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Custom shader material for star nodes with emissive glow
export function StarMaterial({
  emissiveIntensity = 0.6,
  opacity = 0.85,
  highlightIntensity = 0.0,
}: {
  emissiveIntensity?: number;
  opacity?: number;
  highlightIntensity?: number;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    if (!materialRef.current) return;
    const material = materialRef.current;

    // Use onBeforeCompile to inject custom glow effect
    material.onBeforeCompile = (shader: THREE.Shader) => {
      // Add custom uniforms
      shader.uniforms.uEmissiveIntensity = { value: emissiveIntensity };
      shader.uniforms.uOpacity = { value: opacity };
      shader.uniforms.uHighlightIntensity = { value: highlightIntensity };

      // Inject custom fragment code before output
      const customFragment = `
        // Star glow effect
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 worldNormal = normalize(vNormal);
        float fresnel = pow(1.0 - dot(viewDirection, worldNormal), 2.0);
        
        // Enhanced emissive with fresnel glow
        vec3 emissiveGlow = (emissive + vColor) * uEmissiveIntensity * (1.0 + fresnel * 2.0);
        emissiveGlow += vColor * uHighlightIntensity;
        
        totalEmissiveRadiance += emissiveGlow;
      `;

      // Find where to inject our code (before output_fragment)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        customFragment + "\n#include <output_fragment>"
      );

      // Modify opacity
      shader.fragmentShader = shader.fragmentShader.replace(
        /gl_FragColor = vec4\(([^)]+)\);/g,
        "gl_FragColor = vec4($1) * uOpacity;"
      );
    };

    return () => {
      if (material) {
        material.onBeforeCompile = null;
      }
    };
  }, [emissiveIntensity, opacity, highlightIntensity]);

  // Update uniforms when values change
  useEffect(() => {
    if (!materialRef.current || !materialRef.current.userData.shader) return;
    const shader = materialRef.current.userData.shader;
    if (shader.uniforms) {
      shader.uniforms.uEmissiveIntensity.value = emissiveIntensity;
      shader.uniforms.uOpacity.value = opacity;
      shader.uniforms.uHighlightIntensity.value = highlightIntensity;
    }
  }, [emissiveIntensity, opacity, highlightIntensity]);

  return (
    <meshStandardMaterial
      ref={materialRef}
      emissiveIntensity={emissiveIntensity}
      opacity={opacity}
      transparent={true}
    />
  );
}
