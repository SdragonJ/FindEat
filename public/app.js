/**
 * FindEat_CURSOR — 브라우저에서만 실행되는 프론트 스크립트 (바닐라 JavaScript)
 *
 * [구성] `index.html`(마크업) + 이 파일(DOM·fetch) + `server.js`(/api)가 함께 동작합니다.
 *
 * [흐름]
 * 페이지 로드 → init 에서 health·카테고리·목록 로드 → 사용자 조작 → fetch 로 /api 호출 → DOM 갱신
 */

// ---------------------------------------------------------------------------
// DOM / 유틸
// ---------------------------------------------------------------------------

/**
 * CSS 선택자로 문서에서 첫 번째 요소를 찾습니다. 바닐라 JS에서 자주 쓰는 `querySelector` 단축입니다.
 */
const $ = (sel) => document.querySelector(sel);

/**
 * GET/POST 등으로 API를 호출하고 응답 본문을 JSON으로 파싱합니다. HTTP 오류면 Error를 던집니다.
 *
 * [문법] `async function`은 항상 Promise를 반환하며, 내부에서 `await`로 비동기 작업을 “기다린 뒤” 다음 줄로 갑니다.
 */
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.detail || r.statusText);
  return data;
}

/**
 * 사용자 입력·DB 값을 HTML 문자열에 끼워 넣기 전에 이스케이프해 XSS(스크립트 삽입)를 줄입니다.
 * `innerHTML`에 넣을 때는 반드시 이스케이프하거나 `textContent`만 쓰는 습관이 안전합니다.
 *
 * [문법] `??` 는 null/undefined일 때만 오른쪽 값을 쓰는 “null 병합 연산자”입니다.
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 추가·수정 폼: 포커스 시 placeholder 문구를 제거했다가, 비운 뒤 블러하면 다시 붙입니다.
 * `type="number"` 등에서 브라우저마다 다르게 보일 때도 “활성화하면 멘트가 사라짐”을 맞춥니다.
 */
function setupFormPlaceholders() {
  document.querySelectorAll('.form-add input[placeholder], .form-add textarea[placeholder]').forEach((el) => {
    if (el.dataset.phWire === '1') return;
    el.dataset.phWire = '1';
    el.addEventListener('focus', () => {
      const ph = el.getAttribute('placeholder');
      if (!ph) return;
      el.dataset.phSaved = ph;
      el.removeAttribute('placeholder');
    });
    el.addEventListener('blur', () => {
      const saved = el.dataset.phSaved;
      if (!saved) return;
      const empty =
        el.tagName === 'INPUT' && el.type === 'number'
          ? el.value === '' || el.value == null
          : String(el.value ?? '').trim() === '';
      if (empty) el.setAttribute('placeholder', saved);
    });
  });
}

/**
 * 목록·추천용: 1~5면 ⭐/☆ + 점수 텍스트, 없으면 빈 문자열.
 */
function ratingVisualHtml(score) {
  const n = score != null && score !== '' ? parseInt(String(score), 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5) return '';
  const filled = '⭐'.repeat(n);
  const empty = '☆'.repeat(5 - n);
  return `<span class="list-rating" title="${n}점">${filled}${empty} <span class="muted">${n}/5</span></span>`;
}

/** 별점 4+ → 맛집, 3 이하 → 맛집 아님, 별점 없음 → DB `is_matjip`. */
function isMatjipRestaurant(r) {
  const rt = r.rating != null && r.rating !== '' ? parseInt(String(r.rating), 10) : NaN;
  if (Number.isFinite(rt) && rt >= 4) return true;
  if (Number.isFinite(rt) && rt <= 3) return false;
  return Boolean(Number(r.is_matjip));
}

/** 점심 추천 카드 왼쪽 위 맛집 인증 스탬프 (외부 이미지 없이 CSS). */
function matjipCertBadgeHtml() {
  return `<span class="matjip-cert-badge" role="img" aria-label="맛집 인증">
    <span class="matjip-cert-badge__check" aria-hidden="true">✓</span>
    <span class="matjip-cert-badge__title">맛집</span>
    <span class="matjip-cert-badge__sub">인증</span>
  </span>`;
}

