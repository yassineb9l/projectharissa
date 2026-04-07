// ============================================================
// HARISSA JUMP - Main game logic
// ============================================================

// --- Canvas creation and injection into #gameArea ---
const canvas = document.createElement("canvas");
canvas.width = 1100;
canvas.height = 450;
const gameArea = document.getElementById("gameArea");
gameArea.style.width = canvas.width + "px";
gameArea.style.height = canvas.height + "px";
gameArea.appendChild(canvas);
const ctx = canvas.getContext("2d");

// --- Global game state ---
let jeuEnCours = false;
let enPause = false;
let debugHitbox = false; // press D to see hitboxes
let peutRejouer = true; // prevents re-launch if Space is held at death
let spaceDown = false; // tracks the real-time state of the Space key

function togglePause() {
  if (!jeuEnCours) return;
  enPause = !enPause;
  btnPause.textContent = enPause ? "▶" : "⏸";
  if (!enPause) requestAnimationFrame(gameLoop);
}
let animationId = null; // reference to requestAnimationFrame to avoid duplicates
let lastTime = 0; // timestamp of the last frame for delta time

// ============================================================
// SCORE
// ============================================================
let score = 0;
let record = 0;
let medaillesDebloquees = { bronze: false, argent: false, or: false };

// Medal thresholds — modify these values to adjust difficulty
const SEUIL_BRONZE = 300;
const SEUIL_ARGENT = 600;
const SEUIL_OR = 1000;

// Updates medal slots in the DOM
function mettreAJourMedailles() {
  const config = [
    { id: "slot-bronze", seuil: SEUIL_BRONZE, cle: "bronze" },
    { id: "slot-argent", seuil: SEUIL_ARGENT, cle: "argent" },
    { id: "slot-or", seuil: SEUIL_OR, cle: "or" },
  ];
  config.forEach(({ id, seuil, cle }) => {
    const slot = document.getElementById(id);
    const gagnee = score >= seuil || medaillesDebloquees[cle];
    if (slot) slot.style.opacity = gagnee ? "1" : "0.4";
  });
}

function reinitialiserMedailles() {
  const config = [
    { id: "slot-bronze", cle: "bronze" },
    { id: "slot-argent", cle: "argent" },
    { id: "slot-or", cle: "or" },
  ];
  config.forEach(({ id, cle }) => {
    const slot = document.getElementById(id);
    if (slot) slot.style.opacity = medaillesDebloquees[cle] ? "1" : "0.4";
  });
}

function sauvegarderMedailles() {
  if (score >= SEUIL_BRONZE) medaillesDebloquees.bronze = true;
  if (score >= SEUIL_ARGENT) medaillesDebloquees.argent = true;
  if (score >= SEUIL_OR) medaillesDebloquees.or = true;
}

let frameScore = 0; // internal counter for score rhythm

function mettreAJourScore(dt) {
  frameScore += dt;

  // +1 point every 6 frames, like Chrome Dino (~10 pts/second)
  if (frameScore >= 6) {
    score++;
    frameScore = 0;
    // Update the score display in the HTML
    scoreZone.textContent = `Score : ${score} | Record : ${record}`;
    mettreAJourMedailles();
  }

  // Exponential speed: +10% every 200 points.
  // Math.pow(1.1, N) gives 1.0 → 1.1 → 1.21 → 1.33… (exponential growth)
  // Math.floor(score/200) rounds down to the current tier (0–199 = tier 0, 200–399 = tier 1…)
  vitesse = 8.0 * Math.pow(1.1, Math.floor(score / 200));
}

