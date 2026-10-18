const TASKS = {
    subscribe: { reward: 10, key: "freemoney:starter-credits-claimed" },
    watch: { reward: 5, key: "freemoney:watch-task-claimed" },
    "watch-second": { reward: 5, key: "freemoney:task:watch-second:claimed" },
    "watch-short": { reward: 3, key: "freemoney:task:watch-short:claimed" },
    playlists: { reward: 2, key: "freemoney:task:playlists:claimed" },
    uploads: { reward: 2, key: "freemoney:task:uploads:claimed" },
    community: { reward: 2, key: "freemoney:task:community:claimed" },
    checkin: { reward: 2, key: "freemoney:daily-checkin:v1", daily: true },
    "survey-topic": { reward: 4, key: "freemoney:task:survey-topic:answer", survey: true },
    "survey-format": { reward: 4, key: "freemoney:task:survey-format:answer", survey: true },
    "survey-site": { reward: 4, key: "freemoney:task:survey-site:answer", survey: true }
};

const EXCHANGE_KEY = "freemoney:exchange:v1";
const LEGACY_CHECKIN_KEY = "freemoney:daily-checkin-date";
const CREDITS_PER_DOLLAR = 100;
const claimStatus = document.querySelector("#claim-status");
const creditBalance = document.querySelector("#credit-balance");
const tasksTotal = document.querySelector("#tasks-total");
const exchangeAvailable = document.querySelector("#exchange-available");
const cashBalance = document.querySelector("#cash-balance");
const exchangeForm = document.querySelector("#exchange-form");
const exchangeDollars = document.querySelector("#exchange-dollars");
const exchangePreview = document.querySelector("#exchange-preview");
const exchangeButton = exchangeForm.querySelector("button");
const exchangeStatus = document.querySelector("#exchange-status");
const taskCards = [...document.querySelectorAll(".task-card")];
const claimButtons = [...document.querySelectorAll("[data-claim]")];
const completed = Object.fromEntries(Object.keys(TASKS).map((task) => [task, false]));
const surveyAnswers = {};
const visitedTasks = new Set();

let storageUnavailable = false;
let exchangedCredits = 0;
let cashCents = 0;
let dailyCheckinCount = 0;

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
        if (details.daily) {
            continue;
        }

        const value = localStorage.getItem(details.key);
        completed[task] = isStoredComplete(task, value);

        if (details.survey && completed[task]) {
            surveyAnswers[task] = value;
        } else if (details.survey) {
            delete surveyAnswers[task];
        }
    }

    const checkin = readCheckinState();
    dailyCheckinCount = checkin.count;
    completed.checkin = checkin.lastClaimDate === todayKey();
}

function readCheckinState() {
    let storedCheckin = localStorage.getItem(TASKS.checkin.key);

    if (storedCheckin === null) {
        const legacyDate = localStorage.getItem(LEGACY_CHECKIN_KEY);
        if (legacyDate === null) {
            return { lastClaimDate: "", count: 0 };
        }

        storedCheckin = JSON.stringify({ lastClaimDate: legacyDate, count: 1 });
        localStorage.setItem(TASKS.checkin.key, storedCheckin);
    }

    const checkin = JSON.parse(storedCheckin);
    if (typeof checkin.lastClaimDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(checkin.lastClaimDate) ||
        !Number.isSafeInteger(checkin.count) ||
        checkin.count < 1) {
        throw new Error("Saved daily check-in progress is invalid.");
    }

    return checkin;
}

function readExchange() {
    const storedExchange = localStorage.getItem(EXCHANGE_KEY);

    if (storedExchange === null) {
        exchangedCredits = 0;
        cashCents = 0;
        return;
    }

    const exchange = JSON.parse(storedExchange);
    if (!Number.isSafeInteger(exchange.creditsExchanged) ||
        !Number.isSafeInteger(exchange.cashCents) ||
        exchange.creditsExchanged < 0 ||
        exchange.cashCents < 0 ||
        exchange.creditsExchanged % CREDITS_PER_DOLLAR !== 0 ||
        exchange.cashCents !== exchange.creditsExchanged) {
        throw new Error("Saved exchange balance is invalid.");
    }

    exchangedCredits = exchange.creditsExchanged;
    cashCents = exchange.cashCents;

    if (exchangedCredits > earnedCredits()) {
        throw new Error("Exchanged credits exceed the saved task rewards.");
    }
}