/** 식당 목록·점심 추천 카드 공통 내부 마크업 (제목·도보·카테고리·주소). */
function buildListItemInnerHtml(r, opts = {}) {
  const dist = r.distance_meters != null ? `약 ${r.distance_meters}m` : '';
  const walk = r.walk_minutes != null ? `도보 약 ${r.walk_minutes}분` : '';
  const walkHtml = walk ? `<span class="title-walk">${esc(walk)}</span>` : '';
  const line2 = [r.address, dist].filter(Boolean).join(' · ');
  const src = r.source === 'naver' ? 'naver' : 'user';
  const badge =
    src === 'naver'
      ? '<span class="list-badge list-badge--naver" title="네이버 지역 검색">지도</span>'
      : '<span class="list-badge list-badge--user" title="직접 등록">직접</span>';
  const rate = ratingVisualHtml(r.rating);
  const tailStars = rate ? `<span class="title-rating-inline">${rate}</span>` : '';
  const matjipTag =
    !opts.hideMatjipTag && isMatjipRestaurant(r) ? '<span class="list-matjip-tag">맛집</span>' : '';
  return `
      <div class="list-item-inner">
        <div class="list-item-row title-row">
          <span class="title-name-block title-name--grow"><span class="title-name">${esc(r.name)}</span>${walkHtml}</span>
          <span class="title-category-rating">
            <span class="muted">${esc(r.category)}</span>${matjipTag}${tailStars}
          </span>
          <span class="title-badge-wrap">${badge}</span>
        </div>
        <div class="list-item-row sub line-ellipsis">${line2 ? esc(line2) : '\u00a0'}</div>
      </div>
    `;
}

/**
 * 별점 줄: ⭐·☆ 버튼과 숫자 입력을 맞춥니다.
 */
function setupRatingPicker(starRowId, numInputId, matjipCheckboxId) {
  const row = document.getElementById(starRowId);
  const num = document.getElementById(numInputId);
  const matjipCb = matjipCheckboxId ? document.getElementById(matjipCheckboxId) : null;

  function syncMatjipFromRating() {
    if (!matjipCb) return;
    const v = getVal();
    if (v != null && v >= 4) matjipCb.checked = true;
    else if (v != null && v <= 3) matjipCb.checked = false;
  }
  if (!row || !num) {
    return {
      setVal() {},
      redraw() {},
    };
  }

  function getVal() {
    const t = String(num.value ?? '').trim();
    if (t === '') return null;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1 || n > 5) return null;
    return n;
  }

  function redraw() {
    const v = getVal();
    row.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn';
      b.setAttribute('aria-label', `${i}점`);
      b.textContent = v != null && i <= v ? '⭐' : '☆';
      b.addEventListener('click', () => setVal(i));
      row.appendChild(b);
    }
  }

  function setVal(n) {
    num.value = n == null || n === '' ? '' : String(Math.min(5, Math.max(1, n)));
    redraw();
    syncMatjipFromRating();
  }

  num.addEventListener('input', () => {
    const t = String(num.value ?? '').trim();
    if (t === '') {
      redraw();
      return;
    }
    let n = parseInt(t, 10);
    if (Number.isFinite(n)) {
      if (n > 5) num.value = '5';
      if (n < 1) num.value = '1';
    }
    redraw();
    syncMatjipFromRating();
  });

  redraw();
  return { setVal, redraw };
}

const addRatingPicker = setupRatingPicker('addStarRow', 'addRatingNum', 'addMatjip');
const editRatingPicker = setupRatingPicker('editStarRow', 'editRatingNum', 'editMatjip');

