import { createContext, useContext } from 'react';

export interface ModuleState {
  isEnabled: (id: string) => boolean;
  setEnabled: (id: string, enabled: boolean) => void;
}

export const ModuleContext = createContext<ModuleState>({
  isEnabled: () => true,
  setEnabled: () => {},
});

export const useModules = () => useContext(ModuleContext);
