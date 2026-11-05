# WebGIS Togo

Carte interactive du Togo réalisée avec Leaflet : écoles, hôpitaux, routes, préfectures et couverture du sol.

Auteur : Elvis N'LEDEA, géomaticien.
Projet de l'unité « Intégration et publication des données géospatiales », LTAG, Université de Lomé, décembre 2025.

## Fonctionnalités

- 5 couches : préfectures (style par région), routes (style par type), couverture du sol ESA CCI, écoles (2 778) et hôpitaux (318) regroupés en clusters
- 3 fonds de carte : OpenStreetMap, Esri Topographie, Esri Imagerie
- Recherche de lieux (OpenStreetMap Nominatim), géolocalisation, plein écran, échelle, coordonnées de la souris
- Légende dynamique qui suit les couches affichées, avec la part du territoire de chaque classe d'occupation du sol

## Architecture

- `index.html` : structure de la page
- `css/style.css` : mise en forme
- `js/script.js` : chargement des couches et des outils
- `data/` : couches en GeoJSON et raster de couverture du sol en PNG
- `lib/` : bibliothèques Leaflet incluses localement (Leaflet 1.9.4, Leaflet.markercluster 1.5.3, leaflet-geosearch 3.11.0, leaflet.locatecontrol 0.85.1, leaflet.fullscreen 3.0.2)

La version d'origine servait les routes et la couverture du sol par GeoServer (WMS). Cette version les convertit en fichiers statiques pour un hébergement gratuit sur GitHub Pages.

## Sources des données

- Écoles et hôpitaux : OpenStreetMap
- Préfectures : limites GADM (ancien découpage en 21 préfectures)
- Population par région : INSEED, 5e Recensement général de la population et de l'habitat (RGPH-5, 2022)
- Routes : jeu de données fourni par le LTAG
- Couverture du sol : ESA Climate Change Initiative Land Cover

## Lancer la carte sur son ordinateur

Le navigateur bloque la lecture des fichiers GeoJSON ouverts en double-clic. Il faut un petit serveur local :

- avec VS Code : extension Live Server, puis clic droit sur `index.html` et « Open with Live Server »
- ou avec Python : `python -m http.server` dans le dossier, puis ouvrir http://localhost:8000
