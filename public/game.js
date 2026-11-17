"use strict";

const board = document.querySelector("#game-board");
const pegs = Array.from(document.querySelectorAll(".peg"));
const moveCount = document.querySelector("#move-count");
const minimumCount = document.querySelector("#minimum-count");
const message = document.querySelector("#game-message");
const gameCard = document.querySelector(".game-card");
const diskCount = document.querySelector("#disk-count");
const restartButton = document.querySelector("#restart-button");
const hintButton = document.querySelector("#hint-button");
const connectionError = document.querySelector("#connection-error");

let selectedPeg = null;
let gameWon = false;
let requestInProgress = false;
let localMode = false;
let localGame = null;

async function request(path, options = {}) {
  if (localMode) {
    return requestLocal(path, options);
  }

  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "The game server could not complete that request.");
  }
  return data;
}

function copyLocalState() {
  return {
    disks: localGame.disks,
    moves: localGame.moves,
    minimum: localGame.minimum,
    won: localGame.won,
    pegs: localGame.pegs.map((disks, id) => ({ id, disks: [...disks] })),
  };
}

function resetLocalGame(count) {
  if (!Number.isInteger(count) || count < 3 || count > 8) {
    throw new Error("Choose between 3 and 8 disks.");
  }
  localGame = {
    disks: count,
    moves: 0,
    minimum: (1 << count) - 1,
    won: false,
    pegs: [Array.from({ length: count }, (_, index) => index + 1), [], []],
  };
  return copyLocalState();
}

function localHint() {
  if (localGame.won) {
    throw new Error("The puzzle is already solved.");
  }

  const start = localGame.pegs.map((peg) => [...peg]);
  const queue = [{ pegs: start, firstMove: null }];
  const visited = new Set([start.map((peg) => peg.join(",")).join("|")]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.pegs[2].length === localGame.disks) {
      return current.firstMove;
    }

    for (let from = 0; from < 3; from += 1) {
      const disk = current.pegs[from][0];
      if (disk === undefined) continue;

      for (let to = 0; to < 3; to += 1) {
        if (from === to) continue;
        const destinationTop = current.pegs[to][0];
        if (destinationTop !== undefined && disk > destinationTop) continue;

        const nextPegs = current.pegs.map((peg) => [...peg]);
        nextPegs[from].shift();
        nextPegs[to].unshift(disk);
        const key = nextPegs.map((peg) => peg.join(",")).join("|");
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({
          pegs: nextPegs,
          firstMove: current.firstMove || { from, to },
        });
      }
    }
  }

  throw new Error("Could not find a solution from this board.");
}

function requestLocal(path, options) {
  if (path === "/api/state") {
    return copyLocalState();
  }

  const body = options.body ? JSON.parse(options.body) : {};
  if (path === "/api/new") {
    return resetLocalGame(body.disks);
  }

  if (path === "/api/move") {
    const { from, to } = body;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 2 || to < 0 || to > 2 || from === to) {
      throw new Error("That move is not allowed. Select a top disk and place it on a larger disk or an empty peg.");
    }
    const disk = localGame.pegs[from][0];
    const destinationTop = localGame.pegs[to][0];
    if (disk === undefined || (destinationTop !== undefined && disk > destinationTop)) {
      throw new Error("That move is not allowed. Select a top disk and place it on a larger disk or an empty peg.");
    }
    localGame.pegs[from].shift();
    localGame.pegs[to].unshift(disk);
    localGame.moves += 1;
    localGame.won = localGame.pegs[2].length === localGame.disks;
    return copyLocalState();
  }

  if (path === "/api/hint") {
    return localHint();
  }

  throw new Error("Unknown game action.");
}

function setBusy(busy) {
  requestInProgress = busy;
  pegs.forEach((peg) => { peg.disabled = busy || gameWon; });
  diskCount.disabled = busy;
  restartButton.disabled = busy;
  hintButton.disabled = busy || gameWon;
  board.setAttribute("aria-busy", String(busy));
}

