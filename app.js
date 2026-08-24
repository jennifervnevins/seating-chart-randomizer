const STORAGE_KEY = "classroom-seating-randomizer-v2";
const ROOM_WIDTH = 1500;
const ROOM_HEIGHT = 1000;
const ROOM_LAYOUT_VERSION = 25;
const DEFAULT_DESK_SCALE = 1.22;
const TEACHER_DESK_BASE_WIDTH = 180;
const TEACHER_DESK_BASE_HEIGHT = 91;
const ROOM_EDGE_PADDING = 10;
const TEACHER_EDGE_PADDING = 80;
const DESK_COLLISION_GAP = 8;
const CLASS_COUNT = 6;
const DEFAULT_LAYOUT = "trios";
const DEFAULT_DESK_COUNT = 21;

const sampleStudents = Array.from({ length: 20 }, (_, index) => String(index + 1));
const chartFields = [
  "className",
  "roomName",
  "students",
  "desks",
  "elements",
  "rules",
  "layout",
  "deskCount",
  "spacing",
  "deskScale",
  "groupMoveLocked",
  "zoom",
  "toolsCollapsed",
  "roomLayoutVersion",
  "teacherDesk",
];

const state = {
  classes: [],
  activeClassIndex: 0,
  className: "Class 1",
  roomName: "Mrs. Nevins' Classroom",
  students: [],
  desks: [],
  elements: [],
  rules: [],
  layout: DEFAULT_LAYOUT,
  deskCount: DEFAULT_DESK_COUNT,
  spacing: 24,
  deskScale: DEFAULT_DESK_SCALE,
  groupMoveLocked: false,
  zoom: 1,
  fitScale: 1,
  toolsCollapsed: false,
  roomLayoutVersion: ROOM_LAYOUT_VERSION,
  teacherDesk: {
    x: 1334,
    y: 770,
    rotation: 90,
  },
};

const els = {
  addForm: document.querySelector("#addForm"),
  studentInput: document.querySelector("#studentInput"),
  bulkInput: document.querySelector("#bulkInput"),
  addBulkBtn: document.querySelector("#addBulkBtn"),
  studentList: document.querySelector("#studentList"),
  studentCount: document.querySelector("#studentCount"),
  classTabs: document.querySelector("#classTabs"),
  elementLayer: document.querySelector("#elementLayer"),
  deskLayer: document.querySelector("#deskLayer"),
  deskCountInput: document.querySelector("#deskCountInput"),
  spacingInput: document.querySelector("#spacingInput"),
  deskSizeInput: document.querySelector("#deskSizeInput"),
  deskSizeValue: document.querySelector("#deskSizeValue"),
  groupLockInput: document.querySelector("#groupLockInput"),
  addRuleBtn: document.querySelector("#addRuleBtn"),
  ruleList: document.querySelector("#ruleList"),
  teacherDesk: document.querySelector("#teacherDesk"),
  rotateTeacherBtn: document.querySelector("#rotateTeacherBtn"),
  room: document.querySelector("#room"),
  roomFrame: document.querySelector("#roomFrame"),
  roomScroll: document.querySelector(".room-scroll"),
  roomName: document.querySelector("#roomName"),
  zoomLabel: document.querySelector("#zoomLabel"),
  toolsPanel: document.querySelector("#toolsPanel"),
  toggleToolsBtn: document.querySelector("#toggleToolsBtn"),
};

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function deskDimensionsForScale(scale) {
  return {
    width: Math.round(122 * scale),
    height: Math.round(77 * scale),
  };
}

function placeTrioLayout(desks, scale) {
  const { width } = deskDimensionsForScale(scale);
  const groupPositions = [
    [95, 190],
    [795, 180],
    [115, 380],
    [800, 375],
    [125, 585],
    [802, 575],
    [455, 835],
  ];
  const trioOffsets = [
    [0, 0],
    [width, 0],
    [width * 2, 0],
  ];

  desks.forEach((desk, index) => {
    const trioIndex = Math.floor(index / 3);
    const position = index % 3;
    const [baseX, baseY] = groupPositions[trioIndex % groupPositions.length];
    const [offsetX, offsetY] = trioOffsets[position];
    desk.rotation = 0;
    desk.groupId = `trio-${trioIndex}`;
    desk.x = baseX + offsetX;
    desk.y = baseY + offsetY;
  });
}

function createDefaultChart(index) {
  const chart = {
    className: `Class ${index + 1}`,
    roomName: "Mrs. Nevins' Classroom",
    students: sampleStudents.map((name) => ({ id: createId("student"), name })),
    desks: buildDesks(DEFAULT_DESK_COUNT),
    elements: [],
    rules: [],
    layout: DEFAULT_LAYOUT,
    deskCount: DEFAULT_DESK_COUNT,
    spacing: 24,
    deskScale: DEFAULT_DESK_SCALE,
    groupMoveLocked: false,
    zoom: 1,
    toolsCollapsed: false,
    roomLayoutVersion: ROOM_LAYOUT_VERSION,
    teacherDesk: { x: 1334, y: 770, rotation: 90 },
  };
  placeTrioLayout(chart.desks, chart.deskScale);
  return chart;
}

function chartSnapshot() {
  return chartFields.reduce((snapshot, field) => {
    snapshot[field] = cloneData(state[field]);
    return snapshot;
  }, {});
}

function normalizeChart(chart, index) {
  const normalized = {
    ...createDefaultChart(index),
    ...chart,
    className: chart?.className || `Class ${index + 1}`,
  };
  const shouldUseDefaultTrios =
    !chart || (Number(chart.roomLayoutVersion) < ROOM_LAYOUT_VERSION && chart.layout !== "freeform");

  if (shouldUseDefaultTrios) {
    const previousDesks = Array.isArray(chart?.desks) ? chart.desks : [];
    normalized.layout = DEFAULT_LAYOUT;
    normalized.deskCount = DEFAULT_DESK_COUNT;
    normalized.desks = buildDesks(DEFAULT_DESK_COUNT);
    normalized.desks.forEach((desk, deskIndex) => {
      desk.studentId = previousDesks[deskIndex]?.studentId || null;
      desk.label = previousDesks[deskIndex]?.label || `Seat ${deskIndex + 1}`;
    });
    placeTrioLayout(normalized.desks, Number(normalized.deskScale) || DEFAULT_DESK_SCALE);
  }

  normalized.roomLayoutVersion = ROOM_LAYOUT_VERSION;
  normalized.rules = Array.isArray(normalized.rules) ? normalized.rules : [];
  return normalized;
}