function earnedCredits() {
    const oneTimeCredits = Object.entries(TASKS).reduce(
        (total, [task, details]) =>
            total + (!details.daily && completed[task] ? details.reward : 0),
        0
    );

    return oneTimeCredits + dailyCheckinCount * TASKS.checkin.reward;
}

function renderProgress() {
    const claimedCount = Object.values(completed).filter(Boolean).length;
    const available = earnedCredits() - exchangedCredits;

    creditBalance.textContent = `${available} credits`;
    tasksTotal.textContent = `${claimedCount} / ${taskCards.length} done`;
    exchangeAvailable.textContent = `${available} credits`;
    cashBalance.textContent = `$${(cashCents / 100).toFixed(2)}`;
    updateExchangeForm(available);

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

function updateExchangeForm(available) {
    const dollars = Number(exchangeDollars.value);
    const amountIsValid = Number.isSafeInteger(dollars) && dollars >= 1;
    const creditsRequired = amountIsValid ? dollars * CREDITS_PER_DOLLAR : 0;
    const hasEnoughCredits = amountIsValid &&
        Number.isSafeInteger(creditsRequired) &&
        creditsRequired <= available;

    exchangePreview.textContent = amountIsValid
        ? `Uses ${creditsRequired} credits`
        : "Enter a whole dollar amount";
    exchangeButton.disabled = storageUnavailable || !hasEnoughCredits;
}

function showStorageError() {
    storageUnavailable = true;
    claimStatus.textContent = "Tasks are unavailable because this browser could not save your progress.";
    claimStatus.dataset.state = "error";
    exchangeStatus.textContent = "Exchange is unavailable because this browser could not save your balances.";
    exchangeStatus.dataset.state = "error";
    renderProgress();
}

function syncProgress() {
    try {
        readProgress();
        readExchange();
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
        if (TASKS[task].daily) {
            const checkin = readCheckinState();

            if (checkin.lastClaimDate === todayKey()) {
                completed.checkin = true;
                renderProgress();
                return;
            }

            if (!Number.isSafeInteger(checkin.count + 1)) {
                throw new Error("Daily check-in count is too large.");
            }

            const nextCheckin = {
                lastClaimDate: todayKey(),
                count: checkin.count + 1
            };
            localStorage.setItem(TASKS.checkin.key, JSON.stringify(nextCheckin));
            dailyCheckinCount = nextCheckin.count;
            completed.checkin = true;
            claimStatus.textContent = `Daily check-in complete — ${TASKS.checkin.reward} credits added.`;
            claimStatus.dataset.state = "claimed";
            renderProgress();
            return;
        }

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

exchangeDollars.addEventListener("input", () => {
    updateExchangeForm(earnedCredits() - exchangedCredits);
});

exchangeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const dollars = Number(exchangeDollars.value);
    if (!Number.isSafeInteger(dollars) ||
        dollars < 1 ||
        !Number.isSafeInteger(dollars * CREDITS_PER_DOLLAR)) {
        exchangeDollars.reportValidity();
        return;
    }

    try {
        readProgress();
        readExchange();
        const requiredCredits = dollars * CREDITS_PER_DOLLAR;
        const available = earnedCredits() - exchangedCredits;

        if (requiredCredits > available) {
            exchangeStatus.textContent = `You need ${requiredCredits} credits, but only have ${available} available.`;
            exchangeStatus.dataset.state = "error";
            renderProgress();
            return;
        }

        const nextExchangedCredits = exchangedCredits + requiredCredits;
        const nextCashCents = cashCents + requiredCredits;
        localStorage.setItem(EXCHANGE_KEY, JSON.stringify({
            creditsExchanged: nextExchangedCredits,
            cashCents: nextCashCents
        }));
        exchangedCredits = nextExchangedCredits;
        cashCents = nextCashCents;
        exchangeStatus.textContent = `Exchanged ${requiredCredits} credits for $${dollars.toFixed(2)} in-app balance.`;
        exchangeStatus.dataset.state = "success";
        renderProgress();
    } catch {
        showStorageError();
    }
});

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
    if (event.key === EXCHANGE_KEY || Object.values(TASKS).some((task) => task.key === event.key)) {
        syncProgress();
    }
});

syncProgress();
