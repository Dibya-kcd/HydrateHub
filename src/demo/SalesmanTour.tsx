import React from 'react';
import { DemoTour } from './DemoTour';

/** Drop-in for the landing page's salesman demo button (same `onClose` prop as the old overlay). */
export const SalesmanTour: React.FC<{ onClose: () => void }> = ({ onClose }) => <DemoTour tour="salesman" onClose={onClose} />;
export default SalesmanTour;