// ============================================================
// IMAGES — replace paths with your actual files
// ============================================================
const imgCours1 = new Image();
imgCours1.src = "Cours1.png";
const imgCours2 = new Image();
imgCours2.src = "Cours2.png";
let frameCourse = 0; // counter to alternate running animation frames
const imgJoueurAccroupi = new Image();
imgJoueurAccroupi.src = "Accroupi.png";
const imgJoueurMort = new Image();
imgJoueurMort.src = "Mort.png";
// 5 obstacles — Decor images
const imgObstacle1 = new Image();
imgObstacle1.src = "Decor1.png";
const imgObstacle2 = new Image();
imgObstacle2.src = "Decor2.png";
const imgObstacle3 = new Image();
imgObstacle3.src = "Decor3.png";
const imgObstacle4 = new Image();
imgObstacle4.src = "Decor4.png";
const imgObstacle5 = new Image();
imgObstacle5.src = "Decor5.png";
// Flying obstacles and cacti
const imgCactus = new Image();
imgCactus.src = "Decor6.png";
const imgVolant2 = new Image();
imgVolant2.src = "Decor_volant2.png";
// Scrolling backgrounds (day and night)
const imgFond = new Image();
imgFond.src = "Fond.png";
const imgFondNuit = new Image();
imgFondNuit.src = "Fond2.png";
let modeNuit = false;

// Light toggle button in the top right of the game area
const btnLumiere = document.createElement("button");
btnLumiere.textContent = "☀️";
btnLumiere.style.cssText =
  "position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.6); border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; line-height:1;";
btnLumiere.tabIndex = -1; // prevents the button from receiving keyboard focus
btnLumiere.addEventListener("click", () => {
  modeNuit = !modeNuit; // false becomes true, true becomes false
  if (enPause) dessiner();
  if (!jeuEnCours && joueur.mort) gameOver();
});
gameArea.appendChild(btnLumiere); // Places the button inside the game area div

let musiqueActive = true;

const btnMusique = document.createElement("button");
btnMusique.textContent = "🔊";
btnMusique.style.cssText =
  "position:absolute; top:55px; right:10px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.6); border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; line-height:1;";
btnMusique.tabIndex = -1;
btnMusique.addEventListener("click", () => {
  musiqueActive = !musiqueActive;
  const musique = document.getElementById("musiqueJeu");
  if (musiqueActive) {
    musique.play();
    btnMusique.textContent = "🔊";
  } else {
    musique.pause();
    btnMusique.textContent = "🔇";
  }
});
gameArea.appendChild(btnMusique);

const btnPause = document.createElement("button");
btnPause.textContent = "⏸";
btnPause.style.cssText =
  "position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.6); border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; line-height:1;";
btnPause.tabIndex = -1;
btnPause.addEventListener("click", togglePause);
gameArea.appendChild(btnPause);

// Medal slots — next to the score
const medalContainer = document.createElement("div");
medalContainer.style.cssText =
  "display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-left:16px;";
const scoreZone = document.getElementById("scoreZone");
scoreZone.insertAdjacentElement("afterend", medalContainer);

const SLOTS_MEDAILLES = [
  { id: "slot-bronze", src: "medaille bronze.png" },
  { id: "slot-argent", src: "medaille argent.png" },
  { id: "slot-or", src: "medaille or.png" },
];
SLOTS_MEDAILLES.forEach(({ id, src }) => {
  const slot = document.createElement("div");
  slot.id = id;
  slot.style.cssText = "display:inline-block; opacity:0.3;";
  const img = document.createElement("img");
  img.src = src;
  img.style.cssText =
    "width:133px; height:133px; object-fit:contain; display:block;";
  slot.appendChild(img);
  medalContainer.appendChild(slot);
});

// ============================================================
// THE PLAYER
// ============================================================
const GRAVITE = 0.6; // force pulling the player down each frame
const HAUTEUR_NORMAL = 125; // standing height
const LARGEUR_NORMAL = 95; // standing width
const HAUTEUR_ACCROUPI = 72; // crouching height
const LARGEUR_ACCROUPI = 165; // crouching width (wider because spread out)
const SOL_Y = 450; // player runs on the bottom edge of the rectangle
const SOL = SOL_Y - HAUTEUR_NORMAL; // Y position of the standing player on the ground

const joueur = {
  x: 80, // horizontal position (fixed)
  y: SOL, // vertical position (changes when jumping)
  largeur: LARGEUR_NORMAL,
  hauteur: HAUTEUR_NORMAL,
  velociteY: 0, // vertical velocity (negative = up, positive = down)
  sauts: 0, // 0 = on ground, 1 = in the air
  accroupi: false,
  mort: false,
};

