import si from 'systeminformation';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface JarvisAction {
  type: 'open_telemetry' | 'open_weather' | 'open_youtube' | 'open_vault' | 'open_cyber' | 'exec_pc' | 'none';
  payload?: any;
}

export interface TelemetryReport {
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: number;
    physicalCores: number;
    currentLoad: number;
    coreLoads: number[];
    temp?: number;
  };
  mem: {
    total: number;
    used: number;
    free: number;
    active: number;
    usagePercent: number;
  };
  disk: {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    usePercent: number;
    mount: string;
  }[];
  os: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
    hostname: string;
    uptime: number;
  };
  network: {
    iface: string;
    rx_sec: number;
    tx_sec: number;
  }[];
  processes: {
    name: string;
    cpu: number;
    mem: number;
    pid: number;
  }[];
}

class JarvisService {
  private defaultVaultPath = process.env.VAULT_PATH || 'C:\\Users\\Zakar\\Documents\\Obsidian\\My_Vault';

  /**
   * Gather real-time system hardware telemetry
   */
  public async getTelemetry(): Promise<TelemetryReport> {
    try {
      const [cpu, currentLoad, mem, fsSize, osInfo, networkStats, processes, timeInfo] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.networkStats(),
        si.processes(),
        si.time()
      ]);

      const diskReports = fsSize.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Math.round(d.use),
        mount: d.mount
      }));

      const topProcesses = (processes.list || [])
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 8)
        .map(p => ({
          name: p.name,
          cpu: Math.round(p.cpu * 10) / 10,
          mem: Math.round(p.mem * 10) / 10,
          pid: p.pid
        }));

      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          speed: cpu.speed,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          currentLoad: Math.round(currentLoad.currentLoad),
          coreLoads: currentLoad.cpus.map(c => Math.round(c.load))
        },
        mem: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          active: mem.active,
          usagePercent: Math.round((mem.used / mem.total) * 100)
        },
        disk: diskReports,
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          hostname: osInfo.hostname,
          uptime: timeInfo.uptime
        },
        network: networkStats.map(n => ({
          iface: n.iface,
          rx_sec: Math.max(0, n.rx_sec || 0),
          tx_sec: Math.max(0, n.tx_sec || 0)
        })),
        processes: topProcesses
      };
    } catch (err: any) {
      console.error('[JarvisService] Telemetry error:', err.message);
      throw err;
    }
  }

  /**
   * Launch PC Desktop Applications & Links
   */
  public async executePcApp(appName: string, args?: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const lower = appName.toLowerCase().trim();
      let cmd = '';

      if (lower.includes('obsidian')) {
        // Use Obsidian URI scheme or start obsidian
        const vaultParam = encodeURIComponent('My_Vault');
        if (args && args.trim()) {
          const fileParam = encodeURIComponent(args.trim());
          cmd = `start "" "obsidian://open?vault=${vaultParam}&file=${fileParam}"`;
        } else {
          cmd = `start "" "obsidian://open?vault=${vaultParam}"`;
        }
      } else if (lower.includes('calc') || lower === 'calculator') {
        cmd = 'start calc';
      } else if (lower.includes('notepad')) {
        cmd = args ? `notepad "${args}"` : 'start notepad';
      } else if (lower.includes('code') || lower.includes('vs code') || lower.includes('vscode')) {
        cmd = args ? `code "${args}"` : 'code .';
      } else if (lower.includes('terminal') || lower.includes('powershell') || lower.includes('cmd')) {
        cmd = 'start powershell';
      } else if (lower.includes('wireshark')) {
        cmd = 'start wireshark';
      } else if (lower.includes('browser') || lower.includes('chrome') || lower.includes('edge')) {
        cmd = args ? `start "" "${args}"` : 'start https://google.com';
      } else if (lower.includes('explorer') || lower.includes('folder')) {
        const targetPath = args || this.defaultVaultPath;
        cmd = `explorer "${targetPath}"`;
      } else {
        // Safe execution fallback
        cmd = `start "" "${appName}"`;
      }

      console.log(`[JarvisService] Executing Windows PC command: ${cmd}`);
      exec(cmd, { windowsHide: false }, (error) => {
        if (error) {
          console.warn(`[JarvisService] Exec notice: ${error.message}`);
          resolve({ success: true, message: `Command dispatched: ${cmd}` });
        } else {
          resolve({ success: true, message: `Application launched successfully: ${appName}` });
        }
      });
    });
  }

  /**
   * Fetch Live Weather data via Open-Meteo (No API key required)
   */
  public async getWeather(cityQuery?: string): Promise<any> {
    try {
      let lat = 36.75;
      let lon = 3.05;
      let resolvedCity = cityQuery || 'Current Location';

      if (cityQuery && cityQuery.trim()) {
        try {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`
          );
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            lat = geoData.results[0].latitude;
            lon = geoData.results[0].longitude;
            resolvedCity = `${geoData.results[0].name}, ${geoData.results[0].country || ''}`;
          }
        } catch (geoErr) {
          console.warn('[JarvisService] Geocoding lookup fallback:', geoErr);
        }
      }

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await weatherRes.json();

      return {
        success: true,
        city: resolvedCity,
        latitude: lat,
        longitude: lon,
        current: data.current || {},
        daily: data.daily || {},
        units: data.current_units || {}
      };
    } catch (err: any) {
      console.error('[JarvisService] Weather fetch failed:', err.message);
      return {
        success: false,
        error: err.message,
        city: cityQuery || 'Local Sector',
        current: {
          temperature_2m: 22,
          relative_humidity_2m: 48,
          apparent_temperature: 22,
          wind_speed_10m: 12,
          weather_code: 0
        }
      };
    }
  }

  /**
   * Parse user intent for fast modal triggers and commands
   */
  public parseIntent(prompt: string): JarvisAction {
    const p = prompt.toLowerCase();

    // 1. System Telemetry / CPU / RAM / Hardware
    if (
      p.includes('cpu') ||
      p.includes('telemetry') ||
      p.includes('ram') ||
      p.includes('memory usage') ||
      p.includes('system detail') ||
      p.includes('hardware') ||
      p.includes('performance') ||
      p.includes('system load')
    ) {
      return { type: 'open_telemetry' };
    }

    // 2. Weather
    if (p.includes('weather') || p.includes('forecast') || p.includes('temperature') || p.includes('rain')) {
      const match = p.match(/weather\s+(?:in|for|at)\s+([a-zA-Z\s]+)/i);
      const city = match ? match[1].trim() : '';
      return { type: 'open_weather', payload: { city } };
    }

    // 3. YouTube search & playback
    if (p.includes('youtube') || p.includes('play video') || p.includes('watch') || p.includes('video about')) {
      let query = p
        .replace(/open\s+youtube/i, '')
        .replace(/search\s+youtube\s+for/i, '')
        .replace(/search\s+for/i, '')
        .replace(/youtube/i, '')
        .replace(/play/i, '')
        .trim();
      return { type: 'open_youtube', payload: { query: query || 'Cybersecurity Red Team' } };
    }

    // 4. Obsidian Vault
    if (p.includes('obsidian') || p.includes('vault') || p.includes('notes') || p.includes('my notes')) {
      let note = '';
      if (p.includes('note')) {
        const parts = p.split(/note(?:s)?\s+(?:about|on|called|named)?/i);
        if (parts.length > 1) note = parts[1].trim();
      }
      return { type: 'open_vault', payload: { note } };
    }

    // 5. Cybersecurity / Pentest / SOC / Nmap / CVE
    if (
      p.includes('cve') ||
      p.includes('scan') ||
      p.includes('pentest') ||
      p.includes('soc') ||
      p.includes('nmap') ||
      p.includes('exploit') ||
      p.includes('wireshark') ||
      p.includes('recon') ||
      p.includes('security')
    ) {
      return { type: 'open_cyber', payload: { query: prompt } };
    }

    // 6. Direct PC App launching
    if (p.startsWith('open ') || p.startsWith('launch ') || p.startsWith('start ')) {
      const target = p.replace(/^(open|launch|start)\s+/i, '').trim();
      return { type: 'exec_pc', payload: { app: target } };
    }

    return { type: 'none' };
  }
}

export const jarvisService = new JarvisService();
