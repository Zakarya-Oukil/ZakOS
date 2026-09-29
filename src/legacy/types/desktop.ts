import React from 'react';

export type OperatingSystemId = 'agentic' | 'cyber' | 'dev' | 'study' | 'founder';

export interface AppDefinition {
  id: string;
  title: string;
  iconName: string;
  os: OperatingSystemId;
  description: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX?: number;
  defaultY?: number;
  component: React.ComponentType<{ windowId: string; isActive: boolean; onClose: () => void; initialProps?: any }>;
  isPinned?: boolean;
}

export interface DesktopFolderDefinition {
  id: string;
  title: string;
  os: OperatingSystemId;
  iconName: string;
  color: string;
  description: string;
  appIds: string[];
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  iconName: string;
  os: OperatingSystemId;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  prevPosition?: { x: number; y: number };
  prevSize?: { width: number; height: number };
  zIndex: number;
  initialProps?: any;
}

export interface OSConfig {
  id: OperatingSystemId;
  name: string;
  subtitle: string;
  badgeCount: number;
  badgePulse: boolean;
  accentColor: string;
  primaryColor: string;
  borderColor: string;
  wallpaperClass: string;
  tagline: string;
}

export interface CrossOsNotification {
  id: string;
  sourceOs: OperatingSystemId;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  actionAppId?: string;
}

