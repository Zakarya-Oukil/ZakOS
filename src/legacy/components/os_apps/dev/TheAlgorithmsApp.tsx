import React from 'react';
import { TheAlgorithmsPane } from '../../../workbench/panes/TheAlgorithmsPane';
import { CONTEXT_PROFILES } from '../../../workbench/types/profileTypes';

export const TheAlgorithmsApp: React.FC<any> = () => {
  return <TheAlgorithmsPane theme={CONTEXT_PROFILES.DEV} />;
};
export default TheAlgorithmsApp;
