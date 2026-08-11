import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import type {
  MinimapPlayerPose,
  MinimapPointOfInterest,
  MinimapWorldSnapshot,
} from './gameHudStore';
import { gameHudStore, setGameHudMapOpen } from './gameHudStore';
import './minimap.css';

const OCEAN_COLOR = [8, 47, 73, 255] as const;
const LAND_COLOR = [72, 101, 68, 255] as const;
const POI_RADIUS: Record<MinimapPointOfInterest['size'], number> = {
  small: 1.5,
  medium: 2.5,
  big: 3.5,
};
const MIN_MAP_ZOOM = 1;
const INITIAL_MAP_ZOOM = 1.5;
const MAX_MAP_ZOOM = 4;

type MinimapProps = {
  minimapWorld: MinimapWorldSnapshot;
  playerPose: MinimapPlayerPose;
};

type MapCenter = Readonly<{
  x: number;
  y: number;
}>;

type MapSurfaceProps = {
  minimapWorld: MinimapWorldSnapshot;
  playerPose: MinimapPlayerPose;
  className: string;
  surfaceStyle?: CSSProperties;
};

function paintTerrain(
  context: CanvasRenderingContext2D,
  minimapWorld: MinimapWorldSnapshot,
) {
  const { widthInTiles, heightInTiles, landMask } = minimapWorld;
  const imageData = context.createImageData(widthInTiles, heightInTiles);

  for (let cellIndex = 0; cellIndex < landMask.length; cellIndex += 1) {
    const color = landMask[cellIndex] ? LAND_COLOR : OCEAN_COLOR;
    const pixelIndex = cellIndex * 4;
    imageData.data[pixelIndex] = color[0];
    imageData.data[pixelIndex + 1] = color[1];
    imageData.data[pixelIndex + 2] = color[2];
    imageData.data[pixelIndex + 3] = color[3];
  }

  context.putImageData(imageData, 0, 0);
}

function paintPointsOfInterest(
  context: CanvasRenderingContext2D,
  minimapWorld: MinimapWorldSnapshot,
) {
  const { widthInTiles, heightInTiles, pointsOfInterest } = minimapWorld;

  context.lineWidth = 1;
  context.strokeStyle = '#07151d';

  pointsOfInterest.forEach((point) => {
    const x = ((point.tileX + 0.5) / widthInTiles) * context.canvas.width;
    const y = ((point.tileY + 0.5) / heightInTiles) * context.canvas.height;
    const radius = POI_RADIUS[point.size];

    context.beginPath();
    if (point.environment === 'land') {
      context.rect(x - radius, y - radius, radius * 2, radius * 2);
      context.fillStyle = '#f5b85d';
    } else {
      context.moveTo(x, y - radius);
      context.lineTo(x + radius, y);
      context.lineTo(x, y + radius);
      context.lineTo(x - radius, y);
      context.closePath();
      context.fillStyle = '#67d9ed';
    }
    context.fill();
    context.stroke();
  });
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampZoom(value: number) {
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, value));
}

function clampCenter(value: number, zoom: number) {
  const halfVisibleWorld = 0.5 / zoom;
  return Math.min(1 - halfVisibleWorld, Math.max(halfVisibleWorld, value));
}

function clampMapCenter(center: MapCenter, zoom: number): MapCenter {
  return {
    x: clampCenter(center.x, zoom),
    y: clampCenter(center.y, zoom),
  };
}

const COMPASS_HEADINGS = [
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
  'east',
  'southeast',
] as const;

function getCompassHeading(rotation: number) {
  const fullTurn = Math.PI * 2;
  const normalizedRotation = ((rotation % fullTurn) + fullTurn) % fullTurn;
  const headingIndex = Math.round(normalizedRotation / (Math.PI / 4)) % COMPASS_HEADINGS.length;
  return COMPASS_HEADINGS[headingIndex];
}

function getCoarseLocation(normalizedX: number, normalizedY: number) {
  const horizontal = normalizedX < 1 / 3 ? 'west' : normalizedX > 2 / 3 ? 'east' : 'central';
  const vertical = normalizedY < 1 / 3 ? 'north' : normalizedY > 2 / 3 ? 'south' : 'central';

  if (horizontal === 'central' && vertical === 'central') {
    return 'center';
  }
  if (horizontal === 'central') {
    return `${vertical} center`;
  }
  if (vertical === 'central') {
    return `${horizontal} center`;
  }
  return `${vertical}-${horizontal}`;
}

