# ============================================
#   SIMULATION LAPINS & RENARDS (Tkiteasy)
#   Version optimisée + START + MUSIQUE WINSOUND
# ============================================

from tkiteasy import *
import random
import winsound   # 🔥 module musique Windows

# --------------------------------------------
# OUVERTURE FENETRE
# --------------------------------------------
g = ouvrirFenetre(600, 700)

# --------------------------------------------
# PARAMÈTRES
# --------------------------------------------
TAILLE = 30
TAILLE_CASE = 20

# LAPINS
DVLAP = 5
FNLAP = 7

# RENARDS
NB_RENARDS_INIT = 20
ENERGIE_INIT = 10
ENERGIE_GAIN = 3
ENERGIE_PERTE = -1
SEUIL_REPRO = 11
COUT_REPRO = 6

# TOURS
NOMBRE_TOURS = 500


# ============================================
# BOUTON START (avec musique)
# ============================================

def attendre_start():

    # dessin bouton
    g.dessinerRectangle(230, 620, 140, 50, "grey20")
    txt = g.afficherTexte("START", 260, 635, "white", 20)

    while True:
        ev = g.attendreClic()
        x, y = ev.x, ev.y

        if 230 <= x <= 370 and 620 <= y <= 670:
            g.supprimer(txt)

            # 🔥 Lancer MUSIQUE en boucle (WAV)
            winsound.PlaySound("MUSIC.wav", winsound.SND_LOOP + winsound.SND_ASYNC)

            return


# ============================================
# CLASSES
# ============================================

class Lapin:
    def __init__(self, x, y, age, obj):
        self.x = x
        self.y = y
        self.age = age
        self.obj = obj


class Renard:
    def __init__(self, x, y, energie, obj):
        self.x = x
        self.y = y
        self.energie = energie
        self.obj = obj


# ============================================
# SIMULATION
# ============================================

