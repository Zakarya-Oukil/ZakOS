import React, { useState } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { AppLogo } from '../../components/common/AppLogo';

interface AlgorithmData {
  id: string;
  name: string;
  category: 'SORTING' | 'SEARCH' | 'GRAPH' | 'DP';
  complexityTime: string;
  complexitySpace: string;
  description: string;
  codePython: string;
  codeTs: string;
  codeRust: string;
  defaultArray: number[];
}

const ALGORITHMS: AlgorithmData[] = [
  {
    id: 'quicksort',
    name: 'QuickSort (Lomuto Partition)',
    category: 'SORTING',
    complexityTime: 'O(n log n) avg / O(n²) worst',
    complexitySpace: 'O(log n)',
    description: 'Divide-and-conquer sorting algorithm that selects a pivot element and partitions array around it.',
    defaultArray: [42, 17, 89, 5, 63, 29, 74, 11, 95, 33, 58, 2],
    codePython: `def quicksort(arr, low, high):
    if low < high:
        pi = partition(arr, low, high)
        quicksort(arr, low, pi - 1)
        quicksort(arr, pi + 1, high)

def partition(arr, low, high):
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1`,
    codeTs: `export function quickSort(arr: number[], low = 0, high = arr.length - 1): number[] {
  if (low < high) {
    const pIdx = partition(arr, low, high);
    quickSort(arr, low, pIdx - 1);
    quickSort(arr, pIdx + 1, high);
  }
  return arr;
}

function partition(arr: number[], low: number, high: number): number {
  const pivot = arr[high];
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}`,
    codeRust: `pub fn quick_sort<T: Ord>(slice: &mut [T]) {
    if slice.len() <= 1 { return; }
    let pivot_idx = partition(slice);
    quick_sort(&mut slice[0..pivot_idx]);
    quick_sort(&mut slice[pivot_idx + 1..]);
}

fn partition<T: Ord>(slice: &mut [T]) -> usize {
    let len = slice.len();
    let pivot_idx = len - 1;
    let mut i = 0;
    for j in 0..len - 1 {
        if slice[j] <= slice[pivot_idx] {
            slice.swap(i, j);
            i += 1;
        }
    }
    slice.swap(i, pivot_idx);
    i
}`,
  },
  {
    id: 'mergesort',
    name: 'MergeSort (Stable Divide & Conquer)',
    category: 'SORTING',
    complexityTime: 'O(n log n) guaranteed',
    complexitySpace: 'O(n)',
    description: 'Guaranteed O(n log n) stable sorting algorithm dividing arrays in half and merging sorted halves.',
    defaultArray: [64, 34, 25, 12, 22, 11, 90, 48, 73, 19],
    codePython: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result`,
    codeTs: `export function mergeSort(arr: number[]): number[] {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}`,
    codeRust: `pub fn merge_sort<T: Ord + Clone>(arr: &[T]) -> Vec<T> {
    if arr.len() <= 1 { return arr.to_vec(); }
    let mid = arr.len() / 2;
    let left = merge_sort(&arr[..mid]);
    let right = merge_sort(&arr[mid..]);
    merge(&left, &right)
}`,
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's Shortest Path",
    category: 'GRAPH',
    complexityTime: 'O((V + E) log V)',
    complexitySpace: 'O(V)',
    description: 'Calculates shortest paths from a single source node to all other nodes in a weighted graph.',
    defaultArray: [1, 4, 7, 2, 9, 3, 6, 8, 5],
    codePython: `import heapq

def dijkstra(graph, start):
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    pq = [(0, start)]
    
    while pq:
        current_dist, u = heapq.heappop(pq)
        if current_dist > distances[u]:
            continue
        for v, weight in graph[u].items():
            dist = current_dist + weight
            if dist < distances[v]:
                distances[v] = dist
                heapq.heappush(pq, (dist, v))
    return distances`,
    codeTs: `export function dijkstra(graph: Record<string, Record<string, number>>, start: string) {
  const distances: Record<string, number> = {};
  for (const node in graph) distances[node] = Infinity;
  distances[start] = 0;
  // Min-Priority queue traversal ...
  return distances;
}`,
    codeRust: `use std::collections::BinaryHeap;
use std::cmp::Ordering;

pub fn dijkstra(adj: &[Vec<(usize, usize)>], start: usize) -> Vec<usize> {
    let mut dist = vec![usize::MAX; adj.len()];
    dist[start] = 0;
    // Priority queue search...
    dist
}`,
  },
];

export const TheAlgorithmsPane: React.FC<{ theme: ProfileThemeTokens }> = ({ theme }) => {
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmData>(ALGORITHMS[0]);
  const [selectedLang, setSelectedLang] = useState<'Python' | 'TypeScript' | 'Rust'>('Python');
  const [arrayData, setArrayData] = useState<number[]>(ALGORITHMS[0].defaultArray);
  const [isSorting, setIsSorting] = useState(false);

  const handleSelectAlgo = (algo: AlgorithmData) => {
    setSelectedAlgo(algo);
    setArrayData([...algo.defaultArray]);
  };

  const handleRunSort = async () => {
    if (isSorting) return;
    setIsSorting(true);

    const arr = [...arrayData];
    // Simple Bubble Step visualization for quick interactive feedback
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          const temp = arr[j];
          arr[j] = arr[j + 1];
          arr[j + 1] = temp;
          setArrayData([...arr]);
          await new Promise((r) => setTimeout(r, 60));
        }
      }
    }
    setIsSorting(false);
  };

  const handleReset = () => {
    setArrayData([...selectedAlgo.defaultArray]);
  };

  const maxVal = Math.max(...arrayData, 100);

  return (
    <div
      className="w-full h-full flex flex-col font-mono text-xs overflow-hidden"
      style={{ backgroundColor: theme.bgPrimary, color: theme.textPrimary }}
    >
      {/* Top Header */}
      <div
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgSecondary }}
      >
        <div className="flex items-center gap-2">
          <AppLogo name="python" className="w-5 h-5" />
          <span className="font-bold tracking-wider uppercase text-[11px]" style={{ color: theme.accentPrimary }}>
            THE ALGORITHMS & CS VISUALIZER
          </span>
          <span className="text-[10px] text-neutral-500">| OPEN-SOURCE CURRICULUM</span>
        </div>

        {/* Algorithm Picker */}
        <div className="flex items-center gap-1">
          {ALGORITHMS.map((algo) => (
            <button
              key={algo.id}
              onClick={() => handleSelectAlgo(algo)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                selectedAlgo.id === algo.id
                  ? 'bg-amber-500 text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {algo.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Split: Visualization & Code Implementation */}
      <div className="flex-1 flex divide-x overflow-hidden" style={{ borderColor: theme.borderPrimary }}>
        {/* Left Half: Array Visualizer & Complexity Card */}
        <div className="w-1/2 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase">{selectedAlgo.name}</h3>
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                {selectedAlgo.category}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{selectedAlgo.description}</p>
          </div>

          {/* Complexity Telemetry */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded bg-black/40 border border-neutral-800">
              <div className="text-[9px] text-neutral-500 uppercase font-bold">Time Complexity</div>
              <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                {selectedAlgo.complexityTime}
              </div>
            </div>
            <div className="p-2.5 rounded bg-black/40 border border-neutral-800">
              <div className="text-[9px] text-neutral-500 uppercase font-bold">Space Complexity</div>
              <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                {selectedAlgo.complexitySpace}
              </div>
            </div>
          </div>

          {/* Visual Array Bars */}
          <div className="h-44 p-3 rounded-lg border border-neutral-800 bg-black/70 flex items-end gap-1.5 justify-center">
            {arrayData.map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full rounded-t transition-all duration-75"
                  style={{
                    height: `${(val / maxVal) * 100}%`,
                    backgroundColor: isSorting ? '#F59E0B' : '#38BDF8',
                  }}
                />
                <span className="text-[8px] text-neutral-500">{val}</span>
              </div>
            ))}
          </div>

          {/* Run & Reset Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSort}
              disabled={isSorting}
              className={`flex-1 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                isSorting
                  ? 'bg-neutral-800 text-neutral-500'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {isSorting ? 'SORTING IN PROGRESS...' : '▶ RUN VISUAL STEPPER'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSorting}
              className="px-4 py-2 rounded border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white cursor-pointer"
            >
              RESET
            </button>
          </div>
        </div>

        {/* Right Half: Multi-Language Code Implementations */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-black/50">
          {/* Language Switcher */}
          <div
            className="h-9 px-3 border-b flex items-center justify-between flex-shrink-0"
            style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgPanel }}
          >
            <span className="text-[10px] text-neutral-400 uppercase font-bold">SOURCE IMPLEMENTATION:</span>
            <div className="flex items-center gap-1">
              {(['Python', 'TypeScript', 'Rust'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    selectedLang === lang
                      ? 'bg-neutral-200 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Code Editor View */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-200 select-all whitespace-pre">
            {selectedLang === 'Python' && selectedAlgo.codePython}
            {selectedLang === 'TypeScript' && selectedAlgo.codeTs}
            {selectedLang === 'Rust' && selectedAlgo.codeRust}
          </div>
        </div>
      </div>
    </div>
  );
};
export default TheAlgorithmsPane;