// ============================================================
// OBSTACLES
// ============================================================
let obstacles = []; // list of all active obstacles
let pixelsDepuisDernier = 0; // pixels travelled since the last obstacle
let vitesse = 6; // movement speed (increases with score)
let xFond = 0; // X position of the scrolling background

// ============================================================
// HITBOXES — tweak these constants to adjust each obstacle
// gauche/droite/haut/bas = pixels removed from each side
// ============================================================
const HB_DECOR1 = { gauche: 35, droite: 58, haut: 35, bas: 30 };
const HB_DECOR2 = { gauche: 35, droite: 35, haut: 75, bas: 35 }; // haut = margin + offset
const HB_DECOR3 = { gauche: 45, droite: 45, haut: 70, bas: 45 };
const HB_DECOR4 = { gauche: 43, droite: 70, haut: 30, bas: 30 };
const HB_DECOR5 = { gauche: 57, droite: 75, haut: 35, bas: 35 };
const HB_CACTUS = { gauche: 27, droite: 27, haut: 32, bas: 20 };
const HB_OISEAU = { gauche: 30, droite: 40, haut: 25, bas: 27 };

// Available obstacle types — each has its own size and image
const TYPES_OBSTACLES = [
  {
    largeur: 214,
    hauteur: 194,
    offsetSol: 45,
    hb: HB_DECOR1,
    image: imgObstacle1,
  },
  {
    largeur: 237,
    hauteur: 214,
    offsetSol: 65,
    hb: HB_DECOR2,
    image: imgObstacle2,
  },
  {
    largeur: 268,
    hauteur: 242,
    offsetSol: 72,
    hb: HB_DECOR3,
    image: imgObstacle3,
  },
  {
    largeur: 214,
    hauteur: 191,
    offsetSol: 33,
    hb: HB_DECOR4,
    image: imgObstacle4,
  },
  {
    largeur: 266,
    hauteur: 237,
    offsetSol: 66,
    hb: HB_DECOR5,
    image: imgObstacle5,
  },
  // Cactus
  {
    largeur: 116,
    hauteur: 200,
    offsetSol: 50,
    hb: HB_CACTUS,
    image: imgCactus,
    estCactus: true,
  },
  // Flying bird (yFixe chosen randomly in creerObstacle)
  {
    largeur: 180,
    hauteur: 110,
    yFixe: [275, 233], // low (jump over) or high (duck under)
    hb: HB_OISEAU,
    image: imgVolant2,
    estOiseau: true,
  },
];

let dernierTypeObstacle = -1;

// Weighted pool: instead of a simple Math.random() over types,
// we fill an array with each type's index repeated N times.
// Birds appear 13 times, others 10 times → ~30% more likely.
// Drawing a random index from this array automatically gives the correct probability.
const POOL_OBSTACLES = (() => {
  const pool = [];
  TYPES_OBSTACLES.forEach((_, i) => {
    const nb = TYPES_OBSTACLES[i].estOiseau ? 13 : 10;
    for (let k = 0; k < nb; k++) pool.push(i);
  });
  return pool;
})();

function creerObstacle() {
  let index;
  do {
    index = POOL_OBSTACLES[Math.floor(Math.random() * POOL_OBSTACLES.length)];
  } while (index === dernierTypeObstacle);
  dernierTypeObstacle = index;

  const type = TYPES_OBSTACLES[index];
  // If yFixe is an array, pick one of the heights at random
  const yFixeChoisi = Array.isArray(type.yFixe)
    ? type.yFixe[Math.floor(Math.random() * type.yFixe.length)]
    : type.yFixe;
  const y =
    yFixeChoisi !== undefined
      ? yFixeChoisi
      : SOL_Y - type.hauteur + (type.offsetSol || 0);

  if (type.estCactus) {
    // 1, 2 or 3 cacti — the group starts together from the right edge
    const maxCactus = score >= 250 ? 3 : 2;
    const nb = Math.floor(Math.random() * maxCactus) + 1;
    const gap = -20; // negative = overlap, compact group
    // The first cactus (i=0) spawns at canvas.width.
    // The following ones (i=1, i=2) are already placed behind it (off-screen right)
    // because i * (width + gap) offsets them to the right.
    // Moving together to the left, they arrive as a tight group.
    for (let i = 0; i < nb; i++) {
      obstacles.push({
        x: canvas.width + i * (type.largeur + gap),
        y,
        largeur: type.largeur,
        hauteur: type.hauteur,
        hb: type.hb,
        image: type.image,
      });
    }
  } else {
    obstacles.push({
      x: canvas.width,
      y,
      largeur: type.largeur,
      hauteur: type.hauteur,
      hb: type.hb,
      image: type.image,
    });
  }
}

