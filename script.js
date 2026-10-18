const STORAGE_KEYS = {
    subscribe: "freemoney:starter-credits-claimed",
    watch: "freemoney:watch-task-claimed",
    checkin: "freemoney:daily-checkin-date"
};

const REWARDS = {
    subscribe: 10,
    watch: 5,
    checkin: 2
};

const claimStatus = document.querySelector("#claim-status");
const creditBalance = document.querySelector("#credit-balance");
const tasksTotal = document.querySelector("#tasks-total");
const taskCards = [...document.querySelectorAll(".task-card")];
const claimButtons = [...document.querySelectorAll("[data-claim]")];
const completed = {
    subscribe: false,
    watch: false,
    checkin: false
};

let hasOpenedSubscribePage = false;
let hasOpenedWatchPage = false;
let storageUnavailable = false;

function todayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function readProgress() {
    completed.subscribe = localStorage.getItem(STORAGE_KEYS.subscribe) === "true";
    completed.watch = localStorage.getItem(STORAGE_KEYS.watch) === "true";
    completed.checkin = localStorage.getItem(STORAGE_KEYS.checkin) === todayKey();
}

function renderProgress() {
    const claimedCount = Object.values(completed).filter(Boolean).length;
    const totalCredits =
        (completed.subscribe ? REWARDS.subscribe : 0) +
        (completed.watch ? REWARDS.watch : 0) +
        (completed.checkin ? REWARDS.checkin : 0);

    creditBalance.textContent = `${totalCredits} credits`;
    tasksTotal.textContent = `${claimedCount} / 3 done`;

    for (const card of taskCards) {
        const task = card.dataset.task;
        const isComplete = completed[task];
        card.dataset.complete = String(isComplete);

        const button = card.querySelector("[data-claim]");
        button.disabled = storageUnavailable || isComplete ||
            (task === "subscribe" && !hasOpenedSubscribePage) ||
            (task === "watch" && !hasOpenedWatchPage);
        button.textContent = isComplete
            ? (task === "checkin" ? "Claimed today" : "Claimed")
            : "Claim";
    }
}

function showStorageError() {
    storageUnavailable = true;
    claimStatus.textContent = "Tasks are unavailable because this browser could not save your progress.";
    claimStatus.dataset.state = "error";
    renderProgress();
}

function syncProgress() {
    try {
        readProgress();
        renderProgress();
    } catch {
        showStorageError();
    }
}

document.querySelector("#subscribe-link").addEventListener("click", () => {
    hasOpenedSubscribePage = true;
    claimStatus.textContent = "YouTube opened in another tab. Subscribe, then return to claim your credits.";
    claimStatus.dataset.state = "";
    renderProgress();
});

document.querySelector("#watch-link").addEventListener("click", () => {
    hasOpenedWatchPage = true;
    claimStatus.textContent = "YouTube opened in another tab. Watch a video, then return to claim your credits.";
    claimStatus.dataset.state = "";
    renderProgress();
});

for (const button of claimButtons) {
    button.addEventListener("click", () => {
        const task = button.dataset.claim;

        if (storageUnavailable || completed[task]) {
            return;
        }

        if ((task === "subscribe" && !hasOpenedSubscribePage) ||
            (task === "watch" && !hasOpenedWatchPage)) {
            return;
        }

        try {
            const existingValue = localStorage.getItem(STORAGE_KEYS[task]);

            if (task === "checkin" && existingValue === todayKey()) {
                completed.checkin = true;
                renderProgress();
                return;
            }

            if (task !== "checkin" && existingValue === "true") {
                completed[task] = true;
                renderProgress();
                return;
            }

            localStorage.setItem(
                STORAGE_KEYS[task],
                task === "checkin" ? todayKey() : "true"
            );
            completed[task] = true;
            claimStatus.textContent = `Task complete — ${REWARDS[task]} credits added.`;
            claimStatus.dataset.state = "claimed";
            renderProgress();
        } catch {
            showStorageError();
        }
    });
}

window.addEventListener("storage", (event) => {
    if (Object.values(STORAGE_KEYS).includes(event.key)) {
        syncProgress();
    }
});

syncProgress();
