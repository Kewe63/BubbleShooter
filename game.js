import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';

// User data
let currentUser = null;
let walletAddress = null;
let leaderboard = [];

// Initialize Farcaster SDK and get user context
async function initFarcaster() {
    try {
        sdk.actions.ready();
        
        // Get user context from Farcaster
        const context = await sdk.context;
        console.log('Farcaster context:', context);
        
        if (context && context.user) {
            currentUser = {
                fid: context.user.fid,
                username: context.user.username || `User${context.user.fid}`,
                displayName: context.user.displayName || context.user.username,
                pfp: context.user.pfpUrl
            };
            
            document.getElementById('username').textContent = '@' + currentUser.username;
        } else {
            document.getElementById('username').textContent = 'Bağlan';
        }
        
        // Load leaderboard
        loadLeaderboard();
    } catch (e) {
        console.log('Farcaster context not available:', e);
        document.getElementById('username').textContent = 'Bağlan';
        loadLeaderboard();
    }
}

// Connect wallet using Farcaster SDK
async function connectWallet() {
    try {
        // Check if we have Farcaster context
        const context = await sdk.context;
        
        if (context && context.user) {
            currentUser = {
                fid: context.user.fid,
                username: context.user.username || `User${context.user.fid}`,
                displayName: context.user.displayName || context.user.username,
                pfp: context.user.pfpUrl
            };
            document.getElementById('username').textContent = '@' + currentUser.username;
        }
        
        // Try to get wallet address using ethProvider
        if (sdk.wallet && sdk.wallet.ethProvider) {
            const provider = sdk.wallet.ethProvider;
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            
            if (accounts && accounts.length > 0) {
                walletAddress = accounts[0];
                const shortAddress = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
                
                if (currentUser) {
                    document.getElementById('username').textContent = '@' + currentUser.username;
                } else {
                    document.getElementById('username').textContent = shortAddress;
                    currentUser = {
                        fid: walletAddress,
                        username: shortAddress,
                        displayName: shortAddress
                    };
                }
                
                localStorage.setItem('bubbleWallet', walletAddress);
                showOverlay('Bağlandı! ✅', `Cüzdan: ${shortAddress}`, 'Tamam');
            }
        } else {
            // Fallback: try window.ethereum
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                    walletAddress = accounts[0];
                    const shortAddress = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
                    document.getElementById('username').textContent = shortAddress;
                    
                    currentUser = {
                        fid: walletAddress,
                        username: shortAddress,
                        displayName: shortAddress
                    };
                    
                    localStorage.setItem('bubbleWallet', walletAddress);
                    showOverlay('Bağlandı! ✅', `Cüzdan: ${shortAddress}`, 'Tamam');
                }
            } else {
                // No wallet available - create guest
                createGuestUser();
            }
        }
    } catch (e) {
        console.error('Wallet connection error:', e);
        // Create guest user as fallback
        createGuestUser();
    }
}

function createGuestUser() {
    const guestId = Math.floor(Math.random() * 100000);
    currentUser = {
        fid: guestId,
        username: `Misafir${guestId}`,
        displayName: `Misafir ${guestId}`
    };
    localStorage.setItem('bubbleUser', JSON.stringify(currentUser));
    document.getElementById('username').textContent = currentUser.username;
    showOverlay('Misafir Mod', 'Cüzdan bulunamadı.\nMisafir olarak devam ediyorsun.', 'Tamam');
}

// Leaderboard functions
function loadLeaderboard() {
    const saved = localStorage.getItem('bubbleLeaderboard');
    if (saved) {
        leaderboard = JSON.parse(saved);
    }
    updateLeaderboardDisplay();
}