function resolveIsMatjipForSubmit(ratingRaw, matjipChecked) {
  const r =
    ratingRaw === '' || ratingRaw == null ? null : parseInt(String(ratingRaw).trim(), 10);
  if (Number.isFinite(r) && r >= 4) return 1;
  if (Number.isFinite(r) && r <= 3) return 0;
  return matjipChecked ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 쿼리스트링 (필터·추천 조건 → 서버 req.query 와 맞추기)
// ---------------------------------------------------------------------------

/** 식당 목록 현재 페이지 (검색·페이지 변경 시 조정). */
let listPage = 1;

/** 페이지 버튼에 한 번에 보여 줄 번호 개수 (1~10, 11~20 …). */
const PAGER_WINDOW_SIZE = 10;

/** `#listPager` 에 표시 중인 첫 페이지 번호 (1, 11, 21 …). */
let listPagerWindowStart = 1;

/** 화살표만 눌렀을 때 `renderListPager` 재호출용. */
let listPagerMeta = { total: 0, page: 1, totalPages: 0 };

/** `검색` 클릭 시 DOM에서 복사해 두는 조건. `listQueryString`은 여기만 참조합니다. */
let listFilterApplied = {
  category: '',
  walk_filter: '',
  min_rating: '',
  matjip_only: false,
};

function syncAppliedListFiltersFromDom() {
  const cat = $('#filterCat');
  const dist = $('#filterDistance');
  const rate = $('#filterRating');
  const mj = $('#filterMatjipOnly');
  listFilterApplied = {
    category: cat ? String(cat.value || '') : '',
    walk_filter: dist ? String(dist.value || '') : '',
    min_rating: rate ? String(rate.value || '') : '',
    matjip_only: Boolean(mj && mj.checked),
  };
}

/**
 * 목록 API 쿼리: 마지막으로 적용된 검색 조건(`listFilterApplied`) + 페이지.
 */
function listQueryString() {
  const p = new URLSearchParams();
  const f = listFilterApplied;
  if (f.category) p.set('category', f.category);
  if (f.walk_filter) p.set('max_walk_minutes', f.walk_filter);
  if (f.min_rating) p.set('min_rating', f.min_rating);
  if (f.matjip_only) p.set('matjip_only', '1');
  p.set('page', String(listPage));
  p.set('limit', '5');
  return `?${p.toString()}`;
}

/** 오늘 점심 추천 — 별점 필터 옵션. 맛집 체크 시 4·5점만 노출. */
const PICK_RATING_OPTIONS = [
  { value: '', label: '전체 (별점 무관)' },
  { value: '1', label: '⭐ 1점 이상' },
  { value: '2', label: '⭐ 2점 이상' },
  { value: '3', label: '⭐ 3점 이상' },
  { value: '4', label: '⭐ 4점 이상' },
  { value: '5', label: '⭐ 5점' },
];

/** `#pickMatjipOnly` 에 따라 `#pickRating` 옵션을 4·5점만 / 1~5 전체로 바꿉니다. */
function syncPickRatingSelect() {
  const sel = $('#pickRating');
  if (!sel) return;
  const matjip = Boolean($('#pickMatjipOnly')?.checked);
  const prev = sel.value;
  const list = matjip
    ? PICK_RATING_OPTIONS.filter((o) => o.value === '' || o.value === '4' || o.value === '5')
    : PICK_RATING_OPTIONS;
  sel.innerHTML = list
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
    .join('');
  sel.value = list.some((o) => o.value === prev) ? prev : '';
}

/**
 * 점심 추천 API에 넘길 쿼리스트링을 만듭니다 (카테고리·거리·최소 별점).
 */
function pickQueryString() {
  const p = new URLSearchParams();
  const cat = $('#pickCat').value;
  if (cat) p.set('category', cat);
  const walkFilter = $('#pickDistance').value;
  if (walkFilter) p.set('max_walk_minutes', walkFilter);
  const minR = $('#pickRating').value;
  if (minR) p.set('min_rating', minR);
  if ($('#pickMatjipOnly').checked) p.set('matjip_only', '1');
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// 음식 종류(콤보) — 고정 목록. 서버 `FOOD_CATEGORIES`·`lib/naverImport.js` 와 동일 순서·값 유지.
// ---------------------------------------------------------------------------

/** 추천·필터·추가·수정 `<select>` 에 넣는 고정 옵션. `기타`는 항상 맨 끝. */
const FOOD_CATEGORIES = [
  "한식",
  "양식",
  "아시아음식",
  "일식",
  "중식",
  "분식",
  "치킨",
  "피자",
  "카페",
  "뷔페",
  "요리주점",
  "기타",
];

/**
 * `기타`만 맨 아래로 두고 나머지 순서는 유지합니다(고정 배열에서는 이미 `기타`가 끝).
 */
function orderCategoriesWithMiscLast(categories) {
  const rest = [];
  let hasMisc = false;
  for (const c of categories) {
    if (c === "기타") hasMisc = true;
    else rest.push(c);
  }
  return hasMisc ? [...rest, "기타"] : rest;
}

/**
 * 추천·필터·추가·수정 네 곳의 음식 종류 `<select>` 를 고정 목록으로 채웁니다.
 * (DB `/api/restaurants/categories` 는 콤보에 사용하지 않습니다.)
 */
function fillCategorySelects() {
  const categories = orderCategoriesWithMiscLast([...FOOD_CATEGORIES]);
  const pick = $("#pickCat");
  const filter = $("#filterCat");
  const addCat = $("#addCategory");
  const editCat = $("#editCategory");

  const keepPick = pick.value;
  const keepFilter = filter.value;
  const keepAdd = addCat ? addCat.value : "";
  const keepEdit = editCat ? editCat.value : "";

  pick.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
  filter.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());

  /** 추가·수정 폼용: 옵션 전체를 고정 목록으로 다시 구성합니다. */
  function rebuildFormCategorySelect(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    const list = categories.includes("기타") ? categories : [...categories, "기타"];
    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
  }
  rebuildFormCategorySelect(addCat);
  rebuildFormCategorySelect(editCat);

  categories.forEach((c) => {
    const o1 = document.createElement("option");
    o1.value = c;
    o1.textContent = c;
    pick.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = c;
    o2.textContent = c;
    filter.appendChild(o2);
  });

  if ([...pick.options].some((o) => o.value === keepPick)) pick.value = keepPick;
  if ([...filter.options].some((o) => o.value === keepFilter)) filter.value = keepFilter;
  if (addCat && [...addCat.options].some((o) => o.value === keepAdd)) addCat.value = keepAdd;
  if (editCat && [...editCat.options].some((o) => o.value === keepEdit)) editCat.value = keepEdit;
}

/**
 * 셀렉트에 없는 값(예: 예전에 쓰이다 사라진 카테고리)이면 `<option>`을 하나 추가합니다.
 */
function ensureSelectOption(selectEl, value) {
  if (!selectEl || value == null || value === '') return;
  const v = String(value).trim();
  if (!v) return;
  if ([...selectEl.options].some((o) => o.value === v)) return;
  const o = document.createElement('option');
  o.value = v;
  o.textContent = v;
  selectEl.appendChild(o);
}

/**
 * 음식 종류 콤보를 고정 목록으로 채웁니다. (서버 `/api/restaurants/categories` 호출 없음)
 */
async function loadCategories() {
  fillCategorySelects();
}

// ---------------------------------------------------------------------------
// 목록·수정·추천 UI
// ---------------------------------------------------------------------------

function alignPagerWindowToPage(page, totalPages) {
  if (totalPages < 1) {
    listPagerWindowStart = 1;
    return;
  }
  if (page < listPagerWindowStart) {
    listPagerWindowStart =
      Math.floor((page - 1) / PAGER_WINDOW_SIZE) * PAGER_WINDOW_SIZE + 1;
  } else if (page > listPagerWindowStart + PAGER_WINDOW_SIZE - 1) {
    listPagerWindowStart =
      Math.floor((page - 1) / PAGER_WINDOW_SIZE) * PAGER_WINDOW_SIZE + 1;
  }
  const maxStart = Math.max(1, totalPages - PAGER_WINDOW_SIZE + 1);
  if (listPagerWindowStart > maxStart) listPagerWindowStart = maxStart;
}

function appendPagerArrow(nav, symbol, label, disabled, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pager-btn pager-btn--arrow';
  b.textContent = symbol;
  b.setAttribute('aria-label', label);
  b.disabled = disabled;
  if (!disabled) b.addEventListener('click', onClick);
  nav.appendChild(b);
}

/**
 * 총 건수가 2페이지 이상일 때만 페이지 버튼을 그립니다.
 * 번호는 10개씩(1~10, 11~20 …), 앞뒤 화살표로 묶음 이동.
 */
function renderListPager(total, page, totalPages) {
  const nav = $('#listPager');
  if (!nav) return;
  listPagerMeta = { total, page, totalPages };
  if (total < 1 || totalPages < 2) {
    nav.innerHTML = '';
    nav.hidden = true;
    return;
  }
  alignPagerWindowToPage(page, totalPages);
  const windowEnd = Math.min(listPagerWindowStart + PAGER_WINDOW_SIZE - 1, totalPages);
  const canPrevWindow = listPagerWindowStart > 1;
  const canNextWindow = windowEnd < totalPages;

  nav.hidden = false;
  nav.innerHTML = '';

  appendPagerArrow(nav, '‹', '이전 페이지 묶음', !canPrevWindow, () => {
    listPagerWindowStart = Math.max(1, listPagerWindowStart - PAGER_WINDOW_SIZE);
    renderListPager(listPagerMeta.total, listPagerMeta.page, listPagerMeta.totalPages);
  });

  for (let p = listPagerWindowStart; p <= windowEnd; p++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pager-btn' + (p === page ? ' is-active' : '');
    b.textContent = String(p);
    b.setAttribute('aria-label', `페이지 ${p}`);
    if (p === page) b.setAttribute('aria-current', 'page');
    b.addEventListener('click', () => {
      if (p !== listPage) {
        listPage = p;
        loadList();
      }
    });
    nav.appendChild(b);
  }

  appendPagerArrow(nav, '›', '다음 페이지 묶음', !canNextWindow, () => {
    listPagerWindowStart += PAGER_WINDOW_SIZE;
    const maxStart = Math.max(1, totalPages - PAGER_WINDOW_SIZE + 1);
    if (listPagerWindowStart > maxStart) listPagerWindowStart = maxStart;
    renderListPager(listPagerMeta.total, listPagerMeta.page, listPagerMeta.totalPages);
  });
}

/**
 * 필터 조건에 맞는 식당 목록(페이지당 5건)을 받아 `<ul id="list">`를 다시 그립니다.
 * 각 카드는 고정 높이이며 긴 글은 한 줄 말줄임(`…`)입니다.
 */
async function loadList() {
  const data = await fetchJSON(`/api/restaurants${listQueryString()}`);
  const rows = Array.isArray(data.items) ? data.items : [];
  const total = Number(data.total ?? 0);
  const page = Number(data.page ?? listPage);
  const totalPages = Number(data.totalPages ?? 0);

  if (rows.length === 0 && total > 0 && listPage > 1) {
    listPage = Math.max(1, totalPages);
    await loadList();
    return;
  }

  listPage = page;

  const ul = $('#list');
  const empty = $('#empty');
  let countText =
    total === 0
      ? '총 0곳'
      : `총 ${total}곳 (${page}/${Math.max(totalPages, 1)}페이지)`;
  $('#count').textContent = countText;

  ul.innerHTML = '';
  renderListPager(total, page, totalPages);

  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const r of rows) {
    const li = document.createElement('li');
    const isMatjip = isMatjipRestaurant(r);
    li.className = isMatjip ? 'list-item-clickable list-item--matjip' : 'list-item-clickable';
    li.tabIndex = 0;
    li.dataset.id = String(r.id);
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `${r.name} 수정`);
    li.innerHTML = (isMatjip ? matjipCertBadgeHtml() : '') + buildListItemInnerHtml(r, { hideMatjipTag: isMatjip });
    bindListItemOpen(li, r.id);
    ul.appendChild(li);
  }
}

