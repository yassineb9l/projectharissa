// ============================================================
// HARISSA JUMP - Logique principale du jeu
// ============================================================

// --- Création du canvas et injection dans #gameArea ---
const canvas = document.createElement("canvas"); // on crée le canvas en JS
canvas.width = 900;
canvas.height = 400;
const gameArea = document.getElementById("gameArea");
gameArea.style.width = canvas.width + "px";
gameArea.style.height = canvas.height + "px";
gameArea.appendChild(canvas); // on l'insère dans la page
const ctx = canvas.getContext("2d"); // on obtient les outils de dessin 2D

// --- État global du jeu ---
let jeuEnCours = false; // true quand la partie est lancée
let animationId = null; // référence à requestAnimationFrame pour éviter les doublons

// ============================================================
// SCORE
// ============================================================
let score = 0;
// localStorage : mémoire persistante du navigateur, survit aux rechargements
let record = parseInt(localStorage.getItem("harissaRecord")) || 0;

// Seuils des médailles — modifie ces valeurs pour ajuster la difficulté
const SEUIL_BRONZE = 200;
const SEUIL_ARGENT = 600;
const SEUIL_OR = 1200;

const MEDAILLES = [
  { seuil: SEUIL_OR, label: "🥇 Or", couleur: "#f1c40f" },
  { seuil: SEUIL_ARGENT, label: "🥈 Argent", couleur: "#bdc3c7" },
  { seuil: SEUIL_BRONZE, label: "🥉 Bronze", couleur: "#e67e22" },
];

// Retourne la médaille actuelle ou null
function obtenirMedaille(s) {
  for (const m of MEDAILLES) {
    if (s >= m.seuil) return m;
  }
  return null;
}

let frameScore = 0; // compteur interne pour le rythme du score

function mettreAJourScore() {
  frameScore++;

  // +1 point toutes les 6 frames, comme le Dino Chrome (~10 pts/seconde)
  if (frameScore >= 6) {
    score++;
    frameScore = 0;
    // Mettre à jour la zone de score dans le HTML
    const scoreZone = document.getElementById("scoreZone");
    if (scoreZone) scoreZone.textContent = `Score : ${score} | Record : ${record}`;
  }

  // Augmenter la vitesse tous les 100 points
  vitesse = 4 + Math.floor(score / 100) * 0.5;
}

// ============================================================
// IMAGES — remplace les chemins par tes vrais fichiers
// ============================================================
const imgJoueurDebout = new Image();
imgJoueurDebout.src = "Cours.gif"; // joueur qui court (et saute)
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

// ============================================================
// LE JOUEUR
// ============================================================
const GRAVITE = 0.6; // force qui tire le joueur vers le bas chaque frame
const HAUTEUR_NORMAL = 125; // hauteur debout
const LARGEUR_NORMAL = 95; // largeur debout
const HAUTEUR_ACCROUPI = 62; // hauteur accroupi
const LARGEUR_ACCROUPI = 150; // largeur accroupi (plus large car étalé)
const SOL_Y = 360; // position Y du sol sur le canvas
const SOL = SOL_Y - HAUTEUR_NORMAL; // position Y du joueur debout au sol

const joueur = {
  x: 80, // position horizontale (fixe)
  y: SOL, // position verticale (change quand il saute)
  largeur: LARGEUR_NORMAL,
  hauteur: HAUTEUR_NORMAL,
  velociteY: 0, // vitesse verticale (négative = monte, positive = descend)
  sauts: 0, // 0 = au sol, 1 = saut simple, 2 = double saut utilisé
  accroupi: false,
  mort: false,
};

// ============================================================
// OBSTACLES
// ============================================================
let obstacles = []; // liste de tous les obstacles actifs
let frameDepuisDernier = 0; // compteur de frames depuis le dernier obstacle
let vitesse = 4; // vitesse de déplacement (augmente avec le score)

// Les 5 obstacles possibles — chacun a sa taille et son image
// margeHitbox = pixels réduits sur chaque bord pour la collision
const TYPES_OBSTACLES = [
  { largeur: 165, hauteur: 150, offsetSol: 45, margeHitbox: 30, image: imgObstacle1 },
  { largeur: 205, hauteur: 185, offsetSol: 55, margeHitbox: 35, image: imgObstacle2 },
  { largeur: 255, hauteur: 230, offsetSol: 70, margeHitbox: 45, image: imgObstacle3 },
  { largeur: 185, hauteur: 165, offsetSol: 50, margeHitbox: 30, image: imgObstacle4 },
  { largeur: 230, hauteur: 205, offsetSol: 60, margeHitbox: 35, image: imgObstacle5 },
];


let dernierTypeObstacle = -1;

function creerObstacle() {
  let index;
  do {
    index = Math.floor(Math.random() * TYPES_OBSTACLES.length);
  } while (index === dernierTypeObstacle);
  dernierTypeObstacle = index;

  const type = TYPES_OBSTACLES[index];
  obstacles.push({
    x: canvas.width,
    y: SOL_Y - type.hauteur + type.offsetSol,
    largeur: type.largeur,
    hauteur: type.hauteur,
    marge: type.margeHitbox,
    image: type.image,
  });
}