function loadChart(index) {
  const chart = normalizeChart(state.classes[index], index);
  chartFields.forEach((field) => {
    state[field] = cloneData(chart[field]);
  });
  state.classes[index] = chartSnapshot();
}

function syncActiveChart() {
  if (!Array.isArray(state.classes) || !state.classes[state.activeClassIndex]) return;
  state.classes[state.activeClassIndex] = chartSnapshot();
}

function switchClass(index) {
  syncActiveChart();
  state.activeClassIndex = index;
  loadChart(index);
  saveState();
  render();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.classes = Array.from({ length: CLASS_COUNT }, (_, index) => createDefaultChart(index));
    state.activeClassIndex = 0;
    loadChart(0);
    applyLayout();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    if (!Array.isArray(state.classes)) {
      const legacyChart = chartSnapshot();
      state.classes = Array.from({ length: CLASS_COUNT }, (_, index) => createDefaultChart(index));
      state.classes[0] = normalizeChart({ ...legacyChart, className: "Class 1" }, 0);
      state.activeClassIndex = 0;
    } else {
      state.activeClassIndex = Math.max(0, Math.min(CLASS_COUNT - 1, Number(state.activeClassIndex) || 0));
      state.classes = Array.from({ length: CLASS_COUNT }, (_, index) => normalizeChart(state.classes[index], index));
      loadChart(state.activeClassIndex);
    }
    if (!state.roomName || state.roomName === "Room 101") {
      state.roomName = "Mrs. Nevins' Classroom";
    }
    if (!state.teacherDesk) {
      state.teacherDesk = { x: 1334, y: 770, rotation: 90 };
    }
    state.teacherDesk.rotation = normalizeRotation(state.teacherDesk.rotation ?? 90);
    state.deskScale = Number(state.deskScale) || DEFAULT_DESK_SCALE;
    state.groupMoveLocked = Boolean(state.groupMoveLocked);
    if (state.deskScale >= 1.4 || state.roomLayoutVersion < ROOM_LAYOUT_VERSION) {
      state.deskScale = DEFAULT_DESK_SCALE;
    }
    state.elements = Array.isArray(state.elements) ? state.elements : [];
    clampTeacherDeskToRoom();
    state.desks.forEach((desk) => {
      desk.rotation = normalizeRotation(desk.rotation ?? 0);
    });
    if (state.roomLayoutVersion !== ROOM_LAYOUT_VERSION && state.layout !== "freeform") {
      applyLayout();
      state.roomLayoutVersion = ROOM_LAYOUT_VERSION;
      state.teacherDesk = {
        ...state.teacherDesk,
        x: ROOM_WIDTH - teacherDeskSize().width - TEACHER_EDGE_PADDING,
        y: ROOM_HEIGHT - teacherDeskSize().height - TEACHER_EDGE_PADDING,
      };
      clampTeacherDeskToRoom();
      saveState();
    }
  } catch {
    state.classes = Array.from({ length: CLASS_COUNT }, (_, index) => createDefaultChart(index));
    state.activeClassIndex = 0;
    loadChart(0);
    applyLayout();
  }
}

function saveState() {
  syncActiveChart();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildDesks(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: createId("desk"),
    x: 80,
    y: 180,
    studentId: null,
    label: `Seat ${index + 1}`,
    rotation: 0,
    groupId: null,
  }));
}

function setDeskCount(count) {
  const nextCount = Math.max(1, Math.min(60, Number(count) || 1));
  state.deskCount = nextCount;

  while (state.desks.length < nextCount) {
    state.desks.push({
      id: createId("desk"),
      x: 80,
      y: 180,
      studentId: null,
      label: `Seat ${state.desks.length + 1}`,
      rotation: 0,
      groupId: null,
    });
  }

  if (state.desks.length > nextCount) {
    state.desks = state.desks.slice(0, nextCount);
  }

  state.desks.forEach((desk, index) => {
    desk.label = `Seat ${index + 1}`;
  });
}

function syncDeskCount(count) {
  setDeskCount(count);

  if (state.layout !== "freeform") {
    applyLayout();
  }

  render();
}

function deskDimensions() {
  const scale = Number(state.deskScale) || DEFAULT_DESK_SCALE;
  return deskDimensionsForScale(scale);
}

function normalizeRotation(rotation) {
  const normalized = Number(rotation) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function isSideways(rotation) {
  return normalizeRotation(rotation) % 180 !== 0;
}

function rotateSize(size, rotation) {
  return isSideways(rotation) ? { width: size.height, height: size.width } : size;
}

function studentDeskBaseCollisionSize() {
  const { width, height } = deskDimensions();
  return { width, height: height + 26 };
}

function studentDeskVisualSize(desk) {
  return rotateSize(deskDimensions(), desk.rotation ?? 0);
}

function studentDeskCollisionSize(desk) {
  return rotateSize(studentDeskBaseCollisionSize(), desk.rotation ?? 0);
}

function teacherDeskSize() {
  const scale = Number(state.deskScale) || DEFAULT_DESK_SCALE;
  return rotateSize(
    {
      width: Math.round(TEACHER_DESK_BASE_WIDTH * scale),
      height: Math.round(TEACHER_DESK_BASE_HEIGHT * scale),
    },
    state.teacherDesk.rotation ?? 90,
  );
}

function clampDeskPosition(x, y, width, height) {
  return {
    x: Math.max(ROOM_EDGE_PADDING, Math.min(ROOM_WIDTH - width - ROOM_EDGE_PADDING, x)),
    y: Math.max(60, Math.min(ROOM_HEIGHT - height - ROOM_EDGE_PADDING, y)),
  };
}

function deskCollisionRect(desk, x = desk.x, y = desk.y) {
  const { width, height } = studentDeskCollisionSize(desk);
  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
  };
}