/**
 * 한 건을 GET으로 불러와 수정 폼에 채우고 수정 화면으로 전환합니다.
 */
async function openEdit(id) {
  const r = await fetchJSON(`/api/restaurants/${id}`);
  $('#editId').value = String(r.id);
  $('#editName').value = r.name ?? '';
  const editSel = $('#editCategory');
  const cat = r.category != null ? String(r.category).trim() : '';
  ensureSelectOption(editSel, cat);
  editSel.value = cat || '기타';
  $('#editAddress').value = r.address ?? '';
  $('#editWalk').value = r.walk_minutes != null && r.walk_minutes !== '' ? String(r.walk_minutes) : '';
  $('#editMemo').value = r.memo ?? '';
  const rt = r.rating != null && r.rating !== '' ? parseInt(String(r.rating), 10) : null;
  editRatingPicker.setVal(Number.isFinite(rt) && rt >= 1 && rt <= 5 ? rt : null);
  $('#editMatjip').checked = isMatjipRestaurant(r);
  const geoHint = $('#editGeoHint');
  if (geoHint) {
    const ref = r.reference_location;
    const hasPlace = r.latitude != null && r.longitude != null;
    const hasDist = r.distance_meters != null;
    if (ref && ref.latitude != null && ref.longitude != null && (hasPlace || hasDist)) {
      let t = `기준점(내 위치·.env): 위 ${Number(ref.latitude).toFixed(5)}, 경 ${Number(ref.longitude).toFixed(5)}.`;
      if (hasPlace) {
        t += ` 이 식당: 위 ${Number(r.latitude).toFixed(5)}, 경 ${Number(r.longitude).toFixed(5)}.`;
      }
      if (hasDist) {
        t += ` 직선 약 ${r.distance_meters}m.`;
      }
      geoHint.textContent = t;
      geoHint.hidden = false;
    } else {
      geoHint.textContent = '';
      geoHint.hidden = true;
    }
  }
  showEdit();
}

