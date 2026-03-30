// ============================================================
// HARISSA JUMP - Logique principale du jeu
// ============================================================

// --- Création du canvas et injection dans #gameArea ---
const canvas = document.createElement("canvas");
canvas.width = 900;
canvas.height = 400;
const gameArea = document.getElementById("gameArea");
gameArea.style.width = canvas.width + "px";
gameArea.style.height = canvas.height + "px";
gameArea.appendChild(canvas);
const ctx = canvas.getContext("2d");

// --- État global du jeu ---
let jeuEnCours = false;
let enPause = false;
let debugHitbox = false; // appuie sur D pour voir les hitboxes
let peutRejouer = false; // évite de relancer si Espace est maintenu à la mort
let spaceDown = false; // suit l'état de la touche Espace en temps réel

function togglePause() {
  if (!jeuEnCours) return;
  enPause = !enPause;
  btnPause.textContent = enPause ? "▶" : "⏸";
  if (!enPause) requestAnimationFrame(gameLoop);
}
let animationId = null; // référence à requestAnimationFrame pour éviter les doublons
let lastTime = 0; // timestamp de la dernière frame pour le delta time

// ============================================================
// SCORE
// ============================================================
let score = 0;
// localStorage : mémoire persistante du navigateur, survit aux rechargements
let record = 0;
let medaillesDebloquees = { bronze: false, argent: false, or: false };

// Seuils des médailles — modifie ces valeurs pour ajuster la difficulté
const SEUIL_BRONZE = 300;
const SEUIL_ARGENT = 600;
const SEUIL_OR = 1000;

const MEDAILLES = [
  { seuil: SEUIL_OR, label: "🥇 Or", couleur: "#f1c40f" },
  { seuil: SEUIL_ARGENT, label: "🥈 Argent", couleur: "#bdc3c7" },
  { seuil: SEUIL_BRONZE, label: "🥉 Bronze", couleur: "#e67e22" },
];

// Met à jour les slots médailles dans le DOM
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

// Retourne la médaille actuelle ou null
function obtenirMedaille(s) {
  for (const m of MEDAILLES) {
    if (s >= m.seuil) return m;
  }
  return null;
}

let frameScore = 0; // compteur interne pour le rythme du score

function mettreAJourScore(dt) {
  frameScore += dt;

  // +1 point toutes les 6 frames, comme le Dino Chrome (~10 pts/seconde)
  if (frameScore >= 6) {
    score++;
    frameScore = 0;
    // Mettre à jour la zone de score dans le HTML
    scoreZone.textContent = `Score : ${score} | Record : ${record}`;
    mettreAJourMedailles();
  }

  // Augmenter la vitesse tous les 100 points
  vitesse = 7.62 * Math.pow(1.1, Math.floor(score / 200));
}

// ============================================================
// IMAGES — remplace les chemins par tes vrais fichiers
// ============================================================
const imgCours1 = new Image();
imgCours1.src = "Cours1.png";
const imgCours2 = new Image();
imgCours2.src = "Cours2.png";
let frameCourse = 0; // compteur pour alterner les images de course
const imgJoueurAccroupi = new Image();
imgJoueurAccroupi.src = "Accroupi.png";
const imgJoueurMort = new Image();
imgJoueurMort.src = "Mort.png";
// 5 obstacles — images Decor
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
// Obstacles volants et cactus
const imgCactus = new Image();
imgCactus.src = "Decor6.png";
const imgVolant2 = new Image();
imgVolant2.src = "Decor_volant2.png";
// Fonds défilants (jour et nuit)
const imgFond = new Image();
imgFond.src = "Fond.png";
const imgFondNuit = new Image();
imgFondNuit.src = "Fond2.png";
let modeNuit = false;

// Bouton toggle lumière en haut à droite du rectangle de jeu
const btnLumiere = document.createElement("button");
btnLumiere.textContent = "☀️";
btnLumiere.style.cssText =
  "position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.6); border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; line-height:1;";
