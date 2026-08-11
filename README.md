# Pirate Game

A browser-based pirate game with Phaser-driven gameplay and a React interface.

## Development

```sh
npm install
npm run dev
npm run build
npm run preview
```

## Architecture

```mermaid
flowchart TB
  shell["Browser / game shell"]
  shell --> react["React DOM<br/>#game-ui"]
  shell --> phaser["Phaser canvas<br/>#game<br/>authoritative game state"]
  phaser -->|Typed immutable snapshots| react
  react -->|Typed action requests| phaser
```

- [React-Phaser UI Guidelines](docs/react-phaser-ui-guidelines.md)