function rectsOverlap(first, second) {
  return !(
    first.right + DESK_COLLISION_GAP <= second.left ||
    first.left >= second.right + DESK_COLLISION_GAP ||
    first.bottom + DESK_COLLISION_GAP <= second.top ||
    first.top >= second.bottom + DESK_COLLISION_GAP
  );
}

function clampElementPosition(element) {
  element.width = Math.max(120, Math.min(ROOM_WIDTH - 20, Number(element.width) || 360));
  element.height = Math.max(44, Math.min(ROOM_HEIGHT - 20, Number(element.height) || 90));
  element.x = Math.max(ROOM_EDGE_PADDING, Math.min(ROOM_WIDTH - element.width - ROOM_EDGE_PADDING, Number(element.x) || 0));
  element.y = Math.max(ROOM_EDGE_PADDING, Math.min(ROOM_HEIGHT - element.height - ROOM_EDGE_PADDING, Number(element.y) || 0));
}

function clampTeacherDeskPosition(x, y) {
  const { width, height } = teacherDeskSize();
  return {
    x: Math.max(TEACHER_EDGE_PADDING, Math.min(ROOM_WIDTH - width - TEACHER_EDGE_PADDING, x)),
    y: Math.max(TEACHER_EDGE_PADDING, Math.min(ROOM_HEIGHT - height - TEACHER_EDGE_PADDING, y)),
  };
}

function clampTeacherDeskToRoom() {
  const next = clampTeacherDeskPosition(state.teacherDesk.x, state.teacherDesk.y);
  state.teacherDesk.x = next.x;
  state.teacherDesk.y = next.y;
}

