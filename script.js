const TASKS = {
    subscribe: { reward: 10, key: "freemoney:starter-credits-claimed" },
    watch: { reward: 5, key: "freemoney:watch-task-claimed" },
    "watch-second": { reward: 5, key: "freemoney:task:watch-second:claimed" },
    "watch-short": { reward: 3, key: "freemoney:task:watch-short:claimed" },
    playlists: { reward: 2, key: "freemoney:task:playlists:claimed" },
    uploads: { reward: 2, key: "freemoney:task:uploads:claimed" },
    community: { reward: 2, key: "freemoney:task:community:claimed" },
    checkin: { reward: 2, key: "freemoney:daily-checkin-date", daily: true },
    "survey-topic": { reward: 4, key: "freemoney:task:survey-topic:answer", survey: true },
    "survey-format": { reward: 4, key: "freemoney:task:survey-format:answer", survey: true },
    "survey-site": { reward: 4, key: "freemoney:task:survey-site:answer", survey: true }
};

const claimStatus = document.querySelector("#claim-status");
const creditBalance = document.querySelector("#credit-balance");
const tasksTotal = document.querySelector("#tasks-total");
const taskCards = [...document.querySelectorAll(".task-card")];
const claimButtons = [...document.querySelectorAll("[data-claim]")];
const completed = Object.fromEntries(Object.keys(TASKS).map((task) => [task, false]));
const surveyAnswers = {};
const visitedTasks = new Set();

let storageUnavailable = false;

function todayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isStoredComplete(task, value) {
    if (TASKS[task].daily) {
        return value === todayKey();
    }

    return TASKS[task].survey ? value !== null : value === "true";
}

function readProgress() {
    for (const [task, details] of Object.entries(TASKS)) {
        const value = localStorage.getItem(details.key);
        completed[task] = isStoredComplete(task, value);

        if (details.survey && completed[task]) {
            surveyAnswers[task] = value;
        } else if (details.survey) {
            delete surveyAnswers[task];
        }
    }
}

function renderProgress() {
    const claimedCount = Object.values(completed).filter(Boolean).length;
    const totalCredits = Object.entries(TASKS).reduce(
        (total, [task, details]) => total + (completed[task] ? details.reward : 0),
        0
    );

    creditBalance.textContent = `${totalCredits} credits`;
    tasksTotal.textContent = `${claimedCount} / ${taskCards.length} done`;

    for (const card of taskCards) {
        const task = card.dataset.task;
        const isComplete = completed[task];
        card.dataset.complete = String(isComplete);

        const button = card.querySelector("[data-claim]");
        const hasVisitLink = card.querySelector("[data-visit-task]") !== null;
        button.disabled = storageUnavailable || isComplete ||
            (hasVisitLink && !visitedTasks.has(task));
        button.textContent = isComplete
            ? (TASKS[task].daily ? "Claimed today" : TASKS[task].survey ? "Submitted" : "Claimed")
            : (TASKS[task].survey ? "Submit" : "Claim");

        if (TASKS[task].survey) {
            for (const input of card.querySelectorAll('input[type="radio"]')) {
                input.checked = input.value === surveyAnswers[task];
                input.disabled = storageUnavailable || isComplete;
            }
        }
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

function claimTask(task, answer) {
    if (storageUnavailable || completed[task]) {
        return;
    }

    const card = document.querySelector(`[data-task="${task}"]`);
    if (card.querySelector("[data-visit-task]") && !visitedTasks.has(task)) {
        return;
    }

    try {
        const existingValue = localStorage.getItem(TASKS[task].key);

        if (isStoredComplete(task, existingValue)) {
            completed[task] = true;
            if (TASKS[task].survey) {
                surveyAnswers[task] = existingValue;
            }
            renderProgress();
            return;
        }

        const value = TASKS[task].daily
            ? todayKey()
            : TASKS[task].survey
                ? answer
                : "true";
        localStorage.setItem(TASKS[task].key, value);
        completed[task] = true;

        if (TASKS[task].survey) {
            surveyAnswers[task] = answer;
        }

        const label = card.querySelector("h3").textContent;
        claimStatus.textContent = `${label} complete — ${TASKS[task].reward} credits added.`;
        claimStatus.dataset.state = "claimed";
        renderProgress();
    } catch {
        showStorageError();
    }
}

for (const link of document.querySelectorAll("[data-visit-task]")) {
    link.addEventListener("click", () => {
        const task = link.dataset.visitTask;
        visitedTasks.add(task);
        const label = document.querySelector(`[data-task="${task}"] h3`).textContent;
        claimStatus.textContent = `Opened the channel for "${label}". Complete it, then return to claim.`;
        claimStatus.dataset.state = "";
        renderProgress();
    });
}

for (const button of claimButtons) {
    button.addEventListener("click", () => {
        if (button.closest(".survey-form")) {
            return;
        }

        claimTask(button.dataset.claim);
    });
}

for (const form of document.querySelectorAll(".survey-form")) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const answer = form.querySelector('input[type="radio"]:checked');

        if (!answer) {
            form.reportValidity();
            return;
        }

        claimTask(form.dataset.survey, answer.value);
    });
}

window.addEventListener("storage", (event) => {
    if (Object.values(TASKS).some((task) => task.key === event.key)) {
        syncProgress();
    }
});

syncProgress();