function mettreAJourObstacles(dt) {
  pixelsDepuisDernier += vitesse * dt;

  // Spawn distance: fixed at 560px up to 200 pts,
  // then +5.5% every 200 pts (e.g. 590px at 400pts, 623px at 600pts…)
  // Math.max(0, ...) avoids a negative exponent before 200 pts (distance stays at 560).
  // This compensates for acceleration: the faster the speed, the more spaced out obstacles are,
  // keeping the game playable at high scores.
  const distanceSpawn =
    560 * Math.pow(1.055, Math.max(0, Math.floor((score - 200) / 200)));
  if (pixelsDepuisDernier >= distanceSpawn) {
    creerObstacle();
    pixelsDepuisDernier = 0;
  }

  // Move each obstacle to the left and remove those that are off-screen
  obstacles = obstacles.filter((obs) => {
    obs.x -= vitesse * dt;
    return obs.x + obs.largeur > 0;
  });
}

// ============================================================
// KEYBOARD CONTROLS
// ============================================================
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyD") {
    debugHitbox = !debugHitbox;
    return;
  }

  // Replay with Enter or Space when the game is over
  if (
    (e.code === "Enter" || e.code === "Space") &&
    !jeuEnCours &&
    peutRejouer
  ) {
    e.preventDefault();
    lancerPartie();
    return;
  }

  // --- JUMP (Space or Arrow Up) — impossible while crouching ---
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (e.code === "Space") spaceDown = true;
    if (joueur.sauts === 0 && !joueur.accroupi) {
      joueur.velociteY = -17;
      joueur.sauts = 1;
    }
  }

  // --- CROUCH (Arrow Down) ---
  if (e.code === "ArrowDown") {
    e.preventDefault();
    joueur.accroupi = true;
    joueur.hauteur = HAUTEUR_ACCROUPI;
    joueur.largeur = LARGEUR_ACCROUPI;
    if (joueur.sauts === 0) {
      // On the ground: reposition feet
      joueur.y = SOL_Y - HAUTEUR_ACCROUPI;
    } else {
      // In the air: accelerate the fall without teleporting
      joueur.velociteY = Math.max(joueur.velociteY, 10);
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    if (!jeuEnCours) peutRejouer = true; // released after death → can replay
  }

  // When Arrow Down is released → stand back up
  if (e.code === "ArrowDown") {
    joueur.accroupi = false;
    joueur.hauteur = HAUTEUR_NORMAL;
    joueur.largeur = LARGEUR_NORMAL;
    if (joueur.sauts === 0) {
      joueur.y = SOL_Y - HAUTEUR_NORMAL;
    }
  }
});

// ============================================================
// COLLISION DETECTION
// Hitboxes reduced separately for the player and obstacles
// ============================================================
const MARGE_JOUEUR = 15; // player hitbox margin

function verifierCollisions() {
  for (const obs of obstacles) {
    // Reduced player hitbox
    const jx = joueur.x + MARGE_JOUEUR;
    const jy = joueur.y + MARGE_JOUEUR;
    const jw = joueur.largeur - MARGE_JOUEUR * 2;
    const jh = joueur.hauteur - MARGE_JOUEUR * 2;

    // Obstacle hitbox reduced by its own constants
    const ox = obs.x + obs.hb.gauche;
    const oy = obs.y + obs.hb.haut;
    const ow = obs.largeur - obs.hb.gauche - obs.hb.droite;
    const oh = obs.hauteur - obs.hb.haut - obs.hb.bas;

    // AABB (Axis-Aligned Bounding Box): two rectangles overlap
    // if and only if they overlap both horizontally AND vertically.
    // toucheHorizontal: the player's right edge passes the obstacle's left edge
    //                   AND the player's left edge is before the obstacle's right edge.
    const toucheHorizontal = jx < ox + ow && jx + jw > ox;
    const toucheVertical = jy < oy + oh && jy + jh > oy;

    if (toucheHorizontal && toucheVertical) {
      return true;
    }
  }
  return false;
}