btnLumiere.tabIndex = -1; // empêche le bouton de recevoir le focus clavier
btnLumiere.addEventListener("click", () => {
  modeNuit = !modeNuit;
  if (enPause) dessiner();
  if (!jeuEnCours && joueur.mort) gameOver();
});
gameArea.style.position = "relative";
gameArea.appendChild(btnLumiere);

const btnMusique = document.createElement("button");
btnMusique.textContent = "🔊";
btnMusique.style.cssText =
  "position:absolute; top:55px; right:10px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.6); border-radius:50%; width:40px; height:40px; font-size:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; line-height:1;";
btnMusique.tabIndex = -1;
btnMusique.addEventListener("click", () => {
  const musique = document.getElementById("musiqueJeu");
  if (musique.paused) {
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

// Slots médailles — ligne à droite du score
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
    "width:121px; height:121px; object-fit:contain; display:block;";
  slot.appendChild(img);
  medalContainer.appendChild(slot);
});

// ============================================================
// LE JOUEUR
// ============================================================
const GRAVITE = 0.6; // force qui tire le joueur vers le bas chaque frame
const HAUTEUR_NORMAL = 125; // hauteur debout
const LARGEUR_NORMAL = 95; // largeur debout
const HAUTEUR_ACCROUPI = 72; // hauteur accroupi
const LARGEUR_ACCROUPI = 165; // largeur accroupi (plus large car étalé)
const SOL_Y = 400; // joueur court sur la bordure basse du rectangle
const SOL = SOL_Y - HAUTEUR_NORMAL; // position Y du joueur debout au sol

const joueur = {
  x: 80, // position horizontale (fixe)
  y: SOL, // position verticale (change quand il saute)
  largeur: LARGEUR_NORMAL,
  hauteur: HAUTEUR_NORMAL,
  velociteY: 0, // vitesse verticale (négative = monte, positive = descend)
  sauts: 0, // 0 = au sol, 1 = en l'air
  accroupi: false,
  mort: false,
};

// ============================================================
// OBSTACLES
// ============================================================
let obstacles = []; // liste de tous les obstacles actifs
let pixelsDepuisDernier = 0; // pixels parcourus depuis le dernier obstacle
let vitesse = 6; // vitesse de déplacement (augmente avec le score)
let xFond = 0; // position X du fond défilant

// ============================================================
// HITBOXES — modifie ces constantes pour ajuster chaque obstacle
// gauche/droite/haut/bas = pixels retirés de chaque côté
// ============================================================
const HB_DECOR1 = { gauche: 30, droite: 30, haut: 30, bas: 30 };
const HB_DECOR2 = { gauche: 35, droite: 35, haut: 75, bas: 35 }; // haut = marge + decalageHaut
const HB_DECOR3 = { gauche: 45, droite: 45, haut: 70, bas: 45 };
const HB_DECOR4 = { gauche: 35, droite: 70, haut: 30, bas: 30 };
const HB_DECOR5 = { gauche: 52, droite: 65, haut: 35, bas: 35 };
const HB_CACTUS = { gauche: 27, droite: 27, haut: 32, bas: 20 };
const HB_OISEAU = { gauche: 25, droite: 25, haut: 25, bas: 25 };

// Les obstacles possibles — chacun a sa taille et son image
const TYPES_OBSTACLES = [
  {
    largeur: 204,
    hauteur: 185,
    offsetSol: 40,
    hb: HB_DECOR1,
    image: imgObstacle1,
  },
  {
    largeur: 226,
    hauteur: 204,
    offsetSol: 61,
    hb: HB_DECOR2,
    image: imgObstacle2,
  },
  {
    largeur: 255,
    hauteur: 230,
    offsetSol: 67,
    hb: HB_DECOR3,
    image: imgObstacle3,
  },
  {
    largeur: 204,
    hauteur: 182,
    offsetSol: 30,
    hb: HB_DECOR4,
    image: imgObstacle4,
  },
  {
    largeur: 253,
    hauteur: 226,
    offsetSol: 62,
    hb: HB_DECOR5,
    image: imgObstacle5,
  },
  // Cactus
  {
    largeur: 110,
    hauteur: 190,
    offsetSol: 50,
    hb: HB_CACTUS,
    image: imgCactus,
    estCactus: true,
  },
  // Oiseau volant (yFixe choisi aléatoirement dans creerObstacle)
  {
    largeur: 180,
    hauteur: 110,
    yFixe: [245, 207], // bas (sauter par-dessus) ou haut (passer dessous)
    hb: HB_OISEAU,
    image: imgVolant2,
    estOiseau: true,
  },
];

let dernierTypeObstacle = -1;

// Pool pondéré : l'oiseau a 30% de chances en plus que les autres
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
  // Si yFixe est un tableau, choisir aléatoirement parmi les hauteurs
  const yFixeChoisi = Array.isArray(type.yFixe)
    ? type.yFixe[Math.floor(Math.random() * type.yFixe.length)]
    : type.yFixe;
  const y =
    yFixeChoisi !== undefined
      ? yFixeChoisi
      : SOL_Y - type.hauteur + (type.offsetSol || 0);

  if (type.estCactus) {
    // 1, 2 ou 3 cactus — le groupe part ensemble du bord droit
    const nb = Math.floor(Math.random() * 3) + 1;
    const gap = -20; // négatif = chevauchement, groupe compact
    // xBase : le premier cactus du groupe commence à canvas.width
    // les suivants sont placés à gauche du premier (déjà hors écran)
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

  if (pixelsDepuisDernier >= 560) {
    creerObstacle();
    pixelsDepuisDernier = 0;
  }

  // Déplacer chaque obstacle vers la gauche et supprimer ceux hors écran
  obstacles = obstacles.filter((obs) => {
    obs.x -= vitesse * dt;
    return obs.x + obs.largeur > 0;
  });
}

// ============================================================
// CONTRÔLES CLAVIER
// ============================================================
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyD") {
    debugHitbox = !debugHitbox;
    return;
  }

  // Rejouer avec Entrée ou Espace quand le jeu est terminé
  if (
    (e.code === "Enter" || e.code === "Space") &&
    !jeuEnCours &&
    peutRejouer
  ) {
    e.preventDefault();
    lancerPartie();
    return;
  }

  // --- SAUT (Espace ou Flèche haut) — impossible si accroupi ---
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (e.code === "Space") spaceDown = true;
    if (joueur.sauts === 0 && !joueur.accroupi) {
      joueur.velociteY = -17;
      joueur.sauts = 1;
    }
  }

  // --- ACCROUPI (Flèche bas) ---
  if (e.code === "ArrowDown") {
    e.preventDefault();
    joueur.accroupi = true;
    joueur.hauteur = HAUTEUR_ACCROUPI;
    joueur.largeur = LARGEUR_ACCROUPI;
    if (joueur.sauts === 0) {
      // Au sol : repositionner les pieds
      joueur.y = SOL_Y - HAUTEUR_ACCROUPI;
    } else {
      // En l'air : accélérer la descente sans téléporter
      joueur.velociteY = Math.max(joueur.velociteY, 10);
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    if (!jeuEnCours) peutRejouer = true; // relâché après mort → peut rejouer
  }

  // Quand on relâche la flèche bas → on se relève
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
// DÉTECTION DE COLLISION
// Hitboxes réduites séparément pour le joueur et les obstacles
// ============================================================
const MARGE_JOUEUR = 15; // marge hitbox joueur

function verifierCollisions() {
  for (const obs of obstacles) {
    // Hitbox réduite du joueur
    const jx = joueur.x + MARGE_JOUEUR;
    const jy = joueur.y + MARGE_JOUEUR;
    const jw = joueur.largeur - MARGE_JOUEUR * 2;
    const jh = joueur.hauteur - MARGE_JOUEUR * 2;

    // Hitbox réduite par les constantes propres à cet obstacle
    const ox = obs.x + obs.hb.gauche;
    const oy = obs.y + obs.hb.haut;
    const ow = obs.largeur - obs.hb.gauche - obs.hb.droite;
    const oh = obs.hauteur - obs.hb.haut - obs.hb.bas;

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

  // Sauvegarder le record si battu
  if (score > record) {
    record = score;
  }

  sauvegarderMedailles();
  // Si Espace est déjà relâché au moment de la mort, on peut rejouer directement
  peutRejouer = !spaceDown;

  // Dessiner une dernière fois
  dessiner();

  // Image de mort centrée
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
// BOUCLE PRINCIPALE DU JEU
// Appelée ~60 fois par seconde par le navigateur
// ============================================================
function gameLoop(timestamp) {
  if (!jeuEnCours) return;
  if (enPause) return; // boucle suspendue, reprendra via togglePause()

  // dt = 1.0 à 60fps, 0.5 à 120fps, 0.25 à 240fps — normalise le mouvement
  const dt = lastTime ? Math.min((timestamp - lastTime) / (1000 / 60), 3) : 1;
  lastTime = timestamp;

  // 1. Mettre à jour la logique
  mettreAJourJoueur(dt);
  mettreAJourObstacles(dt);
  mettreAJourScore(dt);

  // 2. Vérifier les collisions — si touché, game over et on arrête la boucle
  if (verifierCollisions()) {
    gameOver();
    return;
  }

  // 3. Dessiner l'état actuel sur le canvas
  dessiner(dt);

  // 4. Demander au navigateur d'appeler gameLoop() à la prochaine frame
  animationId = requestAnimationFrame(gameLoop);
}

// ============================================================
// PHYSIQUE DU JOUEUR
// Appelée à chaque frame pour mettre à jour sa position
// ============================================================
function mettreAJourJoueur(dt) {
  // Appliquer la gravité : accélère la chute à chaque frame
  joueur.velociteY += GRAVITE * dt;
  joueur.y += joueur.velociteY * dt;

  // Calculer la position Y du sol selon l'état (debout ou accroupi)
  const solActuel = SOL_Y - joueur.hauteur;

  // Empêcher le joueur de passer sous le sol
  if (joueur.y >= solActuel) {
    joueur.y = solActuel;
    joueur.velociteY = 0; // stoppe la chute
    joueur.sauts = 0; // remet le compteur de sauts à zéro
  }
}

// --- Fonction de dessin ---
function dessiner(dt = 1) {
  // Effacer tout le canvas avant de redessiner
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fond défilant : deux copies côte à côte pour la boucle infinie
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

  // Joueur : choisir l'image selon l'état
  let imgJoueur;
  if (joueur.accroupi) {
    imgJoueur = imgJoueurAccroupi;
  } else {
    // Alterner Cours1 et Cours2 toutes les 8 frames
    frameCourse++;
    imgJoueur = Math.floor(frameCourse / 8) % 2 === 0 ? imgCours1 : imgCours2;
  }

  ctx.drawImage(imgJoueur, joueur.x, joueur.y, joueur.largeur, joueur.hauteur);

  // MODE DEBUG — affiche les hitboxes en rouge/bleu
  if (debugHitbox) {
    const mj = 15; // marge joueur
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
// DÉMARRER LE JEU
// ============================================================
function lancerPartie() {
  if (jeuEnCours) return;
  enPause = false;
  btnPause.textContent = "⏸";
  reinitialiserMedailles();
  // Réinitialiser le score, les obstacles et la vitesse
  score = 0;
  frameScore = 0;
  obstacles = [];
  pixelsDepuisDernier = 0;
  vitesse = 7.62;
  xFond = 0;

  // Réinitialiser le joueur
  joueur.y = SOL;
  joueur.velociteY = 0;
  joueur.sauts = 0;
  joueur.accroupi = false;
  joueur.mort = false;
  joueur.hauteur = HAUTEUR_NORMAL;
  joueur.largeur = LARGEUR_NORMAL;
  frameCourse = 0;

  // Annuler toute boucle existante pour éviter les doublons
  if (animationId) cancelAnimationFrame(animationId);
  lastTime = 0;
  jeuEnCours = true;
  animationId = requestAnimationFrame(gameLoop);
  if (typeof jouerMusiqueAleatoire === "function") jouerMusiqueAleatoire();
}
