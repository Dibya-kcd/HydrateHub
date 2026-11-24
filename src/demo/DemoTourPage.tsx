/**
 * The dedicated demo link (#/demo, #/demo/salesman, #/demo/owner/7).
 * Rendered before and outside the app's data providers, so opening it never reads or writes real data.
 */
import React from 'react';
import { DemoTour } from './DemoTour';
import { TOURS, TourId } from './tourData';
import { DemoRoute, demoHref, leaveDemo, rememberStep } from './demoRoute';
import './tour.css';

const Chooser: React.FC = () => (
  <div className="hhd hhd-pick">
    <div className="hhd-pick__in">
      <div className="hhd-pick__brand">
        <span className="hhd-logo hhd-logo--lg" aria-hidden="true">H</span>
        <div>
          <h1>Hydrate Hub</h1>
          <p>Guided demos, step by step</p>
        </div>
      </div>
      <p className="hhd-pick__lead">
        Pick the demo that matches your job. Every shop, product and number is made up. Nothing you tap is saved or sent
        anywhere.
      </p>
      <div className="hhd-pick__cards">
        {(['salesman', 'owner'] as TourId[]).map((id) => (
          <a key={id} className="hhd-pick__card" href={demoHref(id)}>
            <span className="hhd-pick__icon" aria-hidden="true">{id === 'salesman' ? '🚚' : '📊'}</span>
            <b>{TOURS[id].short}</b>
            <span>{TOURS[id].blurb}</span>
            <small>{TOURS[id].steps.length} steps</small>
            <span className="hhd-pick__go">Start →</span>
          </a>
        ))}
      </div>
      <button type="button" className="hhd-pick__skip" onClick={leaveDemo}>
        Skip the demo and open the app
      </button>
    </div>
  </div>
);

export const DemoTourPage: React.FC<{ route: DemoRoute }> = ({ route }) => {
  if (route.kind === 'chooser') return <Chooser />;
  return (
    <DemoTour
      key={route.tour}
      tour={route.tour}
      initialStep={route.step}
      onStepChange={(n) => rememberStep(route.tour, n)}
      onClose={leaveDemo}
    />
  );
};

export default DemoTourPage;
