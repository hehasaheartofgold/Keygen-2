// ==============================
// Original Mechanism PRESERVED
// ✅ Browser Full-fit Layout Fixed
// ✅ Mechanism & Math 100% Original
// ==============================

let ROWS = 9;
let COLS = 22;
const MIN_COLS = 6;
let backcolor = 0;

const MARGIN_Y = 15;
const MARGIN_X = 15;
const GAP = 5;          
const HEAD_GAP_X = 15;  
const ROW_GAP_Y = 10;   

let headHmin = 0.7, headHmax = 1.3;
let headWmin = 0.7, headWmax = 1.3;

const PALETTE = [
  [0, 122, 255], [205, 92, 92], [255, 105, 180], [255, 69, 0],
  [240, 230, 140], [189, 183, 107], [147, 112, 219], [102, 205, 170],
  [70, 130, 180], [119, 136, 153], [47, 79, 79], [188, 143, 143],
];

const SPRING = { k: 0.15, damping: 0.75 };

let controls = {};
let randomAllBtn, autoBtn, flipBtn, saveBtn;
let autoOn = true;
let lastAutoMs = 0;
let flipOn = true;

let selectedIdx = -1; 
let zoomProg = 0;     

let keys = [];
let KEY_COUNT = 0;
let rowsSlider, colsSlider;
let lastRows = -1, lastCols = -1;

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

class SpringSlider {
  constructor({ min, max, start, step, label }) {
    this.wrapper = createDiv().addClass("p5Slider");
    this.slider = createSlider(min, max, start, step).parent(this.wrapper);
    this.value = start;
    this.v = 0;
    this.label = label;
  }
  update() {
    let target = this.slider.value();
    const force = (target - this.value) * SPRING.k;
    this.v = (this.v + force) * SPRING.damping;
    this.value += this.v;
  }
  get() { return this.value; }
  setUI(v) { this.slider.value(v); }
}

function makeKey() {
  return {
    headW: new SpringValue(250 + random(-60, 60)),
    headH: new SpringValue(250 + random(-60, 60)),
    round: new SpringValue(random(0.25, 1.0)),
    shaftW: new SpringValue(100 + random(-20, 20)),
    colorIdx: new SpringValue(floor(random(0, PALETTE.length))),
    toothScale: new SpringValue(random(1.2, 2.3)),
    toothExtra: new SpringValue(random(0, 10)),
    lastCX: 0, lastTY: 0, lastCH: 0, lastXS: 0
  };
}

function randomizeKeyTargets(k) {
  const headW = random(250 * 0.7, 250 * 1.3);
  k.headW.setTarget(headW);
  k.headH.setTarget(random(250 * 0.7, 250 * 1.3));
  k.round.setTarget(random(0.25, 1.0));
  k.shaftW.setTarget(random(headW * 0.2, headW * 0.4));
  k.colorIdx.setTarget(floor(random(0, PALETTE.length)));
  k.toothScale.setTarget(random(1.2, 2.3));
  k.toothExtra.setTarget(random(0, 20));
}

function rebuildGrid(nr, nc) {
  ROWS = max(1, floor(nr));
  COLS = max(MIN_COLS, floor(nc));
  KEY_COUNT = ROWS * COLS;
  keys = Array.from({ length: KEY_COUNT }, makeKey);
  keys.forEach(k => randomizeKeyTargets(k));
  selectedIdx = -1;
}

function syncUIToKey(idx) {
  const k = keys[idx];
  if (!k) return;
  controls.headH.setUI(k.headH.target);
  controls.headW.setUI(k.headW.target);
  controls.roundness.setUI(k.round.target);
  controls.shaftW.setUI(k.shaftW.target);
  controls.colorIndex.setUI(k.colorIdx.target);
  controls.toothScale.setUI(k.toothScale.target);
  controls.toothExtra.setUI(k.toothExtra.target);
}

function applyUIToSelected() {
  if (selectedIdx === -1) return;
  const k = keys[selectedIdx];
  k.headH.setTarget(controls.headH.slider.value());
  k.headW.setTarget(controls.headW.slider.value());
  k.round.setTarget(controls.roundness.slider.value());
  k.shaftW.setTarget(controls.shaftW.slider.value());
  k.colorIdx.setTarget(controls.colorIndex.slider.value());
  k.toothScale.setTarget(controls.toothScale.slider.value());
  k.toothExtra.setTarget(controls.toothExtra.slider.value());
}

