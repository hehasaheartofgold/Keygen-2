// ==============================
// Responsive canvas (fits browser window)
// ✅ GRID size controlled by SLIDERS: ROWS + COLS (UNDER the canvas)
// ✅ COLS has a minimum (>= 6)
// ✅ Keys array rebuilds when ROWS/COLS change
// ✅ Spacing X uses HEAD width gap only (HEAD_GAP_X)
// ✅ Auto-randomize toggle (default ON)
// ✅ Row width fills canvas (xScale expands/shrinks per row)
// ✅ Flip (head up/down) toggle (checkerboard) (default ON)
// ✅ HEIGHT LOGIC (good version)  <<== YOUR FEELING VERSION
// ✅ head<->shaft GAP + overlap now SCALE with yScale
// ✅ UI panel hide/show button (fixed)
// ✅ Indicators toggle (show/hide all indicator texts)
// ==============================

// ===== GRID DEFAULTS (SLIDERS control these) =====
let saveBtn;
let ROWS = 9;
let COLS = 22;
const MIN_COLS = 6;

let backcolor = 0;

// margins + gaps
const MARGIN_Y = 15;
const MARGIN_X = 15;

const GAP = 5;          // head-to-shaft gap (scales with yScale)
const HEAD_GAP_X = 15;  // headW-to-headW gap
const ROW_GAP_Y = 10;   // row gap

// head slider bounds helpers
let headHmin = 0.7;
let headHmax = 1.3;
let headWmin = 0.7;
let headWmax = 1.3;

// palette
const PALETTE = [
  [0, 122, 255],
  [205, 92, 92],
  [255, 105, 180],
  [255, 69, 0],
  [240, 230, 140],
  [189, 183, 107],
  [147, 112, 219],
  [102, 205, 170],
  [70, 130, 180],
  [119, 136, 153],
  [47, 79, 79],
  [188, 143, 143],
];

// spring
const SPRING = { k: 0.15, damping: 0.75 };

// UI
let controls = {};
let randomAllBtn;
let autoBtn;
let flipBtn;
let indBtn;

let autoOn = true;   // ✅ default ON
let lastAutoMs = 0;

let flipOn = true;   // ✅ default ON
let indicatorsOn = true;

let uiPanel;
let uiHidden = false;

// keys
let keys = [];
let KEY_COUNT = 0;

// GRID sliders (rows/cols)
let rowsSlider, colsSlider;
let lastRows = -1, lastCols = -1;

// indicator DOM spans
let indicatorSpans = {};

// ==============================
// Spring value (no UI)
// ==============================
class SpringValue {
  constructor(value, spring = SPRING) {
    this.value = value;
    this.v = 0;
    this.spring = spring;
    this.target = value;
  }
  setTarget(t) { this.target = t; }
  update() {
    const force = (this.target - this.value) * this.spring.k;
    this.v = (this.v + force) * this.spring.damping;
    this.value += this.v;
  }
  get() { return this.value; }
}

// ==============================
// Slider + Spring (UI)
// ==============================
class SpringSlider {
  constructor({ x, y, min, max, start, step, label = "", spring = SPRING }) {
    this.slider = createSlider(min, max, start, step);
    this.slider.position(x, y);

    this.spring = spring;
    this.value = start;
    this.v = 0;

    this.label = label;
    this.x = x;
    this.y = y;

    this.targetMin = undefined;
    this.targetMax = undefined;
  }

  update() {
    let target = this.slider.value();
    if (this.targetMin !== undefined) target = max(target, this.targetMin);
    if (this.targetMax !== undefined) target = min(target, this.targetMax);

    const force = (target - this.value) * this.spring.k;
    this.v = (this.v + force) * this.spring.damping;
    this.value += this.v;
  }

  get() { return this.value; }
  setUI(v) { this.slider.value(v); }

  drawLabel(extraText = "") {
    // (kept for compatibility; we now show indicators in DOM too)
    push();
    fill(30);
    noStroke();
    textSize(12);
    text(`${this.label}: ${this.get().toFixed(2)} ${extraText}`, this.x + 170, this.y + 12);
    pop();
  }

