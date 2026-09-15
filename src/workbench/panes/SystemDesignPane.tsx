import React, { useState } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { Server, Activity, Calculator, Layers, Database, Cpu, Globe } from 'lucide-react';

interface SystemDesignPaneProps {
  theme: ProfileThemeTokens;
}

const LATENCIES = [
  { item: 'L1 CPU cache reference', ns: 0.5, human: '0.5 ns' },
  { item: 'Branch mispredict', ns: 5, human: '5 ns' },
  { item: 'L2 CPU cache reference', ns: 7, human: '7 ns' },
  { item: 'Mutex lock/unlock', ns: 17, human: '17 ns' },
  { item: 'Main memory (RAM) reference', ns: 100, human: '100 ns' },
  { item: 'Compress 1KB with Zstandard', ns: 2000, human: '2.0 µs' },
  { item: 'Send 1KB over 10 Gbps network', ns: 10000, human: '10 µs' },
  { item: 'Read 4KB randomly from NVMe SSD', ns: 15000, human: '15 µs' },
  { item: 'Read 1MB sequentially from memory', ns: 3000, human: '3 µs' },
  { item: 'Round trip within same datacenter', ns: 500000, human: '0.5 ms' },
  { item: 'Read 1MB sequentially from SSD', ns: 1000000, human: '1 ms' },
  { item: 'Disk seek (HDD)', ns: 10000000, human: '10 ms' },
  { item: 'Send packet California to Netherlands', ns: 150000000, human: '150 ms' },
];

export const SystemDesignPane: React.FC<SystemDesignPaneProps> = ({ theme }) => {
  // Live Capacity Calculator State
  const [dau, setDau] = useState<number>(10000000); // 10 Million DAU
  const [readsPerUser, setReadsPerUser] = useState<number>(20);
  const [writesPerUser, setWritesPerUser] = useState<number>(2);
  const [avgPayloadKb, setAvgPayloadKb] = useState<number>(2);

  // Computed QPS & Bandwidth
  const totalReadsPerDay = dau * readsPerUser;
  const totalWritesPerDay = dau * writesPerUser;
  const readQps = Math.round(totalReadsPerDay / 86400);
  const writeQps = Math.round(totalWritesPerDay / 86400);
  const totalQps = readQps + writeQps;
  const peakQps = totalQps * 2; // Standard 2x peak rule

  // Daily Storage
  const dailyStorageGb = ((totalWritesPerDay * avgPayloadKb) / (1024 * 1024)).toFixed(1);
  const yearlyStorageTb = (((totalWritesPerDay * avgPayloadKb * 365) / (1024 * 1024 * 1024))).toFixed(1);
  const bandwidthMbps = (((totalQps * avgPayloadKb * 8) / 1024)).toFixed(1);

  return (
    <div className="flex flex-col h-full w-full font-mono text-xs overflow-y-auto p-4 select-none space-y-4" style={{ backgroundColor: theme.bgPanel }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: theme.borderPrimary }}>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-white text-sm">SYSTEM DESIGN &amp; SCALABILITY PRIMER</span>
        </div>
        <span className="text-[10px] text-purple-300 font-bold px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
          DISTRIBUTED SYSTEMS ENGINE
        </span>
      </div>

      {/* ----------------------------------------------------
          1. Interactive Scale & Capacity Estimator
          ---------------------------------------------------- */}
      <div className="p-3 rounded-xs border space-y-3" style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}>
        <div className="flex items-center gap-2 text-[11px] font-bold text-white">
          <Calculator className="w-3.5 h-3.5 text-purple-400" />
          <span>CAPACITY &amp; QPS ESTIMATOR</span>
        </div>

        <div className="grid grid-cols-4 gap-3 text-[10px]">
          <div>
            <label className="text-neutral-400 block mb-1">DAU (Daily Users)</label>
            <input
              type="number"
              value={dau}
              onChange={(e) => setDau(Math.max(1, Number(e.target.value)))}
              className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-white font-bold"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1">Reads / User / Day</label>
            <input
              type="number"
              value={readsPerUser}
              onChange={(e) => setReadsPerUser(Math.max(1, Number(e.target.value)))}
              className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-white"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1">Writes / User / Day</label>
            <input
              type="number"
              value={writesPerUser}
              onChange={(e) => setWritesPerUser(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-white"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1">Payload Size (KB)</label>
            <input
              type="number"
              value={avgPayloadKb}
              onChange={(e) => setAvgPayloadKb(Math.max(0.1, Number(e.target.value)))}
              className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-white"
            />
          </div>
        </div>

        {/* Output Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-800 text-[10px]">
          <div className="p-2 rounded bg-black/60 border border-neutral-800">
            <span className="text-neutral-500 block text-[9px]">AVERAGE QPS</span>
            <span className="text-white font-bold text-xs">{totalQps.toLocaleString()} QPS</span>
            <span className="text-neutral-500 block text-[8px]">Reads: {readQps.toLocaleString()} | Writes: {writeQps.toLocaleString()}</span>
          </div>

          <div className="p-2 rounded bg-black/60 border border-neutral-800">
            <span className="text-neutral-500 block text-[9px]">PEAK 2X QPS</span>
            <span className="text-amber-400 font-bold text-xs">{peakQps.toLocaleString()} QPS</span>
            <span className="text-neutral-500 block text-[8px]">Design cluster for this load</span>
          </div>

          <div className="p-2 rounded bg-black/60 border border-neutral-800">
            <span className="text-neutral-500 block text-[9px]">INGRESS / EGRESS BANDWIDTH</span>
            <span className="text-cyan-400 font-bold text-xs">{bandwidthMbps} Mbps</span>
            <span className="text-neutral-500 block text-[8px]">{((+bandwidthMbps) / 8000).toFixed(2)} Gbps</span>
          </div>

          <div className="p-2 rounded bg-black/60 border border-neutral-800">
            <span className="text-neutral-500 block text-[9px]">STORAGE ACCUMULATION</span>
            <span className="text-emerald-400 font-bold text-xs">{yearlyStorageTb} TB / Year</span>
            <span className="text-neutral-500 block text-[8px]">{dailyStorageGb} GB / Day</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          2. Latency Numbers Every Programmer Should Know
          ---------------------------------------------------- */}
      <div className="p-3 rounded-xs border space-y-2" style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-white text-[11px]">LATENCY NUMBERS EVERY PROGRAMMER SHOULD KNOW</span>
          <span className="text-neutral-500 text-[9px]">Colin Scott / Peter Norvig</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {LATENCIES.map((lat, idx) => (
            <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-neutral-800/80">
              <span className="text-slate-300 truncate">{lat.item}</span>
              <span className="font-bold text-purple-300 font-mono shrink-0 ml-2">{lat.human}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
