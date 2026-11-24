import React from 'react';
import { DemoTour } from './DemoTour';

/** Drop-in for the landing page's owner demo button (same `onClose` prop as the old overlay). */
export const OwnerTour: React.FC<{ onClose: () => void }> = ({ onClose }) => <DemoTour tour="owner" onClose={onClose} />;
export default OwnerTour;
