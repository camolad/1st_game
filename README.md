# Maze Builder TD

A simple, maze-building tower defense prototype inspired by Fieldrunners-style path control.

## How to play

### Start the game
1. Open `index.html` in a browser, **or** run a local server:
   ```bash
   python -m http.server 8000
   ```
2. Visit `http://localhost:8000`.
3. Choose a difficulty and map, then click **Deploy**.

### Build and defend
- **Left click** on a grid tile to place the selected tower.
- **Right click** a tower to remove it (partial refund).
- Enemies always take the **shortest open path** to the exit.
- You **cannot** block the path completely; towers that do will be rejected.

### Towers
- **Red Gatling**: fast DPS for ground targets.
- **Green Glue**: slows a single enemy, boosting nearby damage towers.
- **Blue Missile**: splash damage and anti-air.
- **Purple Tesla**: heavy damage for ground/air at short range.

### Waves and resources
- **Cash**: earned by defeating enemies; used to place towers.
- **Wave**: enemies scale as waves increase.
- **Lives**: lose one when an enemy reaches the exit. Game ends at 0.

### Tips
- Build longer paths to keep enemies in range longer.
- Use **Glue** at the start of kill zones.
- Keep **Tesla** or **Missile** near the exit as a last line of defense.
- Watch for air units starting in later waves; maze length won’t slow them.
