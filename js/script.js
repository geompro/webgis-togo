// =================================================================================
//  WebGIS Togo
//  Auteur : Elvis N'LEDEA
//  Carte Leaflet : écoles, hôpitaux, routes, préfectures et couverture du sol.
//  Toutes les couches sont des fichiers statiques (GeoJSON, PNG) : la carte
//  fonctionne sur un hébergement simple comme GitHub Pages, sans GeoServer.
// =================================================================================

// ---------------------------------------------------------------------------------
//  1. Carte centrée sur le Togo
// ---------------------------------------------------------------------------------
var map = L.map("map", { zoomControl: true });
var emprisTogo = [[6.1, -0.15], [11.14, 1.81]];
map.fitBounds(emprisTogo, { padding: [20, 20] });

// ---------------------------------------------------------------------------------
//  2. Fonds de carte
// ---------------------------------------------------------------------------------
var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

var esriImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics" }
);

var esriTopo = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, attribution: "Fond &copy; Esri" }
);

var fonds = {
  OpenStreetMap: osm,
  "Esri Topographie": esriTopo,
  "Esri Imagerie satellite": esriImagery,
};

// Commutateur de couches : les couches s'ajoutent au fil du chargement
var controleCouches = L.control.layers(fonds, {}, { collapsed: true }).addTo(map);

// Petit utilitaire : charger un GeoJSON et signaler une erreur lisible
function chargerGeoJSON(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error("Fichier introuvable : " + url);
    return r.json();
  });
}