function MapSurface({
  minimapWorld,
  playerPose,
  className,
  surfaceStyle,
}: MapSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d', { alpha: false });
    if (!context) {
      return;
    }

    paintTerrain(context, minimapWorld);
    paintPointsOfInterest(context, minimapWorld);
  }, [minimapWorld]);

  const worldWidth = minimapWorld.widthInTiles * minimapWorld.tileSize;
  const worldHeight = minimapWorld.heightInTiles * minimapWorld.tileSize;
  const normalizedPlayerX = clampUnit(playerPose.x / worldWidth);
  const normalizedPlayerY = clampUnit(playerPose.y / worldHeight);
  const playerDescription = `Player near ${getCoarseLocation(
    normalizedPlayerX,
    normalizedPlayerY,
  )}, heading ${getCompassHeading(playerPose.rotation)}`;
  const markerStyle = {
    left: `${normalizedPlayerX * 100}%`,
    top: `${normalizedPlayerY * 100}%`,
    '--minimap-player-rotation': `${playerPose.rotation}rad`,
  } as CSSProperties;

  return (
    <div className={className} style={surfaceStyle} aria-hidden={className.includes('expanded') || undefined}>
      <canvas
        ref={canvasRef}
        className="minimap__canvas"
        width={minimapWorld.widthInTiles}
        height={minimapWorld.heightInTiles}
        aria-hidden="true"
      />
      <span
        className="minimap__player"
        style={markerStyle}
        role={className.includes('expanded') ? undefined : 'img'}
        aria-label={className.includes('expanded') ? undefined : playerDescription}
      >
        <svg className="minimap__player-icon" viewBox="0 0 20 20" aria-hidden="true">
          {/* Ship rotation zero faces +Y, so this zero-angle marker points down. */}
          <path d="M 10 19 L 3 4 L 10 7 L 17 4 Z" />
        </svg>
      </span>
    </div>
  );
}

function getPlayerCenter(
  minimapWorld: MinimapWorldSnapshot,
  playerPose: MinimapPlayerPose,
  zoom: number,
) {
  const worldWidth = minimapWorld.widthInTiles * minimapWorld.tileSize;
  const worldHeight = minimapWorld.heightInTiles * minimapWorld.tileSize;
  return clampMapCenter({
    x: playerPose.x / worldWidth,
    y: playerPose.y / worldHeight,
  }, zoom);
}

