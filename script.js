const CLAIM_KEY = "freemoney:starter-credits-claimed";
const subscribeLink = document.querySelector("#subscribe-link");
const claimButton = document.querySelector("#claim-button");
const claimStatus = document.querySelector("#claim-status");
const creditBalance = document.querySelector("#credit-balance");
let hasOpenedSubscribePage = false;
let isClaimed = false;
let storageUnavailable = false;

function showClaimed() {
    isClaimed = true;
    claimButton.disabled = true;
    claimButton.textContent = "Bonus already claimed";
    claimStatus.textContent = "Your one-time 10-credit bonus has already been claimed in this browser.";
    claimStatus.dataset.state = "claimed";
    creditBalance.textContent = "10 credits";
}

function showStorageError() {
    storageUnavailable = true;
    claimButton.disabled = true;
    claimStatus.textContent = "Claims are unavailable because this browser could not access local storage.";
    claimStatus.dataset.state = "error";
}

try {
    if (localStorage.getItem(CLAIM_KEY) === "true") {
        showClaimed();
    }
} catch {
    showStorageError();
}

subscribeLink.addEventListener("click", () => {
    hasOpenedSubscribePage = true;

    if (!isClaimed && !storageUnavailable) {
        claimButton.disabled = false;
        claimStatus.textContent = "YouTube opened in another tab. Subscribe, then return here to claim.";
    }
});

claimButton.addEventListener("click", () => {
    if (!hasOpenedSubscribePage || isClaimed || storageUnavailable) {
        return;
    }

    try {
        if (localStorage.getItem(CLAIM_KEY) === "true") {
            showClaimed();
            return;
        }

        localStorage.setItem(CLAIM_KEY, "true");
        showClaimed();
    } catch {
        showStorageError();
    }
});

window.addEventListener("storage", (event) => {
    if (event.key === CLAIM_KEY && event.newValue === "true") {
        showClaimed();
    }
});