// Échapper le texte venant des données avant de l'afficher dans une popup
function texte(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------------
//  3. Couverture du sol (ESA CCI) : image PNG calée sur l'emprise du raster
// ---------------------------------------------------------------------------------
var infosSol = null;
var coucheSol = null;

chargerGeoJSON("data/couverture_sol.json").then(function (meta) {
  infosSol = meta;
  coucheSol = L.imageOverlay("data/couverture_sol.png", meta.bounds, {
    opacity: 0.75,
    className: "raster-pixels",
    attribution: "Couverture du sol &copy; ESA CCI Land Cover",
  });
  controleCouches.addOverlay(coucheSol, "Couverture du sol (ESA CCI)");
  majLegende();
});

// ---------------------------------------------------------------------------------
//  4. Préfectures : couleur par région, popup avec la population
// ---------------------------------------------------------------------------------
var couleursRegions = {
  Maritime: "#1E90FF",
  Plateaux: "#228B22",
  Centrale: "#CD853F",
  Kara: "#B22222",
  Savanes: "#DAA520",
};

// Population par région : INSEED, 5e Recensement général (RGPH-5), novembre 2022.
// Les limites de préfectures de cette couche sont anciennes (21 préfectures,
// contre 39 aujourd'hui) : la population est donc donnée à l'échelle de la région.
var populationRegions = {
  Maritime: { valeur: 3534991, note: "Grand Lomé (2 188 376) et région Maritime (1 346 615)" },
  Plateaux: { valeur: 1635946 },
  Centrale: { valeur: 795529 },
  Kara: { valeur: 985512 },
  Savanes: { valeur: 1143520 },
};

var couchePrefectures = null;

chargerGeoJSON("data/prefectures.geojson").then(function (data) {
  couchePrefectures = L.geoJSON(data, {
    style: function (f) {
      return {
        color: "#ffffff",
        weight: 1.2,
        fillColor: couleursRegions[f.properties.region] || "#888888",
        // Remplissage presque transparent quand la couverture du sol est affichée
        fillOpacity: coucheSol && map.hasLayer(coucheSol) ? 0.03 : 0.35,
      };
    },
    onEachFeature: function (f, couche) {
      var p = f.properties;
      var pop = populationRegions[p.region];
      couche.bindPopup(
        "<h3>Préfecture de " + texte(p.prefecture) + "</h3>" +
          "<b>Région :</b> " + texte(p.region) + "<br>" +
          "<b>Population de la région :</b> " +
          pop.valeur.toLocaleString("fr-FR") + " habitants" +
          (pop.note ? "<br><small>" + pop.note + "</small>" : "") +
          "<br><small>Source : INSEED, RGPH-5 (2022)</small>"
      );
      couche.on({
        mouseover: function (e) { e.target.setStyle({ weight: 3, fillOpacity: 0.55 }); },
        mouseout: function (e) { couchePrefectures.resetStyle(e.target); },
      });
    },
  }).addTo(map);
  couchePrefectures.bringToBack();
  controleCouches.addOverlay(couchePrefectures, "Préfectures et régions");
  majLegende();
});

// ---------------------------------------------------------------------------------
//  5. Routes : style par type, repris du style GeoServer d'origine
// ---------------------------------------------------------------------------------
var stylesRoutes = {
  principale: { color: "#ff0000", weight: 3 },
  secondaire: { color: "#ef8500", weight: 2 },
  tertiaire: { color: "#000000", weight: 1.2 },
  inconnu: { color: "#adadad", weight: 1.2 },
};

var coucheRoutes = null;

chargerGeoJSON("data/routes.geojson").then(function (data) {
  coucheRoutes = L.geoJSON(data, {
    style: function (f) {
      return stylesRoutes[f.properties.type] || stylesRoutes.inconnu;
    },
    onEachFeature: function (f, couche) {
      couche.bindPopup("<b>Route " + texte(f.properties.type) + "</b>");
    },
  }).addTo(map);
  controleCouches.addOverlay(coucheRoutes, "Routes");
  majLegende();
});

// ---------------------------------------------------------------------------------
//  6. Écoles et hôpitaux : points regroupés (clustering) pour rester lisibles
// ---------------------------------------------------------------------------------
function couchePoints(url, iconeUrl, intitule, classeGroupe) {
  var icone = L.icon({
    iconUrl: iconeUrl,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });

  var groupe = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    iconCreateFunction: function (cluster) {
      return L.divIcon({
        html: "<span>" + cluster.getChildCount() + "</span>",
        className: "groupe " + classeGroupe,
        iconSize: [36, 36],
      });
    },
  });

  return chargerGeoJSON(url).then(function (data) {
    L.geoJSON(data, {
      pointToLayer: function (f, latlng) {
        return L.marker(latlng, { icon: icone, alt: intitule });
      },
      onEachFeature: function (f, couche) {
        var nom = f.properties.nom ? texte(f.properties.nom) : "<i>Nom non renseigné</i>";
        couche.bindPopup("<b>" + intitule + "</b><br>" + nom);
      },
    }).eachLayer(function (m) { groupe.addLayer(m); });
    return { groupe: groupe, total: data.features.length };
  });
}

var nbEcoles = 0;
var nbHopitaux = 0;

couchePoints("data/hopitaux.geojson", "icons/hospital_icon.png", "Hôpital", "groupe-hopital")
  .then(function (res) {
    nbHopitaux = res.total;
    res.groupe.addTo(map);
    controleCouches.addOverlay(res.groupe, "Hôpitaux (" + res.total + ")");
    majLegende();
  });

couchePoints("data/ecoles.geojson", "icons/school_icon.png", "École", "groupe-ecole")
  .then(function (res) {
    nbEcoles = res.total;
    res.groupe.addTo(map);
    controleCouches.addOverlay(res.groupe, "Écoles (" + res.total + ")");
    majLegende();
  });

// ---------------------------------------------------------------------------------
//  7. Outils : recherche, géolocalisation, plein écran, échelle, coordonnées
// ---------------------------------------------------------------------------------
map.addControl(
  new GeoSearch.GeoSearchControl({
    provider: new GeoSearch.OpenStreetMapProvider({ params: { countrycodes: "tg" } }),
    style: "button",
    searchLabel: "Rechercher un lieu au Togo",
    notFoundMessage: "Aucun résultat",
    showMarker: true,
    autoClose: true,
  })
);

L.control
  .locate({
    position: "topleft",
    strings: { title: "Me localiser" },
    initialZoomLevel: 14,
  })
  .addTo(map);

