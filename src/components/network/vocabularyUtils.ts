import * as THREE from "three";

// Base scale for nodes
const BASE_SCALE = 0.6;

export interface Node {
  id: string;
  word: string;
  meaning?: string;
  phonetic?: string;
  tags?: string[];
  position: THREE.Vector3;
  size: number;
  linkCount: number;
}

export interface Link {
  start: string;
  end: string;
  relationship: string;
}

// Calculate node size based on link count proportion
// Formula: (linkCount / maxLinkCount + 1) * baseScale
export function calculateNodeSize(
  linkCount: number,
  maxLinkCount: number
): number {
  if (maxLinkCount === 0) {
    return BASE_SCALE;
  }
  const proportion = linkCount / maxLinkCount;
  return (proportion + 1) * BASE_SCALE;
}


// Simple force-directed layout algorithm
export function computeLayout(
  nodes: Node[],
  links: Link[],
  iterations: number = 50
): void {
  const nodeMap = new Map();
  for (let i = 0; i < nodes.length; i++) {
    nodeMap.set(nodes[i].id, nodes[i]);
  }

  const width = 20;
  const height = 20;
  const depth = 10;

  // Initialize positions in a sphere
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const angle1 = (i / nodes.length) * Math.PI * 2;
    const angle2 = Math.acos((2 * i) / nodes.length - 1);
    const radius = 8;
    node.position.set(
      radius * Math.sin(angle2) * Math.cos(angle1),
      radius * Math.sin(angle2) * Math.sin(angle1),
      radius * Math.cos(angle2)
    );
  }

  // Force-directed simulation
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map();
    for (let i = 0; i < nodes.length; i++) {
      forces.set(nodes[i].id, new THREE.Vector3());
    }

    // Attractive forces along links
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const start = nodeMap.get(link.start);
      const end = nodeMap.get(link.end);
      if (!start || !end) continue;

      const distance = start.position.distanceTo(end.position);
      const idealDistance = 5;
      const force = (distance - idealDistance) * 0.1;

      const direction = new THREE.Vector3()
        .subVectors(end.position, start.position)
        .normalize();

      const startForce = forces.get(start.id);
      const endForce = forces.get(end.id);

      startForce.addScaledVector(direction, force);
      endForce.addScaledVector(direction, -force);
    }

    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const distance = node1.position.distanceTo(node2.position);
        if (distance < 0.1) continue;

        const force = -2.0 / (distance * distance);
        const direction = new THREE.Vector3()
          .subVectors(node2.position, node1.position)
          .normalize();

        const force1 = forces.get(node1.id);
        const force2 = forces.get(node2.id);

        force1.addScaledVector(direction, force);
        force2.addScaledVector(direction, -force);
      }
    }

    // Apply forces with damping
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const force = forces.get(node.id);
      node.position.addScaledVector(force, 0.1);

      // Keep nodes within bounds
      node.position.x = Math.max(
        -width / 2,
        Math.min(width / 2, node.position.x)
      );
      node.position.y = Math.max(
        -height / 2,
        Math.min(height / 2, node.position.y)
      );
      node.position.z = Math.max(
        -depth / 2,
        Math.min(depth / 2, node.position.z)
      );
    }
  }
}
