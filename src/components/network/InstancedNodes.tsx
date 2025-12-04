"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { StarMaterial } from "./StarMaterial";
import { Node } from "./vocabularyUtils";

interface InstancedNodesProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  learnedNodes?: Set<string>;
}

const DEFAULT_OPACITY = 0.2; // Transparent bubble effect

export function InstancedNodes({
  nodes,
  selectedNodeId,
  onNodeClick,
  learnedNodes = new Set(),
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  // Create opacity attribute for transparent bubbles
  useEffect(() => {
    if (!geometryRef.current) return;

    const opacityArray = new Float32Array(nodes.length);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isSelected = selectedNodeId === node.id;
      const isLearned = learnedNodes.has(node.id);
      
      opacityArray[i] = isSelected || isLearned ? 1.0 : DEFAULT_OPACITY;
    }

    const opacityAttribute = new THREE.InstancedBufferAttribute(opacityArray, 1);
    geometryRef.current.setAttribute("instanceOpacity", opacityAttribute);
    opacityAttribute.needsUpdate = true;
  }, [nodes, selectedNodeId, learnedNodes]);

  useEffect(() => {
    if (!meshRef.current) return;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      tempObject.position.copy(node.position);
      tempObject.scale.setScalar(node.size);
      tempObject.updateMatrix();

      meshRef.current!.setMatrixAt(i, tempObject.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [nodes, tempObject]);

  const handleClick = (event: any) => {
    if (!meshRef.current) return;
    const instanceId = event.instanceId;
    if (instanceId !== undefined && instanceId < nodes.length) {
      onNodeClick(nodes[instanceId].id);
    }
  };

  if (nodes.length === 0) return null;

  // Determine highlight intensity based on selection
  const hasSelection = selectedNodeId !== null;
  const highlightIntensity = hasSelection ? 1.5 : 0.0;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <sphereGeometry
        ref={geometryRef}
        args={[1, 16, 16]}
      />
      <StarMaterial
        emissiveIntensity={0.6}
        highlightIntensity={highlightIntensity}
      />
    </instancedMesh>
  );
}