function applyLayout() {
  if (state.layout === "trios" && state.desks.length !== 21) {
    setDeskCount(21);
  }

  const count = state.desks.length;
  const gap = Number(state.spacing) || 0;
  const spacingGap = 45 + gap * 1.4;
  const { width, height } = deskDimensions();
  const top = 150;
  const roomWidth = ROOM_WIDTH;
  const roomHeight = ROOM_HEIGHT;

  if (state.layout === "rows") {
    const columns = Math.min(5, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const xGap = columns === 1 ? 0 : spacingGap;
    const yGap = rows === 1 ? 0 : spacingGap;
    const totalWidth = columns * width + (columns - 1) * xGap;
    const totalHeight = rows * height + (rows - 1) * yGap;
    const startX = (roomWidth - totalWidth) / 2;
    const startY = top + Math.max(0, (roomHeight - top - 125 - totalHeight) / 2);
    state.desks.forEach((desk, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      desk.rotation = 0;
      desk.groupId = `row-${row}`;
      desk.x = startX + col * (width + xGap);
      desk.y = startY + row * (height + yGap);
    });
  }

  if (state.layout === "pairs") {
    const pairSpacing = 14;
    const pairWidth = width * 2 + pairSpacing;
    const pairsPerRow = 3;
    const totalPairs = Math.ceil(count / 2);
    const totalRows = Math.ceil(totalPairs / pairsPerRow);
    const sideOffset = 120;
    const layoutWidth = roomWidth - sideOffset * 2;
    const layoutHeight = roomHeight - top - 80;
    const pairGap = Math.max(70, Math.min((layoutWidth - pairWidth * pairsPerRow) / (pairsPerRow - 1), 210 + gap * 2));
    const rowBlankGap = totalRows === 1 ? 0 : spacingGap;
    const pairRowGap = studentDeskBaseCollisionSize().height + rowBlankGap;
    const totalHeight = totalRows * studentDeskBaseCollisionSize().height + Math.max(0, totalRows - 1) * rowBlankGap;
    const startY = top + Math.max(0, (layoutHeight - totalHeight) / 2);
    state.desks.forEach((desk, index) => {
      const pairIndex = Math.floor(index / 2);
      const pairsInRow = Math.min(pairsPerRow, totalPairs - Math.floor(pairIndex / pairsPerRow) * pairsPerRow);
      const rowWidth = pairsInRow * pairWidth + Math.max(0, pairsInRow - 1) * pairGap;
      const col = pairIndex % pairsPerRow;
      const row = Math.floor(pairIndex / pairsPerRow);
      const offset = index % 2 === 0 ? 0 : width + pairSpacing;
      desk.rotation = 0;
      desk.groupId = `pair-${pairIndex}`;
      desk.x = (roomWidth - rowWidth) / 2 + col * (pairWidth + pairGap) + offset;
      desk.y = startY + row * pairRowGap;
    });
  }

  if (state.layout === "trios") {
    placeTrioLayout(state.desks, state.deskScale);
  }

  if (state.layout === "groups") {
    const centers = [
      [170, 220],
      [568, 220],
      [966, 220],
      [370, 590],
      [770, 590],
    ];
    state.desks.forEach((desk, index) => {
      const group = Math.floor(index / 4) % centers.length;
      const position = index % 4;
      const [cx, cy] = centers[group];
      desk.rotation = 0;
      desk.groupId = `group-${Math.floor(index / 4)}`;
      desk.x = cx + (position % 2) * (width + 12);
      desk.y = cy + Math.floor(position / 2) * (height + 18);
    });
  }

  if (state.layout === "ushape") {
    const sideVisual = rotateSize(deskDimensions(), 90);
    const bottomVisual = rotateSize(deskDimensions(), 180);
    const sideGap = 48;
    const bottomGap = 36;
    const bottomSideMargin = 170;
    const sideTop = top + 35;
    const bottomCapacity = Math.max(
      1,
      Math.floor((roomWidth - bottomSideMargin * 2 + bottomGap) / (bottomVisual.width + bottomGap)),
    );
    const sideCount = Math.min(Math.ceil(count / 7), 3);
    const leftCount = Math.min(Math.ceil(count / 2), sideCount);
    const rightCount = Math.min(Math.max(0, count - leftCount), sideCount);
    const bottomCount = Math.max(0, count - leftCount - rightCount);
    const bottomRows = Math.max(1, Math.ceil(bottomCount / bottomCapacity));
    const bottomBlockHeight = bottomRows * bottomVisual.height + Math.max(0, bottomRows - 1) * bottomGap;
    const bottomTop = roomHeight - bottomBlockHeight - 110;
    const sideBottom = Math.max(sideTop, bottomTop - sideVisual.height - 58);
    const leftX = 130;
    const rightX = roomWidth - sideVisual.width - 130;

    function spread(index, total, start, span, itemSize) {
      if (total <= 1) return start;
      const minimumSpan = (total - 1) * (itemSize + sideGap);
      return start + (index / (total - 1)) * Math.max(span, minimumSpan);
    }

    state.desks.forEach((desk, index) => {
      if (index < leftCount) {
        desk.rotation = 270;
        desk.groupId = "u-left";
        desk.x = leftX;
        desk.y = spread(index, leftCount, sideTop, sideBottom - sideTop, sideVisual.height);
      } else if (index < leftCount + bottomCount) {
        const bottomIndex = index - leftCount;
        const row = Math.floor(bottomIndex / bottomCapacity);
        const col = bottomIndex % bottomCapacity;
        const remaining = bottomCount - row * bottomCapacity;
        const rowCount = Math.min(bottomCapacity, remaining);
        const rowWidth = rowCount * bottomVisual.width + Math.max(0, rowCount - 1) * bottomGap;
        const startX = (roomWidth - rowWidth) / 2;
        desk.rotation = 0;
        desk.groupId = `u-bottom-${row}`;
        desk.x = startX + col * (bottomVisual.width + bottomGap);
        desk.y = bottomTop + row * (bottomVisual.height + bottomGap);
      } else {
        const rightIndex = index - leftCount - bottomCount;
        desk.rotation = 90;
        desk.groupId = "u-right";
        desk.x = rightX;
        desk.y = spread(rightIndex, rightCount, sideTop, sideBottom - sideTop, sideVisual.height);
      }
    });
  }

  if (state.layout === "centerAisle") {
    const visual = rotateSize(deskDimensions(), 90);
    const leftCount = Math.ceil(count / 2);
    const rightCount = count - leftCount;
    const usableTop = 120;
    const usableHeight = roomHeight - usableTop - 65;
    const aisleWidth = 300;
    const columnGap = 80 + gap * 1.4;
    const leftInnerX = roomWidth / 2 - aisleWidth / 2 - visual.width;
    const leftOuterX = leftInnerX - visual.width - columnGap;
    const rightInnerX = roomWidth / 2 + aisleWidth / 2;
    const rightOuterX = rightInnerX + visual.width + columnGap;

    function placeSide(desk, sideIndex, sideCount, isLeft) {
      const columnCount = sideCount > 2 ? 2 : 1;
      const innerColumnCount = Math.ceil(sideCount / columnCount);
      const outerColumnCount = sideCount - innerColumnCount;
      const isInnerColumn = columnCount === 1 || sideIndex < innerColumnCount;
      const columnIndex = isInnerColumn ? sideIndex : sideIndex - innerColumnCount;
      const columnSize = isInnerColumn ? innerColumnCount : outerColumnCount;
      const maxRowGap = columnSize <= 1 ? 0 : Math.max(10, (usableHeight - columnSize * visual.height) / (columnSize - 1));
      const rowGap = columnSize <= 1 ? 0 : Math.min(spacingGap, maxRowGap);
      const totalHeight = columnSize * visual.height + Math.max(0, columnSize - 1) * rowGap;
      const startY = usableTop + Math.max(0, (usableHeight - totalHeight) / 2);
      const sideName = isLeft ? "left" : "right";
      const columnName = isInnerColumn ? "inner" : "outer";

      desk.rotation = isLeft ? 270 : 90;
      desk.groupId = `center-${sideName}-${columnName}`;
      if (isLeft) {
        desk.x = isInnerColumn ? leftInnerX : leftOuterX;
      } else {
        desk.x = isInnerColumn ? rightInnerX : rightOuterX;
      }
      desk.y = startY + columnIndex * (visual.height + rowGap);
    }

    state.desks.forEach((desk, index) => {
      const isLeft = index < leftCount;
      placeSide(desk, isLeft ? index : index - leftCount, isLeft ? leftCount : rightCount, isLeft);
    });
  }

}

function assignedStudentIds() {
  return new Set(state.desks.map((desk) => desk.studentId).filter(Boolean));
}

function renderStudents() {
  const assigned = assignedStudentIds();
  els.studentList.innerHTML = "";
  els.studentCount.textContent = state.students.length;

  state.students.forEach((student) => {
    const item = document.querySelector("#studentTemplate").content.firstElementChild.cloneNode(true);
    item.dataset.studentId = student.id;
    item.querySelector(".student-name").textContent = student.name;
    item.classList.toggle("assigned", assigned.has(student.id));
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", student.id);
    });
    item.querySelector("button").addEventListener("click", () => removeStudent(student.id));
    els.studentList.appendChild(item);
  });
}