  setPos(x, y) {
    this.slider.position(x, y);
    this.x = x;
    this.y = y;
  }
}

// ==============================
// Shapes
// ==============================
function drawShaftPentagon(x, topY, shaftW, shaftH, tipH) {
  const half = shaftW / 2;
  const jointY = topY + shaftH;
  const bottomY = jointY + tipH;

  beginShape();
  vertex(x - half, topY);
  vertex(x + half, topY);
  vertex(x + half, jointY);
  vertex(x, bottomY);
  vertex(x - half, jointY);
  endShape(CLOSE);
}

// tooth refs
const TOOTH_BASE_REF = 26;
const TOOTH_OUT_REF = 18;

function drawRightToothAtPivotSlide_Scaled(x, pivotY, shaftW_x, toothBaseY, toothOutX, progress) {
  const half = shaftW_x / 2;
  const bx = x + half;
  const by = pivotY;

  const p = constrain(progress, 0, 1);
  const xOff = lerp(-toothOutX, 0, p);

  const p1x = bx + xOff;
  const p1y = by - toothBaseY;

  const p2x = bx + toothOutX + xOff;
  const p2y = by - toothBaseY * 0.5;

  triangle(bx + xOff, by, p1x, p1y, p2x, p2y);
}

// ==============================
// Key factory + randomize
// ==============================
function makeKey() {
  const baseHeadW = 250 + random(-60, 60);
  const baseHeadH = 250 + random(-60, 60);

  return {
    headW: new SpringValue(baseHeadW),
    headH: new SpringValue(baseHeadH),
    round: new SpringValue(random(0.25, 1.0)),
    shaftW: new SpringValue(100 + random(-20, 20)),
    colorIdx: new SpringValue(floor(random(0, PALETTE.length))),
    toothScale: new SpringValue(random(1.2, 2.3)),
    toothExtra: new SpringValue(random(0, 10)),
  };
}

function randomizeKeyTargets(k) {
  const headW = random(250 * 0.7, 250 * 1.3);
  const headH = random(250 * 0.7, 250 * 1.3);

  k.headW.setTarget(headW);
  k.headH.setTarget(headH);
  k.round.setTarget(random(0.25, 1.0));

  const shaftMin = headW * 0.2;
  const shaftMax = headW * 0.4;
  k.shaftW.setTarget(random(shaftMin, shaftMax));

  k.colorIdx.setTarget(floor(random(0, PALETTE.length)));
  k.toothScale.setTarget(random(1.2, 2.3));
  k.toothExtra.setTarget(random(0, 20));
}

function randomizeAllKeys() {
  for (let i = 0; i < keys.length; i++) randomizeKeyTargets(keys[i]);
  syncUIToSelectedKey();
}

// ==============================
// GRID rebuild when ROWS/COLS change
// ==============================
function rebuildGrid(newRows, newCols) {
  ROWS = max(1, floor(newRows));
  COLS = max(MIN_COLS, floor(newCols));
  KEY_COUNT = ROWS * COLS;

  keys = [];
  for (let i = 0; i < KEY_COUNT; i++) {
    const k = makeKey();
    keys.push(k);
    randomizeKeyTargets(k);
  }

  // update editKey max
  controls.keyIndex.slider.elt.max = KEY_COUNT - 1;
  controls.keyIndex.targetMax = KEY_COUNT - 1;

  // clamp selection
  const cur = floor(controls.keyIndex.slider.value());
  controls.keyIndex.slider.value(constrain(cur, 0, KEY_COUNT - 1));

  syncUIToSelectedKey();
}

// ==============================
// UI <-> selected key
// ==============================
function selectedIndex() {
  return constrain(floor(controls.keyIndex.slider.value()), 0, KEY_COUNT - 1);
}

