import { BspNode, DividerInfo, LayoutRect, NavigationDirection, SplitDirection } from '../types/bspTypes';

/**
 * Generates a unique node ID.
 */
export function generateNodeId(): string {
  return 'bsp-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Creates an initial root node with a single pane.
 */
export function createInitialTree(initialPaneId: string = 'pane-terminal-1'): BspNode {
  return {
    id: generateNodeId(),
    paneId: initialPaneId,
  };
}

/**
 * Recursively searches for a node containing the specified paneId.
 */
export function findNodeByPaneId(node: BspNode, paneId: string): BspNode | null {
  if (node.paneId === paneId) return node;
  if (node.first) {
    const found = findNodeByPaneId(node.first, paneId);
    if (found) return found;
  }
  if (node.second) {
    const found = findNodeByPaneId(node.second, paneId);
    if (found) return found;
  }
  return null;
}

/**
 * Collects all leaf pane IDs in the tree in depth-first order.
 */
export function getAllPaneIds(node: BspNode): string[] {
  if (node.paneId) return [node.paneId];
  const list: string[] = [];
  if (node.first) list.push(...getAllPaneIds(node.first));
  if (node.second) list.push(...getAllPaneIds(node.second));
  return list;
}

/**
 * Splits the leaf node containing targetPaneId in the specified direction.
 */
export function splitPane(
  root: BspNode,
  targetPaneId: string,
  direction: SplitDirection,
  newPaneId: string,
  ratio: number = 0.5
): BspNode {
  // If this node is the leaf to split
  if (root.paneId === targetPaneId) {
    return {
      id: generateNodeId(),
      split: direction,
      ratio,
      first: {
        id: generateNodeId(),
        paneId: targetPaneId,
      },
      second: {
        id: generateNodeId(),
        paneId: newPaneId,
      },
    };
  }

  // Otherwise traverse down
  if (root.first && root.second) {
    return {
      ...root,
      first: splitPane(root.first, targetPaneId, direction, newPaneId, ratio),
      second: splitPane(root.second, targetPaneId, direction, newPaneId, ratio),
    };
  }

  return root;
}

/**
 * Closes targetPaneId and promotes its sibling into the parent's place.
 */
export function closePane(root: BspNode, targetPaneId: string): BspNode {
  // Single leaf root cannot be closed, return as is
  if (root.paneId === targetPaneId) {
    return root;
  }

  // Helper to remove and promote
  function removeRecursive(node: BspNode): BspNode | null {
    if (node.paneId === targetPaneId) {
      return null; // Signals this node should be removed
    }

    if (node.first && node.second) {
      const newFirst = removeRecursive(node.first);
      const newSecond = removeRecursive(node.second);

      // If first was deleted, promote second
      if (newFirst === null) return newSecond;
      // If second was deleted, promote first
      if (newSecond === null) return newFirst;

      return {
        ...node,
        first: newFirst,
        second: newSecond,
      };
    }

    return node;
  }

  const result = removeRecursive(root);
  return result || root;
}

/**
 * Swaps two leaf pane IDs in the tree.
 */
export function swapPanes(root: BspNode, paneIdA: string, paneIdB: string): BspNode {
  function swapRecursive(node: BspNode): BspNode {
    if (node.paneId === paneIdA) {
      return { ...node, paneId: paneIdB };
    }
    if (node.paneId === paneIdB) {
      return { ...node, paneId: paneIdA };
    }
    if (node.first && node.second) {
      return {
        ...node,
        first: swapRecursive(node.first),
        second: swapRecursive(node.second),
      };
    }
    return node;
  }

  return swapRecursive(root);
}

/**
 * Adjusts the ratio of a split node identified by nodeId.
 */
export function updateNodeRatio(root: BspNode, nodeId: string, newRatio: number): BspNode {
  const clampedRatio = Math.max(0.1, Math.min(0.9, newRatio));

  function updateRecursive(node: BspNode): BspNode {
    if (node.id === nodeId && node.split) {
      return { ...node, ratio: clampedRatio };
    }
    if (node.first && node.second) {
      return {
        ...node,
        first: updateRecursive(node.first),
        second: updateRecursive(node.second),
      };
    }
    return node;
  }

  return updateRecursive(root);
}

/**
 * Computes exact LayoutRect coordinates for all leaf panes and split dividers.
 */
export function calculateLayout(
  root: BspNode,
  currentRect: LayoutRect = { x: 0, y: 0, width: 100, height: 100 }
): {
  paneRects: Map<string, LayoutRect>;
  dividers: DividerInfo[];
} {
  const paneRects = new Map<string, LayoutRect>();
  const dividers: DividerInfo[] = [];

  function traverse(node: BspNode, rect: LayoutRect) {
    // Leaf node: record layout bounding box
    if (node.paneId) {
      paneRects.set(node.paneId, rect);
      return;
    }

    if (node.first && node.second && node.split) {
      const ratio = node.ratio ?? 0.5;

      if (node.split === 'vertical') {
        // Side-by-side split (horizontal partition line going vertically down)
        const firstWidth = rect.width * ratio;
        const secondWidth = rect.width * (1 - ratio);
        const dividerX = rect.x + firstWidth;

        dividers.push({
          id: `div-${node.id}`,
          nodeId: node.id,
          direction: 'vertical',
          x: dividerX,
          y: rect.y,
          length: rect.height,
        });

        traverse(node.first, {
          x: rect.x,
          y: rect.y,
          width: firstWidth,
          height: rect.height,
        });

        traverse(node.second, {
          x: dividerX,
          y: rect.y,
          width: secondWidth,
          height: rect.height,
        });
      } else {
        // Horizontal split (top & bottom partition line)
        const firstHeight = rect.height * ratio;
        const secondHeight = rect.height * (1 - ratio);
        const dividerY = rect.y + firstHeight;

        dividers.push({
          id: `div-${node.id}`,
          nodeId: node.id,
          direction: 'horizontal',
          x: rect.x,
          y: dividerY,
          length: rect.width,
        });

        traverse(node.first, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: firstHeight,
        });

        traverse(node.second, {
          x: rect.x,
          y: dividerY,
          width: rect.width,
          height: secondHeight,
        });
      }
    }
  }

  traverse(root, currentRect);
  return { paneRects, dividers };
}