function renderDesks() {
  els.deskLayer.innerHTML = "";

  state.desks.forEach((desk) => {
    const deskEl = document.createElement("div");
    const student = state.students.find((item) => item.id === desk.studentId);
    const displayValue = student ? student.name : desk.label;
    deskEl.className = "desk";
    deskEl.classList.toggle("empty", !student);
    deskEl.dataset.deskId = desk.id;
    deskEl.setAttribute("role", "group");
    deskEl.tabIndex = 0;
    deskEl.style.left = `${desk.x}px`;
    deskEl.style.top = `${desk.y}px`;
    const visualSize = studentDeskVisualSize(desk);
    deskEl.style.width = `${visualSize.width}px`;
    deskEl.style.height = `${visualSize.height}px`;
    deskEl.classList.toggle("rotated", isSideways(desk.rotation ?? 0));
    deskEl.classList.toggle("rotated-left", normalizeRotation(desk.rotation ?? 0) === 270);
    deskEl.innerHTML = `
      <button class="rotate-desk-btn" type="button" aria-label="Rotate desk" title="Rotate desk">↻</button>
      <input class="desk-name" type="text" value="${escapeAttribute(displayValue)}" aria-label="Desk label" />
    `;
    deskEl.title = "Drag the desk to move it. Edit the label to change the number.";
    deskEl.querySelector(".rotate-desk-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      rotateStudentDesk(desk);
    });
    const labelInput = deskEl.querySelector(".desk-name");
    labelInput.addEventListener("input", () => {
      if (student) {
        student.name = labelInput.value;
      } else {
        desk.label = labelInput.value;
      }
      saveState();
      renderStudents();
      renderRules();
    });
    deskEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      deskEl.classList.add("drop-ready");
    });
    deskEl.addEventListener("dragleave", () => deskEl.classList.remove("drop-ready"));
    deskEl.addEventListener("drop", (event) => {
      event.preventDefault();
      assignStudentToDesk(event.dataTransfer.getData("text/plain"), desk.id);
    });
    makeDeskDraggable(deskEl, desk);
    els.deskLayer.appendChild(deskEl);
  });
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderClassTabs() {
  els.classTabs.innerHTML = "";
  state.classes.forEach((chart, index) => {
    const tab = document.createElement("div");
    tab.className = "class-tab";
    tab.classList.toggle("active", index === state.activeClassIndex);
    tab.tabIndex = 0;
    tab.setAttribute("role", "button");
    tab.setAttribute("aria-current", index === state.activeClassIndex ? "page" : "false");
    tab.setAttribute("aria-label", `Open ${chart.className || `Class ${index + 1}`}`);
    tab.innerHTML = `
      <input
        class="class-tab-input"
        type="text"
        value="${escapeAttribute(chart.className || `Class ${index + 1}`)}"
        aria-label="Class tab name"
      />
    `;
    const input = tab.querySelector(".class-tab-input");
    tab.addEventListener("click", (event) => {
      if (event.target.closest(".class-tab-input")) return;
      if (index !== state.activeClassIndex) switchClass(index);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.target.closest(".class-tab-input")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (index !== state.activeClassIndex) switchClass(index);
    });
    input.addEventListener("focus", () => {
      if (index === state.activeClassIndex) return;
      switchClass(index);
      requestAnimationFrame(() => els.classTabs.querySelectorAll(".class-tab-input")[index]?.focus());
    });
    input.addEventListener("input", (event) => {
      const nextName = event.target.value.trim() || `Class ${index + 1}`;
      state.classes[index].className = nextName;
      if (index === state.activeClassIndex) state.className = nextName;
      saveState();
    });
    els.classTabs.appendChild(tab);
  });
}

function studentSelectOptions(selectedId) {
  const options = ['<option value="">Choose...</option>'];
  state.students.forEach((student) => {
    options.push(
      `<option value="${escapeAttribute(student.id)}" ${
        student.id === selectedId ? "selected" : ""
      }>${escapeAttribute(student.name)}</option>`,
    );
  });
  return options.join("");
}

function renderRules() {
  state.rules = Array.isArray(state.rules) ? state.rules : [];
  els.ruleList.innerHTML = "";

  if (state.rules.length === 0) {
    els.ruleList.innerHTML = '<p class="empty-rules">No rules for this class yet.</p>';
    return;
  }

  state.rules.forEach((rule, index) => {
    const card = document.createElement("div");
    card.className = "rule-card";
    card.innerHTML = `
      <label class="rule-toggle">
        <input class="rule-enabled" type="checkbox" ${rule.enabled !== false ? "checked" : ""} />
        <span>On</span>
      </label>
      <label class="rule-field">
        <span>Keep</span>
        <select class="rule-student-a">${studentSelectOptions(rule.studentAId)}</select>
      </label>
      <label class="rule-field">
        <span>More than this many nearby desks</span>
        <input class="rule-distance" type="number" min="1" max="20" value="${escapeAttribute(rule.distance || 3)}" />
      </label>
      <label class="rule-field">
        <span>Away from</span>
        <select class="rule-student-b">${studentSelectOptions(rule.studentBId)}</select>
      </label>
      <button class="rule-remove" type="button">Remove</button>
    `;

    card.querySelector(".rule-enabled").addEventListener("change", (event) => {
      rule.enabled = event.target.checked;
      saveState();
    });
    card.querySelector(".rule-student-a").addEventListener("change", (event) => {
      rule.studentAId = event.target.value;
      saveState();
    });
    card.querySelector(".rule-student-b").addEventListener("change", (event) => {
      rule.studentBId = event.target.value;
      saveState();
    });
    card.querySelector(".rule-distance").addEventListener("input", (event) => {
      rule.distance = Math.max(1, Math.min(20, Number(event.target.value) || 3));
      saveState();
    });
    card.querySelector(".rule-remove").addEventListener("click", () => {
      state.rules.splice(index, 1);
      saveState();
      renderRules();
    });

    els.ruleList.appendChild(card);
  });
}

function render() {
  els.roomName.value = state.roomName;
  els.deskCountInput.value = state.desks.length;
  els.spacingInput.value = state.spacing;
  els.deskSizeInput.value = Math.round((Number(state.deskScale) || DEFAULT_DESK_SCALE) * 100);
  els.deskSizeValue.textContent = `${els.deskSizeInput.value}%`;
  els.groupLockInput.checked = Boolean(state.groupMoveLocked);
  document.querySelectorAll(".layout-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === state.layout);
  });
  els.toolsPanel.classList.toggle("collapsed", state.toolsCollapsed);
  els.toggleToolsBtn.setAttribute("aria-expanded", String(!state.toolsCollapsed));
  els.toggleToolsBtn.title = state.toolsCollapsed ? "Expand layout tools" : "Collapse layout tools";
  renderClassTabs();
  renderTeacherDesk();
  fitRoomToScreen();
  renderStudents();
  renderRules();
  renderElements();
  renderDesks();
}

