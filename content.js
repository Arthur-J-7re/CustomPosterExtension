// ----------------------------
// Détecter le compte connecté
// ----------------------------
function getLoggedUser() {
    const profileLink = document.querySelector('a[href="#"]'); 
    return profileLink ? profileLink.textContent.trim() : null;
}

// ----------------------------
// Détecter le nom d'utilisateur dans l'URL
// ----------------------------
function getUserFromUrl(logUser) {
    const username = window.location.pathname.split('/')[1] || null;
    const banWords = ["films","film", "pro","lists", "members", "journal"];
    if (username === logUser) {
        return ""; // Évite de traiter la page de son propre profil
    } else if (banWords.includes(username)) {
        return ""; // Évite les pages non-utilisateur
    }
    return username;
}

// ----------------------------
// Récupérer les posters d'un utilisateur
// ----------------------------
function fetchUserPosters(username) {
    console.log("Fetching posters for user:", username);
    fetch(`https://customposter.onrender.com/${username}`,{
        method: "GET",
        headers: { "Content-Type": "application/json" },
    }) // ou /posters si tu crées cette route
        .then(res => res.json())
        .then(posters => {
            console.log("Posters fetched:", posters);
            chrome.storage.local.get("customPosters", (data) => {
                const lsposters = data.customPosters || {};
                lsposters[username] = posters;

                chrome.storage.local.set({ customPosters: lsposters });
                
            });
        })
        .catch(err => console.error("Erreur fetch posters :", err));
}

// ----------------------------
// Initialisation
// ----------------------------
const loggedUser = getLoggedUser().toLowerCase();
const urlUser = getUserFromUrl(loggedUser).toLowerCase();

if (urlUser) {
    fetchUserPosters(urlUser);
} else {
} if (loggedUser) {
    fetchUserPosters(loggedUser);
} 

