import { api } from './api';

export interface TelemetryData {
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: number;
    physicalCores: number;
    currentLoad: number;
    coreLoads: number[];
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

export interface WeatherData {
  success: boolean;
  city: string;
  current: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
  units?: {
    temperature_2m?: string;
    wind_speed_10m?: string;
  };
}

export interface JarvisActionResponse {
  type: 'open_telemetry' | 'open_weather' | 'open_youtube' | 'open_vault' | 'open_cyber' | 'exec_pc' | 'none';
  payload?: any;
}

export const jarvisApi = {
  /**
   * Fetch hardware telemetry (CPU, RAM, Disks, Processes)
   */
  async getTelemetry(): Promise<TelemetryData> {
    const res = await fetch('/api/jarvis/telemetry');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch telemetry');
    return data.telemetry;
  },

  /**
   * Fetch live weather
   */
  async getWeather(city?: string): Promise<WeatherData> {
    const url = city ? `/api/jarvis/weather?city=${encodeURIComponent(city)}` : '/api/jarvis/weather';
    const res = await fetch(url);
    return await res.json();
  },

  /**
   * Execute PC application (Obsidian, Calc, Wireshark, etc.)
   */
  async executePcApp(app: string, args?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/jarvis/exec-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, args })
    });
    return await res.json();
  },

  /**
   * Parse prompt intent for automatic HUD actions
   */
  async parseIntent(prompt: string): Promise<JarvisActionResponse> {
    const res = await fetch('/api/jarvis/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    return data.action;
  },

  /**
   * Send prompt to JARVIS AI intelligence core
   */
  async askJarvis(prompt: string, history: any[] = []): Promise<string> {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'jarvis',
        prompt,
        history,
        routingMode: 'hybrid_fallback'
      })
    });

    if (!res.body) {
      throw new Error('No response body from JARVIS core');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) {
              fullText += parsed.text;
            }
          } catch (e) {
            // raw text chunk fallback
            fullText += line.slice(6);
          }
        }
      }
    }

    return fullText.trim();
  }
};
