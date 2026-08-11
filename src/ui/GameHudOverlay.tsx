import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import type { RudderDirection, SailState } from '../entities/Ship';
import { gameHudStore } from './gameHudStore';
import { Minimap } from './Minimap';

const SAIL_STATUS: Record<SailState, { label: string; asset: string }> = {
  0: {
    label: 'Furled',
    asset: '/assets/ship-parts/sails/ivory/ship_big_sails_closed.png',
  },
  1: {
    label: 'Half sail',
    asset: '/assets/ship-parts/sails/ivory/ship_big_sails_partial.png',
  },
  2: {
    label: 'Full sail',
    asset: '/assets/ship-parts/sails/ivory/ship_big_sails_open.png',
  },
};

const RUDDER_LABELS: Record<RudderDirection, string> = {
  [-1]: 'Port',
  0: 'Centered',
  1: 'Starboard',
};

const WHEEL_SPOKE_ANGLES = Array.from({ length: 8 }, (_, index) => index * 45);

type SteeringWheelProps = {
  rudder: RudderDirection;
};

function SteeringWheel({ rudder }: SteeringWheelProps) {
  const wheelStyle = {
    '--wheel-angle': `${rudder * 30}deg`,
  } as CSSProperties;
  const rudderLabel = RUDDER_LABELS[rudder];

  return (
    <div
      className="game-hud__control steering-wheel"
      role="group"
      aria-label="Rudder status"
      style={wheelStyle}
    >
      <svg className="steering-wheel__svg" viewBox="0 0 140 140" aria-hidden="true">
        <g className="steering-wheel__rotor">
          {WHEEL_SPOKE_ANGLES.map((angle) => (
            <g key={angle} transform={`rotate(${angle} 70 70)`}>
              <rect className="steering-wheel__handle" x="65" y="2" width="10" height="24" rx="4" />
              <line className="steering-wheel__spoke" x1="70" y1="20" x2="70" y2="57" />
            </g>
          ))}
          <circle className="steering-wheel__rim-shadow" cx="70" cy="70" r="47" />
          <circle className="steering-wheel__rim" cx="70" cy="70" r="43" />
          <circle className="steering-wheel__hub-shadow" cx="70" cy="70" r="16" />
          <circle className="steering-wheel__hub" cx="70" cy="70" r="11" />
        </g>
      </svg>
      <div className="game-hud__status" role="status" aria-live="polite" aria-atomic="true">
        <span className="game-hud__label">Rudder</span>
        <span className="game-hud__value">{rudderLabel}</span>
      </div>
    </div>
  );
}

type SailStatusProps = {
  sailState: SailState;
};

function SailStatus({ sailState }: SailStatusProps) {
  const status = SAIL_STATUS[sailState];

  return (
    <div className="game-hud__control sail-status" role="group" aria-label="Sail status">
      <div className="sail-status__art" aria-hidden="true">
        <img className="sail-status__image" src={status.asset} alt="" draggable={false} />
      </div>
      <div className="game-hud__status" role="status" aria-live="polite" aria-atomic="true">
        <span className="game-hud__label">Sails</span>
        <span className="game-hud__value">{status.label}</span>
      </div>
    </div>
  );
}

type ShipResourcesProps = {
  crew: number;
  crewCapacity: number;
  supplies: number;
  supplyCapacity: number;
};

function ShipResources({
  crew,
  crewCapacity,
  supplies,
  supplyCapacity,
}: ShipResourcesProps) {
  return (
    <div className="ship-resources" role="group" aria-label="Ship resources">
      <div className="ship-resources__item" role="status" aria-live="polite" aria-atomic="true">
        <span className="ship-resources__icon" aria-hidden="true">
          <img
            className="ship-resources__image"
            src="/assets/gameplay/crew-hud.png"
            alt=""
            draggable={false}
          />
        </span>
        <span className="game-hud__label">Crew</span>
        <span className="ship-resources__value">{crew} / {crewCapacity}</span>
      </div>
      <div className="ship-resources__item" role="status" aria-live="polite" aria-atomic="true">
        <span className="ship-resources__icon" aria-hidden="true">
          <img
            className="ship-resources__image"
            src="/assets/gameplay/supplies-hud.png"
            alt=""
            draggable={false}
          />
        </span>
        <span className="game-hud__label">Supplies</span>
        <span className="ship-resources__value">
          {Math.ceil(supplies)} / {supplyCapacity}
        </span>
      </div>
    </div>
  );
}

export function GameHudOverlay() {
  const hudState = useSyncExternalStore(
    gameHudStore.subscribe,
    gameHudStore.getSnapshot,
    gameHudStore.getSnapshot,
  );

  if (!hudState.visible) {
    return null;
  }

  return (
    <>
      {hudState.minimapWorld && hudState.minimapPlayerPose ? (
        <Minimap
          minimapWorld={hudState.minimapWorld}
          playerPose={hudState.minimapPlayerPose}
        />
      ) : null}
      <section className="game-hud" aria-label="Ship controls and resources status">
        {hudState.resources ? <ShipResources {...hudState.resources} /> : null}
        <SailStatus sailState={hudState.sailState} />
        <SteeringWheel rudder={hudState.rudder} />
      </section>
    </>
  );
}