(function() {
    let customPosterUrl = null;
    let stabilityTimer = 0;

    // ----------------------------
    // Récupération du slug du film
    // ----------------------------
    function getFilmWindow() {
        const match = window.location.pathname.match(/^\/film\/([^/]+)\//);
        return match ? match[1] : null;
    }

    function getFilmSlug() {
        const div = document.querySelector(".film-poster, .poster");
        const span = div ? div.querySelector("span").querySelector("span") : null;
        return span ? span.textContent.trim() : null;
    }

    
    const filmWindowSlug = getFilmWindow();
    console.log("Film page slug:", filmWindowSlug);
    var filmSlug = "";
    if (filmWindowSlug) {
        filmSlug = getFilmSlug();
    } 
    console.log("Detected film slug:", filmSlug);

    // ----------------------------
    // Remplace l'image si elle diffère
    // ----------------------------
    function forcePoster(img, url) {
        if (!img) return false;
        if (img.src !== url) {
            img.src = url;
            img.srcset = "";
            img.removeAttribute("data-src");
            return true;
        }
        return false;
    }

    // ----------------------------
    // Application du poster principal avec vérification continue
    // ----------------------------
    function applyMainPoster(url) {
        let stableCount = 0;

        const interval = setInterval(() => {
            const imgs = document.querySelectorAll("div.film-poster img, div.poster img");
            if (imgs.length === 0) return;

            let changed = false;
            imgs.forEach(img => {
                if (forcePoster(img, url)) changed = true;
            });

            if (!changed) stableCount++;
            else stableCount = 0;

            if (stableCount > 20) {
                clearInterval(interval);
            }
        }, 100);
    }

    // ----------------------------
    // Observer le pop-up
    // ----------------------------
    function observePopup() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {

                        // Ancien popup
                        const popupImg = node.querySelector(".modal img, .poster img");
                        if (popupImg && customPosterUrl) {
                            forcePoster(popupImg, customPosterUrl);
                        }

                        // Nouvel observer pour le formulaire / modal
                        const diaryPosterImg = node.querySelector(".poster-list .poster img, .poster-list .film-poster img");
                        if (diaryPosterImg && customPosterUrl) {
                            forcePoster(diaryPosterImg, customPosterUrl);
                        }

                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }


    // ----------------------------
    // 🔁 Boucle universelle pour tous les posters visibles
    // ----------------------------
    function getSlugFromElement(el) {
        
        const link = el.querySelector("a[href*='/film/']");
        if (link) {
            const span = link.querySelector("span");
            return span ? span.textContent.trim() : null;
        }
        if (el.dataset.filmSlug) return el.dataset.filmSlug;
        return null;
    }

    function replaceAllVisiblePosters(postersMap) {
        const allPosters = document.querySelectorAll(".film-poster, .poster");
        allPosters.forEach(el => {
            const slug = getSlugFromElement(el);
            if (!slug) return;

            const url = postersMap[slug];
            if (!url) return;
            const img = el.querySelector("img");
            if (img && img.src !== url) {
                forcePoster(img, url);
            }
        });
    }

    // Boucle qui tourne constamment
    function startUniversalLoop(postersMap) {
        setInterval(() => replaceAllVisiblePosters(postersMap), 100);
    }

    // ----------------------------
    // Charger depuis le stockage local
    // ----------------------------
    chrome.storage.local.get("customPosters", (data) => {
        const userPoster = urlUser ? urlUser : loggedUser;
        const posters = data.customPosters[userPoster] || {};

        // Si on est sur une page de film → appliquer le poster principal
        if (filmSlug && posters[filmSlug]) {
            customPosterUrl = posters[filmSlug];
            applyMainPoster(customPosterUrl);
            observePopup();
        } 

        // Toujours activer la boucle universelle
        startUniversalLoop(posters);
    });

    // ----------------------------
    // Bouton d’action sur page film
    // ----------------------------
    function injectButton() {
        const actionsPanel = document.querySelector("ul.js-actions-panel");
        if (!actionsPanel || document.querySelector(".custom-poster-btn")) return;

        const customBtn = document.createElement("li");
        customBtn.className = "custom-poster-btn menu-item";
        const customDeleteBtn = document.createElement("li");
        customDeleteBtn.className = "custom-poster-delete-btn menu-item";

        const button = document.createElement("a");
        button.href = "#";
        button.textContent = "Choose your poster";
        button.style.color = "#f0f0f0";
        button.style.fontWeight = "600";
        
        const deleteButton = document.createElement("a");
        deleteButton.href = "#";
        deleteButton.textContent = "Delete custom poster";
        deleteButton.style.color = "#f0f0f0";
        deleteButton.style.fontWeight = "600";

        customBtn.appendChild(button);
        customDeleteBtn.appendChild(deleteButton);

        actionsPanel.appendChild(customBtn);
        actionsPanel.appendChild(customDeleteBtn);

        button.addEventListener("click", (e) => {
            e.preventDefault();
            openPosterModal();
        });

        deleteButton.addEventListener("click", (e) => {
            deletePoster();
        });

        
    }
    if (filmSlug){
        injectButton();
    }
    
    // ----------------------------
    // Fenêtre modale (inchangée)
    // ----------------------------
    function openPosterModal() {
        if (document.querySelector("#customPosterModal")) return;

        const modal = document.createElement("div");
        modal.id = "customPosterModal";
        modal.innerHTML = `
            <div class="poster-modal-overlay"></div>
            <div class="poster-modal">
              <h3>Changer le poster</h3>
              <input type="text" id="posterUrlInput" placeholder="Colle une URL d'image..." />
              <p>ou</p>
              <input type="file" id="posterFileInput" accept="image/*" />
              <div class="poster-modal-actions">
                <button id="savePosterBtn">Enregistrer</button>
                <button id="cancelPosterBtn">Annuler</button>
              </div>
            </div>
        `;
        document.body.appendChild(modal);

        const style = document.createElement("style");
        style.textContent = `
            .poster-modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.6);
              z-index: 10000;
            }
            .poster-modal {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: #1a1a1a;
              color: white;
              padding: 20px;
              border-radius: 12px;
              z-index: 10001;
              width: 300px;
              text-align: center;
              box-shadow: 0 0 10px rgba(0,0,0,0.4);
              font-family: sans-serif;
            }
            .poster-modal input[type="text"] {
              width: 100%;
              padding: 6px;
              border-radius: 6px;
              border: none;
              margin-bottom: 8px;
            }
            .poster-modal input[type="file"] {
              color: #ccc;
              margin-bottom: 12px;
            }
            .poster-modal-actions {
              display: flex;
              justify-content: space-between;
            }
            .poster-modal button {
              background: #ff8000;
              border: none;
              padding: 6px 12px;
              border-radius: 6px;
              color: white;
              cursor: pointer;
              font-weight: bold;
            }
            .poster-modal button:hover {
              background: #ffa64d;
            }
        `;
        document.head.appendChild(style);

        const saveBtn = modal.querySelector("#savePosterBtn");
        const cancelBtn = modal.querySelector("#cancelPosterBtn");
        const urlInput = modal.querySelector("#posterUrlInput");
        const fileInput = modal.querySelector("#posterFileInput");

        cancelBtn.addEventListener("click", () => modal.remove());
        modal.querySelector(".poster-modal-overlay").addEventListener("click", () => modal.remove());

        saveBtn.addEventListener("click", () => {
            if (fileInput.files.length > 0) {
                /*const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    savePoster(e.target.result);
                    modal.remove();
                };
                reader.readAsDataURL(file);*/
                const formData = new FormData();
                formData.append("poster", fileInput.files[0]);
                formData.append("film", filmSlug);
                formData.append("username",loggedUser);
                fetch("https://customposter.onrender.com/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: formData,
                }).then(response => {return response.json()})
                .then(data => {
                    if (data && data.url) {
                        savePoster(data.url);
                    } 
                });
                modal.remove();

            } else if (urlInput.value.trim() !== "") {
                console.log(filmSlug, loggedUser, urlInput.value.trim());
                const formData = new FormData();
                formData.append("link", urlInput.value.trim());
                formData.append("film", filmSlug);
                formData.append("username",loggedUser);
                fetch("https://customposter.onrender.com/link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ film: filmSlug, username: loggedUser, link: urlInput.value.trim() })
                }).then(response => {return response.json()})
                .then(data => {
                    savePoster(urlInput.value.trim());
                })
                modal.remove();
            } else {
                alert("⚠️ Choisis un fichier ou colle une URL !");
            }
        });
    }

    const deletePoster = () => {
        chrome.storage.local.get("customPosters", (data) => {
            const posters = data.customPosters || {};
            if (posters[loggedUser] && posters[loggedUser][filmSlug]) {
                fetch("https://customposter.onrender.com/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ film: filmSlug, username: loggedUser }),
                }).then(response => {
                    if (response.ok) {
                        delete posters[loggedUser][filmSlug];
                        chrome.storage.local.set({ customPosters: posters });
                        location.reload();
                    }
                });

            }
        });   
    }

    // ----------------------------
    // Sauvegarde + Application immédiate
    // ----------------------------
    function savePoster(newPosterUrl) {
        chrome.storage.local.get("customPosters", (data) => {
            const posters = data.customPosters || {};
            posters[loggedUser][filmSlug] = newPosterUrl;

            chrome.storage.local.set({ customPosters: posters }, () => {
                customPosterUrl = newPosterUrl;
                applyMainPoster(newPosterUrl);
                observePopup();
            });
        });
    }
})();