function applyUIToSelectedKey() {
  const i = selectedIndex();
  const k = keys[i];
  if (!k) return;

  k.headW.setTarget(controls.headW.slider.value());
  k.headH.setTarget(controls.headH.slider.value());
  k.round.setTarget(controls.roundness.slider.value());

  const headWNow = k.headW.target;
  const shaftMin = headWNow * 0.2;
  const shaftMax = headWNow * 0.4;
  const shaftTarget = constrain(controls.shaftW.slider.value(), shaftMin, shaftMax);
  k.shaftW.setTarget(shaftTarget);

  k.colorIdx.setTarget(controls.colorIndex.slider.value());
  k.toothScale.setTarget(controls.toothScale.slider.value());
  k.toothExtra.setTarget(controls.toothExtra.slider.value());
}

function syncUIToSelectedKey() {
  const i = selectedIndex();
  const k = keys[i];
  if (!k) return;

  controls.headW.setUI(k.headW.target);
  controls.headH.setUI(k.headH.target);
  controls.roundness.setUI(k.round.target);

  const shaftMin = k.headW.target * 0.2;
  const shaftMax = k.headW.target * 0.4;
  controls.shaftW.slider.elt.min = shaftMin;
  controls.shaftW.slider.elt.max = shaftMax;
  controls.shaftW.setUI(constrain(k.shaftW.target, shaftMin, shaftMax));

  controls.colorIndex.setUI(constrain(floor(k.colorIdx.target + 0.5), 0, PALETTE.length - 1));
  controls.toothScale.setUI(k.toothScale.target);
  controls.toothExtra.setUI(k.toothExtra.target);
}

// ==============================
// Draw one key inside a ROW CELL
// ✅ YOUR "good version" height logic + gap/overlap scaling
// ✅ teeth clamped: never above shaftTopY
// ==============================
function drawKeyAt(xCenter, cellTopY, cellH, k, xScale, flipY = false) {
  push();

  if (flipY) {
    const cy = cellTopY + cellH / 2;
    translate(0, cy);
    scale(1, -1);
    translate(0, -cy);
  }

  const headW = k.headW.get();
  const headH_raw = k.headH.get();
  const shaftW = k.shaftW.get();

  // X scaled
  const headW_x = headW * xScale;
  const shaftW_x = shaftW * xScale;

  // layout constants
  const overlap = +5;
  const tipH_raw = shaftW * 0.35;

  // row-dependent min shaft length
  const minShaftBody = cellH * 0.15;  // 고정값 제거

  // head gets what's left AFTER reserving (minShaftBody + tip)
  const reserveBase_raw = GAP + overlap;

  let headMax = max(20, cellH - (reserveBase_raw + minShaftBody + tipH_raw));
  let headH = min(headH_raw, headMax);

  // yScale is defined by head shrink (<=1)
  const yScale = headH_raw > 0 ? (headH / headH_raw) : 1;

  // scaled GAP + overlap
  const gapY = GAP * yScale;
  const overlapY = overlap * yScale;

  // compute tip
  let remainForTip = cellH - ((gapY + overlapY) + minShaftBody + headH);
  let tipH = min(tipH_raw * yScale, max(10, remainForTip));

  // positions
  let headY = cellTopY + headH / 2;
  let headBottomY = cellTopY + headH;

  let shaftStartY = headBottomY + gapY;
  let shaftTopY = shaftStartY + overlapY;

  const bottomY = cellTopY + cellH;
  let shaftBodyH = bottomY - tipH - shaftTopY;

  // enforce shaftBody >= minShaftBody (reduce tip first)
  if (shaftBodyH < minShaftBody) {
    const deficit = minShaftBody - shaftBodyH;
    tipH = max(0, tipH - deficit);
    shaftBodyH = bottomY - tipH - shaftTopY;
  }

  // if still too short, shrink head (last resort)
  if (shaftBodyH < minShaftBody) {
    const need = minShaftBody - shaftBodyH;
    const headCanShrink = max(0, headH - 20);
    const shrink = min(headCanShrink, need);
    headH -= shrink;

    headY = cellTopY + headH / 2;
    headBottomY = cellTopY + headH;
    shaftStartY = headBottomY + gapY;
    shaftTopY = shaftStartY + overlapY;
    shaftBodyH = bottomY - tipH - shaftTopY;
  }

  // roundness
  const roundRatio = k.round.get();
  const roundPx = max(0, roundRatio * (min(headW_x, headH) / 2));

  // hole
  const headD = sqrt(max(1, headW * headH_raw));
  const holeY = headY - (headD * 0.15) * yScale;
  const holeR = (headD * 0.2) * yScale;

  // color
  const idxSafe = constrain(floor(k.colorIdx.get() + 0.5), 0, PALETTE.length - 1);
  fill(color(...PALETTE[idxSafe]));

  // head
  rectMode(CENTER);
  rect(xCenter, headY, headW_x, headH, roundPx);

  // shaft + tip
  drawShaftPentagon(xCenter, shaftTopY, shaftW_x, shaftBodyH, tipH);

  // teeth
  const tScale = k.toothScale.get();
  const toothBaseY = (TOOTH_BASE_REF * tScale) * yScale;
  const toothOutX = (TOOTH_OUT_REF * tScale) * xScale;

  const jointY = shaftTopY + shaftBodyH;

  // clamp inside shaft area
  const headLimitY = cellTopY + 1.05 * headH;
  const limitY = max(shaftTopY, headLimitY);

  const EPS = 0.0001;
  const available = max(0, jointY - limitY);
  const maxTeeth = toothBaseY > 0 ? max(0, floor((available + EPS) / toothBaseY)) : 0;
  const maxExtra = max(0, maxTeeth - 1);

  const extraFloat = constrain(k.toothExtra.get(), 0, maxExtra);
  const totalTarget = 1 + extraFloat;
  const drawN = min(maxTeeth, ceil(totalTarget) + 1);

  for (let i = 0; i < drawN; i++) {
    const pivotY = jointY - toothBaseY * i;
    if (pivotY < limitY) break;

    let progress = 1;
    if (i >= 1) {
      progress = constrain(totalTarget - i, 0, 1);
      if (progress <= 0.0001) continue;
    }

    drawRightToothAtPivotSlide_Scaled(
      xCenter, pivotY, shaftW_x, toothBaseY, toothOutX, progress
    );
  }

  // hole
  fill(backcolor);
  circle(xCenter, holeY, holeR);

  pop();
}