function mettreAJourObstacles() {
  frameDepuisDernier++;

  // Spawn un obstacle toutes les 140 frames environ
  if (frameDepuisDernier >= 140) {
    creerObstacle();
    frameDepuisDernier = 0;
  }

  // Déplacer chaque obstacle vers la gauche et supprimer ceux hors écran
  obstacles = obstacles.filter((obs) => {
    obs.x -= vitesse;
    return obs.x + obs.largeur > 0; // garder seulement ceux encore visibles
  });
}

// ============================================================
// CONTRÔLES CLAVIER
// ============================================================
document.addEventListener("keydown", (e) => {
  // Rejouer avec Entrée ou Espace quand le jeu est terminé
  if ((e.code === "Enter" || e.code === "Space") && !jeuEnCours) {
    lancerPartie();
    return;
  }

  // --- SAUT (Espace ou Flèche haut) — saut simple uniquement ---
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (joueur.sauts === 0) {
      joueur.velociteY = -17; // force du saut (négatif = vers le haut)
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

    // Hitbox réduite par la marge propre à cet obstacle
    const ox = obs.x + obs.marge;
    const oy = obs.y + obs.marge;
    const ow = obs.largeur - obs.marge * 2;
    const oh = obs.hauteur - obs.marge * 2;

    const toucheHorizontal = jx < ox + ow && jx + jw > ox;
    const toucheVertical   = jy < oy + oh && jy + jh > oy;

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
    localStorage.setItem("harissaRecord", record);
  }

  // Dessiner une dernière fois avec l'image mort
  dessiner();

  // Overlay sombre
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Texte GAME OVER
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, 90);

  // Score et record
  ctx.font = "20px Arial";
  ctx.fillText(
    `Score : ${score}   |   Record : ${record}`,
    canvas.width / 2,
    130,
  );

  // Médaille obtenue
  const medaille = obtenirMedaille(score);
  if (medaille) {
    ctx.fillStyle = medaille.couleur;
    ctx.font = "bold 22px Arial";
    ctx.fillText(medaille.label, canvas.width / 2, 165);
  }

  // Instruction rejouer
  ctx.fillStyle = "#fff";
  ctx.font = "18px Arial";
  ctx.fillText("Appuie sur Espace pour rejouer", canvas.width / 2, 210);
}

// ============================================================
// BOUCLE PRINCIPALE DU JEU
// Appelée ~60 fois par seconde par le navigateur
// ============================================================
function gameLoop() {
  if (!jeuEnCours) return; // on sort si le jeu est en pause ou game over

  // 1. Mettre à jour la logique
  mettreAJourJoueur();
  mettreAJourObstacles();
  mettreAJourScore();

  // 2. Vérifier les collisions — si touché, game over et on arrête la boucle
  if (verifierCollisions()) {
    gameOver();
    return;
  }

  // 3. Dessiner l'état actuel sur le canvas
  dessiner();

  // 4. Demander au navigateur d'appeler gameLoop() à la prochaine frame
  animationId = requestAnimationFrame(gameLoop);
}

// ============================================================
// PHYSIQUE DU JOUEUR
// Appelée à chaque frame pour mettre à jour sa position
// ============================================================
function mettreAJourJoueur() {
  // Appliquer la gravité : accélère la chute à chaque frame
  joueur.velociteY += GRAVITE;
  joueur.y += joueur.velociteY;

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
function dessiner() {
  // Effacer tout le canvas avant de redessiner
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Obstacles dessinés en premier (sous le sol)
  for (const obs of obstacles) {
    ctx.drawImage(obs.image, obs.x, obs.y, obs.largeur, obs.hauteur);
  }

  // Couvrir la zone sous le sol pour cacher les transparents des images
  ctx.fillStyle = "#eeeeee"; // même couleur que le fond du gameArea
  ctx.fillRect(0, SOL_Y + 2, canvas.width, canvas.height - SOL_Y);

  // Sol (ligne de séparation)
  ctx.fillStyle = "#555";
  ctx.fillRect(0, SOL_Y, canvas.width, 2);

  // Joueur : choisir l'image selon l'état
  let imgJoueur;
  if (joueur.mort) imgJoueur = imgJoueurMort;
  else if (joueur.accroupi) imgJoueur = imgJoueurAccroupi;
  else imgJoueur = imgJoueurDebout;

  ctx.drawImage(imgJoueur, joueur.x, joueur.y, joueur.largeur, joueur.hauteur);
}

// ============================================================
// DÉMARRER LE JEU
// ============================================================
function lancerPartie() {
  // Réinitialiser le score, les obstacles et la vitesse
  score = 0;
  frameScore = 0;
  obstacles = [];
  frameDepuisDernier = 0;
  vitesse = 4;

  // Réinitialiser le joueur
  joueur.y = SOL;
  joueur.velociteY = 0;
  joueur.sauts = 0;
  joueur.accroupi = false;
  joueur.mort = false;
  joueur.hauteur = HAUTEUR_NORMAL;

  // Annuler toute boucle existante pour éviter les doublons
  if (animationId) cancelAnimationFrame(animationId);
  jeuEnCours = true;
  animationId = requestAnimationFrame(gameLoop);
}

// ============================================================
// REDÉMARRER LE JEU
// ============================================================
function restartGame() {
  lancerPartie();
}

// Connexion des boutons Start et Restart du HTML
// Le script est en bas du body, le DOM est déjà chargé ici
const boutons = document.querySelectorAll("#gameContainer button");
boutons[0].addEventListener("click", lancerPartie); // bouton Start
boutons[1].addEventListener("click", restartGame); // bouton Restart