function saveToLeaderboard(playerScore) {
    if (!currentUser) return;
    
    // Find existing entry
    const existingIndex = leaderboard.findIndex(e => e.fid === currentUser.fid);
    
    if (existingIndex >= 0) {
        // Update if new score is higher
        if (playerScore > leaderboard[existingIndex].score) {
            leaderboard[existingIndex].score = playerScore;
            leaderboard[existingIndex].date = Date.now();
        }
    } else {
        // Add new entry
        leaderboard.push({
            fid: currentUser.fid,
            username: currentUser.username,
            displayName: currentUser.displayName,
            score: playerScore,
            date: Date.now()
        });
    }
    
    // Sort by score descending
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep top 100
    leaderboard = leaderboard.slice(0, 100);
    
    // Save
    localStorage.setItem('bubbleLeaderboard', JSON.stringify(leaderboard));
    updateLeaderboardDisplay();
}

function updateLeaderboardDisplay() {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;
    
    if (leaderboard.length === 0) {
        listEl.innerHTML = '<p style="color: #888; text-align: center;">Henüz skor yok</p>';
        return;
    }
    
    listEl.innerHTML = leaderboard.slice(0, 20).map((entry, index) => {
        const rankClass = index === 0 ? '' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'normal';
        const rankSymbol = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
        const isCurrentUser = currentUser && entry.fid === currentUser.fid;
        
        return `
            <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
                <span class="rank ${rankClass}">${rankSymbol}</span>
                <span class="player-name">@${entry.username}</span>
                <span class="player-score">${entry.score.toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

function showLeaderboard() {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
}

function hideLeaderboard() {
    document.getElementById('leaderboard-modal').classList.add('hidden');
}

// Initialize Farcaster
initFarcaster();

// Game Constants
const BUBBLE_RADIUS = 18;
const GRID_COLS = 11;
const BUBBLE_COLORS = ['#E63946', '#457B9D', '#2A9D8F', '#F4A261', '#FFD60A', '#00BBF9'];
const SHOOT_SPEED = 12;

// Game State
let canvas, ctx;
let canvasWidth, canvasHeight;
let grid = [];
let shooterBubble = null;
let nextBubbleColor = null;
let aimAngle = -Math.PI / 2;
let isAiming = false;
let isShooting = false;
let isPaused = false;
let gameOver = false;
let levelComplete = false;

let score = 0;
let highScore = parseInt(localStorage.getItem('bubbleHighScore')) || 0;
let level = 1;
let shotsCount = 0;
let comboChain = 0;

// Bubble Pool
const bubblePool = [];
const MAX_POOL_SIZE = 200;

// Level Configuration
const levelConfigs = [
    { colors: 3, rows: 4 },
    { colors: 3, rows: 5 },
    { colors: 4, rows: 5 },
    { colors: 4, rows: 6 },
    { colors: 5, rows: 6 },
    { colors: 5, rows: 7 },
    { colors: 6, rows: 7 },
    { colors: 6, rows: 8 },
    { colors: 6, rows: 9 },
    { colors: 6, rows: 10 }
];

// Bubble class
class Bubble {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.color = BUBBLE_COLORS[0];
        this.vx = 0;
        this.vy = 0;
        this.row = -1;
        this.col = -1;
        this.active = false;
        this.popping = false;
        this.popScale = 1;
        this.falling = false;
        this.fallSpeed = 0;
    }

    reset() {
        this.vx = 0;
        this.vy = 0;
        this.row = -1;
        this.col = -1;
        this.active = false;
        this.popping = false;
        this.popScale = 1;
        this.falling = false;
        this.fallSpeed = 0;
    }

    draw() {
        if (!this.active) return;
        
        ctx.save();
        
        if (this.popping) {
            ctx.globalAlpha = this.popScale;
            ctx.translate(this.x, this.y);
            ctx.scale(this.popScale, this.popScale);
            ctx.translate(-this.x, -this.y);
        }
        
        // Main bubble
        const gradient = ctx.createRadialGradient(
            this.x - BUBBLE_RADIUS * 0.3,
            this.y - BUBBLE_RADIUS * 0.3,
            BUBBLE_RADIUS * 0.1,
            this.x,
            this.y,
            BUBBLE_RADIUS
        );
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 30));
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Highlight
        ctx.beginPath();
        ctx.arc(this.x - BUBBLE_RADIUS * 0.25, this.y - BUBBLE_RADIUS * 0.25, BUBBLE_RADIUS * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
        
        ctx.restore();
    }

    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}

// Get bubble from pool
function getBubble() {
    for (let bubble of bubblePool) {
        if (!bubble.active) {
            bubble.active = true;
            return bubble;
        }
    }
    if (bubblePool.length < MAX_POOL_SIZE) {
        const bubble = new Bubble();
        bubble.active = true;
        bubblePool.push(bubble);
        return bubble;
    }
    return null;
}

// Return bubble to pool
function returnBubble(bubble) {
    bubble.reset();
}

// Grid functions
function getGridX(row, col) {
    const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
    return col * BUBBLE_RADIUS * 2 + BUBBLE_RADIUS + offset;
}

function getGridY(row) {
    return row * BUBBLE_RADIUS * 1.73 + BUBBLE_RADIUS + 35;
}

function getGridPosition(x, y) {
    // Calculate approximate row
    let row = Math.floor((y - 35) / (BUBBLE_RADIUS * 1.73));
    row = Math.max(0, row);
    
    // Check both this row and adjacent rows to find the closest cell
    let bestRow = row;
    let bestCol = 0;
    let bestDist = Infinity;
    
    for (let r = Math.max(0, row - 1); r <= row + 1; r++) {
        const maxCols = getMaxCols(r);
        for (let c = 0; c < maxCols; c++) {
            const cellX = getGridX(r, c);
            const cellY = getGridY(r);
            const dist = Math.sqrt((x - cellX) ** 2 + (y - cellY) ** 2);
            
            if (dist < bestDist) {
                bestDist = dist;
                bestRow = r;
                bestCol = c;
            }
        }
    }
    
    return { row: bestRow, col: bestCol };
}

function getMaxCols(row) {
    return row % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
}

// Initialize grid
function initGrid() {
    grid = [];
    const config = levelConfigs[Math.min(level - 1, levelConfigs.length - 1)];
    const numColors = config.colors;
    const numRows = config.rows;
    
    for (let row = 0; row < numRows; row++) {
        grid[row] = [];
        const maxCols = getMaxCols(row);
        for (let col = 0; col < maxCols; col++) {
            const bubble = getBubble();
            if (bubble) {
                bubble.x = getGridX(row, col);
                bubble.y = getGridY(row);
                bubble.row = row;
                bubble.col = col;
                bubble.color = BUBBLE_COLORS[Math.floor(Math.random() * numColors)];
                grid[row][col] = bubble;
            }
        }
    }
}

// Create shooter bubble
function createShooterBubble() {
    if (nextBubbleColor === null) {
        nextBubbleColor = getRandomBubbleColor();
    }
    
    shooterBubble = getBubble();
    if (shooterBubble) {
        shooterBubble.x = canvasWidth / 2;
        shooterBubble.y = canvasHeight - 50;
        shooterBubble.color = nextBubbleColor;
    }
    
    nextBubbleColor = getRandomBubbleColor();
    updateNextBubbleUI();
}

function getRandomBubbleColor() {
    const config = levelConfigs[Math.min(level - 1, levelConfigs.length - 1)];
    
    // Collect all remaining bubbles
    const remainingBubbles = [];
    for (let row of grid) {
        if (row) {
            for (let bubble of row) {
                if (bubble && bubble.active && !bubble.popping && !bubble.falling) {
                    remainingBubbles.push(bubble);
                }
            }
        }
    }
    
    // If 2 or fewer bubbles remain and they're the same color, return that color
    if (remainingBubbles.length <= 2 && remainingBubbles.length > 0) {
        const firstColor = remainingBubbles[0].color;
        const allSameColor = remainingBubbles.every(b => b.color === firstColor);
        if (allSameColor) {
            return firstColor;
        }
    }
    
    // Get colors in grid
    const colorsInGrid = new Set();
    for (let bubble of remainingBubbles) {
        colorsInGrid.add(bubble.color);
    }
    
    // 80% chance to pick a color that exists in grid
    if (colorsInGrid.size > 0 && Math.random() < 0.8) {
        const colors = Array.from(colorsInGrid);
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    return BUBBLE_COLORS[Math.floor(Math.random() * config.colors)];
}

function updateNextBubbleUI() {
    const nextBubbleEl = document.getElementById('next-bubble');
    if (nextBubbleEl && nextBubbleColor) {
        nextBubbleEl.style.background = `radial-gradient(circle at 30% 30%, #fff, ${nextBubbleColor})`;
    }
}

// Shooting
function shoot() {
    if (!shooterBubble || isShooting || isPaused || gameOver) return;
    
    isShooting = true;
    shooterBubble.vx = Math.cos(aimAngle) * SHOOT_SPEED;
    shooterBubble.vy = Math.sin(aimAngle) * SHOOT_SPEED;
    shotsCount++;
}

// Update shooter bubble
function updateShooterBubble() {
    if (!shooterBubble || !isShooting) return;
    
    // Move bubble
    shooterBubble.x += shooterBubble.vx;
    shooterBubble.y += shooterBubble.vy;
    
    // Wall bounce - handle multiple bounces in case of high speed
    const leftBound = BUBBLE_RADIUS;
    const rightBound = canvasWidth - BUBBLE_RADIUS;
    
    // Left wall
    if (shooterBubble.x < leftBound) {
        shooterBubble.x = leftBound + (leftBound - shooterBubble.x);
        shooterBubble.vx = Math.abs(shooterBubble.vx); // Always go right after left wall
    }
    // Right wall
    else if (shooterBubble.x > rightBound) {
        shooterBubble.x = rightBound - (shooterBubble.x - rightBound);
        shooterBubble.vx = -Math.abs(shooterBubble.vx); // Always go left after right wall
    }
    
    // Clamp position to prevent escaping bounds
    shooterBubble.x = Math.max(leftBound, Math.min(rightBound, shooterBubble.x));
    
    // Top collision
    if (shooterBubble.y - BUBBLE_RADIUS <= 35) {
        shooterBubble.y = BUBBLE_RADIUS + 35;
        snapBubbleToGrid();
        return;
    }
    
    // Grid collision - check all active bubbles
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (!bubble || !bubble.active || bubble.popping || bubble.falling) continue;
            
            const dx = shooterBubble.x - bubble.x;
            const dy = shooterBubble.y - bubble.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Collision threshold
            if (dist < BUBBLE_RADIUS * 1.9) {
                snapBubbleToGrid();
                return;
            }
        }
    }
}