function bindListItemOpen(li, id) {
  const open = () => openEdit(id);
  li.addEventListener('click', open);
  li.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      open();
    }
  });
}

/**
 * 추천 API 결과 한 건을 `#pickResult` 영역에 표시합니다 (식당 목록과 같은 박스·카드).
 */
function showPick(r) {
  const box = $('#pickResult');
  const isMatjip = isMatjipRestaurant(r);
  const matjipCert = isMatjip ? matjipCertBadgeHtml() : '';
  const cardClass = isMatjip
    ? 'list-item-clickable pick-result-card list-item--matjip'
    : 'list-item-clickable pick-result-card';
  box.hidden = false;
  box.innerHTML = `
    <div class="list-browse-panel pick-result-panel">
      <ul class="list pick-result-list">
        <li class="${cardClass}" data-id="${esc(String(r.id))}" role="button" tabindex="0" aria-label="${esc(r.name)} 수정">
          ${matjipCert}
          ${buildListItemInnerHtml(r, { hideMatjipTag: isMatjip })}
        </li>
      </ul>
    </div>
  `;
  const li = box.querySelector('.pick-result-card');
  if (li && r.id != null) bindListItemOpen(li, r.id);
}

/**
 * 추천 버튼 동작: pick API 호출 후 성공 시 `showPick`, 실패 시 에러 메시지 표시.
 */
