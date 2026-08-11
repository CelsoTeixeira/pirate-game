import type { RudderDirection, SailState } from '../entities/Ship';

export type MinimapPointOfInterest = Readonly<{
  id: string;
  environment: 'land' | 'water';
  size: 'small' | 'medium' | 'big';
  tileX: number;
  tileY: number;
}>;

export type MinimapWorldSnapshot = Readonly<{
  seed: number;
  widthInTiles: number;
  heightInTiles: number;
  tileSize: number;
  landMask: ReadonlyArray<boolean>;
  pointsOfInterest: ReadonlyArray<MinimapPointOfInterest>;
}>;

export type MinimapPlayerPose = Readonly<{
  x: number;
  y: number;
  rotation: number;
}>;

export type GameHudState = Readonly<{
  visible: boolean;
  mapOpen: boolean;
  rudder: RudderDirection;
  sailState: SailState;
  minimapWorld: MinimapWorldSnapshot | null;
  minimapPlayerPose: MinimapPlayerPose | null;
}>;

export type GameHudInitialization = Readonly<{
  rudder: RudderDirection;
  sailState: SailState;
  minimapWorld?: MinimapWorldSnapshot;
  minimapPlayerPose?: MinimapPlayerPose;
}>;

const hiddenState: GameHudState = {
  visible: false,
  mapOpen: false,
  rudder: 0,
  sailState: 0,
  minimapWorld: null,
  minimapPlayerPose: null,
};

let state = hiddenState;
const listeners = new Set<() => void>();

function posesAreEqual(first: MinimapPlayerPose | null, second: MinimapPlayerPose | null) {
  return first === second || (
    first !== null
    && second !== null
    && first.x === second.x
    && first.y === second.y
    && first.rotation === second.rotation
  );
}

function setState(nextState: GameHudState) {
  if (
    state.visible === nextState.visible
    && state.mapOpen === nextState.mapOpen
    && state.rudder === nextState.rudder
    && state.sailState === nextState.sailState
    && state.minimapWorld === nextState.minimapWorld
    && posesAreEqual(state.minimapPlayerPose, nextState.minimapPlayerPose)
  ) {
    return;
  }

  state = nextState;
  listeners.forEach((listener) => listener());
}

export const gameHudStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function initializeGameHud(initialization: GameHudInitialization) {
  setState({
    visible: true,
    mapOpen: false,
    rudder: initialization.rudder,
    sailState: initialization.sailState,
    minimapWorld: initialization.minimapWorld ?? null,
    minimapPlayerPose: initialization.minimapPlayerPose ?? null,
  });
}

export function setGameHudMapOpen(mapOpen: boolean) {
  setState({
    ...state,
    mapOpen,
  });
}

export function syncGameHudControls(rudder: RudderDirection, sailState: SailState) {
  setState({
    ...state,
    rudder,
    sailState,
  });
}

export function syncMinimapPlayerPose(minimapPlayerPose: MinimapPlayerPose) {
  setState({
    ...state,
    minimapPlayerPose,
  });
}

export function hideGameHud() {
  setState(hiddenState);
}