function renderElements() {
  state.elements = Array.isArray(state.elements) ? state.elements : [];
  els.elementLayer.innerHTML = "";

  state.elements.forEach((element) => {
    clampElementPosition(element);
    const elementEl = document.createElement("div");
    elementEl.className = `room-element ${element.type === "nileRiver" ? "nile-river" : ""} ${
      element.type === "digSight" ? "dig-sight" : ""
    }`;
    elementEl.dataset.elementId = element.id;
    elementEl.style.left = `${element.x}px`;
    elementEl.style.top = `${element.y}px`;
    elementEl.style.width = `${element.width}px`;
    elementEl.style.height = `${element.height}px`;
    const labelMarkup = element.type === "digSight"
      ? `<input class="element-label element-label-input" type="text" value="${escapeAttribute(element.label || "")}" aria-label="Dig sight label" placeholder="#" />`
      : "";
    elementEl.innerHTML = `
      ${labelMarkup}
      <button class="element-remove" type="button" aria-label="Remove element" title="Remove element">×</button>
      <span class="element-resize" aria-hidden="true"></span>
    `;
    const labelInput = elementEl.querySelector(".element-label-input");
    if (labelInput) {
      labelInput.addEventListener("input", () => {
        element.label = labelInput.value;
        saveState();
      });
    }
    elementEl.querySelector(".element-remove").addEventListener("click", (event) => {
      event.stopPropagation();
      removeElement(element.id);
    });
    makeElementInteractive(elementEl, element);
    els.elementLayer.appendChild(elementEl);
  });
}

function renderTeacherDesk() {
  clampTeacherDeskToRoom();
  const { width, height } = teacherDeskSize();
  els.teacherDesk.style.left = `${state.teacherDesk.x}px`;
  els.teacherDesk.style.top = `${state.teacherDesk.y}px`;
  els.teacherDesk.style.width = `${width}px`;
  els.teacherDesk.style.height = `${height}px`;
  els.teacherDesk.classList.toggle("rotated", isSideways(state.teacherDesk.rotation ?? 90));
}

function fitRoomToScreen() {
  const bounds = els.roomScroll.getBoundingClientRect();
  const padding = 42;
  const availableWidth = Math.max(300, bounds.width - padding);
  const availableHeight = Math.max(260, bounds.height - padding);
  const fitScale = Math.min(availableWidth / ROOM_WIDTH, availableHeight / ROOM_HEIGHT);
  const nextScale = Math.max(0.2, Math.min(1.15, fitScale, fitScale * state.zoom));
  state.fitScale = nextScale;
  els.roomFrame.style.width = `${ROOM_WIDTH * nextScale}px`;
  els.roomFrame.style.height = `${ROOM_HEIGHT * nextScale}px`;
  els.room.style.transform = `scale(${nextScale})`;
  els.zoomLabel.textContent = `${Math.round(nextScale * 100)}%`;
}

function addStudents(names) {
  const cleanNames = names.map((name) => name.trim()).filter(Boolean);
  cleanNames.forEach((name) => state.students.push({ id: createId("student"), name }));
  saveState();
  render();
}

function removeStudent(studentId) {
  state.students = state.students.filter((student) => student.id !== studentId);
  state.desks.forEach((desk) => {
    if (desk.studentId === studentId) desk.studentId = null;
  });
  state.rules = (Array.isArray(state.rules) ? state.rules : []).map((rule) => ({
    ...rule,
    studentAId: rule.studentAId === studentId ? "" : rule.studentAId,
    studentBId: rule.studentBId === studentId ? "" : rule.studentBId,
  }));
  saveState();
  render();
}

function assignStudentToDesk(studentId, deskId) {
  if (!state.students.some((student) => student.id === studentId)) return;
  state.desks.forEach((desk) => {
    if (desk.studentId === studentId) desk.studentId = null;
  });
  const desk = state.desks.find((item) => item.id === deskId);
  if (desk) desk.studentId = studentId;
  saveState();
  render();
}

function rotateStudentDesk(desk) {
  const originalRotation = desk.rotation ?? 0;
  const originalX = desk.x;
  const originalY = desk.y;
  desk.rotation = normalizeRotation(originalRotation + 90);
  const { width, height } = studentDeskCollisionSize(desk);
  const next = clampDeskPosition(desk.x, desk.y, width, height);
  desk.x = next.x;
  desk.y = next.y;
  if (deskGroupOverlaps([{ desk, x: desk.x, y: desk.y }], 0, 0)) {
    desk.rotation = originalRotation;
    desk.x = originalX;
    desk.y = originalY;
  }

  saveState();
  render();
}

function rotateTeacherDesk() {
  const originalRotation = state.teacherDesk.rotation ?? 90;
  state.teacherDesk.rotation = normalizeRotation(originalRotation + 90);
  clampTeacherDeskToRoom();

  saveState();
  render();
}

function addNileRiver() {
  const width = 145;
  const height = 760;
  state.elements.push({
    id: createId("element"),
    type: "nileRiver",
    label: "",
    x: Math.round((ROOM_WIDTH - width) / 2),
    y: 135,
    width,
    height,
  });
  saveState();
  render();
}

function addDigSight() {
  state.elements.push({
    id: createId("element"),
    type: "digSight",
    label: "Dig Sight",
    x: 520,
    y: 300,
    width: 190,
    height: 190,
  });
  saveState();
  render();
}

function addKeepApartRule() {
  state.rules = Array.isArray(state.rules) ? state.rules : [];
  state.rules.push({
    id: createId("rule"),
    type: "keepApart",
    enabled: true,
    studentAId: state.students[0]?.id || "",
    studentBId: state.students[1]?.id || "",
    distance: 3,
  });
  saveState();
  render();
}