// Check if a cell is truly empty
function isCellEmpty(row, col) {
    if (row < 0 || col < 0 || col >= getMaxCols(row)) return false;
    if (!grid[row]) return true;
    if (!grid[row][col]) return true;
    if (!grid[row][col].active) return true;
    if (grid[row][col].popping || grid[row][col].falling) return true;
    return false;
}

// Find the best empty cell to place a bubble
function findBestEmptyCell(x, y) {
    let candidates = [];
    
    // Search a reasonable range of rows and columns
    const approxRow = Math.floor((y - 35) / (BUBBLE_RADIUS * 1.73));
    const startRow = Math.max(0, approxRow - 1);
    const endRow = Math.max(0, approxRow + 2);
    
    for (let r = startRow; r <= endRow; r++) {
        // Ensure row exists
        while (grid.length <= r) grid.push([]);
        
        const maxCols = getMaxCols(r);
        for (let c = 0; c < maxCols; c++) {
            // Check if cell is truly empty
            if (!isCellEmpty(r, c)) continue;
            
            const cellX = getGridX(r, c);
            const cellY = getGridY(r);
            const dist = Math.sqrt((x - cellX) ** 2 + (y - cellY) ** 2);
            
            // Check if this cell is adjacent to any existing bubble or is in row 0
            const hasAdjacentBubble = r === 0 || hasNeighborBubble(r, c);
            
            if (hasAdjacentBubble) {
                candidates.push({ row: r, col: c, dist: dist, priority: 1 });
            } else {
                candidates.push({ row: r, col: c, dist: dist, priority: 2 });
            }
        }
    }
    
    // Sort by priority first, then by distance
    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.dist - b.dist;
    });
    
    // Return the best candidate
    if (candidates.length > 0) {
        return { row: candidates[0].row, col: candidates[0].col };
    }
    
    return null;
}