// ==============================
// UI positioning helper (UNDER canvas)
// ==============================
function layoutUIUnderCanvas() {
  if (!uiPanel) return;

  // 슬라이더는 좌측에 배치
  const sliderX = 20;
  const uiY = height + 10;

  rowsSlider.position(sliderX, uiY);
  colsSlider.position(sliderX, uiY + 25);

  controls._uiBaseY = uiY;

  const base = uiY + 55;

  controls.keyIndex.setPos(sliderX, base);
  controls.headH.setPos(sliderX, base + 25);
  controls.headW.setPos(sliderX, base + 50);
  controls.roundness.setPos(sliderX, base + 75);
  controls.shaftW.setPos(sliderX, base + 100);
  controls.colorIndex.setPos(sliderX, base + 125);
  controls.toothScale.setPos(sliderX, base + 150);
  controls.toothExtra.setPos(sliderX, base + 175);

  // 버튼은 우측에 배치
  const btnX = width - 220;
  const btnStartY = base;
  randomAllBtn.position(btnX, btnStartY);
  autoBtn.position(btnX, btnStartY + 40);
  flipBtn.position(btnX, btnStartY + 80);
  indBtn.position(btnX, btnStartY + 120);
  saveBtn.position(btnX, btnStartY + 160); // 기존 버튼 간격 맞춰서

  // indicator spans (right side)
  const indX = sliderX + 650;
  let indY = base + 5;
  const line = 18;

  for (const key of Object.keys(indicatorSpans)) {
    indicatorSpans[key].position(indX, indY);
    indY += line;
  }
}

