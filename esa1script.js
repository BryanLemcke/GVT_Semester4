// CD-ANIMATION
const images = [
  "images/cd_0.png", "images/cd_1.png", "images/cd_2.png", "images/cd_3.png",
  "images/cd_4.png", "images/cd_5.png", "images/cd_6.png", "images/cd_7.png",
  "images/cd_8.png", "images/cd_9.png", "images/cd_10.png", "images/cd_11.png"
];

const cd = document.getElementById("cd");
let index = 0;
let autoRotate = false;
let timer = null;

function updateImage() {
  cd.src = images[index];
}

function nextFrame(step = 1) {
  index = (index + step + images.length) % images.length;
  updateImage();
}

document.getElementById("left").addEventListener("click", () => nextFrame(-1));
document.getElementById("right").addEventListener("click", () => nextFrame(1));
document.getElementById("auto").addEventListener("click", toggleAuto);

document.addEventListener("keydown", (e) => {
  if (e.key === "l") nextFrame(-1);
  if (e.key === "r") nextFrame(1);
  if (e.key === "a") toggleAuto();
});

function toggleAuto() {
  autoRotate = !autoRotate;
  if (autoRotate) {
    timer = setInterval(() => nextFrame(1), 300);
    document.getElementById("auto").textContent = " Stop (a)";
  } else {
    clearInterval(timer);
    document.getElementById("auto").textContent = " Auto (a)";
  }
}

// BONUS-ANIMATION
const charImages = Array.from({ length: 12 }, (_, i) => `images/bonus_${i + 1}.png`);

const charImg = document.getElementById("char");
const charManual = document.getElementById("charManual");

let manualIndex = 0;
let manualTimer = null;
let manualAuto = false;

let charState = "awake";
let charTimer = null;
let variationActive = false;


function updateManualImage() {
  charManual.src = charImages[manualIndex];
}

function manualNext(step = 1) {
  stopManualAuto();
  manualIndex = (manualIndex + step + charImages.length) % charImages.length;
  updateManualImage();
}

function toggleManualAuto() {
  manualAuto = !manualAuto;
  if (manualAuto) {
    stopVariation();
    manualTimer = setInterval(() => {
      manualIndex = (manualIndex + 1) % charImages.length;
      updateManualImage();
    }, 300);
  } else {
    stopManualAuto();
  }
}

function stopManualAuto() {
  clearInterval(manualTimer);
  manualAuto = false;
}

function toggleVariation() {
  variationActive = !variationActive;
  if (variationActive) {
    stopManualAuto();
    animateChar();
  } else {
    stopVariation();
  }
}

function stopVariation() {
  clearInterval(charTimer);
  variationActive = false;
}

function animateChar() {
  if (!variationActive) return;
  clearInterval(charTimer);
  switch (charState) {
    case "awake": playAwake(); break;
    case "falling": playFallingAsleep(); break;
    case "asleep": playAsleep(); break;
    case "waking": playWaking(); break;
  }
}

// ---------- WACH ----------
function playAwake() {
  clearInterval(charTimer);
  let current = 0;
  const awakeFrames = [1, 2];
  charTimer = setInterval(() => {
    if (!variationActive) return clearInterval(charTimer);
    charImg.src = charImages[awakeFrames[current % 2] - 1];
    current++;
  }, 300);

  setTimeout(() => {
    if (!variationActive) return;
    clearInterval(charTimer);
    if (Math.random() < 0.75) charState = "falling";
    animateChar();
  }, 1000 + Math.random() * 2000);
}

// ---------- EINSCHLAFEN ----------
function playFallingAsleep() {
  clearInterval(charTimer);
  const shortSeq = [1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 3, 4, 1, 2];
  const longSeq = [1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 8, 9, 10];
  const useSleep = Math.random() < 0.65;
  const seq = useSleep ? longSeq : shortSeq;

  let i = 0;
  function nextStep() {
    if (!variationActive) return;
    if (i >= seq.length) {
      charState = useSleep ? "asleep" : "awake";
      animateChar();
      return;
    }
    charImg.src = charImages[seq[i] - 1];
    i++;
    setTimeout(nextStep, 300);
  }
  nextStep();
}

// ---------- SCHLAFEN ----------
function playAsleep() {
  clearInterval(charTimer);
  const asleepPattern = [9, 10, 9, 10, 11, 12, 11, 12];
  let i = 0;
  charTimer = setInterval(() => {
    if (!variationActive) return clearInterval(charTimer);
    charImg.src = charImages[asleepPattern[i % asleepPattern.length] - 1];
    i++;
  }, 300);

  setTimeout(() => {
    if (!variationActive) return;
    clearInterval(charTimer);
    charState = "waking";
    animateChar();
  }, 10000);
}

// ---------- AUFWACHEN ----------
function playWaking() {
  clearInterval(charTimer);
  const seq = [5, 6, 1, 2];
  let i = 0;
  function nextStep() {
    if (!variationActive) return;
    if (i >= seq.length) {
      charState = "awake";
      animateChar();
      return;
    }
    charImg.src = charImages[seq[i] - 1];
    i++;
    setTimeout(nextStep, 300);
  }
  nextStep();
}

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "b": manualNext(-1); break;
    case "f": manualNext(1); break;
    case "p": toggleManualAuto(); break;
    case "v": toggleVariation(); break;
  }
});

document.getElementById("prevFrame").addEventListener("click", () => manualNext(-1));
document.getElementById("nextFrame").addEventListener("click", () => manualNext(1));
document.getElementById("playAllOnce").addEventListener("click", toggleManualAuto);
document.getElementById("playVariation").addEventListener("click", toggleVariation);
