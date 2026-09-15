import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, HardDrive, Activity, X, Server, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { jarvisApi, TelemetryData } from '../../../services/jarvisApi';

interface JarvisTelemetryModalProps {
  onClose: () => void;
}

export const JarvisTelemetryModal: React.FC<JarvisTelemetryModalProps> = ({ onClose }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await jarvisApi.getTelemetry();
      setTelemetry(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Telemetry offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2500);
    return () => clearInterval(interval);
  }, []);

  const openTaskManager = () => {
    jarvisApi.executePcApp('taskmgr');
  };

  const openResourceMonitor = () => {
    jarvisApi.executePcApp('resmon');
  };

  const ramUsedGb = telemetry ? (telemetry.mem.used / (1024 * 1024 * 1024)).toFixed(1) : '0';
  const ramTotalGb = telemetry ? (telemetry.mem.total / (1024 * 1024 * 1024)).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full max-w-xl rounded-2xl border border-white/15 bg-[#07090e]/90 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(167, 139, 250, 0.15)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <Activity className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS Telemetry Diagnostic
            </h3>
            <p className="text-[11px] text-zinc-400">Real-time hardware & operating system telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            title="Refresh metrics"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading && !telemetry ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500/20 border-t-purple-400" />
          <span className="font-mono text-xs text-zinc-400">Interfacing system bus...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-xs text-red-400">{error}</div>
      ) : telemetry ? (
        <div className="mt-4 space-y-4">
          {/* Top Row: CPU & RAM Gauges */}
          <div className="grid grid-cols-2 gap-3">
            {/* CPU Card */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" /> CPU Load
                </span>
                <span className="font-mono text-sm font-bold text-purple-300">
                  {telemetry.cpu.currentLoad}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, telemetry.cpu.currentLoad)}%` }}
                />
              </div>
              <div className="mt-2.5 truncate text-[10px] text-zinc-400">
                {telemetry.cpu.brand} ({telemetry.cpu.cores} Cores @ {telemetry.cpu.speed} GHz)
              </div>
            </div>

            {/* RAM Card */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <Server className="h-3.5 w-3.5 text-cyan-400" /> Memory
                </span>
                <span className="font-mono text-sm font-bold text-cyan-300">
                  {telemetry.mem.usagePercent}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, telemetry.mem.usagePercent)}%` }}
                />
              </div>
              <div className="mt-2.5 text-[10px] text-zinc-400">
                {ramUsedGb} GB used of {ramTotalGb} GB total
              </div>
            </div>
          </div>

          {/* Storage Row */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <HardDrive className="h-3.5 w-3.5 text-emerald-400" /> Drives & Partitions
              </span>
              <span className="text-[10px] text-zinc-400">{telemetry.disk.length} detected</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {telemetry.disk.slice(0, 4).map((d, i) => (
                <div key={i} className="rounded-lg border border-white/5 bg-black/30 p-2 text-[11px]">
                  <div className="flex justify-between font-mono">
                    <span className="font-semibold text-zinc-300">{d.mount || d.fs}</span>
                    <span className="text-zinc-400">{d.usePercent}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${d.usePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Active Processes */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Layers className="h-3.5 w-3.5 text-amber-400" /> Top Process Consumers
              </span>
              <span className="text-[10px] text-zinc-400">PID / CPU / RAM</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              {telemetry.processes.slice(0, 6).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border border-white/5 bg-black/20 px-2 py-1 text-zinc-300"
                >
                  <span className="truncate max-w-[90px]">{p.name}</span>
                  <span className="text-purple-300">{p.cpu}% CPU</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Quick PC Actions */}
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <ShieldCheck className="h-3 w-3 text-emerald-400" /> Host: {telemetry.os.hostname} (Win {telemetry.os.release})
            </span>
            <div className="flex gap-2">
              <button
                onClick={openResourceMonitor}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Resource Monitor
              </button>
              <button
                onClick={openTaskManager}
                className="rounded-lg border border-purple-500/30 bg-purple-500/20 px-2.5 py-1 text-[11px] font-medium text-purple-200 transition-colors hover:bg-purple-500/30"
              >
                Task Manager
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};
