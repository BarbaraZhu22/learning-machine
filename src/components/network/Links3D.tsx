"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Node, Link } from "./vocabularyUtils";

interface Links3DProps {
  nodes: Node[];
  links: Link[];
}

export function Links3D({ nodes, links }: Links3DProps) {
  const nodeMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < nodes.length; i++) {
      map.set(nodes[i].id, nodes[i]);
    }
    return map;
  }, [nodes]);

  const { positions, colors } = useMemo(() => {
    const positionArray = new Float32Array(links.length * 2 * 3);
    const colorArray = new Float32Array(links.length * 2 * 3);

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const start = nodeMap.get(link.start);
      const end = nodeMap.get(link.end);
      if (!start || !end) continue;

      const baseIndex = i * 6;

      // Start position
      positionArray[baseIndex] = start.position.x;
      positionArray[baseIndex + 1] = start.position.y;
      positionArray[baseIndex + 2] = start.position.z;

      // End position
      positionArray[baseIndex + 3] = end.position.x;
      positionArray[baseIndex + 4] = end.position.y;
      positionArray[baseIndex + 5] = end.position.z;

      // Color
      const color = new THREE.Color(0x666666);
      colorArray[baseIndex] = color.r;
      colorArray[baseIndex + 1] = color.g;
      colorArray[baseIndex + 2] = color.b;
      colorArray[baseIndex + 3] = color.r;
      colorArray[baseIndex + 4] = color.g;
      colorArray[baseIndex + 5] = color.b;
    }

    return { positions: positionArray, colors: colorArray };
  }, [links, nodeMap]);

  if (links.length === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={links.length * 2}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={links.length * 2}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors linewidth={1} />
    </lineSegments>
  );
}