// ==============================
// Indicators toggle
// ==============================
function setIndicatorsVisible(on) {
  indicatorsOn = on;
  for (const k in indicatorSpans) {
    indicatorSpans[k].elt.classList.toggle("hidden", !indicatorsOn);
  }
  indBtn.html(indicatorsOn ? "INDICATORS: ON" : "INDICATORS: OFF");
}

// ==============================
// p5
// ==============================
function setup() {
  createCanvas(windowWidth, windowHeight);

  // ✅ create uiPanel div (CSS handles it)
  uiPanel = createDiv().id("uiPanel");
  uiPanel.addClass("ui-panel");

  // build initial grid
  KEY_COUNT = ROWS * COLS;
  keys = [];
  for (let i = 0; i < KEY_COUNT; i++) {
    const k = makeKey();
    keys.push(k);
    randomizeKeyTargets(k);
  }

  // GRID sliders (under canvas)
  rowsSlider = createSlider(1, 12, ROWS, 1);
  colsSlider = createSlider(MIN_COLS, 24, COLS, 1);
  lastRows = ROWS;
  lastCols = COLS;

  // spring UI
  controls.keyIndex = new SpringSlider({ x: 0, y: 0, min: 0, max: KEY_COUNT - 1, start: 0, step: 1, label: "editKey" });
  controls.headH = new SpringSlider({ x: 0, y: 0, min: 100 * headHmin, max: 250 * headHmax, start: 250, step: 0.001, label: "headH" });
  controls.headW = new SpringSlider({ x: 0, y: 0, min: 100 * headWmin, max: 250 * headWmax, start: 250, step: 0.001, label: "headW" });
  controls.roundness = new SpringSlider({ x: 0, y: 0, min: 0.25, max: 1, start: 1, step: 0.001, label: "roundness" });
  controls.shaftW = new SpringSlider({ x: 0, y: 0, min: 250 * 0.2, max: 250 * 0.4, start: 100, step: 0.001, label: "shaftW" });
  controls.colorIndex = new SpringSlider({ x: 0, y: 0, min: 0, max: PALETTE.length - 1, start: 0, step: 1, label: "colorIndex" });
  controls.toothScale = new SpringSlider({ x: 0, y: 0, min: 1.2, max: 2.3, start: 2.0, step: 0.001, label: "toothScale" });
  controls.toothExtra = new SpringSlider({ x: 0, y: 0, min: 0, max: 20, start: 5, step: 0.001, label: "toothExtra" });

  // buttons
  randomAllBtn = createButton("RANDOMIZE ALL");
  randomAllBtn.mousePressed(randomizeAllKeys);

  autoBtn = createButton(autoOn ? "AUTO RANDOM: ON" : "AUTO RANDOM: OFF");
  autoBtn.mousePressed(() => {
    autoOn = !autoOn;
    autoBtn.html(autoOn ? "AUTO RANDOM: ON" : "AUTO RANDOM: OFF");
    lastAutoMs = millis();
  });

  flipBtn = createButton(flipOn ? "FLIP GRID: ON" : "FLIP GRID: OFF");
  flipBtn.mousePressed(() => {
    flipOn = !flipOn;
    flipBtn.html(flipOn ? "FLIP GRID: ON" : "FLIP GRID: OFF");
  });


saveBtn = createButton("SAVE PNG");
saveBtn.mousePressed(() => {
  const ts =
    `${year()}-${nf(month(),2)}-${nf(day(),2)}_` +
    `${nf(hour(),2)}-${nf(minute(),2)}-${nf(second(),2)}`;
  saveCanvas(`keys_${ts}`, "png");
});


  indBtn = createButton("INDICATORS: ON");
  indBtn.mousePressed(() => setIndicatorsVisible(!indicatorsOn));

  // indicator DOM (names + values)
  indicatorSpans.rows = createSpan("").addClass("ui-ind");
  indicatorSpans.cols = createSpan("").addClass("ui-ind");
  indicatorSpans.editKey = createSpan("").addClass("ui-ind");
  indicatorSpans.headH = createSpan("").addClass("ui-ind");
  indicatorSpans.headW = createSpan("").addClass("ui-ind");
  indicatorSpans.roundness = createSpan("").addClass("ui-ind");
  indicatorSpans.shaftW = createSpan("").addClass("ui-ind");
  indicatorSpans.colorIndex = createSpan("").addClass("ui-ind");
  indicatorSpans.toothScale = createSpan("").addClass("ui-ind");
  indicatorSpans.toothExtra = createSpan("").addClass("ui-ind");

  layoutUIUnderCanvas();
  syncUIToSelectedKey();
  setIndicatorsVisible(true);

  lastAutoMs = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutUIUnderCanvas();
}

