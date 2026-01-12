(function () {
    /**
     * BanterChess Unified Embed Script
     * Loads dependencies, initializes game logic, and renders the board in Banter.
     */

    // --- Configuration ---
    const config = {
        boardPosition: new BS.Vector3(0, 1.1, -2),
        boardRotation: new BS.Vector3(0, 0, 0),
        boardScale: new BS.Vector3(1, 1, 1),
        resetPosition: new BS.Vector3(0, 0, 2.5),
        resetRotation: new BS.Vector3(0, 0, 0),
        resetScale: new BS.Vector3(1, 1, 1),
        instance: window.location.href.split('?')[0], // Default to current URL without query params to avoid mismatches
        hideUI: false,
        hideBoard: false,
        piecesOpacity: 1.0,
        lighting: 'unlit',
        addLights: true
    };

    // Helper to parse Vector3 from string
    const parseVector3 = (str, defaultVal) => {
        if (!str) return defaultVal;
        const s = str.trim();
        if (s.includes(' ')) {
            const parts = s.split(' ').map(Number);
            if (parts.length === 3) return new BS.Vector3(parts[0], parts[1], parts[2]);
        } else {
            const val = parseFloat(s);
            if (!isNaN(val)) return new BS.Vector3(val, val, val);
        }
        return defaultVal;
    };

    // Parse URL params from this script tag
    const currentScript = document.currentScript;
    if (currentScript) {
        const url = new URL(currentScript.src);
        const params = new URLSearchParams(url.search);

        if (params.has('hideBoard')) config.hideBoard = params.get('hideBoard') === 'true';
        if (params.has('hideUI')) config.hideUI = params.get('hideUI') === 'true';
        if (params.has('instance')) config.instance = params.get('instance');
        if (params.has('lighting')) config.lighting = params.get('lighting');
        if (params.has('addLights')) config.addLights = params.get('addLights') !== 'false';

        if (params.has('piecesOpacity')) {
            const opacity = parseFloat(params.get('piecesOpacity'));
            if (!isNaN(opacity)) {
                config.piecesOpacity = Math.max(0, Math.min(1, opacity)); // Clamp between 0 and 1
            }
        }

        config.boardScale = parseVector3(params.get('boardScale'), config.boardScale);
        config.boardPosition = parseVector3(params.get('boardPosition'), config.boardPosition);
        config.boardRotation = parseVector3(params.get('boardRotation'), config.boardRotation);

        config.resetPosition = parseVector3(params.get('resetPosition'), config.resetPosition);
        config.resetRotation = parseVector3(params.get('resetRotation'), config.resetRotation);
        config.resetScale = parseVector3(params.get('resetScale'), config.resetScale);
    }

    // --- Dependency Loading ---
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    };

    const loadDependencies = async () => {
        const deps = [];
        if (typeof Chess === 'undefined') deps.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js')); // Using CDN for Embed
        await Promise.all(deps);
    };

    // --- Game Logic (ChessGame) ---
    class ChessGame {
        constructor() {
            this.chess = new Chess();
            this.onGameOverCallback = null;
        }
        reset() { this.chess.reset(); }
        loadFen(fen) {
            try {
                this.chess.load(fen);
                return true;
            } catch (e) {
                console.error("Failed to load FEN:", fen, e);
                return false;
            }
        }
        makeMove(move) {
            try {
                const result = this.chess.move(move);
                if (result) {
                    // this.checkGameOver(); // Optional for demo
                    return true;
                }
            } catch (e) { console.warn("Invalid move:", move); }
            return false;
        }
        receiveMove(move) {
            const result = this.chess.move(move);
            if (result && this.onMoveCallback) this.onMoveCallback(result);
        }
        getFen() { return this.chess.fen(); }
        getMoves(square) { return this.chess.moves({ square: square, verbose: true }); }
    }

    // --- Banter Board Logic ---
    const COLORS = {
        white: '#EEEEEE', black: '#333333', selected: '#76F250', valid: '#50ABF2',
        highlight: '#E3C662', whitePiece: '#D4AF37', blackPiece: '#222222'
    };

    function hexToVector4(hex) {
        let c = hex.substring(1);
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return new BS.Vector4(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, 1);
    }

    const state = {
        tiles: {}, pieces: {}, selectedSquare: null,
        boardRoot: null, piecesRoot: null,
        listenersSetup: false, tileSize: 0.5, boardSize: 8, offset: 0
    };
    state.offset = (state.boardSize * state.tileSize) / 2 - (state.tileSize / 2);

    async function initializeBoard() {
        state.boardRoot = await new BS.GameObject("ChessBoardRoot");

        // Transform
        let rootTrans = state.boardRoot.GetComponent(BS.ComponentType.Transform);
        if (!rootTrans) rootTrans = await state.boardRoot.AddComponent(new BS.Transform());

        // Apply Config
        rootTrans.position = config.boardPosition;
        rootTrans.localEulerAngles = config.boardRotation; // Apply Rotation
        rootTrans.localScale = config.boardScale;         // Apply Scale

        // Add lights if we are using a lit shader and the user has not disabled them.
        if (config.lighting === 'lit' && config.addLights) {
            const lightGO = await new BS.GameObject("BanterChess_DirectionalLight");
            await lightGO.SetParent(state.boardRoot, false);
            let lightTrans = await lightGO.AddComponent(new BS.Transform());
            lightTrans.localPosition = new BS.Vector3(0, 5, -5); // Above and behind the board from white's perspective
            lightTrans.localEulerAngles = new BS.Vector3(45, 0, 0); // Angled down

            // Add a directional light. BS.LightType.Directional is 1.
            await lightGO.AddComponent(new BS.Light(1, new BS.Vector4(1, 1, 1, 1), 1, 0.1));
        }

        console.log("Board Initialized with Config:", config);

        await generateTiles();

        // Check UI flag to add buttons
        if (!config.hideUI) {
            await createResetButton();
        }

        // Networking Setup
        setupBanterStateListeners();
    }

    async function createResetButton() {
        // Child of boardRoot so it scales/rotates with board
        const btn = await new BS.GameObject("ResetButton").Async();
        // FIX: SetParent with false to reset local scale relative to parent
        await btn.SetParent(state.boardRoot, false);

        // Transform: Position it "below" or "beside" the board side (z positive is "bottom" for white usually)
        let trans = await btn.AddComponent(new BS.Transform());
        trans.localPosition = config.resetPosition;
        trans.localEulerAngles = config.resetRotation;
        trans.localScale = config.resetScale;

        // Visuals: Red Box
        const w = 1.0, h = 0.2, d = 0.4;
        const geoArgs = [BS.GeometryType.BoxGeometry, null, w, h, d, 1, 1, 1, 0.5, 24, 0, 6.28, 0, 6.28, 8, false, 0.5, 0.5, 0, 1, 24, 8, 0.4, 16, 6.28, 2, 3, 5, 5, 0, ""];
        await btn.AddComponent(new BS.BanterGeometry(...geoArgs));

        const redColor = new BS.Vector4(0.8, 0.2, 0.2, 1);
        await btn.AddComponent(new BS.BanterMaterial("Unlit/Diffuse", "", redColor, BS.MaterialSide.Front, false));

        // Collider for click
        await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(w, h, d)));
        await btn.SetLayer(5); // UI Layer

        // Logic
        btn.On('click', () => {
            console.log("Requesting game reset...");
            const boardState = { fen: 'reset' };
            const stateKey = 'chess_game_' + config.instance;
            BS.BanterScene.GetInstance().SetPublicSpaceProps({ [stateKey]: JSON.stringify(boardState) });

            // Optimistically reset for the local user, as the `space-state-changed` event
            // may not fire reliably for the originating client.
            console.log("Optimistically resetting local board.");
            window.chessGame.reset();
            syncBoard();
            clearSelection();
        });
    }

    async function createBanterObject(name, parent, posLocal, colorHex, geometryType, dims) {
        const obj = await new BS.GameObject(name).Async();
        // FIX: SetParent with false to reset local scale relative to parent
        await obj.SetParent(parent, false);

        let transform = obj.GetComponent(BS.ComponentType.Transform);
        if (!transform) transform = await obj.AddComponent(new BS.Transform());
        transform.localPosition = posLocal;

        const geoArgs = getGeometryArgs(geometryType, dims);
        await obj.AddComponent(new BS.BanterGeometry(...geoArgs));

        const color = hexToVector4(colorHex);
        await obj.AddComponent(new BS.BanterMaterial("Unlit/Diffuse", "", color, BS.MaterialSide.Front, false));

        let colSize;
        if (geometryType === BS.GeometryType.BoxGeometry) {
            colSize = new BS.Vector3(dims.width, dims.height, dims.depth);
        } else {
            const r = dims.radius || dims.radiusBottom || 0.2;
            const h = dims.height || 0.6;
            colSize = new BS.Vector3(r * 2, h, r * 2);
        }
        await obj.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), colSize));
        await obj.SetLayer(5); // UI Layer
        return obj;
    }

    function getGeometryArgs(type, d) {
        return [
            type, null, d.width || 1, d.height || 1, d.depth || 1, 1, 1, 1,
            d.radius || 0.5, 24, 0, 6.283185, 0, 6.283185, 8, false,
            d.radiusTop || d.radius || 0.5, d.radiusBottom || d.radius || 0.5,
            0, 1, 24, 8, 0.4, 16, 6.283185, 2, 3, 5, 5, 0, ""
        ];
    }

    async function generateTiles() {
        const size = state.tileSize;
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                const file = letters[x];
                const rank = z + 1;
                const squareId = `${file}${rank}`;
                const isWhite = (x + z) % 2 === 1;
                const xPos = (x * size) - state.offset;
                const zPos = -((rank - 1) * size) + state.offset;

                const tile = await createBanterObject(`Tile_${squareId}`, state.boardRoot, new BS.Vector3(xPos, 0, zPos),
                    isWhite ? COLORS.white : COLORS.black, BS.GeometryType.BoxGeometry, { width: 0.5, height: 0.1, depth: 0.5 });

                tile.On('click', () => handleSquareClick(squareId));
                state.tiles[squareId] = tile;

                // Set initial color/transparency now that the tile is created
                setMaterialColor(tile, isWhite ? COLORS.white : COLORS.black);
            }
        }
        // Initial Sync
        await syncBoard();
    }

    const PIECE_MODELS = {
        'p': 'Pawn.glb', 'r': 'Rook.glb', 'n': 'Knight.glb',
        'b': 'Bishop.glb', 'q': 'Queen.glb', 'k': 'King.glb'
    };

    function getSquarePos(squareId) {
        const size = state.tileSize;
        const xIndex = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].indexOf(squareId[0]);
        const rank = parseInt(squareId[1]);
        const xPos = (xIndex * size) - state.offset;
        const zPos = -((rank - 1) * size) + state.offset;
        // Base raising to sit on board. 
        return new BS.Vector3(xPos, 0.15, zPos);
    }

    // HELPER: Get adjusted position for a specific piece type
    function getPiecePos(squareId, char) {
        const pos = getSquarePos(squareId);
        const type = char.toLowerCase();

        // Fine-tune Y heights per piece type
        const Y_ADJUSTMENTS = {
            'r': -0.01, // Rook
            'n': 0.04, // Knight
            'b': 0.03, // Bishop
            'q': 0.1, // Queen
            'k': 0.11  // King
        };

        if (Y_ADJUSTMENTS[type]) {
            pos.y += Y_ADJUSTMENTS[type];
        }
        return pos;
    }

    function getModelUrl(modelName) {
        try {
            // Use the captured 'currentScript' variable from the top of the IIFE
            if (currentScript) {
                // .../js/embed.js -> .../models/Name.glb
                return new URL(`../models/${modelName}`, currentScript.src).href;
            }
        } catch (e) { console.error("Error resolving model URL:", e); }
        // Fallback if script tag parsing failed
        return `models/${modelName}`;
    }

    async function createPiece(char, squareId, parent) {
        try {
            console.log(`Creating piece ${char} at ${squareId}`);
            const isWhite = char === char.toUpperCase();
            const type = char.toLowerCase();
            const modelName = PIECE_MODELS[type];
            if (!modelName) {
                console.error(`No model for type ${type}`);
                return null;
            }

            const piece = await new BS.GameObject(`Piece_${type}_${Math.random().toString(36).substr(2, 5)}`).Async();
            await piece.SetParent(parent, false);

            let transform = piece.GetComponent(BS.ComponentType.Transform);
            if (!transform) transform = await piece.AddComponent(new BS.Transform());

            // USE HELPER for position - a piece's position is its square
            transform.localPosition = getPiecePos(squareId, char);
            transform.localScale = new BS.Vector3(1, 1, 1);

            // The piece's root object should not be rotated.
            // Create a child "model" object to contain the GLTF and its rotation.
            const model = await new BS.GameObject(`Model_${type}`).Async();
            await model.SetParent(piece, false);

            let modelTransform = await model.AddComponent(new BS.Transform());
            modelTransform.localEulerAngles = new BS.Vector3(0, isWhite ? 180 : 0, 0);
            modelTransform.localScale = new BS.Vector3(1, 1, 1);

            // CHANGED: Use subfolders for White/Black models
            const folder = isWhite ? 'White' : 'Black';
            const url = getModelUrl(`${folder}/${modelName}`);
            console.log(`Loading GLB from: ${url}`);

            try {
                // Attach GLTF to the model sub-object
                await model.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));

                // If using lit lighting, add a standard material to override the GLTF's unlit one.
                if (config.lighting === 'lit') {
                    const colorHex = isWhite ? COLORS.whitePiece : COLORS.blackPiece;
                    const colorVec4 = hexToVector4(colorHex);
                    // This is a speculative change. It assumes adding a new BanterMaterial will
                    // override the material of the loaded GLTF. The "Standard" shader is also a guess.
                    await model.AddComponent(new BS.BanterMaterial("Standard", "", colorVec4, BS.MaterialSide.Front, false));
                } else {
                    // For unlit, we'll apply our own material to control color and transparency.
                    const colorHex = isWhite ? COLORS.whitePiece : COLORS.blackPiece;
                    const colorVec4 = hexToVector4(colorHex);
                    colorVec4.w = config.piecesOpacity; // Set alpha

                    // Use the transparent shader if opacity is less than 1
                    const shader = config.piecesOpacity < 1.0 ? 'Unlit/DiffuseTransparent' : 'Unlit/Diffuse';
                    
                    await model.AddComponent(new BS.BanterMaterial(shader, "", colorVec4, BS.MaterialSide.Front, false));
                }
            } catch (glbErr) {
                console.error(`Failed to load GLTF for ${char}:`, glbErr);
            }

            // Collider for click - Stays on the main piece object for correct click handling
            await piece.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0.15, 0), new BS.Vector3(0.2, 0.15, 0.2)));
            await piece.SetLayer(5); // UI layer

            piece.On('click', () => {
                const currentSq = Object.keys(state.pieces).find(key => state.pieces[key] === piece);
                console.log(`Piece clicked: ${char} at ${currentSq}`);
                if (currentSq) handleSquareClick(currentSq);
            });

            piece.pieceType = char;
            return piece;
        } catch (e) {
            console.error(`Failed to create piece ${char} at ${squareId}:`, e);
            return null;
        }
    }

    async function syncBoard() {
        console.log("Syncing board...");
        if (!state.piecesRoot) {
            state.piecesRoot = await new BS.GameObject("PiecesContainer").Async();
            await state.piecesRoot.SetParent(state.boardRoot, false);
            let trans = await state.piecesRoot.AddComponent(new BS.Transform());
            trans.localPosition = new BS.Vector3(0, 0, 0);
        }

        const fen = window.chessGame.getFen();
        const rows = fen.split(' ')[0].split('/');
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const newBoardState = {};

        // 1. Map current board state based on FEN
        rows.forEach((row, rowIndex) => {
            const rank = 8 - rowIndex;
            let fileIndex = 0;
            for (let char of row) {
                if (parseInt(char)) fileIndex += parseInt(char);
                else {
                    newBoardState[`${letters[fileIndex]}${rank}`] = char;
                    fileIndex++;
                }
            }
        });

        // 2. Prepare pool of available pieces from current state
        const availablePieces = {}; // char -> [GameObject]
        if (state.pieces) {
            Object.values(state.pieces).forEach(p => {
                const type = p.pieceType;
                if (!availablePieces[type]) availablePieces[type] = [];
                availablePieces[type].push(p);
            });
        }

        const nextPiecesMap = {};
        const pendingSquares = [];

        // 3. PASS 1: Keep pieces in place if possible
        for (const [sq, char] of Object.entries(newBoardState)) {
            const existingPieceOnSquare = state.pieces ? state.pieces[sq] : null;
            if (existingPieceOnSquare && existingPieceOnSquare.pieceType === char) {
                // Exact match in place - LOCK IT
                nextPiecesMap[sq] = existingPieceOnSquare;

                // Remove from pool so it can't be stolen
                const list = availablePieces[char];
                if (list) {
                    const idx = list.indexOf(existingPieceOnSquare);
                    if (idx > -1) list.splice(idx, 1);
                }
            } else {
                // Needs a piece, try to resolve in Pass 2
                pendingSquares.push({ sq, char });
            }
        }

        // 4. PASS 2: Fill gaps (moved pieces or new promotions)
        for (const { sq, char } of pendingSquares) {
            let piece = null;
            if (availablePieces[char] && availablePieces[char].length > 0) {
                // Reuse a piece that moved from somewhere else
                piece = availablePieces[char].pop();
                const trans = piece.GetComponent(BS.ComponentType.Transform);
                // FIX: Use getPiecePos so moved pieces keep their Y-offset
                if (trans) trans.localPosition = getPiecePos(sq, char);
            } else {
                // Determine creation parent (piecesRoot)
                piece = await createPiece(char, sq, state.piecesRoot);
            }

            if (piece) {
                nextPiecesMap[sq] = piece;
            }
        }

        // 5. Destroy unused pieces (captured)
        for (const list of Object.values(availablePieces)) {
            for (const p of list) {
                p.Destroy();
            }
        }

        // 6. Update State
        state.pieces = nextPiecesMap;
        console.log("Board sync complete.");
    }

    function setMaterialColor(go, hexColor) {
        if (!go) return;
        const mat = go.GetComponent(BS.ComponentType.BanterMaterial);
        if (mat) {
            const newColor = hexToVector4(hexColor);
            // If board is hidden, adjust tile alpha.
            if (config.hideBoard && go.name.startsWith("Tile_")) {
                if (hexColor === COLORS.selected || hexColor === COLORS.valid) {
                    newColor.w = 0.5; // Make selection/valid moves semi-transparent
                } else {
                    newColor.w = 0; // Keep normal tiles fully transparent
                }
            }
            mat.color = newColor;
        } else {
            console.warn("No BanterMaterial found on", go.name);
        }
    }

    function handleSquareClick(squareId) {
        const game = window.chessGame;
        if (!state.selectedSquare) {
            if (game.chess.get(squareId)) {
                state.selectedSquare = squareId;
                if (state.tiles[squareId]) setMaterialColor(state.tiles[squareId], COLORS.selected);
                game.getMoves(squareId).forEach(m => {
                    if (state.tiles[m.to]) setMaterialColor(state.tiles[m.to], COLORS.valid);
                });
            }
            return;
        }


        const move = { from: state.selectedSquare, to: squareId, promotion: 'q' };
        if (game.makeMove(move)) {
            const fen = game.getFen();
            const boardState = { fen: fen };
            const stateKey = 'chess_game_' + config.instance;
            BS.BanterScene.GetInstance().SetPublicSpaceProps({ [stateKey]: JSON.stringify(boardState) });

            // Optimistically sync the board for the local player, as the space-state-changed
            // event might not fire reliably for the client that initiated the change.
            console.log("Optimistically syncing local board after move.");
            syncBoard();

            // The syncBoard() call is implicit via the event listener now, but we can clear selection optimistically.
            clearSelection();
        } else {
            clearSelection();
            if (game.chess.get(squareId)) handleSquareClick(squareId); // Retry selection
        }
    }

    function clearSelection() {
        state.selectedSquare = null;
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                const id = `${letters[x]}${z + 1}`;
                const isWhite = (x + z) % 2 === 1;
                if (state.tiles[id]) setMaterialColor(state.tiles[id], isWhite ? COLORS.white : COLORS.black);
            }
        }
    }

    async function getSpaceStateValue(key) {
        const scene = BS.BanterScene.GetInstance();
        while (!scene.localUser || scene.localUser.uid === undefined) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        const spaceState = scene.spaceState;
        if (spaceState.protected && spaceState.protected[key]) return spaceState.protected[key];
        if (spaceState.public && spaceState.public[key]) return spaceState.public[key];
        return null;
    }

    async function setupBanterStateListeners() {
        if (state.listenersSetup) return;
        state.listenersSetup = true;

        const scene = BS.BanterScene.GetInstance();
        const stateKey = 'chess_game_' + config.instance;

        // Listen for space state changes
        scene.On("space-state-changed", (e) => {
            const changes = e.detail.changes;
            // The `changes` array contains objects, so we need to check the `property` of each one.
            if (changes && changes.find(c => c.property === stateKey)) {
                const spaceState = scene.spaceState;
                const val = (spaceState.public && spaceState.public[stateKey]) || (spaceState.protected && spaceState.protected[stateKey]);
                
                if (val) {
                    try {
                        const gameState = JSON.parse(val);
                        console.log("Syncing game state from space:", gameState);
                        if (gameState.fen === 'reset') {
                            window.chessGame.reset();
                            syncBoard();
                            clearSelection();
                        } else if (gameState.fen) {
                            window.chessGame.loadFen(gameState.fen);
                            syncBoard();
                        }
                    } catch (err) {
                        console.error("Error parsing game state:", err);
                    }
                }
            }
        });

        // Initial load
        const initialVal = await getSpaceStateValue(stateKey);
        if (initialVal) {
            try {
                const gameState = JSON.parse(initialVal);
                console.log("Loaded initial game state:", gameState);
                if (gameState.fen) {
                    window.chessGame.loadFen(gameState.fen);
                    syncBoard();
                }
            } catch (err) {
                console.error("Error parsing initial game state:", err);
            }
        }
        
        // The board is now synced only through space state changes.
    }

    // --- Scene Logic ---
    // --- Main Initializer ---
    async function init() {
        await loadDependencies();

        // Initialize Game
        if (!window.chessGame) {
            window.chessGame = new ChessGame();
        }

        if (window.BS) {
            BS.BanterScene.GetInstance().On("unity-loaded", async () => {
                console.log("Banter Unity Loaded. Initializing scene...");
                // Note: Floor creation removed as per user request. 
                // Host spaces should provide their own ground/environment.
                await initializeBoard();
            });
        } else {
            console.error("Banter SDK (BS) not found.");
        }
    }

    init();

})();