async function doPick() {
  try {
    const r = await fetchJSON(`/api/restaurants/pick${pickQueryString()}`);
    showPick(r);
  } catch (e) {
    const box = $('#pickResult');
    box.hidden = false;
    box.innerHTML = `
      <div class="list-browse-panel pick-result-panel">
        <p class="muted empty-msg--panel">${esc(e.message)}</p>
      </div>
    `;
  }
}

// ---------------------------------------------------------------------------
// 화면 전환 (라우팅 대신 div 표시/숨김)
// ---------------------------------------------------------------------------

/**
 * 홈 화면만 보이게 합니다. URL은 바꾸지 않고 `#viewHome` 등에 `.hidden`을 토글합니다.
 */
function showHome() {
  $('#viewHome').classList.remove('hidden');
  $('#viewAdd').classList.add('hidden');
  $('#viewEdit').classList.add('hidden');
}

/** 맛집 추가 화면만 표시합니다. */
function showAdd() {
  $('#viewHome').classList.add('hidden');
  $('#viewEdit').classList.add('hidden');
  $('#viewAdd').classList.remove('hidden');
  addRatingPicker.setVal(null);
  const am = $('#addMatjip');
  if (am) am.checked = false;
}

/** 맛집 수정 화면만 표시합니다. */
function showEdit() {
  $('#viewHome').classList.add('hidden');
  $('#viewAdd').classList.add('hidden');
  $('#viewEdit').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// 이벤트 연결 — DOM 노드에 `addEventListener`로 콜백을 붙입니다.
// ---------------------------------------------------------------------------

const SYNC_MSG_LOADING = '주변 식당 받는 중…';
const SYNC_MSG_DONE = '최신화 완료';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 주변 식당 최신화 중 전체 화면 로딩(스크롤·클릭 차단). */
function showSyncLoading() {
  const el = $('#syncLoadingOverlay');
  const msg = $('#syncLoadingMsg');
  const dots = $('#syncLoadingDots');
  if (!el) return;
  el.classList.remove('sync-loading-overlay--done');
  if (msg) msg.textContent = SYNC_MSG_LOADING;
  if (dots) dots.hidden = false;
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('aria-busy', 'true');
  document.body.classList.add('sync-loading-active');
}

function showSyncLoadingComplete() {
  const el = $('#syncLoadingOverlay');
  const msg = $('#syncLoadingMsg');
  const dots = $('#syncLoadingDots');
  if (el) {
    el.classList.add('sync-loading-overlay--done');
    el.setAttribute('aria-busy', 'false');
  }
  if (msg) msg.textContent = SYNC_MSG_DONE;
  if (dots) dots.hidden = true;
}

function hideSyncLoading() {
  const el = $('#syncLoadingOverlay');
  const msg = $('#syncLoadingMsg');
  const dots = $('#syncLoadingDots');
  if (!el) return;
  el.classList.remove('sync-loading-overlay--done');
  if (msg) msg.textContent = SYNC_MSG_LOADING;
  if (dots) dots.hidden = false;
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('aria-busy', 'false');
  document.body.classList.remove('sync-loading-active');
}

/**
 * 네이버 지역 검색으로 새 식당만 추가합니다. 이름+좌표가 같으면 기존 데이터는 그대로 둡니다.
 * 서버의 `POST /api/restaurants/sync-naver` 가 `.env` 의 NAVER_* 와 NAVER_IMPORT_QUERIES 를 사용합니다.
 */
async function syncNaverFromWeb() {
  const btn = $('#btnSyncNaver');
  if (btn?.disabled) return;
  showSyncLoading();
  if (btn) btn.disabled = true;
  try {
    await fetchJSON('/api/restaurants/sync-naver', { method: 'POST' });
    showSyncLoadingComplete();
    await Promise.all([loadCategories(), loadList(), sleep(1000)]);
  } catch (e) {
    alert(e.message);
  } finally {
    hideSyncLoading();
    if (btn) btn.disabled = false;
  }
}

$('#btnPick').addEventListener('click', doPick);
const pickMatjipOnlyEl = $('#pickMatjipOnly');
if (pickMatjipOnlyEl) pickMatjipOnlyEl.addEventListener('change', syncPickRatingSelect);
$('#btnGoList').addEventListener('click', async () => {
  const block = $('#homeListBlock');
  const btn = $('#btnGoList');
  if (!block || !btn) return;
  if (block.hidden) {
    block.hidden = false;
    btn.textContent = '닫기';
    btn.classList.remove('btn-blue');
    btn.classList.add('danger');
    try {
      await loadList();
    } catch (e) {
      alert(e.message);
    }
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    block.hidden = true;
    btn.textContent = '식당 목록 및 추가';
    btn.classList.remove('danger');
    btn.classList.add('btn-blue');
  }
});
$('#btnListSearch').addEventListener('click', async () => {
  listPage = 1;
  listPagerWindowStart = 1;
  syncAppliedListFiltersFromDom();
  try {
    await loadList();
  } catch (e) {
    alert(e.message);
  }
});
$('#btnSyncNaver').addEventListener('click', syncNaverFromWeb);
$('#btnOpenAdd').addEventListener('click', showAdd);
$('#btnAddBack').addEventListener('click', showHome);
$('#btnEditBack').addEventListener('click', showHome);

/**
 * 맛집 추가 폼 제출: POST /api/restaurants, 성공 시 폼 리셋·카테고리·목록 갱신·홈으로.
 *
 * [문법] `ev.preventDefault()`는 폼 기본 제출(페이지 새로고침)을 막습니다.
 * `FormData`는 필드 이름→값을 읽는 브라우저 내장 객체이며, `fd.get('name')`은 첫 번째 `name` 입력값입니다.
 */
$('#formAdd').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const body = {
    name: fd.get('name'),
    category: fd.get('category') || '기타',
    address: fd.get('address') || '',
    walk_minutes: fd.get('walk_minutes'),
    memo: fd.get('memo') || '',
    rating: (() => {
      const v = fd.get('rating');
      return v === '' || v == null ? null : v;
    })(),
    is_matjip: resolveIsMatjipForSubmit(fd.get('rating'), fd.get('is_matjip') === '1'),
  };
  try {
    await fetchJSON('/api/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    ev.target.reset();
    const ac = $('#addCategory');
    if (ac && [...ac.options].some((o) => o.value === '기타')) ac.value = '기타';
    addRatingPicker.setVal(null);
    const am = $('#addMatjip');
    if (am) am.checked = false;
    listPage = 1;
    listPagerWindowStart = 1;
    await loadCategories();
    await loadList();
    showHome();
  } catch (e) {
    alert(e.message);
  }
});