function render(state) {
  selectedPeg = null;
  gameWon = state.won;
  moveCount.textContent = String(state.moves);
  minimumCount.textContent = String(state.minimum);
  gameCard.classList.toggle("won", gameWon);

  state.pegs.forEach(({ id, disks }) => {
    const peg = pegs[id];
    const diskContainer = peg.querySelector(".disks");
    diskContainer.replaceChildren();
    disks.forEach((disk, index) => {
      const diskElement = document.createElement("span");
      diskElement.className = `disk disk-${disk}`;
      diskElement.textContent = String(disk);
      diskElement.style.width = `${Math.max(28, 38 + (disk / state.disks) * 55)}%`;
      diskElement.setAttribute("aria-hidden", "true");
      diskContainer.append(diskElement);
      if (index === 0) {
        peg.setAttribute("aria-label", `Peg ${id + 1}, top disk ${disk}, ${disks.length} ${disks.length === 1 ? "disk" : "disks"}`);
      }
    });
    if (disks.length === 0) {
      peg.setAttribute("aria-label", `Peg ${id + 1}, empty`);
    }
    peg.classList.remove("selected");
    peg.disabled = requestInProgress || gameWon;
  });

  message.textContent = gameWon
    ? `Puzzle solved in ${state.moves} ${state.moves === 1 ? "move" : "moves"}. ${state.moves === state.minimum ? "Perfect — that's the minimum." : `The minimum is ${state.minimum}. Can you match it?`}`
    : "Select a peg with a disk to begin.";
  hintButton.disabled = requestInProgress || gameWon;
}

function showError(error) {
  message.textContent = error.message;
}

async function loadState() {
  if (window.location.pathname.includes("/public/")) {
    localMode = true;
    render(resetLocalGame(Number(diskCount.value)));
    connectionError.hidden = true;
    message.textContent = "Playing locally. Select a peg with a disk to begin.";
    return;
  }

  try {
    render(await request("/api/state"));
    connectionError.hidden = true;
  } catch {
    localMode = true;
    render(resetLocalGame(Number(diskCount.value)));
    connectionError.hidden = true;
    message.textContent = "Playing locally. Select a peg with a disk to begin.";
  }
}

async function handlePegClick(event) {
  if (requestInProgress || gameWon) return;
  const peg = event.currentTarget;
  const target = Number(peg.dataset.peg);

  if (selectedPeg === null) {
    if (!peg.querySelector(".disks").firstElementChild) {
      message.textContent = "That peg is empty. Choose a peg with a disk.";
      return;
    }
    selectedPeg = target;
    peg.classList.add("selected");
    message.textContent = `Peg ${target + 1} selected. Choose a destination.`;
    return;
  }

  if (selectedPeg === target) {
    selectedPeg = null;
    peg.classList.remove("selected");
    message.textContent = "Selection cleared. Choose a peg with a disk.";
    return;
  }

  const from = selectedPeg;
  try {
    setBusy(true);
    render(await request("/api/move", {
      method: "POST",
      body: JSON.stringify({ from, to: target }),
    }));
    connectionError.hidden = true;
  } catch (error) {
    selectedPeg = null;
    pegs.forEach((item) => item.classList.remove("selected"));
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function startNewGame(count = Number(diskCount.value)) {
  try {
    setBusy(true);
    render(await request("/api/new", {
      method: "POST",
      body: JSON.stringify({ disks: count }),
    }));
    diskCount.value = String(count);
    connectionError.hidden = true;
  } catch (error) {
    showError(error);
    connectionError.hidden = true;
  } finally {
    setBusy(false);
  }
}

async function showHint() {
  if (requestInProgress || gameWon) return;
  try {
    setBusy(true);
    const { from, to } = await request("/api/hint");
    selectedPeg = from;
    pegs.forEach((peg, index) => peg.classList.toggle("selected", index === from));
    message.textContent = `Try moving the top disk from peg ${from + 1} to peg ${to + 1}.`;
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

pegs.forEach((peg) => peg.addEventListener("click", handlePegClick));
diskCount.addEventListener("change", () => startNewGame(Number(diskCount.value)));
restartButton.addEventListener("click", () => startNewGame());
hintButton.addEventListener("click", showHint);

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "h" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
    showHint();
  }
});

loadState();