function removeElement(elementId) {
  state.elements = state.elements.filter((element) => element.id !== elementId);
  saveState();
  render();
}

function shuffledStudents() {
  const shuffled = [...state.students];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function activeSeatingRules() {
  return (Array.isArray(state.rules) ? state.rules : []).filter(
    (rule) =>
      rule.enabled !== false &&
      rule.type === "keepApart" &&
      rule.studentAId &&
      rule.studentBId &&
      rule.studentAId !== rule.studentBId,
  );
}

function deskCenter(desk) {
  const { width, height } = studentDeskCollisionSize(desk);
  return {
    x: desk.x + width / 2,
    y: desk.y + height / 2,
  };
}

function centerDistance(firstDesk, secondDesk) {
  const first = deskCenter(firstDesk);
  const second = deskCenter(secondDesk);
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function nearbyDeskRank(firstDesk, secondDesk, desks) {
  const sorted = desks
    .filter((desk) => desk.id !== firstDesk.id)
    .map((desk) => ({
      id: desk.id,
      distance: centerDistance(firstDesk, desk),
    }))
    .sort((first, second) => first.distance - second.distance);
  const index = sorted.findIndex((desk) => desk.id === secondDesk.id);
  return index === -1 ? Infinity : index + 1;
}

function ruleIsSatisfied(rule, desks) {
  const firstDesk = desks.find((desk) => desk.studentId === rule.studentAId);
  const secondDesk = desks.find((desk) => desk.studentId === rule.studentBId);
  if (!firstDesk || !secondDesk) return true;

  const distanceLimit = Math.max(1, Math.min(20, Number(rule.distance) || 3));
  return (
    nearbyDeskRank(firstDesk, secondDesk, desks) > distanceLimit &&
    nearbyDeskRank(secondDesk, firstDesk, desks) > distanceLimit
  );
}

function seatingFollowsRules(desks) {
  const rules = activeSeatingRules();
  if (rules.length === 0) return true;
  return rules.every((rule) => ruleIsSatisfied(rule, desks));
}

function randomizeSeats() {
  const rules = activeSeatingRules();
  const attemptCount = rules.length ? 4000 : 1;

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    const shuffled = shuffledStudents();
    const candidateDesks = state.desks.map((desk, index) => ({
      ...desk,
      studentId: shuffled[index]?.id || null,
    }));

    if (!seatingFollowsRules(candidateDesks)) continue;

    state.desks.forEach((desk, index) => {
      desk.studentId = candidateDesks[index].studentId;
    });
    saveState();
    render();
    return;
  }

  window.alert("I could not find a random seating chart that follows the enabled rules. Try turning off a rule or lowering the nearby-desk number.");
}

function desksForDrag(desk) {
  if (!state.groupMoveLocked || !desk.groupId) return [desk];
  return state.desks.filter((item) => item.groupId === desk.groupId);
}

function clampDeskGroupDelta(originals, dx, dy) {
  const bounds = originals.reduce(
    (next, item) => {
      const { width, height } = studentDeskCollisionSize(item.desk);
      return {
        minX: Math.min(next.minX, item.x),
        minY: Math.min(next.minY, item.y),
        maxX: Math.max(next.maxX, item.x + width),
        maxY: Math.max(next.maxY, item.y + height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  return {
    dx: Math.max(ROOM_EDGE_PADDING - bounds.minX, Math.min(ROOM_WIDTH - ROOM_EDGE_PADDING - bounds.maxX, dx)),
    dy: Math.max(60 - bounds.minY, Math.min(ROOM_HEIGHT - ROOM_EDGE_PADDING - bounds.maxY, dy)),
  };
}

function deskGroupOverlaps(originals, dx, dy) {
  const movingIds = new Set(originals.map((item) => item.desk.id));
  return originals.some((item) => {
    const movedRect = deskCollisionRect(item.desk, item.x + dx, item.y + dy);
    return state.desks.some((desk) => {
      if (movingIds.has(desk.id)) return false;
      return rectsOverlap(movedRect, deskCollisionRect(desk));
    });
  });
}

function allowedDeskGroupDelta(originals, dx, dy) {
  const clamped = clampDeskGroupDelta(originals, dx, dy);
  if (!deskGroupOverlaps(originals, clamped.dx, clamped.dy)) return clamped;

  const xOnly = clampDeskGroupDelta(originals, dx, 0);
  if (!deskGroupOverlaps(originals, xOnly.dx, xOnly.dy)) return xOnly;

  const yOnly = clampDeskGroupDelta(originals, 0, dy);
  if (!deskGroupOverlaps(originals, yOnly.dx, yOnly.dy)) return yOnly;

  return { dx: 0, dy: 0 };
}

function makeDeskDraggable(element, desk) {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originalDesks = [];

  element.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".desk-name, .rotate-desk-btn")) return;
    dragging = true;
    moved = false;
    state.layout = "freeform";
    startX = event.clientX;
    startY = event.clientY;
    originalDesks = desksForDrag(desk).map((item) => ({ desk: item, x: item.x, y: item.y }));
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = (event.clientX - startX) / state.fitScale;
    const dy = (event.clientY - startY) / state.fitScale;
    moved = moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;
    const nextDelta = allowedDeskGroupDelta(originalDesks, dx, dy);

    originalDesks.forEach((item) => {
      item.desk.x = item.x + nextDelta.dx;
      item.desk.y = item.y + nextDelta.dy;
      const deskElement = els.deskLayer.querySelector(`[data-desk-id="${item.desk.id}"]`);
      if (deskElement) {
        deskElement.style.left = `${item.desk.x}px`;
        deskElement.style.top = `${item.desk.y}px`;
      }
    });
    document.querySelectorAll(".layout-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.layout === state.layout);
    });
  });

  element.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    originalDesks = [];
    element.releasePointerCapture(event.pointerId);
    if (moved) {
      element.dataset.skipNextClick = "true";
    }
    saveState();
  });

  element.addEventListener("click", (event) => {
    if (element.dataset.skipNextClick === "true") {
      event.stopImmediatePropagation();
      element.dataset.skipNextClick = "false";
    }
  }, true);
}