function drawKeyAt(xCenter, cellTopY, cellH, k, xScale, flipY, isSelected) {
  push();
  let drawX = xCenter, drawY = cellTopY, drawH = cellH, drawXS = xScale;

  if (isSelected) {
    let targetMag = (height * 0.5) / cellH; 
    let targetX = width / 2;
    let targetY = (height * 0.45) - (cellH * targetMag) / 2; // 중앙 강조 위치 최적화
    drawX = lerp(xCenter, targetX, zoomProg);
    drawY = lerp(cellTopY, targetY, zoomProg);
    drawH = lerp(cellH, cellH * targetMag, zoomProg);
    drawXS = lerp(xScale, xScale * targetMag, zoomProg);
  }

  if (flipY && !isSelected) {
    translate(0, drawY + drawH / 2);
    scale(1, -1);
    translate(0, -(drawY + drawH / 2));
  }

  const headW = k.headW.get(), headH_raw = k.headH.get(), shaftW = k.shaftW.get();
  const headW_x = headW * drawXS, shaftW_x = shaftW * drawXS;
  const overlap = 5;
  const tipH_raw = shaftW * 0.35;
  const minShaftBody = drawH * 0.15;
  const reserveBase_raw = GAP + overlap;
  let headMax = max(20, drawH - (reserveBase_raw + minShaftBody + tipH_raw));
  let headH = min(headH_raw, headMax);
  const yScale = headH_raw > 0 ? (headH / headH_raw) : 1;
  const gapY = GAP * yScale, overlapY = overlap * yScale;
  let tipH = min(tipH_raw * yScale, max(10, drawH - (gapY + overlapY + minShaftBody + headH)));
  let headY = drawY + headH / 2;
  let shaftTopY = drawY + headH + gapY + overlapY;
  let shaftBodyH = (drawY + drawH) - tipH - shaftTopY;

  fill(PALETTE[constrain(floor(k.colorIdx.get() + 0.5), 0, PALETTE.length - 1)]);
  noStroke();
  const rd = k.round.get() * (min(headW_x, headH) / 2);
  rectMode(CENTER);
  rect(drawX, headY, headW_x, headH, rd);
  const half = shaftW_x / 2;
  beginShape();
  vertex(drawX - half, shaftTopY);
  vertex(drawX + half, shaftTopY);
  vertex(drawX + half, shaftTopY + shaftBodyH);
  vertex(drawX, shaftTopY + shaftBodyH + tipH);
  vertex(drawX - half, shaftTopY + shaftBodyH);
  endShape(CLOSE);
  const tScale = k.toothScale.get();
  const tBaseY = (26 * tScale) * yScale, tOutX = (18 * tScale) * drawXS;
  const jointY = shaftTopY + shaftBodyH;
  const maxPossibleTeeth = floor(shaftBodyH / tBaseY);
  const requestedTeeth = floor(k.toothExtra.get()) + 1;
  const numTeeth = min(requestedTeeth, maxPossibleTeeth);
  for (let i = 0; i < numTeeth; i++) {
    const py = jointY - tBaseY * i;
    if (py - tBaseY < shaftTopY) break; 
    triangle(drawX + half, py, drawX + half, py - tBaseY, drawX + half + tOutX, py - tBaseY * 0.5);
  }
  fill(backcolor);
  circle(drawX, headY - (sqrt(max(1, headW * headH_raw)) * 0.15) * yScale, (sqrt(max(1, headW * headH_raw)) * 0.2) * yScale);
  pop();
}

// function mousePressed() {
//   if (mouseY > height - 100) return; // 클릭 방지 영역 축소 (브라우저 전체 활용)
//   if (selectedIdx !== -1) { selectedIdx = -1; return; }
//   for (let i = 0; i < keys.length; i++) {
//     let k = keys[i];
//     if (dist(mouseX, mouseY, k.lastCX, k.lastTY + k.lastCH/2) < 35) {
//       selectedIdx = i; syncUIToKey(i); return;
//     }
//   }
// }