export function Minimap({ minimapWorld, playerPose }: MinimapProps) {
  const isExpanded = useSyncExternalStore(
    gameHudStore.subscribe,
    () => gameHudStore.getSnapshot().mapOpen,
    () => gameHudStore.getSnapshot().mapOpen,
  );
  const [zoom, setZoom] = useState(MIN_MAP_ZOOM);
  const [center, setCenter] = useState<MapCenter>(() => getPlayerCenter(
    minimapWorld,
    playerPose,
    INITIAL_MAP_ZOOM,
  ));
  const zoomRef = useRef(MIN_MAP_ZOOM);
  const compactButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const hasOpenedRef = useRef(false);

  const pointSummary = useMemo(() => {
    const landCount = minimapWorld.pointsOfInterest.filter(
      (point) => point.environment === 'land',
    ).length;
    const waterCount = minimapWorld.pointsOfInterest.length - landCount;
    return `${landCount} land and ${waterCount} water points of interest. Marker size indicates point size.`;
  }, [minimapWorld]);

  const openMap = useCallback(() => {
    zoomRef.current = INITIAL_MAP_ZOOM;
    setZoom(INITIAL_MAP_ZOOM);
    setCenter(getPlayerCenter(minimapWorld, playerPose, INITIAL_MAP_ZOOM));
    setGameHudMapOpen(true);
  }, [minimapWorld, playerPose]);

  const closeMap = useCallback(() => {
    setGameHudMapOpen(false);
  }, []);

  useEffect(() => {
    if (isExpanded) {
      hasOpenedRef.current = true;
      dialogRef.current?.focus();
    } else if (hasOpenedRef.current) {
      compactButtonRef.current?.focus();
    }
  }, [isExpanded]);

  const adjustZoom = useCallback((amount: number) => {
    const nextZoom = clampZoom(zoomRef.current + amount);
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    setCenter((currentCenter) => clampMapCenter(currentCenter, nextZoom));
  }, []);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setCenter((currentCenter) => clampMapCenter({
      x: currentCenter.x + deltaX,
      y: currentCenter.y + deltaY,
    }, zoomRef.current));
  }, []);

  const recenter = useCallback(() => {
    setCenter(getPlayerCenter(minimapWorld, playerPose, zoomRef.current));
  }, [minimapWorld, playerPose]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => (
        element.getAttribute('aria-hidden') !== 'true'
        && element.getClientRects().length > 0
      ));

      event.preventDefault();
      event.stopPropagation();
      if (focusableElements.length === 0) {
        dialogRef.current?.focus();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = activeElement
        ? focusableElements.indexOf(activeElement)
        : -1;
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusableElements.length - 1
          ? 0
          : currentIndex + 1);
      focusableElements[nextIndex].focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMap();
      return;
    }

    const panStep = 0.06 / zoom;
    const key = event.key.toLowerCase();
    const panByKey: Record<string, readonly [number, number]> = {
      arrowleft: [-panStep, 0],
      a: [-panStep, 0],
      arrowright: [panStep, 0],
      d: [panStep, 0],
      arrowup: [0, -panStep],
      w: [0, -panStep],
      arrowdown: [0, panStep],
      s: [0, panStep],
    };
    const direction = panByKey[key];
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      panBy(direction[0], direction[1]);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      event.stopPropagation();
      adjustZoom(0.25);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      event.stopPropagation();
      adjustZoom(-0.25);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    panBy(
      (drag.x - event.clientX) / rect.width / zoom,
      (drag.y - event.clientY) / rect.height / zoom,
    );
    dragRef.current = { pointerId: drag.pointerId, x: event.clientX, y: event.clientY };
  };

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.25 : -0.25);
  };

  const expandedSurfaceStyle = {
    '--minimap-map-zoom': zoom,
    '--minimap-map-pan-x': `${(0.5 - center.x) * 100}%`,
    '--minimap-map-pan-y': `${(0.5 - center.y) * 100}%`,
  } as CSSProperties;

  return (
    <>
      <aside className="minimap" aria-labelledby="minimap-title" aria-describedby="minimap-summary">
        <h2 className="minimap__title" id="minimap-title">Map <span aria-hidden="true">N↑</span></h2>
        <button
          ref={compactButtonRef}
          className="minimap__open-button"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isExpanded}
          aria-label="Open expanded world map"
          onClick={openMap}
        >
          <div className="minimap__viewport">
            <MapSurface
              minimapWorld={minimapWorld}
              playerPose={playerPose}
              className="minimap__surface"
            />
            <div className="minimap__legend" aria-hidden="true">
              <span><i className="minimap__legend-marker minimap__legend-marker--land" />Land</span>
              <span><i className="minimap__legend-marker minimap__legend-marker--water" />Water</span>
            </div>
          </div>
        </button>
        <p className="minimap__summary" id="minimap-summary">
          Full north-up world map for seed {minimapWorld.seed}. {pointSummary}
        </p>
      </aside>

      {isExpanded ? (
        <div className="minimap-expanded" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeMap();
          }
        }}>
          <div
            ref={dialogRef}
            className="minimap-expanded__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-map-title"
            aria-describedby="expanded-map-help"
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
          >
            <header className="minimap-expanded__header">
              <div>
                <h2 id="expanded-map-title">World map <span aria-hidden="true">N↑</span></h2>
                <p id="expanded-map-help">Drag or use arrow keys/WASD to pan. Scroll or use + and − to zoom.</p>
              </div>
              <div className="minimap-expanded__actions">
                <button type="button" onClick={recenter} aria-label="Recenter map on ship" title="Recenter on ship">⌖</button>
                <button type="button" onClick={() => adjustZoom(-0.25)} aria-label="Zoom out" title="Zoom out">−</button>
                <span aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => adjustZoom(0.25)} aria-label="Zoom in" title="Zoom in">+</button>
                <button type="button" onClick={closeMap} aria-label="Close expanded map" title="Close">×</button>
              </div>
            </header>
            <div
              className="minimap-expanded__viewport"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endPointerDrag}
              onPointerCancel={endPointerDrag}
              onWheel={handleWheel}
            >
              <MapSurface
                minimapWorld={minimapWorld}
                playerPose={playerPose}
                className="minimap-expanded__surface"
                surfaceStyle={expandedSurfaceStyle}
              />
              <span className="minimap-expanded__north" aria-hidden="true">N↑</span>
            </div>
            <footer className="minimap-expanded__footer">
              <span>Seed {minimapWorld.seed}</span>
              <span>{pointSummary}</span>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