/**
 * 맛집 수정 폼 제출: PUT /api/restaurants/:id 후 목록·카테고리 갱신.
 */
$('#formEdit').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const id = fd.get('id');
  const body = {
    name: fd.get('name'),
    category: fd.get('category') || '기타',
    address: fd.get('address') || '',
    walk_minutes: fd.get('walk_minutes'),
    memo: fd.get('memo') || '',
    rating: (() => {
      const v = fd.get('rating');
      return v === '' || v == null ? null : v;
    })(),
    is_matjip: resolveIsMatjipForSubmit(fd.get('rating'), fd.get('is_matjip') === '1'),
  };
  try {
    await fetchJSON(`/api/restaurants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await loadCategories();
    await loadList();
    showHome();
  } catch (e) {
    alert(e.message);
  }
});

/**
 * 수정 화면에서 한 건 삭제: `DELETE /api/restaurants/:id` 후 목록 갱신·홈으로.
 */
$('#btnEditDelete').addEventListener('click', async () => {
  const id = $('#editId').value?.trim();
  if (!id) return;
  if (!confirm('이 맛집을 DB에서 삭제할까요? 되돌릴 수 없습니다.')) return;
  const btn = $('#btnEditDelete');
  btn.disabled = true;
  try {
    await fetchJSON(`/api/restaurants/${id}`, { method: 'DELETE' });
    await loadCategories();
    await loadList();
    showHome();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
  }
});

/**
 * 페이지가 로드되자마자 한 번 실행되는 초기화(IIFE).
 * DB 헬스 체크 후 카테고리·목록을 불러옵니다.
 *
 * [문법] `(async function init() { ... })();` 는 “정의하자마자 호출”하는 즉시 실행 함수(IIFE)입니다.
 */
(async function init() {
  setupFormPlaceholders();
  try {
    const h = await fetchJSON('/api/health');
    $('#dbStatus').textContent = h.db ? 'DB 연결됨' : 'DB 오류';
    $('#dbStatus').className = h.db ? 'muted ok' : 'muted err';
  } catch {
    $('#dbStatus').textContent = '서버에 연결할 수 없습니다';
    $('#dbStatus').className = 'muted err';
  }

  try {
    await loadCategories();
    syncPickRatingSelect();
    syncAppliedListFiltersFromDom();
    await loadList();
  } catch (e) {
    $('#empty').hidden = false;
    $('#empty').textContent = `목록을 불러오지 못했습니다: ${e.message}`;
  }
})();
