# Neon Orbit: Cyber-Quantum Defense

Neon Orbit is not just an arcade shooter. It is a live visualization of adversarial machine learning, web-cryptography, and linear algebra computing, operating on real-time internet data streams.

## The Lore
You are the **Core**, a Quantum Heuristic Decoupler node operating on the edge of the neural-firewall. The internet is constantly flooded with anomalies (represented by live edits from the Wikipedia RecentChanges SSE stream). Adversarial entities attempt to steal your private keys. Your objective: survive long enough to mine cryptographic blocks and flush their TCP/IP handshakes through a GUI written in Visual Basic.

## Technical Mechanics

### 1. Real-Time Internet Data (Network Module)
The game connects to `https://stream.wikimedia.org/v2/stream/recentchange` using Server-Sent Events (SSE). Every time someone on Earth edits a Wikipedia page, an enemy spawns holding that edit's data payload. The feed is throttled to ensure optimal performance.

### 2. Gradient Descent Adversarial AI (Calculus)
Enemies do not fly in a straight line. They run a real-time calculus algorithm to calculate a **Loss Function**.
- **Minimize**: Distance to the Core.
- **Maximize**: Distance to your projectiles.
By taking the partial derivatives (gradients) of this loss function with respect to their X and Y coordinates, enemies actively evade your bullets using **Gradient Descent** optimization.

### 3. Linear Algebra Combat (Matrix-Vector Multiplication)
The combat system is pure mathematics. 
- Your projectiles are 2D **Vectors**.
- Every enemy is initialized as a 2x2 **Transformation Matrix**.
- When a bullet hits an enemy, the game performs a real **Matrix-Vector Multiplication**. The resulting vector's magnitude is divided by the matrix's determinant. If the force exceeds the mathematical threshold, the matrix is "factored", its eigenvalues collapse, and the enemy is destroyed. 

### 4. Web Crypto API & Proof of Work
When an enemy's matrix collapses, you capture its payload.
- The game uses the browser's native `window.crypto.subtle` API.
- The payload is encrypted in real-time using an **AES-GCM** 256-bit key.
- The ciphertext is then hashed using **SHA-256**.
Collect enough hashes to increase your Hash Rate. Mining a complete block (10 hashes) triggers an EMP blast that clears the screen.

### 5. WebGL Rendering (PixiJS)
The game ditches standard HTML Canvas 2D and implements **PixiJS** for true hardware-accelerated GPU WebGL graphics. This allows the game to render hundreds of neon-glowing entities, particle explosions, and mathematical text UI smoothly at 60 FPS without breaking a sweat.

## How to Play
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Navigate to `http://localhost:5173/`
4. Use `A`/`D` or `Left`/`Right` arrows to orbit the Core.
5. Use the `Mouse` to aim and `Click` to shoot vectors.
6. Watch the terminal logs as you perform SQL injections on the Blockchain.

Good luck, Operator.