function setup() {
  createCanvas(windowWidth, windowHeight);
  let rsWrap = createDiv().addClass("p5Slider");
  rowsSlider = createSlider(1, 12, ROWS, 1).parent(rsWrap);
  let csWrap = createDiv().addClass("p5Slider");
  colsSlider = createSlider(MIN_COLS, 24, COLS, 1).parent(csWrap);

  controls.headH = new SpringSlider({ min: 100 * headHmin, max: 250 * headHmax, start: 250, step: 0.001, label: "headH" });
  controls.headW = new SpringSlider({ min: 100 * headWmin, max: 250 * headWmax, start: 250, step: 0.001, label: "headW" });
  controls.roundness = new SpringSlider({ min: 0.25, max: 1, start: 1, step: 0.001, label: "roundness" });
  controls.shaftW = new SpringSlider({ min: 40, max: 150, start: 100, step: 0.001, label: "shaftW" });
  controls.colorIndex = new SpringSlider({ min: 0, max: PALETTE.length - 1, start: 0, step: 1, label: "colorIndex" });
  controls.toothScale = new SpringSlider({ min: 1.2, max: 2.3, start: 2.0, step: 0.001, label: "toothScale" });
  controls.toothExtra = new SpringSlider({ min: 0, max: 20, start: 5, step: 0.001, label: "toothExtra" });

  randomAllBtn = createDiv().addClass("p5Button").child(createButton("RANDOMIZE ALL").mousePressed(() => keys.forEach(randomizeKeyTargets)));
  autoBtn = createDiv().addClass("p5Button").child(createButton("AUTO RANDOM: ON").mousePressed(() => {
    autoOn = !autoOn; autoBtn.child()[0].html(autoOn ? "AUTO RANDOM: ON" : "AUTO RANDOM: OFF");
  }));
  flipBtn = createDiv().addClass("p5Button").child(createButton("FLIP GRID: ON").mousePressed(() => {
    flipOn = !flipOn; flipBtn.child()[0].html(flipOn ? "FLIP GRID: ON" : "FLIP GRID: OFF");
  }));
  saveBtn = createDiv().addClass("p5Button").child(createButton("SAVE PNG").mousePressed(() => saveCanvas('keys', 'png')));

  rebuildGrid(ROWS, COLS);
}

function draw() {
  background(backcolor);
  zoomProg = lerp(zoomProg, selectedIdx !== -1 ? 1 : 0, 0.15);

  if (rowsSlider.value() !== lastRows || colsSlider.value() !== lastCols) {
    lastRows = rowsSlider.value(); lastCols = colsSlider.value();
    rebuildGrid(lastRows, lastCols);
  }

  if (autoOn && millis() - lastAutoMs >= 500) {
    keys.forEach(randomizeKeyTargets); lastAutoMs = millis();
  }

  Object.values(controls).forEach(c => c.update());
  applyUIToSelected();
  keys.forEach(k => {
    k.headW.update(); k.headH.update(); k.round.update(); k.shaftW.update();
    k.colorIdx.update(); k.toothScale.update(); k.toothExtra.update();
  });

  // ✅ cellH 계산에서 하단 여백 최적화 (브라우저 가득 채우기)
  const cellH = (height - MARGIN_Y * 2 - ROW_GAP_Y * (ROWS - 1)) / ROWS;
  const availableW = width - MARGIN_X * 2 - HEAD_GAP_X * (COLS - 1);

  for (let r = 0; r < ROWS; r++) {
    const start = r * COLS;
    let sumHead = 0;
    for (let c = 0; c < COLS; c++) sumHead += keys[start + c].headW.get();
    const xScale = sumHead > 0 ? (availableW / sumHead) : 1;
    let xLeft = MARGIN_X;
    for (let c = 0; c < COLS; c++) {
      let idx = start + c;
      let k = keys[idx];
      const kw = k.headW.get() * xScale;
      const cx = xLeft + kw / 2, ty = MARGIN_Y + r * (cellH + ROW_GAP_Y);
      k.lastCX = cx; k.lastTY = ty; k.lastCH = cellH; k.lastXS = xScale;
      if (idx !== selectedIdx) drawKeyAt(cx, ty, cellH, k, xScale, flipOn && (r + c) % 2 === 1, false);
      xLeft += kw + HEAD_GAP_X;
    }
  }

  if (selectedIdx !== -1) {
    let sk = keys[selectedIdx];
    drawKeyAt(sk.lastCX, sk.lastTY, sk.lastCH, sk, sk.lastXS, false, true);
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }