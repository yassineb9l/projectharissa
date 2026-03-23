// ============================================================
// HARISSA JUMP - Logique principale du jeu
// ============================================================

// --- Création du canvas et injection dans #gameArea ---
const canvas = document.createElement("canvas"); // on crée le canvas en JS
canvas.width = 800;
canvas.height = 250;
document.getElementById("gameArea").appendChild(canvas); // on l'insère dans la page
const ctx = canvas.getContext("2d"); // on obtient les outils de dessin 2D

// --- État global du jeu ---
let jeuEnCours = false; // true quand la partie est lancée

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
const HAUTEUR_NORMAL = 90; // hauteur debout
const HAUTEUR_ACCROUPI = 45; // hauteur accroupi
const SOL = 248 - HAUTEUR_NORMAL; // position Y quand le joueur est au sol (= 198)

const joueur = {
  x: 80, // position horizontale (fixe)
  y: SOL, // position verticale (change quand il saute)
  largeur: 70,
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
const TYPES_OBSTACLES = [
  { largeur: 55, hauteur: 80,  image: imgObstacle1 },
  { largeur: 65, hauteur: 110, image: imgObstacle2 },
  { largeur: 75, hauteur: 150, image: imgObstacle3 },
  { largeur: 60, hauteur: 95,  image: imgObstacle4 },
  { largeur: 70, hauteur: 130, image: imgObstacle5 },
];

function creerObstacle() {
  // Choisir un type au hasard
  const type =
    TYPES_OBSTACLES[Math.floor(Math.random() * TYPES_OBSTACLES.length)];
  obstacles.push({
    x: canvas.width, // spawn hors écran à droite
    y: 248 - type.hauteur, // positionné sur le sol
    largeur: type.largeur,
    hauteur: type.hauteur,
    image: type.image, // image associée à ce type
  });
}

function mettreAJourObstacles() {
  frameDepuisDernier++;

  // Spawn un obstacle toutes les 80 frames environ
  if (frameDepuisDernier >= 80) {
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
let dernierAppuiEspace = 0; // timestamp du dernier appui sur Espace
const DELAI_DOUBLE_SAUT = 300; // millisecondes max entre les deux appuis

document.addEventListener("keydown", (e) => {
  // Rejouer avec Entrée quand le jeu est terminé
  if (e.code === "Enter" && !jeuEnCours) {
    lancerPartie();
    return;
  }

  // --- SAUT (Espace ou Flèche haut) ---
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault(); // évite que la page défile

    const maintenant = Date.now(); // heure actuelle en millisecondes

    if (joueur.sauts === 0) {
      // Premier saut : saut normal
      joueur.velociteY = -12;
      joueur.sauts = 1;
      dernierAppuiEspace = maintenant;
    } else if (
      joueur.sauts === 1 &&
      maintenant - dernierAppuiEspace < DELAI_DOUBLE_SAUT
    ) {
      // Double saut : appui rapide → saut plus haut
      joueur.velociteY = -18;
      joueur.sauts = 2;
    }
  }

  // --- ACCROUPI (Flèche bas) ---
  if (e.code === "ArrowDown") {
    e.preventDefault();
    joueur.accroupi = true;
    joueur.hauteur = HAUTEUR_ACCROUPI;
    // On repositionne le joueur pour que ses pieds restent au sol
    joueur.y = 248 - HAUTEUR_ACCROUPI;
  }
});

document.addEventListener("keyup", (e) => {
  // Quand on relâche la flèche bas → on se relève
  if (e.code === "ArrowDown") {
    joueur.accroupi = false;
    joueur.hauteur = HAUTEUR_NORMAL;
    joueur.y = 248 - HAUTEUR_NORMAL;
  }
});

// ============================================================
// DÉTECTION DE COLLISION
// Vérifie si le joueur touche un obstacle (rectangle contre rectangle)
// ============================================================
function verifierCollisions() {
  for (const obs of obstacles) {
    // Les 4 conditions pour que deux rectangles se chevauchent :
    const toucheHorizontal =
      joueur.x < obs.x + obs.largeur && joueur.x + joueur.largeur > obs.x;
    const toucheVertical =
      joueur.y < obs.y + obs.hauteur && joueur.y + joueur.hauteur > obs.y;

    if (toucheHorizontal && toucheVertical) {
      return true; // collision détectée
    }
  }
  return false; // aucune collision
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
  ctx.fillText("Appuie sur Entrée pour rejouer", canvas.width / 2, 210);
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
  requestAnimationFrame(gameLoop);
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
  const solActuel = 248 - joueur.hauteur;

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

  // Sol (ligne en bas du canvas)
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 248, canvas.width, 2);

  // Joueur : choisir l'image selon l'état
  let imgJoueur;
  if (joueur.mort) imgJoueur = imgJoueurMort;
  else if (joueur.accroupi) imgJoueur = imgJoueurAccroupi;
  else imgJoueur = imgJoueurDebout;

  ctx.drawImage(imgJoueur, joueur.x, joueur.y, joueur.largeur, joueur.hauteur);

  // Obstacles — chacun utilise sa propre image
  for (const obs of obstacles) {
    ctx.drawImage(obs.image, obs.x, obs.y, obs.largeur, obs.hauteur);
  }

  // Affichage du score en haut à droite
  ctx.fillStyle = "#222";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`Score : ${score}`, canvas.width - 10, 25);
  ctx.fillText(`Record : ${record}`, canvas.width - 10, 48);

  // Médaille en cours (si seuil atteint)
  const medaille = obtenirMedaille(score);
  if (medaille) {
    ctx.fillStyle = medaille.couleur;
    ctx.font = "bold 16px Arial";
    ctx.fillText(medaille.label, canvas.width - 10, 71);
  }
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

  jeuEnCours = true;
  requestAnimationFrame(gameLoop);
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
