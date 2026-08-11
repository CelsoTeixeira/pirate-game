import type { RudderDirection, SailState } from '../entities/Ship';

export type GameHudState = Readonly<{
  visible: boolean;
  rudder: RudderDirection;
  sailState: SailState;
}>;

const hiddenState: GameHudState = {
  visible: false,
  rudder: 0,
  sailState: 0,
};

let state = hiddenState;
const listeners = new Set<() => void>();

function setState(nextState: GameHudState) {
  if (
    state.visible === nextState.visible
    && state.rudder === nextState.rudder
    && state.sailState === nextState.sailState
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

export function showGameHud(rudder: RudderDirection, sailState: SailState) {
  setState({ visible: true, rudder, sailState });
}

export function hideGameHud() {
  setState(hiddenState);
}