function draw() {
  background(backcolor);
  noStroke();

  // detect ROWS/COLS changes and rebuild
  const rNow = rowsSlider.value();
  const cNow = colsSlider.value();

  if (rNow !== lastRows || cNow !== lastCols) {
    lastRows = rNow;
    lastCols = cNow;
    rebuildGrid(rNow, cNow);
  }

  // auto random
  if (autoOn && millis() - lastAutoMs >= 500) {
    randomizeAllKeys();
    lastAutoMs = millis();
  }

  // UI update
  for (const k in controls) {
    if (controls[k] instanceof SpringSlider) controls[k].update();
  }

  if (frameCount % 2 === 0) syncUIToSelectedKey();
  applyUIToSelectedKey();

  // update key springs
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];

    k.headW.update();
    k.headH.update();

    const shaftMin = k.headW.target * 0.2;
    const shaftMax = k.headW.target * 0.4;
    k.shaftW.target = constrain(k.shaftW.target, shaftMin, shaftMax);

    k.round.update();
    k.shaftW.update();
    k.colorIdx.update();
    k.toothScale.update();
    k.toothExtra.update();
  }

  // GRID layout
  const cellH = (height - MARGIN_Y * 2 - ROW_GAP_Y * (ROWS - 1)) / ROWS;

  for (let r = 0; r < ROWS; r++) {
    const cellTopY = MARGIN_Y + r * (cellH + ROW_GAP_Y);
    const start = r * COLS;

    let sumHead = 0;
    let rowHeads = [];
    for (let c = 0; c < COLS; c++) {
      const kk = keys[start + c];
      const hw = kk.headW.get();
      rowHeads.push(hw);
      sumHead += hw;
    }

    const availableW = width - MARGIN_X * 2 - HEAD_GAP_X * (COLS - 1);
    const xScale = sumHead > 0 ? (availableW / sumHead) : 1;

    let xLeft = MARGIN_X;
    for (let c = 0; c < COLS; c++) {
      const drawHeadW = rowHeads[c] * xScale;
      const xCenter = xLeft + drawHeadW / 2;

      const flipY = flipOn ? ((r + c) % 2 === 1) : false;
      drawKeyAt(xCenter, cellTopY, cellH, keys[start + c], xScale, flipY);

      xLeft += drawHeadW + HEAD_GAP_X;
    }
  }

  // update indicators (DOM)
  if (indicatorsOn) {
    indicatorSpans.rows.html(`ROWS: ${ROWS}`);
    indicatorSpans.cols.html(`COLS: ${COLS} (min ${MIN_COLS})`);
    indicatorSpans.editKey.html(`editKey: ${selectedIndex()}`);

    indicatorSpans.headH.html(`headH: ${controls.headH.get().toFixed(2)}`);
    indicatorSpans.headW.html(`headW: ${controls.headW.get().toFixed(2)}`);
    indicatorSpans.roundness.html(`roundness: ${controls.roundness.get().toFixed(2)}`);
    indicatorSpans.shaftW.html(`shaftW: ${controls.shaftW.get().toFixed(2)}`);
    indicatorSpans.colorIndex.html(`colorIndex: ${Math.round(controls.colorIndex.get())}`);
    indicatorSpans.toothScale.html(`toothScale: ${controls.toothScale.get().toFixed(2)}`);
    indicatorSpans.toothExtra.html(`toothExtra: ${controls.toothExtra.get().toFixed(2)}`);
  }
}