// ============================================================
// GAME OVER
// ============================================================
function gameOver() {
  jeuEnCours = false;
  joueur.mort = true;

  // Stop the music
  const musique = document.getElementById("musiqueJeu");
  if (musique) {
    musique.pause();
    musique.currentTime = 0;
  }

  // Save the record if beaten
  if (score > record) {
    record = score;
  }

  sauvegarderMedailles();
  // Anti-double-restart system: if the player holds Space to jump and dies
  // at the same time, we block the restart. peutRejouer becomes true only
  // when Space is released (keyup), forcing a new press.
  peutRejouer = !spaceDown;

  // Draw one last frame
  dessiner();

  // Centered death image
  const mw = LARGEUR_NORMAL * 6;
  const mh = HAUTEUR_NORMAL * 3;
  ctx.drawImage(
    imgJoueurMort,
    canvas.width / 2 - mw / 2,
    canvas.height - mh,
    mw,
    mh,
  );
}

// ============================================================
// MAIN GAME LOOP
// Called ~60 times per second by the browser
// ============================================================
function gameLoop(timestamp) {
  if (!jeuEnCours) return;
  if (enPause) return; // loop suspended, will resume via togglePause()

  // Delta time: normalises all speeds to the refresh rate.
  // (timestamp - lastTime) = real frame duration in ms.
  // Divided by (1000/60 ≈ 16.67ms) → dt = 1.0 at 60fps, 0.5 at 120fps, 0.25 at 240fps.
  // Math.min(..., 3) prevents a huge dt if the tab was in the background.
  // All position updates multiply by dt to stay consistent across all screens.
  const dt = lastTime ? Math.min((timestamp - lastTime) / (1000 / 60), 3) : 1;
  lastTime = timestamp;

  // 1. Update logic
  mettreAJourJoueur(dt);
  mettreAJourObstacles(dt);
  mettreAJourScore(dt);

  // 2. Check collisions — if hit, game over and stop the loop
  if (verifierCollisions()) {
    gameOver();
    return;
  }

  // 3. Draw the current state on the canvas
  dessiner(dt);

  // 4. Ask the browser to call gameLoop() on the next frame
  animationId = requestAnimationFrame(gameLoop);
}

// ============================================================
// PLAYER PHYSICS
// Called every frame to update the player's position
// ============================================================
function mettreAJourJoueur(dt) {
  // Apply gravity: accelerates the fall each frame
  joueur.velociteY += GRAVITE * dt;
  joueur.y += joueur.velociteY * dt;

  // Calculate the ground Y position based on state (standing or crouching)
  const solActuel = SOL_Y - joueur.hauteur;

  // Prevent the player from going below the ground
  if (joueur.y >= solActuel) {
    joueur.y = solActuel;
    joueur.velociteY = 0; // stop the fall
    joueur.sauts = 0; // reset the jump counter
  }
}

