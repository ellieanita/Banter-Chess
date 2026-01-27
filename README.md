# BanterChess

**A serverless, 3D chess game for the Banter platform.**

This project provides a fully interactive 3D chess game that can be dropped into any Banter world. It is designed to be **serverless**, meaning it doesn't require any backend infrastructure and can be hosted on any static file host (like GitHub Pages).

## Features
- **3D Chess Board**: A fully interactive 3D chess board rendered directly in your Banter space.
- **Serverless Real-time Multiplayer**: Game state is synced between players using Banter's public space properties, removing the need for a backend server.
- **Static Host Ready**: Can be deployed and run from any static web host.
- **Multiple Games**: Supports multiple, independent chess games in the same Banter space via a simple configuration.
- **Customizable**: The board's position, rotation, and scale are easily configurable.

## How It Works
The game operates using a single JavaScript file (`Chess.js`) that you include in your Banter space.
- **Game Logic**: Core chess rules, move validation, and FEN state management are handled by the powerful `chess.js` library.
- **3D Rendering**: The board and pieces are created at runtime as `GameObject` instances using the Banter SDK. Piece models are loaded from the `models` directory.
- **State Synchronization**: There is no server. When a player makes a move, the new game state (in FEN format) is written to Banter's `public` space state. All game clients listen for the `space-state-changed` event and update their boards accordingly, ensuring everyone stays in sync.

## Usage

To add the chess board to your Banter world, you simply need to host these files on a static host (like GitHub Pages) and then add a single `<script>` tag to your world's HTML.

**1. Host the Files**
Upload the contents of this repository to your static hosting provider.

**2. Add to Banter**
Add the following HTML to your space's configuration, replacing the `src` URL with the path to the `Chess.js` file on your host.

```html
<!-- 
  Add this script tag to your Banter world's HTML.
  Example uses GitHub Pages. Replace `your-github-username` with your username.
-->
<script src="https://banter-chess.firer.at/Chess.js"></script>
```

The game will appear at the default position in your world.

## Project Structure
- `index.html`: An example HTML file for loading the game. This can be used to test the game or as a basis for your Banter world's HTML.
- `Chess.js`: The all-in-one script that contains the game's logic, rendering, and networking code.
- `models/`: Contains the `.glb` 3D models for the white and black chess pieces.
- `README.md`: This file.

## Configuration
You can customize the game's appearance and position by appending URL parameters to the `Chess.js` script source.

**Example:**
Place a smaller, rotated board inside your world.
```html
<script src="https://banter-chess.firer.at/Chess.js?boardPosition=5+1.5+-2&boardScale=0.8&boardRotation=0+30+0"></script>
```

**Multiple Instances:**
To have multiple, independent chess games in the same space, add a unique `instance` name to each script URL.

```html
<!-- Game in the Lobby -->
<script src="https://banter-chess.firer.at/Chess.js?instance=lobby_game"></script>

<!-- Game by the Fireside -->
<script src="https://banter-chess.firer.at/Chess.js?instance=fireside_game&boardPosition=10+1+-5"></script>
```

### All Parameters
- `instance`: A unique ID for the game board. Use this to have multiple separate games in one Banter space. (Default: the page URL)
- `boardPosition`: The `x y z` position of the board in the world. (Default: `0 1.1 -2`)
- `boardRotation`: The `x y z` rotation of the board in degrees. (Default: `0 0 0`)
- `boardScale`: A uniform scale `s` or per-axis `x y z` scale. (Default: `1`)
- `lighting`: Set to `lit` to use physically-based lit materials that respond to scene lights. (Default: `unlit`)
- `addLights`: When `lighting=lit`, this controls whether a default directional light is added. Set to `false` if you have your own lights. (Default: `true`)
- `hideUI`: Set to `true` to hide the Reset button. (Default: `false`)
- `resetPosition`: The `x y z` position of the reset button relative to the board. (Default: `0 0 2.5`)
- `resetRotation`: The `x y z` rotation of the reset button. (Default: `0 0 0`)
- `resetScale`: The `x y z` scale of the reset button. (Default: `1 1 1`)