// Check if a cell has any neighboring bubbles
function hasNeighborBubble(row, col) {
    const isOddRow = row % 2 === 1;
    
    const offsets = isOddRow ? [
        [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, 0], [1, 1]
    ] : [
        [-1, -1], [-1, 0],
        [0, -1], [0, 1],
        [1, -1], [1, 0]
    ];
    
    for (let [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        
        if (r >= 0 && r < grid.length && c >= 0 && c < getMaxCols(r)) {
            if (grid[r] && grid[r][c] && grid[r][c].active && !grid[r][c].popping && !grid[r][c].falling) {
                return true;
            }
        }
    }
    
    return false;
}

// Snap bubble to grid
function snapBubbleToGrid() {
    // Find the best cell to place the bubble
    let cell = findBestEmptyCell(shooterBubble.x, shooterBubble.y);
    
    // Double check that the cell is really empty
    if (cell && !isCellEmpty(cell.row, cell.col)) {
        cell = null;
    }
    
    if (!cell) {
        // Fallback: find any empty cell near the collision point
        const approxRow = Math.max(0, Math.floor((shooterBubble.y - 35) / (BUBBLE_RADIUS * 1.73)));
        
        for (let r = approxRow; r <= approxRow + 3; r++) {
            while (grid.length <= r) grid.push([]);
            const maxCols = getMaxCols(r);
            
            for (let c = 0; c < maxCols; c++) {
                if (isCellEmpty(r, c)) {
                    cell = { row: r, col: c };
                    break;
                }
            }
            if (cell) break;
        }
    }
    
    if (!cell) {
        // Last resort: place at row 0
        for (let c = 0; c < getMaxCols(0); c++) {
            if (isCellEmpty(0, c)) {
                cell = { row: 0, col: c };
                break;
            }
        }
    }
    
    if (cell) {
        // Ensure row exists
        while (grid.length <= cell.row) grid.push([]);
        
        // Clear any existing bubble at this position (safety check)
        if (grid[cell.row][cell.col] && grid[cell.row][cell.col] !== shooterBubble) {
            returnBubble(grid[cell.row][cell.col]);
        }
        
        shooterBubble.row = cell.row;
        shooterBubble.col = cell.col;
        shooterBubble.x = getGridX(cell.row, cell.col);
        shooterBubble.y = getGridY(cell.row);
        shooterBubble.vx = 0;
        shooterBubble.vy = 0;
        grid[cell.row][cell.col] = shooterBubble;
        
        // Check matches
        const matches = findMatches(shooterBubble);
        if (matches.length >= 3) {
            popBubbles(matches);
        }
    }
    
    // Check game state (win/lose)
    checkGameState();
    
    isShooting = false;
    shooterBubble = null;
    
    if (!gameOver && !levelComplete) {
        setTimeout(createShooterBubble, 100);
    }
}

// Find matching bubbles (flood fill)
function findMatches(startBubble) {
    const matches = [];
    const visited = new Set();
    const queue = [startBubble];
    
    while (queue.length > 0) {
        const bubble = queue.shift();
        const key = `${bubble.row},${bubble.col}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        
        if (bubble.color !== startBubble.color) continue;
        
        matches.push(bubble);
        
        // Get neighbors
        const neighbors = getNeighbors(bubble.row, bubble.col);
        for (let n of neighbors) {
            if (!visited.has(`${n.row},${n.col}`)) {
                queue.push(n);
            }
        }
    }
    
    return matches;
}

// Get neighboring bubbles
function getNeighbors(row, col) {
    const neighbors = [];
    const isOddRow = row % 2 === 1;
    
    const offsets = isOddRow ? [
        [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, 0], [1, 1]
    ] : [
        [-1, -1], [-1, 0],
        [0, -1], [0, 1],
        [1, -1], [1, 0]
    ];
    
    for (let [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        
        if (r >= 0 && r < grid.length && c >= 0 && c < getMaxCols(r)) {
            if (grid[r] && grid[r][c] && grid[r][c].active && !grid[r][c].popping) {
                neighbors.push(grid[r][c]);
            }
        }
    }
    
    return neighbors;
}

// Pop bubbles
function popBubbles(bubbles) {
    comboChain++;
    let poppedCount = bubbles.length;
    
    for (let bubble of bubbles) {
        bubble.popping = true;
    }
    
    // Find floating bubbles
    setTimeout(() => {
        const floating = findFloatingBubbles();
        poppedCount += floating.length;
        
        for (let bubble of floating) {
            bubble.falling = true;
            bubble.fallSpeed = 2;
        }
        
        // Calculate score
        const baseScore = poppedCount * 10;
        const comboBonus = comboChain * 5;
        const dropBonus = floating.length * 20;
        
        score += baseScore + comboBonus + dropBonus;
        updateUI();
        
        // Clean up after animation
        setTimeout(() => {
            for (let bubble of bubbles) {
                if (grid[bubble.row] && grid[bubble.row][bubble.col] === bubble) {
                    grid[bubble.row][bubble.col] = null;
                }
                returnBubble(bubble);
            }
        }, 200);
    }, 100);
}

// Find floating bubbles (not connected to top)
function findFloatingBubbles() {
    const connected = new Set();
    const queue = [];
    
    // Start from top row
    if (grid[0]) {
        for (let col = 0; col < grid[0].length; col++) {
            const bubble = grid[0][col];
            if (bubble && bubble.active && !bubble.popping) {
                queue.push(bubble);
                connected.add(`${bubble.row},${bubble.col}`);
            }
        }
    }
    
    // Flood fill from top
    while (queue.length > 0) {
        const bubble = queue.shift();
        const neighbors = getNeighbors(bubble.row, bubble.col);
        
        for (let n of neighbors) {
            const key = `${n.row},${n.col}`;
            if (!connected.has(key) && !n.popping) {
                connected.add(key);
                queue.push(n);
            }
        }
    }
    
    // Find unconnected bubbles
    const floating = [];
    for (let row = 0; row < grid.length; row++) {
        if (!grid[row]) continue;
        for (let col = 0; col < grid[row].length; col++) {
            const bubble = grid[row][col];
            if (bubble && bubble.active && !bubble.popping && !connected.has(`${row},${col}`)) {
                floating.push(bubble);
            }
        }
    }
    
    return floating;
}

// Add new row from top - disabled to prevent gaps
function addNewRow() {
    // Don't add new rows - just let the player clear the level
    return;
}

// Check game state
function checkGameState() {
    // Count remaining bubbles and find lowest
    let bubbleCount = 0;
    let lowestBubbleY = 0;
    
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (bubble && bubble.active && !bubble.popping && !bubble.falling) {
                bubbleCount++;
                if (bubble.y > lowestBubbleY) {
                    lowestBubbleY = bubble.y;
                }
            }
        }
    }
    
    // Check danger line - game over
    if (lowestBubbleY + BUBBLE_RADIUS > canvasHeight - 100) {
        gameOver = true;
        showOverlay('Oyun Bitti!', `Skor: ${score}`, 'Tekrar Oyna');
        saveHighScore();
        return;
    }
    
    // Check if all bubbles cleared - level complete!
    if (bubbleCount === 0 && !levelComplete) {
        levelComplete = true;
        const bonus = 1000;
        score += bonus;
        updateUI();
        saveHighScore();
        
        setTimeout(() => {
            const completedLevel = level;
            level++;
            showOverlay(`Bölüm ${completedLevel} Tamamlandı!`, `Skor: ${score}\n+${bonus} Bonus`, 'Sonraki Bölüm');
        }, 300);
    }
}

// Periodic check for level completion (catches edge cases)
function periodicGameCheck() {
    if (gameOver || levelComplete || isPaused) return;
    
    let bubbleCount = 0;
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (bubble && bubble.active && !bubble.popping && !bubble.falling) {
                bubbleCount++;
            }
        }
    }
    
    if (bubbleCount === 0) {
        checkGameState();
    }
}

// Save high score
function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('bubbleHighScore', highScore.toString());
        updateUI();
    }
    
    // Save to leaderboard
    saveToLeaderboard(score);
}

// Show overlay
function showOverlay(title, message, buttonText) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-message').textContent = message;
    document.getElementById('overlay-btn').textContent = buttonText;
    document.getElementById('overlay').classList.remove('hidden');
}

// Hide overlay
function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('highscore').textContent = highScore;
}

// Draw aim line
function drawAimLine() {
    if (isShooting || !shooterBubble || isPaused) return;
    
    const startX = shooterBubble.x;
    const startY = shooterBubble.y;
    
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    
    let x = startX;
    let y = startY;
    let vx = Math.cos(aimAngle);
    let vy = Math.sin(aimAngle);
    
    const leftBound = BUBBLE_RADIUS;
    const rightBound = canvasWidth - BUBBLE_RADIUS;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    const maxLength = 600;
    let length = 0;
    let bounces = 0;
    
    while (length < maxLength && y > BUBBLE_RADIUS + 35 && bounces < 4) {
        const step = 5;
        x += vx * step;
        y += vy * step;
        length += step;
        
        // Wall bounce preview
        if (x < leftBound) {
            x = leftBound + (leftBound - x);
            vx = Math.abs(vx);
            bounces++;
        } else if (x > rightBound) {
            x = rightBound - (x - rightBound);
            vx = -Math.abs(vx);
            bounces++;
        }
        
        ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw end point indicator
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.fill();
}

// Animation loop
function updateAnimations() {
    // Update popping bubbles
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (bubble && bubble.popping) {
                bubble.popScale -= 0.1;
                if (bubble.popScale <= 0) {
                    if (grid[bubble.row]) {
                        grid[bubble.row][bubble.col] = null;
                    }
                    returnBubble(bubble);
                }
            }
        }
    }
    
    // Update falling bubbles
    for (let row of grid) {
        if (!row) continue;
        for (let col = 0; col < row.length; col++) {
            const bubble = row[col];
            if (bubble && bubble.falling) {
                bubble.fallSpeed += 0.5;
                bubble.y += bubble.fallSpeed;
                
                if (bubble.y > canvasHeight + BUBBLE_RADIUS) {
                    row[col] = null;
                    returnBubble(bubble);
                }
            }
        }
    }
}

// Main draw function
function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw danger line
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight - 100);
    ctx.lineTo(canvasWidth, canvasHeight - 100);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw grid bubbles
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (bubble) {
                bubble.draw();
            }
        }
    }
    
    // Draw aim line
    drawAimLine();
    
    // Draw shooter bubble
    if (shooterBubble) {
        shooterBubble.draw();
    }
}

// Game loop
let frameCount = 0;
function gameLoop() {
    if (!isPaused) {
        updateShooterBubble();
        updateAnimations();
        
        // Check for level completion every 30 frames
        frameCount++;
        if (frameCount % 30 === 0) {
            periodicGameCheck();
        }
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// Input handling
function handlePointerStart(x, y) {
    if (isPaused || gameOver || isShooting) return;
    isAiming = true;
    updateAim(x, y);
}

function handlePointerMove(x, y) {
    if (!isAiming) return;
    updateAim(x, y);
}

function handlePointerEnd() {
    if (isAiming) {
        shoot();
    }
    isAiming = false;
}

function updateAim(x, y) {
    if (!shooterBubble) return;
    
    const dx = x - shooterBubble.x;
    const dy = y - shooterBubble.y;
    
    let angle = Math.atan2(dy, dx);
    
    // Clamp angle to shooting upward
    if (angle > -0.1) angle = -0.1;
    if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;
    
    aimAngle = angle;
}

// Resize handler
function resize() {
    const container = document.getElementById('game-container');
    const maxWidth = Math.min(450, window.innerWidth);
    const maxHeight = window.innerHeight;
    
    // 9:16 aspect ratio
    let width = maxWidth;
    let height = width * 16 / 9;
    
    if (height > maxHeight) {
        height = maxHeight;
        width = height * 9 / 16;
    }
    
    canvasWidth = width;
    canvasHeight = height;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
}

// Start new game
function startGame() {
    // Clear grid
    for (let row of grid) {
        if (!row) continue;
        for (let bubble of row) {
            if (bubble) returnBubble(bubble);
        }
    }
    grid = [];
    
    if (shooterBubble) {
        returnBubble(shooterBubble);
        shooterBubble = null;
    }
    
    shotsCount = 0;
    comboChain = 0;
    gameOver = false;
    levelComplete = false;
    isPaused = false;
    
    initGrid();
    createShooterBubble();
    updateUI();
    hideOverlay();
}

// Initialize game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    resize();
    window.addEventListener('resize', resize);
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        handlePointerStart(e.clientX - rect.left, e.clientY - rect.top);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
    });
    
    canvas.addEventListener('mouseup', handlePointerEnd);
    canvas.addEventListener('mouseleave', handlePointerEnd);
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        handlePointerStart(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        handlePointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        handlePointerEnd();
    }, { passive: false });
    
    // Pause button
    document.getElementById('pauseBtn').addEventListener('click', () => {
        if (gameOver || levelComplete) return;
        isPaused = !isPaused;
        document.getElementById('pauseBtn').textContent = isPaused ? '▶️' : '⏸️';
        
        if (isPaused) {
            showOverlay('Duraklatıldı', '', 'Devam Et');
        } else {
            hideOverlay();
        }
    });
    
    // Overlay button
    document.getElementById('overlay-btn').addEventListener('click', () => {
        if (gameOver) {
            score = 0;
            level = 1;
            startGame();
        } else if (levelComplete) {
            levelComplete = false;
            shotsCount = 0;
            startGame();
        } else if (isPaused) {
            isPaused = false;
            document.getElementById('pauseBtn').textContent = '⏸️';
            hideOverlay();
        }
    });
    
    // Leaderboard button
    document.getElementById('leaderboard-btn').addEventListener('click', () => {
        showLeaderboard();
    });
    
    // Close leaderboard
    document.getElementById('close-leaderboard').addEventListener('click', () => {
        hideLeaderboard();
    });
    
    // Close leaderboard on outside click
    document.getElementById('leaderboard-modal').addEventListener('click', (e) => {
        if (e.target.id === 'leaderboard-modal') {
            hideLeaderboard();
        }
    });
    
    // User info click - connect wallet or show profile
    document.getElementById('user-info').addEventListener('click', async () => {
        if (currentUser && walletAddress) {
            const shortAddress = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
            showOverlay('Profil', `${currentUser.username}\nCüzdan: ${shortAddress}`, 'Tamam');
        } else if (currentUser) {
            showOverlay('Profil', `@${currentUser.username}\nFID: ${currentUser.fid}`, 'Tamam');
        } else {
            // Connect wallet
            await connectWallet();
        }
    });
    
    // Start game
    startGame();
    gameLoop();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