/**
 * Calculates the best adjacent pane neighbor in a spatial direction.
 */
export function getDirectionalNeighbor(
  paneRects: Map<string, LayoutRect>,
  activePaneId: string,
  direction: NavigationDirection
): string | null {
  const current = paneRects.get(activePaneId);
  if (!current) return null;

  const currentCenter = {
    x: current.x + current.width / 2,
    y: current.y + current.height / 2,
  };

  let bestNeighborId: string | null = null;
  let minDistance = Infinity;

  paneRects.forEach((rect, candidateId) => {
    if (candidateId === activePaneId) return;

    const candCenter = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };

    let isEligible = false;

    switch (direction) {
      case 'LEFT':
        // Candidate must be to the left of the current center
        isEligible = candCenter.x < currentCenter.x;
        break;
      case 'RIGHT':
        // Candidate must be to the right of current center
        isEligible = candCenter.x > currentCenter.x;
        break;
      case 'UP':
        // Candidate must be above current center
        isEligible = candCenter.y < currentCenter.y;
        break;
      case 'DOWN':
        // Candidate must be below current center
        isEligible = candCenter.y > currentCenter.y;
        break;
    }

    if (isEligible) {
      // Euclidean distance between center points with orthogonal bias
      const dx = candCenter.x - currentCenter.x;
      const dy = candCenter.y - currentCenter.y;
      
      // Penalize perpendicular axis deviation so true horizontal/vertical neighbors win
      const distance =
        direction === 'LEFT' || direction === 'RIGHT'
          ? Math.abs(dx) + Math.abs(dy) * 1.5
          : Math.abs(dy) + Math.abs(dx) * 1.5;

      if (distance < minDistance) {
        minDistance = distance;
        bestNeighborId = candidateId;
      }
    }
  });

  return bestNeighborId;
}