// --- Drawing function ---
function dessiner(dt = 1) {
  // Clear the entire canvas before redrawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Scrolling background — "double buffer" technique:
  // We draw the same image twice side by side (xFond and xFond + canvas.width).
  // xFond moves back by speed*0.4 each frame (parallax, slower than the ground).
  // When xFond reaches -canvas.width (image 1 fully off-screen left),
  // we reset to 0 → image 2 takes its place and the loop repeats invisibly.
  xFond -= vitesse * 0.4 * dt;
  if (xFond <= -canvas.width) xFond = 0;
  const fondActuel = modeNuit ? imgFondNuit : imgFond;
  ctx.drawImage(fondActuel, xFond, 0, canvas.width, canvas.height);
  ctx.drawImage(
    fondActuel,
    xFond + canvas.width,
    0,
    canvas.width,
    canvas.height,
  );

  // Obstacles
  for (const obs of obstacles) {
    ctx.drawImage(obs.image, obs.x, obs.y, obs.largeur, obs.hauteur);
  }

  // Player: choose the image based on state
  let imgJoueur;
  if (joueur.accroupi) {
    imgJoueur = imgJoueurAccroupi;
  } else {
    // Alternate between Cours1 and Cours2 every 8 frames
    frameCourse++;
    imgJoueur = Math.floor(frameCourse / 8) % 2 === 0 ? imgCours1 : imgCours2;
  }

  ctx.drawImage(imgJoueur, joueur.x, joueur.y, joueur.largeur, joueur.hauteur);

  // DEBUG MODE — shows hitboxes in red/blue
  if (debugHitbox) {
    const mj = 15; // player margin
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      joueur.x + mj,
      joueur.y + mj,
      joueur.largeur - mj * 2,
      joueur.hauteur - mj * 2,
    );

    for (const obs of obstacles) {
      ctx.strokeStyle = "red";
      ctx.strokeRect(
        obs.x + obs.hb.gauche,
        obs.y + obs.hb.haut,
        obs.largeur - obs.hb.gauche - obs.hb.droite,
        obs.hauteur - obs.hb.haut - obs.hb.bas,
      );
    }
  }
}

// ============================================================
// START THE GAME
// ============================================================
function lancerPartie() {
  if (jeuEnCours) return;
  enPause = false;
  btnPause.textContent = "⏸";
  reinitialiserMedailles();
  // Reset score, obstacles and speed
  score = 0;
  frameScore = 0;
  obstacles = [];
  pixelsDepuisDernier = 0;
  vitesse = 8.0;
  xFond = 0;

  // Reset the player
  joueur.y = SOL;
  joueur.velociteY = 0;
  joueur.sauts = 0;
  joueur.accroupi = false;
  joueur.mort = false;
  joueur.hauteur = HAUTEUR_NORMAL;
  joueur.largeur = LARGEUR_NORMAL;
  frameCourse = 0;

  // Cancel any existing loop to avoid duplicates
  if (animationId) cancelAnimationFrame(animationId);
  lastTime = 0;
  jeuEnCours = true;
  animationId = requestAnimationFrame(gameLoop);
  if (typeof jouerMusiqueAleatoire === "function" && musiqueActive)
    jouerMusiqueAleatoire();
}

// Waiting screen — displayed in the rectangle before the first game
function dessinerEcranAttente() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fond = modeNuit ? imgFondNuit : imgFond;
  ctx.drawImage(fond, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px 'Press Start 2P', cursive";
  ctx.textAlign = "center";
  ctx.fillText("Press Space to play", canvas.width / 2, canvas.height / 2);
}
// Wait for images to load before drawing
imgFond.onload = dessinerEcranAttente;
imgFondNuit.onload = dessinerEcranAttente;

// ============================================================
// TOUCH CONTROLS (mobile / tablet)
// ============================================================
let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  touchStartY = e.touches[0].clientY;
  if (!jeuEnCours && peutRejouer) { lancerPartie(); return; }
  if (joueur.sauts === 0 && !joueur.accroupi) {
    joueur.velociteY = -17;
    joueur.sauts = 1;
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const dy = e.touches[0].clientY - touchStartY;
  if (dy > 30 && !joueur.accroupi) {
    joueur.accroupi = true;
    joueur.hauteur = HAUTEUR_ACCROUPI;
    joueur.largeur = LARGEUR_ACCROUPI;
    if (joueur.sauts === 0) {
      joueur.y = SOL_Y - HAUTEUR_ACCROUPI;
    } else {
      joueur.velociteY = Math.max(joueur.velociteY, 10);
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  joueur.accroupi = false;
  joueur.hauteur = HAUTEUR_NORMAL;
  joueur.largeur = LARGEUR_NORMAL;
  if (joueur.sauts === 0) {
    joueur.y = SOL_Y - HAUTEUR_NORMAL;
  }
}, { passive: false });
