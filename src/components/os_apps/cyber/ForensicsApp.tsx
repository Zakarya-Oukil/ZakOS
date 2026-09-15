import React from 'react';
import { ForensicsLabPane } from '../../../workbench/panes/ForensicsLabPane';
import { CONTEXT_PROFILES } from '../../../workbench/types/profileTypes';

export const ForensicsApp: React.FC<any> = () => {
  return <ForensicsLabPane theme={CONTEXT_PROFILES.CYBER} />;
};
export default ForensicsApp;
