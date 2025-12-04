"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { indexedDbClient } from "@/lib/indexedDb";
import { useAppStore, selectLearningLanguage } from "@/store/useAppStore";
import { useTranslation } from "@/hooks/useTranslation";
import { InstancedNodes } from "./InstancedNodes";
import { Links3D } from "./Links3D";
import {
  Node,
  Link,
  calculateNodeSize,
  computeLayout,
} from "./vocabularyUtils";


// Scene component that provides node positions for labels
function SceneContent({
  nodes,
  links,
  selectedNodeId,
  onNodeClick,
  onNodePositionsUpdate,
}: {
  nodes: Node[];
  links: Link[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onNodePositionsUpdate: (
    positions: Map<string, { x: number; y: number }>
  ) => void;
}) {
  const { camera, size } = useThree();
  const vector = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const positions = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      vector.copy(node.position);
      vector.project(camera);

      const x = (vector.x * 0.5 + 0.5) * size.width;
      const y = (vector.y * -0.5 + 0.5) * size.height;

      positions.set(node.id, { x, y });
    }
    onNodePositionsUpdate(positions);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      <InstancedNodes
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        onNodeClick={onNodeClick}
      />

      <Links3D nodes={nodes} links={links} />
    </>
  );
}

export const VocabularyNetwork3D = () => {
  const { t } = useTranslation();
  const learningLanguage = useAppStore(selectLearningLanguage);
  const [vocabularyGraph, setVocabularyGraph] = useState<{
    nodes: Array<{
      word: string;
      meaning?: string;
      phonetic?: string;
      tags?: string[];
      notes?: string;
    }>;
    links: Link[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  useEffect(() => {
    const loadVocabulary = async () => {
      try {
        setLoading(true);
        const graph = await indexedDbClient.getVocabulary(learningLanguage);
        if (graph) {
          setVocabularyGraph({
            nodes: graph.nodes,
            links: graph.links,
          });
        }
      } catch (error) {
        console.error("Failed to load vocabulary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadVocabulary();
  }, [learningLanguage]);

  const { processedNodes, processedLinks } = useMemo(() => {
    if (!vocabularyGraph || vocabularyGraph.nodes.length === 0) {
      return { processedNodes: [], processedLinks: [] };
    }

    // Create node map
    const nodeMap = new Map();
    for (let i = 0; i < vocabularyGraph.nodes.length; i++) {
      nodeMap.set(vocabularyGraph.nodes[i].word, i);
    }

    // Calculate link count for each node
    const linkCounts = new Map();
    for (let i = 0; i < vocabularyGraph.nodes.length; i++) {
      linkCounts.set(vocabularyGraph.nodes[i].word, 0);
    }

    // Filter valid links
    const validLinks: Link[] = [];
    for (let i = 0; i < vocabularyGraph.links.length; i++) {
      const link = vocabularyGraph.links[i];
      const hasStart = nodeMap.has(link.start);
      const hasEnd = nodeMap.has(link.end);
      if (hasStart && hasEnd && link.start !== link.end) {
        validLinks.push(link);
      }
    }

    // Count links
    for (let i = 0; i < validLinks.length; i++) {
      const link = validLinks[i];
      linkCounts.set(link.start, (linkCounts.get(link.start) || 0) + 1);
      linkCounts.set(link.end, (linkCounts.get(link.end) || 0) + 1);
    }

    // Find max link count for proportion calculation
    let maxLinkCount = 0;
    for (let i = 0; i < vocabularyGraph.nodes.length; i++) {
      const linkCount = linkCounts.get(vocabularyGraph.nodes[i].word) || 0;
      if (linkCount > maxLinkCount) {
        maxLinkCount = linkCount;
      }
    }

    // Create nodes
    const nodes: Node[] = [];
    for (let i = 0; i < vocabularyGraph.nodes.length; i++) {
      const nodeData = vocabularyGraph.nodes[i];
      const linkCount = linkCounts.get(nodeData.word) || 0;
      
      nodes.push({
        id: nodeData.word,
        word: nodeData.word,
        meaning: nodeData.meaning,
        phonetic: nodeData.phonetic,
        tags: nodeData.tags,
        position: new THREE.Vector3(),
        size: calculateNodeSize(linkCount, maxLinkCount),
        linkCount,
      });
    }

    // Compute layout
    computeLayout(nodes, validLinks);

    return {
      processedNodes: nodes,
      processedLinks: validLinks,
    };
  }, [vocabularyGraph]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("loading") || "Loading..."}
        </p>
      </div>
    );
  }

  if (!vocabularyGraph || processedNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t("noVocabulary") || "No vocabulary data available"}
        </p>
      </div>
    );
  }

  const selectedNode = (() => {
    if (!selectedNodeId) return null;
    for (let i = 0; i < processedNodes.length; i++) {
      if (processedNodes[i].id === selectedNodeId) {
        return processedNodes[i];
      }
    }
    return null;
  })();

  return (
    <div className="relative h-full w-full">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 25], fov: 50 }}
          gl={{ antialias: true }}
        >
          <SceneContent
            nodes={processedNodes}
            links={processedLinks}
            selectedNodeId={selectedNodeId}
            onNodeClick={setSelectedNodeId}
            onNodePositionsUpdate={setNodePositions}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={10}
            maxDistance={50}
            autoRotate
            autoRotateSpeed={0.7}
          />
        </Canvas>
      </div>

      {/* HTML Labels Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {processedNodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;

          return (
            <div
              key={node.id}
              className="absolute pointer-events-auto cursor-pointer text-center whitespace-nowrap"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: "translate(-50%, -50%)",
                fontSize: selectedNodeId === node.id ? "14px" : "12px",
                fontWeight: selectedNodeId === node.id ? "bold" : "normal",
                color: selectedNodeId === node.id ? "#ffd700" : "#ffffff",
                textShadow:
                  "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)",
                userSelect: "none",
              }}
              onClick={() => setSelectedNodeId(node.id)}
            >
              {node.word}
            </div>
          );
        })}
      </div>

      {/* Detail Panel on Left */}
      {selectedNode && (
        <div className="absolute left-4 top-4 rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-4 shadow-lg backdrop-blur dark:border-surface-700 dark:bg-surface-900 max-w-xs z-10">
          <div className="text-sm font-semibold">{selectedNode.word}</div>
          {selectedNode.phonetic && (
            <div className="text-xs text-muted-foreground mt-1">
              {selectedNode.phonetic}
            </div>
          )}
          {selectedNode.meaning && (
            <div className="text-xs text-muted-foreground mt-2">
              {selectedNode.meaning}
            </div>
          )}
          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedNode.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {selectedNode.linkCount} connections
          </div>
        </div>
      )}
    </div>
  );
};
