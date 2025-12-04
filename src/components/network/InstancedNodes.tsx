"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { StarMaterial } from "./StarMaterial";
import { Node, getNodeColor } from "./vocabularyUtils";

interface InstancedNodesProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

export function InstancedNodes({
  nodes,
  selectedNodeId,
  onNodeClick,
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isSelected = selectedNodeId === node.id;

      tempObject.position.copy(node.position);
      tempObject.scale.setScalar(node.size);
      tempObject.updateMatrix();

      meshRef.current!.setMatrixAt(i, tempObject.matrix);

      // Set color - gold for selected, normal color for others
      const color = isSelected
        ? new THREE.Color(0xffd700)
        : new THREE.Color(getNodeColor(node.linkCount));
      meshRef.current!.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodes, selectedNodeId, tempObject]);

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
      <sphereGeometry args={[1, 16, 16]} />
      <StarMaterial
        emissiveIntensity={0.6}
        opacity={0.85}
        highlightIntensity={highlightIntensity}
      />
    </instancedMesh>
  );
}