L.control
  .fullscreen({
    position: "topleft",
    title: "Plein écran",
    titleCancel: "Quitter le plein écran",
  })
  .addTo(map);

L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 200 }).addTo(map);

var coords = L.control({ position: "bottomleft" });
coords.onAdd = function () {
  var div = L.DomUtil.create("div", "coords");
  div.textContent = "Lat : - | Long : -";
  map.on("mousemove", function (e) {
    div.textContent =
      "Lat : " + e.latlng.lat.toFixed(5) + " | Long : " + e.latlng.lng.toFixed(5);
  });
  return div;
};
coords.addTo(map);

// ---------------------------------------------------------------------------------
//  8. Légende : n'affiche que les couches visibles, avec les vraies couleurs
// ---------------------------------------------------------------------------------
var legende = L.control({ position: "bottomright" });
var divLegende;

legende.onAdd = function () {
  divLegende = L.DomUtil.create("div", "legende");
  L.DomEvent.disableClickPropagation(divLegende);
  L.DomEvent.disableScrollPropagation(divLegende);
  return divLegende;
};
legende.addTo(map);

function ligne(symbole, libelle) {
  return '<div class="ligne">' + symbole + "<span>" + libelle + "</span></div>";
}

function majLegende() {
  if (!divLegende) return;
  var ouverte = divLegende.classList.contains("ouverte");
  var html =
    '<button type="button" class="entete" aria-expanded="' + ouverte + '">' +
    "Légende</button><div class=\"contenu\">";

  if (nbHopitaux || nbEcoles) {
    html += "<h4>Équipements</h4>";
    if (nbHopitaux) html += ligne('<img src="icons/hospital_icon.png" alt="">', "Hôpital");
    if (nbEcoles) html += ligne('<img src="icons/school_icon.png" alt="">', "École");
    html += ligne('<i class="rond"></i>', "Groupe de points (nombre)");
  }

  if (coucheRoutes && map.hasLayer(coucheRoutes)) {
    html += "<h4>Routes</h4>";
    ["principale", "secondaire", "tertiaire", "inconnu"].forEach(function (t) {
      var s = stylesRoutes[t];
      html += ligne(
        '<i class="trait" style="border-top:' + s.weight + "px solid " + s.color + '"></i>',
        t === "inconnu" ? "Type inconnu" : "Route " + t
      );
    });
  }

  if (couchePrefectures && map.hasLayer(couchePrefectures)) {
    html += "<h4>Régions</h4>";
    Object.keys(couleursRegions).forEach(function (r) {
      html += ligne('<i class="carre" style="background:' + couleursRegions[r] + '"></i>', r);
    });
  }

  if (coucheSol && map.hasLayer(coucheSol) && infosSol) {
    html += "<h4>Couverture du sol (part du territoire)</h4>";
    infosSol.legend
      .filter(function (c) { return c.pct >= 0.1; })
      .forEach(function (c) {
        html += ligne(
          '<i class="carre" style="background:' + c.color + '"></i>',
          c.label + " <small>" + c.pct.toLocaleString("fr-FR") + " %</small>"
        );
      });
  }

  html += "</div>";
  divLegende.innerHTML = html;
  divLegende.querySelector(".entete").onclick = function () {
    divLegende.classList.toggle("ouverte");
    this.setAttribute("aria-expanded", divLegende.classList.contains("ouverte"));
  };
}

map.on("overlayadd overlayremove", function () {
  if (couchePrefectures) couchePrefectures.setStyle(couchePrefectures.options.style);
  majLegende();
});

// Légende ouverte par défaut sur grand écran, repliée sur téléphone
if (window.innerWidth > 700) divLegende.classList.add("ouverte");
majLegende();

// ---------------------------------------------------------------------------------
//  9. Bouton « À propos et sources »
// ---------------------------------------------------------------------------------
document.getElementById("btn-infos").addEventListener("click", function () {
  var bloc = document.getElementById("infos");
  bloc.hidden = !bloc.hidden;
  this.setAttribute("aria-expanded", String(!bloc.hidden));
});