class Simulation:

    def __init__(self):

        self.plateau = [[None for _ in range(TAILLE)]
                        for _ in range(TAILLE)]

        self.lapins = []
        self.renards = []

        self.compteur_l = None
        self.compteur_r = None
        self.compteur_t = None

        self.creer_plateau()
        self.ajouter_renards_initiaux()
        self.afficher_compteurs(0)

    # --------------------------------------------
    # GRILLE + COMPTEURS
    # --------------------------------------------

    def creer_plateau(self):
        g.dessinerRectangle(0, 0,
                            TAILLE * TAILLE_CASE,
                            TAILLE * TAILLE_CASE,
                            "black")
        for i in range(TAILLE):
            g.dessinerLigne(0, i * TAILLE_CASE,
                            TAILLE * TAILLE_CASE,
                            i * TAILLE_CASE,
                            "grey40")
            g.dessinerLigne(i * TAILLE_CASE, 0,
                            i * TAILLE_CASE,
                            TAILLE * TAILLE_CASE,
                            "grey40")

    def afficher_compteurs(self, tour):
        if self.compteur_l is None:
            self.compteur_l = g.afficherTexte(
                f"Lapins : {len(self.lapins)}", 150, 670, "white", 20)
            self.compteur_r = g.afficherTexte(
                f"Renards : {len(self.renards)}", 450, 670, "orange", 20)
            self.compteur_t = g.afficherTexte(
                f"Tour : {tour}", 300, 640, "cyan", 18)
        else:
            g.changerTexte(self.compteur_l, f"Lapins : {len(self.lapins)}")
            g.changerTexte(self.compteur_r, f"Renards : {len(self.renards)}")
            g.changerTexte(self.compteur_t, f"Tour : {tour}")

    # --------------------------------------------
    # OUTILS
    # --------------------------------------------

    def case_libre(self, x, y):
        if x < 0 or x >= TAILLE or y < 0 or y >= TAILLE:
            return False
        return self.plateau[y][x] is None

    def voisins(self, x, y):
        res = []
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                if dx == dy == 0:
                    continue
                nx, ny = x+dx, y+dy
                if 0 <= nx < TAILLE and 0 <= ny < TAILLE:
                    res.append((nx,ny))
        return res

    # --------------------------------------------
    # AJOUT LAPINS
    # --------------------------------------------

    def ajouter_lapin(self):
        essais = 0
        while essais < 2000:
            x = random.randint(0,TAILLE-1)
            y = random.randint(0,TAILLE-1)
            if self.case_libre(x,y):
                obj = g.afficherImage(
                    x*TAILLE_CASE, y*TAILLE_CASE,
                    "lapin.png", TAILLE_CASE, TAILLE_CASE
                )
                lap = Lapin(x,y,DVLAP,obj)
                self.lapins.append(lap)
                self.plateau[y][x] = lap
                return
            essais += 1

    def naissances_automatiques(self):
        for _ in range(FNLAP):
            self.ajouter_lapin()

    # --------------------------------------------
    # AJOUT RENARDS
    # --------------------------------------------

    def ajouter_renards_initiaux(self):
        for _ in range(NB_RENARDS_INIT):
            self.ajouter_renard()

    def ajouter_renard(self):
        essais = 0
        while essais < 2000:
            x = random.randint(0,TAILLE-1)
            y = random.randint(0,TAILLE-1)
            if self.case_libre(x,y):
                obj = g.afficherImage(
                    x*TAILLE_CASE, y*TAILLE_CASE,
                    "renard.png", TAILLE_CASE, TAILLE_CASE
                )
                ren = Renard(x,y,ENERGIE_INIT,obj)
                self.renards.append(ren)
                self.plateau[y][x] = ren
                return
            essais += 1

    # --------------------------------------------
    # DÉPLACEMENT LAPINS
    # --------------------------------------------

    def deplacer_lapin(self, lap):
        directions = [
            (-1,-1),(-1,0),(-1,1),
            (0,-1),(0,1),
            (1,-1),(1,0),(1,1)
        ]
        random.shuffle(directions)

        for dx,dy in directions:
            nx,ny = lap.x+dx, lap.y+dy
            if self.case_libre(nx,ny):
                self.plateau[lap.y][lap.x] = None
                self.plateau[ny][nx] = lap
                g.deplacer(lap.obj, dx*TAILLE_CASE, dy*TAILLE_CASE)
                lap.x, lap.y = nx,ny
                return

    # --------------------------------------------
    # REPRODUCTION LAPINS
    # --------------------------------------------

    def reproduction_lapins(self):
        nouveaux = []

        for lap in self.lapins:
            voisins = self.voisins(lap.x,lap.y)

            if not any(isinstance(self.plateau[ny][nx], Lapin)
                       for nx,ny in voisins):
                continue

            for nx,ny in voisins:
                if self.case_libre(nx,ny):
                    obj = g.afficherImage(
                        nx*TAILLE_CASE, ny*TAILLE_CASE,
                        "lapin.png", TAILLE_CASE, TAILLE_CASE)
                    bebe = Lapin(nx,ny,DVLAP,obj)
                    nouveaux.append(bebe)
                    self.plateau[ny][nx] = bebe
                    break

        self.lapins.extend(nouveaux)

    # --------------------------------------------
    # SUPPRESSION
    # --------------------------------------------

    def supprimer_lapin(self, lap):
        if self.plateau[lap.y][lap.x] == lap:
            self.plateau[lap.y][lap.x] = None
        g.supprimer(lap.obj)
        self.lapins.remove(lap)

    def supprimer_renard(self, ren):
        if self.plateau[ren.y][ren.x] == ren:
            self.plateau[ren.y][ren.x] = None
        g.supprimer(ren.obj)
        self.renards.remove(ren)

    # --------------------------------------------
    # CHASSE RENARD
    # --------------------------------------------

    def renard_chasse(self, ren):
        directions = [
            (-1,-1),(-1,0),(-1,1),
            (0,-1),(0,1),
            (1,-1),(1,0),(1,1)
        ]
        random.shuffle(directions)

        for dx,dy in directions:
            nx,ny = ren.x+dx, ren.y+dy

            if 0 <= nx < TAILLE and 0 <= ny < TAILLE:

                contenu = self.plateau[ny][nx]

                if isinstance(contenu, Lapin):
                    self.supprimer_lapin(contenu)
                    ren.energie += ENERGIE_GAIN

                    self.plateau[ren.y][ren.x] = None
                    self.plateau[ny][nx] = ren
                    g.deplacer(ren.obj, dx*TAILLE_CASE, dy*TAILLE_CASE)

                    ren.x, ren.y = nx, ny
                    return True

        return False

    # --------------------------------------------
    # DÉPLACEMENT RENARDS
    # --------------------------------------------

    def deplacer_renard(self, ren):

        a_mange = self.renard_chasse(ren)

        if not a_mange:
            ren.energie -= 1

            directions = [
                (-1,-1),(-1,0),(-1,1),
                (0,-1),(0,1),
                (1,-1),(1,0),(1,1)
            ]
            random.shuffle(directions)

            for dx,dy in directions:
                nx,ny = ren.x+dx, ren.y+dy
                if self.case_libre(nx,ny):
                    self.plateau[ren.y][ren.x] = None
                    self.plateau[ny][nx] = ren
                    g.deplacer(ren.obj, dx*TAILLE_CASE, dy*TAILLE_CASE)
                    ren.x, ren.y = nx,ny
                    break

        if ren.energie <= 0:
            self.supprimer_renard(ren)

    # --------------------------------------------
    # REPRODUCTION RENARDS
    # --------------------------------------------

    def reproduction_renards(self):
        nouveaux = []

        for ren in self.renards:

            if ren.energie < SEUIL_REPRO:
                continue

            voisins = self.voisins(ren.x,ren.y)
            libres = [(nx,ny) for nx,ny in voisins if self.case_libre(nx,ny)]

            if not libres:
                continue

            nx,ny = random.choice(libres)

            obj = g.afficherImage(
                nx*TAILLE_CASE, ny*TAILLE_CASE,
                "renard.png", TAILLE_CASE, TAILLE_CASE)

            bebe = Renard(nx,ny,ENERGIE_INIT,obj)
            nouveaux.append(bebe)

            self.plateau[ny][nx] = bebe
            ren.energie -= COUT_REPRO

        self.renards.extend(nouveaux)

    # --------------------------------------------
    # BOUCLE PRINCIPALE
    # --------------------------------------------

    def lancer(self):

        tour = 0

        while tour < NOMBRE_TOURS:

            tour += 1

            # --- GESTION LAPINS ---
            morts = []
            for lap in list(self.lapins):
                lap.age -= 1
                if lap.age <= 0:
                    morts.append(lap)
                else:
                    self.deplacer_lapin(lap)

            for lap in morts:
                self.supprimer_lapin(lap)

            self.reproduction_lapins()
            self.naissances_automatiques()

            # --- GESTION RENARDS ---
            for ren in list(self.renards):
                self.deplacer_renard(ren)

            self.reproduction_renards()

            # --- AFFICHAGE ---
            self.afficher_compteurs(tour)
            g.actualiser()
            g.pause(0.3)

        # ====================================
        # ARRÊTER LA MUSIQUE À LA FIN DU JEU
        # ====================================
        winsound.PlaySound(None, winsound.SND_PURGE)

        print("Simulation terminée.")
        g.pause(0.1)


# ============================================
# LANCEMENT AVEC BOUTON START
# ============================================

attendre_start()
sim = Simulation()
sim.lancer()