function makeTeacherDeskDraggable() {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originalX = 0;
  let originalY = 0;

  els.teacherDesk.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".rotate-desk-btn")) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originalX = state.teacherDesk.x;
    originalY = state.teacherDesk.y;
    els.teacherDesk.setPointerCapture(event.pointerId);
  });

  els.teacherDesk.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = (event.clientX - startX) / state.fitScale;
    const dy = (event.clientY - startY) / state.fitScale;
    const next = clampTeacherDeskPosition(originalX + dx, originalY + dy);
    state.teacherDesk.x = next.x;
    state.teacherDesk.y = next.y;

    renderTeacherDesk();
  });

  els.teacherDesk.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    els.teacherDesk.releasePointerCapture(event.pointerId);
    saveState();
  });
}

function makeElementInteractive(elementEl, element) {
  let mode = null;
  let startX = 0;
  let startY = 0;
  let original = null;

  elementEl.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".element-remove, .element-label-input")) return;
    mode = event.target.closest(".element-resize") ? "resize" : "move";
    startX = event.clientX;
    startY = event.clientY;
    original = { x: element.x, y: element.y, width: element.width, height: element.height };
    elementEl.setPointerCapture(event.pointerId);
  });

  elementEl.addEventListener("pointermove", (event) => {
    if (!mode) return;
    const dx = (event.clientX - startX) / state.fitScale;
    const dy = (event.clientY - startY) / state.fitScale;

    if (mode === "resize") {
      element.width = original.width + dx;
      element.height = original.height + dy;
    } else {
      element.x = original.x + dx;
      element.y = original.y + dy;
    }

    clampElementPosition(element);
    elementEl.style.left = `${element.x}px`;
    elementEl.style.top = `${element.y}px`;
    elementEl.style.width = `${element.width}px`;
    elementEl.style.height = `${element.height}px`;
  });

  elementEl.addEventListener("pointerup", (event) => {
    if (!mode) return;
    mode = null;
    elementEl.releasePointerCapture(event.pointerId);
    saveState();
  });
}

function exportLayout() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.roomName || "seating-chart"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importLayout(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      loadState();
      saveState();
      render();
    } catch {
      alert("That file could not be imported. Please choose a saved seating chart JSON file.");
    }
  };
  reader.readAsText(file);
}

els.addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addStudents([els.studentInput.value]);
  els.studentInput.value = "";
});

els.addBulkBtn.addEventListener("click", () => {
  addStudents(els.bulkInput.value.split(/\r?\n/));
  els.bulkInput.value = "";
});

document.querySelector("#randomizeBtn").addEventListener("click", randomizeSeats);

document.querySelector("#saveBtn").addEventListener("click", () => {
  saveState();
  alert("Saved on this computer.");
});

document.querySelector("#exportBtn").addEventListener("click", exportLayout);

document.querySelector("#importInput").addEventListener("change", (event) => {
  if (event.target.files[0]) importLayout(event.target.files[0]);
  event.target.value = "";
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  state.desks.forEach((desk) => {
    desk.studentId = null;
  });
  saveState();
  render();
});

document.querySelector("#matchBtn").addEventListener("click", () => {
  syncDeskCount(state.students.length || 1);
});

document.querySelector("#sampleBtn").addEventListener("click", () => {
  const previousNamesById = new Map(state.students.map((student) => [student.id, student.name]));
  state.students = sampleStudents.map((name) => ({ id: createId("student"), name }));
  const nextIdsByName = new Map(state.students.map((student) => [student.name, student.id]));
  state.rules = (Array.isArray(state.rules) ? state.rules : []).map((rule) => ({
    ...rule,
    studentAId: nextIdsByName.get(previousNamesById.get(rule.studentAId)) || "",
    studentBId: nextIdsByName.get(previousNamesById.get(rule.studentBId)) || "",
  }));
  syncDeskCount(state.students.length);
  randomizeSeats();
});

document.querySelector("#printBtn").addEventListener("click", () => window.print());

document.querySelector("#addNileRiverBtn").addEventListener("click", addNileRiver);
document.querySelector("#addDigSightBtn").addEventListener("click", addDigSight);
els.addRuleBtn.addEventListener("click", addKeepApartRule);

els.rotateTeacherBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  rotateTeacherDesk();
});

els.toggleToolsBtn.addEventListener("click", () => {
  state.toolsCollapsed = !state.toolsCollapsed;
  saveState();
  render();
  requestAnimationFrame(fitRoomToScreen);
});

document.querySelectorAll(".layout-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.layout = button.dataset.layout;
    if (state.layout !== "freeform") applyLayout();
    saveState();
    render();
  });
});

els.deskCountInput.addEventListener("change", (event) => syncDeskCount(event.target.value));

els.spacingInput.addEventListener("input", (event) => {
  state.spacing = Number(event.target.value);
  if (state.layout !== "freeform") applyLayout();
  saveState();
  render();
});

els.deskSizeInput.addEventListener("input", (event) => {
  state.deskScale = Number(event.target.value) / 100;
  if (state.layout !== "freeform") applyLayout();
  clampTeacherDeskToRoom();
  saveState();
  render();
});

els.groupLockInput.addEventListener("change", (event) => {
  state.groupMoveLocked = event.target.checked;
  saveState();
  render();
});

els.roomName.addEventListener("input", (event) => {
  state.roomName = event.target.value;
  saveState();
});

document.querySelector("#zoomOutBtn").addEventListener("click", () => {
  state.zoom = Math.max(0.75, Number((state.zoom - 0.1).toFixed(2)));
  saveState();
  render();
});

document.querySelector("#zoomInBtn").addEventListener("click", () => {
  state.zoom = Math.min(1, Number((state.zoom + 0.1).toFixed(2)));
  saveState();
  render();
});

loadState();
makeTeacherDeskDraggable();
render();
window.addEventListener("resize", fitRoomToScreen);
