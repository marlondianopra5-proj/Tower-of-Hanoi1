# Tower of Hanoi

A browser-based Tower of Hanoi game with a Prolog backend. Prolog owns the game state, validates every move, tracks the move count, and calculates the shortest route for hints.

## Requirements

- [SWI-Prolog](https://www.swi-prolog.org/) 8.4 or newer

## Run

The frontend works on its own with VS Code Live Server: open `public/index.html` and choose **Open with Live Server**. If the Prolog API is not available, the game automatically runs locally in the browser.

To run with the Prolog backend, start the server from this directory:

```powershell
swipl -s server.pl
```

Open [http://localhost:8080](http://localhost:8080) in your browser. Stop the server with Ctrl+C. When opened from this server, game state and move validation are handled by Prolog.

Choose between 3 and 8 disks. Select a peg with a disk, then select its destination. The game won't allow a larger disk to land on a smaller one. Use **Show me a move** (or press **H**) to request the next move in a shortest solution.

## API

- `GET /api/state` — current board, move count, and minimum move count
- `POST /api/new` with `{"disks": 4}` — start a new game (3–8 disks)
- `POST /api/move` with `{"from": 0, "to": 2}` — move a disk between pegs (0–2)
- `GET /api/hint` — get the next move in a shortest solution from the current board

Invalid moves and invalid game sizes return an HTTP 400 response with a JSON `error` message. Game state is in memory and shared by clients connected to the same server.

## Tests

Run the Prolog unit tests with:

```powershell
swipl -g run_tests -t halt test_game.pl
```
