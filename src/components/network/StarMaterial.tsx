"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Custom shader material for transparent bubbles with red-yellow-blue gradient
export function StarMaterial({
  emissiveIntensity = 0.6,
  highlightIntensity = 0.0,
}: {
  emissiveIntensity?: number;
  highlightIntensity?: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uEmissiveIntensity: { value: emissiveIntensity },
      uHighlightIntensity: { value: highlightIntensity },
    }),
    [emissiveIntensity, highlightIntensity]
  );

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uEmissiveIntensity.value = emissiveIntensity;
      materialRef.current.uniforms.uHighlightIntensity.value = highlightIntensity;
    }
  }, [emissiveIntensity, highlightIntensity]);

  const vertexShader = `
    attribute float instanceOpacity;
    
    varying float vOpacity;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    
    void main() {
      vOpacity = instanceOpacity;
      vNormal = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uEmissiveIntensity;
    uniform float uHighlightIntensity;
    
    varying float vOpacity;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    
    void main() {
      // Red to Yellow to Blue gradient based on normal
      vec3 gradientDir = normalize(vec3(1.0, 1.0, 1.0));
      float gradientFactor = dot(normalize(vNormal), gradientDir) * 0.5 + 0.5;
      
      vec3 red = vec3(1.0, 0.2, 0.2);
      vec3 yellow = vec3(1.0, 0.95, 0.3);
      vec3 blue = vec3(0.3, 0.5, 1.0);
      
      vec3 gradientColor;
      if (gradientFactor < 0.5) {
        gradientColor = mix(red, yellow, gradientFactor * 2.0);
      } else {
        gradientColor = mix(yellow, blue, (gradientFactor - 0.5) * 2.0);
      }
      
      // Fresnel glow
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - dot(viewDir, normalize(vNormal)), 2.0);
      vec3 glow = gradientColor * uEmissiveIntensity * (1.0 + fresnel * 2.0);
      glow += gradientColor * uHighlightIntensity;
      
      vec3 finalColor = gradientColor + glow;
      float finalOpacity = vOpacity;
      
      gl_FragColor = vec4(finalColor, finalOpacity);
    }
  `;

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent={true}
      side={THREE.DoubleSide}
    />
  );
}
