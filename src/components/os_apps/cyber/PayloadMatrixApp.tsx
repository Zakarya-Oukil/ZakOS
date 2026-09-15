import React from 'react';
import { PayloadMatrixPane } from '../../../workbench/panes/PayloadMatrixPane';
import { CONTEXT_PROFILES } from '../../../workbench/types/profileTypes';

export const PayloadMatrixApp: React.FC<any> = () => {
  return <PayloadMatrixPane theme={CONTEXT_PROFILES.CYBER} />;
};
export default PayloadMatrixApp;
