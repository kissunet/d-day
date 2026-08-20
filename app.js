/**
 * D-Day Master - App Logic
 * 20년차 개발자의 견고한 아키텍처로 작성된 디데이 관리 및 PWA 앱 지원 엔진
 */

// 1. 초기 상태 및 글로벌 데이터
const STORAGE_KEY = 'dday_master_data_v1';
const STORAGE_CAT_KEY = 'dday_master_categories_v1';
const THEME_KEY = 'dday_master_theme';

// 기본 카테고리 정의
const DEFAULT_CATEGORIES = [
  { id: 'couple', label: '커플/연애', icon: 'fa-heart', color: '#ec4899', isDefault: true },
  { id: 'birthday', label: '생일/기념일', icon: 'fa-cake-candles', color: '#f59e0b', isDefault: true },
  { id: 'exam', label: '시험/자격증', icon: 'fa-graduation-cap', color: '#8b5cf6', isDefault: true },
  { id: 'travel', label: '여행/휴가', icon: 'fa-plane', color: '#3b82f6', isDefault: true },
  { id: 'work', label: '업무/프로젝트', icon: 'fa-briefcase', color: '#10b981', isDefault: true },
  { id: 'goal', label: '목표/습관', icon: 'fa-bullseye', color: '#ef4444', isDefault: true },
  { id: 'other', label: '기타', icon: 'fa-star', color: '#64748b', isDefault: true }
];

// 카테고리 아이콘 피커 옵션 목록
const ICON_OPTIONS = [
  'fa-heart', 'fa-cake-candles', 'fa-graduation-cap', 'fa-plane',
  'fa-briefcase', 'fa-bullseye', 'fa-star', 'fa-dumbbell',
  'fa-book', 'fa-music', 'fa-gamepad', 'fa-cart-shopping',
  'fa-house', 'fa-car', 'fa-stethoscope', 'fa-coins',
  'fa-lightbulb', 'fa-ring', 'fa-baby', 'fa-utensils'
];

let state = {
  ddays: [],
  categories: [],
  currentFilter: 'all',
  currentSort: 'pinned',
  searchQuery: '',
  viewMode: 'grid',
  theme: 'dark',
  activeDetailId: null,
  activeMilestoneTab: 'months'
};

let deferredPrompt = null; // PWA 설치 프롬프트 보관용

function getCategoryInfo(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (cat) return cat;
  return state.categories.find(c => c.id === 'other') || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
}

// 샘플 디데이 데이터 (처음 접속 시 제공)
const INITIAL_SAMPLES = [
  {
    id: 'sample-1',
    title: '❤️ 우리 연애 시작한 날',
    calcType: 'count',
    category: 'couple',
    targetDate: getPastDateString(150),
    targetTime: '00:00',
    color: '#ec4899',
    isPinned: true,
    memo: '평생 서로를 보듬어주기로 약속한 소중한 첫 만남의 순간입니다.',
    createdAt: Date.now() - 10000
  },
  {
    id: 'sample-2',
    title: '✈️ 발리 힐링 휴가 출발!',
    calcType: 'dday',
    category: 'travel',
    targetDate: getFutureDateString(45),
    targetTime: '09:30',
    color: '#3b82f6',
    isPinned: false,
    memo: '비행기 표 예매 완료! 리조트 예약 및 수영복 챙기기.',
    createdAt: Date.now() - 5000
  },
  {
    id: 'sample-3',
    title: '🎓 정보처리기사 실기 시험',
    calcType: 'dday',
    category: 'exam',
    targetDate: getFutureDateString(18),
    targetTime: '10:00',
    color: '#8b5cf6',
    isPinned: false,
    memo: '매일 2시간씩 기출문제 풀기 및 알고리즘 복습!',
    createdAt: Date.now()
  }
];

function getPastDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function getFutureDateString(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// 2. 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadCategories();
  loadData();
  bindEvents();
  renderIconPicker();
  renderCategoryChips();
  renderCategorySelectOptions();
  render();
  startRealtimeTimer();
  initPWA();
});

// 테마 초기화
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  state.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.querySelector('#themeToggleBtn i');
  if (icon) {
    icon.className = state.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
}

// 카테고리 로컬 스토리지 로드 / 저장
function loadCategories() {
  const json = localStorage.getItem(STORAGE_CAT_KEY);
  if (json) {
    try {
      state.categories = JSON.parse(json);
    } catch (e) {
      console.error('카테고리 데이터 파싱 오류', e);
      state.categories = [...DEFAULT_CATEGORIES];
    }
  } else {
    state.categories = [...DEFAULT_CATEGORIES];
    saveCategories();
  }
}

function saveCategories() {
  localStorage.setItem(STORAGE_CAT_KEY, JSON.stringify(state.categories));
}

// 로컬 스토리지 데이터 로드
function loadData() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (json) {
    try {
      state.ddays = JSON.parse(json);
    } catch (e) {
      console.error('데이터 파싱 오류', e);
      state.ddays = [...INITIAL_SAMPLES];
    }
  } else {
    state.ddays = [...INITIAL_SAMPLES];
    saveData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ddays));
}

// 3. PWA 서비스 워커 및 설치 관리 엔진
function initPWA() {
  // file:// 로컬 직접 실행 환경 처리 (CORS 및 Service Worker 미지원 프로토콜 예방)
  if (!window.location.protocol.startsWith('http')) {
    console.log('[PWA] file:// 프로토콜 로컬 실행 모드입니다. (Service Worker 및 PWA 앱 설치 기능은 웹 서버 환경에서 활성화됩니다)');
    return;
  }

  // HTTP/HTTPS 환경일 경우 동적으로 manifest.json 로드
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = 'manifest.json';
  document.head.appendChild(manifestLink);

  // Service Worker 등록
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
        .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
    });
  }

  // PWA 설치 가능 가능 이벤트 (beforeinstallprompt)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    if (pwaInstallBtn) {
      pwaInstallBtn.style.display = 'inline-flex';
    }

    const pwaBanner = document.getElementById('pwaBanner');
    if (pwaBanner && !localStorage.getItem('pwa_banner_closed')) {
      pwaBanner.style.display = 'flex';
    }
  });

  // 이미 독립형 앱으로 동작 중인지 감지
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) {
    console.log('[PWA] Running as standalone App');
    const pwaBanner = document.getElementById('pwaBanner');
    if (pwaBanner) pwaBanner.style.display = 'none';
  }
}

// 4. 날짜 및 디데이 계산 심장부
function calculateDDayInfo(item) {
  const now = new Date();
  
  const [year, month, day] = item.targetDate.split('-').map(Number);
  const [hour, minute] = (item.targetTime || '00:00').split(':').map(Number);
  
  const targetDateObj = new Date(year, month - 1, day, hour, minute, 0);
  
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(year, month - 1, day);
  
  const diffTime = targetMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  let displayText = '';
  let subText = '';
  
  if (item.calcType === 'count') {
    const countDays = -diffDays + 1;
    if (countDays > 0) {
      displayText = `${countDays}일째`;
      subText = `D+${countDays - 1}`;
    } else {
      displayText = `시작 D${diffDays}`;
      subText = `시작 전`;
    }
  } else {
    if (diffDays === 0) {
      displayText = 'D-DAY';
      subText = '오늘이 바로 그 날!';
    } else if (diffDays > 0) {
      displayText = `D-${diffDays}`;
      subText = `${diffDays}일 남음`;
    } else {
      displayText = `D+${Math.abs(diffDays)}`;
      subText = `${Math.abs(diffDays)}일 지남`;
    }
  }
  
  return {
    diffDays,
    displayText,
    subText,
    targetDateObj
  };
}

function calculateRealtimeCountdown(targetDateObj) {
  const now = new Date();
  const diffMs = targetDateObj.getTime() - now.getTime();
  
  const isPast = diffMs < 0;
  const absMs = Math.abs(diffMs);
  
  const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absMs % (1000 * 60)) / 1000);
  
  return {
    isPast,
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0')
  };
}

// 5. 1~12개월 및 주요 마일스톤 자동 계산 엔진
function generateMilestones(item) {
  const [year, month, day] = item.targetDate.split('-').map(Number);
  const startDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const milestones = {
    months: [],
    hundreds: [],
    years: []
  };

  const getMilestoneInfo = (mDate, title) => {
    const timeDiff = mDate.getTime() - today.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    let statusText = '';
    let isPassed = false;
    let isToday = false;

    if (daysDiff === 0) {
      statusText = '❤️ 오늘!';
      isToday = true;
    } else if (daysDiff > 0) {
      statusText = `D-${daysDiff}`;
    } else {
      statusText = `완료 (D+${Math.abs(daysDiff)})`;
      isPassed = true;
    }

    const y = mDate.getFullYear();
    const m = String(mDate.getMonth() + 1).padStart(2, '0');
    const d = String(mDate.getDate()).padStart(2, '0');
    const dateStr = `${y}.${m}.${d}`;

    return {
      title,
      dateStr,
      statusText,
      daysDiff,
      isPassed,
      isToday
    };
  };

  // 1달 ~ 12달 (1개월~12개월) 기념일
  for (let m = 1; m <= 12; m++) {
    const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, startDate.getDate());
    milestones.months.push(getMilestoneInfo(mDate, `${m}개월 기념일`));
  }

  // 100일 단위 기념일 (100일~1000일)
  const hundredSteps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  hundredSteps.forEach(h => {
    const hDate = new Date(startDate);
    hDate.setDate(hDate.getDate() + (h - 1));
    milestones.hundreds.push(getMilestoneInfo(hDate, `${h}일 기념일`));
  });

  // 주년 단위 기념일 (1년~10년)
  for (let y = 1; y <= 10; y++) {
    const yDate = new Date(startDate.getFullYear() + y, startDate.getMonth(), startDate.getDate());
    milestones.years.push(getMilestoneInfo(yDate, `${y}주년`));
  }

  return milestones;
}

// 6. DOM 렌더링 함수
function render() {
  renderFilteredList();
}

function renderFilteredList() {
  let list = [...state.ddays];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.memo && item.memo.toLowerCase().includes(q))
    );
  }

  if (state.currentFilter !== 'all') {
    list = list.filter(item => item.category === state.currentFilter);
  }

  list.sort((a, b) => {
    if (state.currentSort === 'pinned') {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      return a.createdAt - b.createdAt;
    } else if (state.currentSort === 'upcoming') {
      const infoA = calculateDDayInfo(a);
      const infoB = calculateDDayInfo(b);
      return infoA.diffDays - infoB.diffDays;
    } else if (state.currentSort === 'recent') {
      return b.createdAt - a.createdAt;
    } else if (state.currentSort === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const pinnedList = list.filter(item => item.isPinned);
  const pinnedSection = document.getElementById('pinnedSection');
  const pinnedContainer = document.getElementById('pinnedCardContainer');

  if (pinnedList.length > 0) {
    pinnedSection.style.display = 'block';
    pinnedContainer.innerHTML = pinnedList.map(item => createPinnedCardHTML(item)).join('');
  } else {
    pinnedSection.style.display = 'none';
  }

  const gridContainer = document.getElementById('ddayGrid');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('ddayCountBadge');

  countBadge.textContent = list.length;

  if (list.length === 0) {
    gridContainer.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    gridContainer.style.display = 'grid';
    emptyState.style.display = 'none';
    gridContainer.innerHTML = list.map(item => createCardHTML(item)).join('');
  }

  if (state.viewMode === 'list') {
    gridContainer.classList.add('list-mode');
  } else {
    gridContainer.classList.remove('list-mode');
  }
}

function createPinnedCardHTML(item) {
  const info = calculateDDayInfo(item);
  const cat = getCategoryInfo(item.category);

  return `
    <div class="pinned-card" onclick="openDetailModal('${item.id}')" style="--primary-accent: ${item.color};">
      <div class="pinned-info">
        <span class="card-category"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>
        <h2>${escapeHTML(item.title)}</h2>
        <p><i class="fa-regular fa-calendar"></i> 기준일: ${item.targetDate} ${item.targetTime || ''}</p>
      </div>
      <div class="pinned-dday-large">
        ${info.displayText}
      </div>
    </div>
  `;
}

function createCardHTML(item) {
  const info = calculateDDayInfo(item);
  const cat = getCategoryInfo(item.category);

  return `
    <div class="dday-card" onclick="openDetailModal('${item.id}')" style="--stripe-color: ${item.color};">
      <div class="card-color-stripe"></div>
      <div class="card-top">
        <span class="card-category"><i class="fa-solid ${cat.icon}"></i> ${cat.label}</span>
        ${item.isPinned ? '<span class="card-pin-icon"><i class="fa-solid fa-thumbtack"></i></span>' : ''}
      </div>
      <div class="card-body">
        <h3>${escapeHTML(item.title)}</h3>
        <div class="card-date"><i class="fa-regular fa-clock"></i> ${item.targetDate}</div>
      </div>
      <div class="card-footer">
        <div class="dday-number">${info.displayText}</div>
        <div class="realtime-preview">${info.subText}</div>
      </div>
    </div>
  `;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// 카테고리 UI 동적 렌더링 함수들
function renderCategoryChips() {
  const container = document.getElementById('categoryChips');
  if (!container) return;

  const chipsHTML = [
    `<button class="chip ${state.currentFilter === 'all' ? 'active' : ''}" data-category="all">전체</button>`
  ];

  state.categories.forEach(cat => {
    const isActive = state.currentFilter === cat.id ? 'active' : '';
    chipsHTML.push(`
      <button class="chip ${isActive}" data-category="${cat.id}">
        <i class="fa-solid ${cat.icon}"></i> ${escapeHTML(cat.label)}
      </button>
    `);
  });

  chipsHTML.push(`
    <button class="chip chip-manage" id="manageCategoriesBtn" title="카테고리 관리">
      <i class="fa-solid fa-gear"></i> 관리
    </button>
  `);

  container.innerHTML = chipsHTML.join('');
}

function renderCategorySelectOptions() {
  const select = document.getElementById('formCategory');
  if (!select) return;

  select.innerHTML = state.categories.map(cat => `
    <option value="${cat.id}">&#127991; ${escapeHTML(cat.label)}</option>
  `).join('');
}

function renderIconPicker() {
  const picker = document.getElementById('catIconPicker');
  if (!picker) return;

  const currentIcon = document.getElementById('catIcon').value || 'fa-star';

  picker.innerHTML = ICON_OPTIONS.map(icon => `
    <button type="button" class="icon-option ${icon === currentIcon ? 'selected' : ''}" data-icon="${icon}">
      <i class="fa-solid ${icon}"></i>
    </button>
  `).join('');
}

function renderCategoryManageList() {
  const listEl = document.getElementById('categoryManageList');
  if (!listEl) return;

  if (state.categories.length === 0) {
    listEl.innerHTML = '<p style="font-size:13px; text-align:center; padding: 10px; color: var(--text-dim);">등록된 카테고리가 없습니다.</p>';
    return;
  }

  listEl.innerHTML = state.categories.map(cat => {
    const count = state.ddays.filter(d => d.category === cat.id).length;
    const isOther = cat.id === 'other';

    return `
      <div class="category-item">
        <div class="category-item-info">
          <span class="category-badge-preview" style="background-color: ${cat.color}22; color: ${cat.color};">
            <i class="fa-solid ${cat.icon}"></i> ${escapeHTML(cat.label)}
          </span>
          <span class="cat-dday-count">디데이 ${count}개</span>
        </div>
        <div class="category-item-actions">
          <button type="button" class="cat-action-btn edit-btn" onclick="editCategory('${cat.id}')" title="수정">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${!isOther ? `
            <button type="button" class="cat-action-btn delete-btn" onclick="deleteCategory('${cat.id}')" title="삭제">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function resetCategoryForm() {
  document.getElementById('catId').value = '';
  document.getElementById('catName').value = '';
  document.getElementById('catFormTitle').innerHTML = `<i class="fa-solid fa-plus"></i> 새 카테고리 추가`;
  document.getElementById('catIcon').value = 'fa-star';
  document.getElementById('cancelCatBtn').style.display = 'none';

  const defaultColorRadio = document.querySelector('#catColorPicker input[value="#ec4899"]');
  if (defaultColorRadio) defaultColorRadio.checked = true;

  renderIconPicker();
}

function editCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('catId').value = cat.id;
  document.getElementById('catName').value = cat.label;
  document.getElementById('catFormTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> 카테고리 수정`;
  document.getElementById('catIcon').value = cat.icon;
  document.getElementById('cancelCatBtn').style.display = 'inline-flex';

  const colorRadio = document.querySelector(`#catColorPicker input[value="${cat.color}"]`);
  if (colorRadio) colorRadio.checked = true;

  renderIconPicker();
}

function deleteCategory(catId) {
  if (catId === 'other') {
    alert('기타 카테고리는 삭제할 수 없습니다.');
    return;
  }

  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  const count = state.ddays.filter(d => d.category === catId).length;
  let confirmMsg = `'${cat.label}' 카테고리를 삭제하시겠습니까?`;
  if (count > 0) {
    confirmMsg += `\n(해당 카테고리의 디데이 ${count}개는 '기타' 카테고리로 변경됩니다.)`;
  }

  if (confirm(confirmMsg)) {
    state.ddays.forEach(d => {
      if (d.category === catId) {
        d.category = 'other';
      }
    });

    state.categories = state.categories.filter(c => c.id !== catId);

    if (state.currentFilter === catId) {
      state.currentFilter = 'all';
    }

    saveCategories();
    saveData();
    renderCategoryChips();
    renderCategorySelectOptions();
    renderCategoryManageList();
    renderFilteredList();
    resetCategoryForm();
  }
}

// 7. 실시간 카운트다운 타이머 인터벌
let realtimeInterval = null;

function startRealtimeTimer() {
  if (realtimeInterval) clearInterval(realtimeInterval);
  realtimeInterval = setInterval(() => {
    if (state.activeDetailId) {
      updateDetailTimer();
    }
  }, 1000);
}

function updateDetailTimer() {
  const item = state.ddays.find(d => d.id === state.activeDetailId);
  if (!item) return;

  const info = calculateDDayInfo(item);
  const countdown = calculateRealtimeCountdown(info.targetDateObj);

  document.getElementById('dtDays').textContent = countdown.days;
  document.getElementById('dtHours').textContent = countdown.hours;
  document.getElementById('dtMinutes').textContent = countdown.minutes;
  document.getElementById('dtSeconds').textContent = countdown.seconds;
}

// 8. 상세 모달 및 마일스톤 탭 렌더링
function openDetailModal(id) {
  const item = state.ddays.find(d => d.id === id);
  if (!item) return;

  state.activeDetailId = id;
  const info = calculateDDayInfo(item);
  const cat = getCategoryInfo(item.category);

  document.getElementById('detailCategoryTag').innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.label}`;
  document.getElementById('detailCategoryTag').style.backgroundColor = item.color + '22';
  document.getElementById('detailCategoryTag').style.color = item.color;
  
  document.getElementById('detailTitle').textContent = item.title;
  document.getElementById('detailDdayNumber').textContent = info.displayText;
  document.getElementById('detailDdayNumber').style.color = item.color;
  document.getElementById('detailTargetDateText').textContent = `기준 날짜: ${item.targetDate} (${item.calcType === 'count' ? '1일부터 세기' : '목표일 기준'})`;

  const memoBox = document.getElementById('detailMemoBox');
  const memoText = document.getElementById('detailMemoText');
  if (item.memo && item.memo.trim()) {
    memoBox.style.display = 'block';
    memoText.textContent = item.memo;
  } else {
    memoBox.style.display = 'none';
  }

  updateDetailTimer();
  renderMilestones(item);
  document.getElementById('detailModal').classList.add('active');
}

function renderMilestones(item) {
  const milestones = generateMilestones(item);
  const grid = document.getElementById('milestoneGrid');
  const currentTab = state.activeMilestoneTab;

  const list = milestones[currentTab] || [];

  grid.innerHTML = list.map(m => `
    <div class="milestone-item ${m.isPassed ? 'passed' : ''} ${m.isToday ? 'today' : ''}">
      <span class="milestone-title">${m.title}</span>
      <span class="milestone-date"><i class="fa-regular fa-calendar"></i> ${m.dateStr}</span>
      <span class="milestone-dday">${m.statusText}</span>
    </div>
  `).join('');
}

// 9. 모달 조작 및 카드 이미지 캡처
function openAddModal() {
  document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-calendar-plus"></i> 새 디데이 등록`;
  document.getElementById('ddayForm').reset();
  document.getElementById('ddayId').value = '';
  document.getElementById('formTargetDate').value = getFutureDateString(7);
  renderCategorySelectOptions();
  document.getElementById('ddayFormModal').classList.add('active');
}

function openEditModal(id) {
  const item = state.ddays.find(d => d.id === id);
  if (!item) return;

  renderCategorySelectOptions();
  document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> 디데이 수정`;
  document.getElementById('ddayId').value = item.id;
  document.getElementById('formTitle').value = item.title;
  document.getElementById('formCalcType').value = item.calcType;
  document.getElementById('formCategory').value = item.category;
  document.getElementById('formTargetDate').value = item.targetDate;
  document.getElementById('formTargetTime').value = item.targetTime || '00:00';
  document.getElementById('formIsPinned').checked = !!item.isPinned;
  document.getElementById('formMemo').value = item.memo || '';

  const colorRadio = document.querySelector(`input[name="cardColor"][value="${item.color}"]`);
  if (colorRadio) colorRadio.checked = true;

  document.getElementById('detailModal').classList.remove('active');
  document.getElementById('ddayFormModal').classList.add('active');
}

function generateCardImage() {
  const item = state.ddays.find(d => d.id === state.activeDetailId);
  if (!item) return;

  const info = calculateDDayInfo(item);
  const cat = getCategoryInfo(item.category);

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 600, 400);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 600, 400);

  ctx.fillStyle = item.color;
  ctx.fillRect(0, 0, 600, 8);

  ctx.fillStyle = item.color;
  ctx.font = 'bold 16px "Outfit", sans-serif';
  ctx.fillText(`[ ${cat.label} ]`, 40, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Outfit", sans-serif';
  ctx.fillText(item.title, 40, 95);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px "Outfit", sans-serif';
  ctx.fillText(`기준일: ${item.targetDate}`, 40, 130);

  ctx.fillStyle = item.color;
  ctx.font = 'extrabold 72px "Outfit", sans-serif';
  ctx.fillText(info.displayText, 40, 230);

  if (item.memo) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 16px "Outfit", sans-serif';
    ctx.fillText(`"${item.memo.slice(0, 35)}${item.memo.length > 35 ? '...' : ''}"`, 40, 310);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px "Outfit", sans-serif';
  ctx.fillText('D-Day Master | Smart Count & Milestones', 40, 365);

  const dataURL = canvas.toDataURL('image/png');
  const container = document.getElementById('canvasContainer');
  container.innerHTML = `<img src="${dataURL}" style="max-width:100%; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.5);" alt="Card Image">`;

  const dlBtn = document.getElementById('downloadCardImgBtn');
  dlBtn.href = dataURL;
  dlBtn.download = `${item.title}_dday.png`;

  document.getElementById('detailModal').classList.remove('active');
  document.getElementById('shareModal').classList.add('active');
}

// 10. 이벤트 리스너 바인딩
function bindEvents() {
  // PWA 설치 버튼 클릭
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        alert('이 브라우저/기기에서는 [홈 화면에 추가] 또는 브라우저 주소창 우측의 [앱 설치] 아이콘을 눌러 직접 설치할 수 있습니다.');
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Install prompt outcome: ${outcome}`);
      deferredPrompt = null;
      pwaInstallBtn.style.display = 'none';
    });
  }

  // PWA 안내 배너 닫기
  const closePwaBannerBtn = document.getElementById('closePwaBannerBtn');
  if (closePwaBannerBtn) {
    closePwaBannerBtn.addEventListener('click', () => {
      document.getElementById('pwaBanner').style.display = 'none';
      localStorage.setItem('pwa_banner_closed', 'true');
    });
  }

  // 테마 토글
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem(THEME_KEY, state.theme);
    updateThemeIcon();
  });

  // 검색
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderFilteredList();
  });

  // 카테고리 칩 선택 & 관리 버튼 클릭
  document.getElementById('categoryChips').addEventListener('click', (e) => {
    const manageBtn = e.target.closest('#manageCategoriesBtn');
    if (manageBtn) {
      openCategoryModal();
      return;
    }

    const chip = e.target.closest('.chip');
    if (!chip || chip.classList.contains('chip-manage')) return;

    document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.currentFilter = chip.dataset.category;
    renderFilteredList();
  });

  // 카테고리 관리 모달 이벤트 바인딩
  document.getElementById('closeCategoryModalBtn').addEventListener('click', () => {
    document.getElementById('categoryModal').classList.remove('active');
  });

  document.getElementById('cancelCatBtn').addEventListener('click', () => {
    resetCategoryForm();
  });

  // 카테고리 아이콘 선택 이벤트
  document.getElementById('catIconPicker').addEventListener('click', (e) => {
    const opt = e.target.closest('.icon-option');
    if (!opt) return;

    const icon = opt.dataset.icon;
    document.getElementById('catIcon').value = icon;
    document.querySelectorAll('#catIconPicker .icon-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });

  // 카테고리 폼 제출 (추가 / 수정)
  document.getElementById('categoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const catId = document.getElementById('catId').value;
    const label = document.getElementById('catName').value.trim();
    const icon = document.getElementById('catIcon').value;
    const colorEl = document.querySelector('input[name="catColor"]:checked');
    const color = colorEl ? colorEl.value : '#ec4899';

    if (!label) return;

    if (catId) {
      const idx = state.categories.findIndex(c => c.id === catId);
      if (idx !== -1) {
        state.categories[idx] = {
          ...state.categories[idx],
          label,
          icon,
          color
        };
      }
    } else {
      const newCat = {
        id: 'custom_' + Date.now(),
        label,
        icon,
        color,
        isDefault: false
      };
      state.categories.push(newCat);
    }

    saveCategories();
    renderCategoryChips();
    renderCategorySelectOptions();
    renderCategoryManageList();
    renderFilteredList();
    resetCategoryForm();
  });

  // 정렬 선택
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    renderFilteredList();
  });

  // 뷰 모드 토글
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    renderFilteredList();
  });

  document.getElementById('listViewBtn').addEventListener('click', () => {
    state.viewMode = 'list';
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    renderFilteredList();
  });

  // 디데이 추가 버튼
  document.getElementById('addDdayBtn').addEventListener('click', openAddModal);
  document.getElementById('closeFormModalBtn').addEventListener('click', () => {
    document.getElementById('ddayFormModal').classList.remove('active');
  });
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('ddayFormModal').classList.remove('active');
  });

  // 폼 제출 (추가 / 수정)
  document.getElementById('ddayForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('ddayId').value;
    const title = document.getElementById('formTitle').value.trim();
    const calcType = document.getElementById('formCalcType').value;
    const category = document.getElementById('formCategory').value;
    const targetDate = document.getElementById('formTargetDate').value;
    const targetTime = document.getElementById('formTargetTime').value || '00:00';
    const isPinned = document.getElementById('formIsPinned').checked;
    const memo = document.getElementById('formMemo').value.trim();
    
    const colorEl = document.querySelector('input[name="cardColor"]:checked');
    const color = colorEl ? colorEl.value : '#ec4899';

    if (!title || !targetDate) return;

    if (id) {
      const idx = state.ddays.findIndex(item => item.id === id);
      if (idx !== -1) {
        state.ddays[idx] = {
          ...state.ddays[idx],
          title,
          calcType,
          category,
          targetDate,
          targetTime,
          color,
          isPinned,
          memo
        };
      }
    } else {
      const newItem = {
        id: 'dday_' + Date.now(),
        title,
        calcType,
        category,
        targetDate,
        targetTime,
        color,
        isPinned,
        memo,
        createdAt: Date.now()
      };
      state.ddays.unshift(newItem);
    }

    saveData();
    renderCategoryManageList();
    renderFilteredList();
    document.getElementById('ddayFormModal').classList.remove('active');
  });

  // 상세 모달 닫기
  document.getElementById('closeDetailModalBtn').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('active');
    state.activeDetailId = null;
  });

  document.getElementById('detailEditBtn').addEventListener('click', () => {
    if (state.activeDetailId) {
      openEditModal(state.activeDetailId);
    }
  });

  document.getElementById('detailDeleteBtn').addEventListener('click', () => {
    if (!state.activeDetailId) return;
    if (confirm('이 디데이를 정말 삭제하시겠습니까?')) {
      state.ddays = state.ddays.filter(item => item.id !== state.activeDetailId);
      saveData();
      renderCategoryManageList();
      renderFilteredList();
      document.getElementById('detailModal').classList.remove('active');
      state.activeDetailId = null;
    }
  });

  // 마일스톤 탭 전환
  document.querySelectorAll('.milestone-tabs .m-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.milestone-tabs .m-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeMilestoneTab = e.target.dataset.tab;
      
      const item = state.ddays.find(d => d.id === state.activeDetailId);
      if (item) renderMilestones(item);
    });
  });

  // 카드 이미지 다운로드
  document.getElementById('detailShareImgBtn').addEventListener('click', generateCardImage);
  document.getElementById('closeShareModalBtn').addEventListener('click', () => {
    document.getElementById('shareModal').classList.remove('active');
  });
  document.getElementById('closeShareBtn').addEventListener('click', () => {
    document.getElementById('shareModal').classList.remove('active');
  });

  // 데이터 백업 및 복원
  document.getElementById('backupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.add('active');
  });
  document.getElementById('closeBackupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.remove('active');
  });

  // JSON Export (디데이 + 카테고리 내보내기)
  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    const backupPayload = {
      ddays: state.ddays,
      categories: state.categories,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `dday_master_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  });

  // JSON Import (디데이 + 카테고리 불러오기 및 이전 백업 호환)
  document.getElementById('importJsonInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('selectedFileName').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          state.ddays = importedData;
          saveData();
          renderCategoryChips();
          renderCategorySelectOptions();
          renderFilteredList();
          alert('디데이 목록이 성공적으로 복원되었습니다!');
          document.getElementById('backupModal').classList.remove('active');
        } else if (importedData && typeof importedData === 'object' && Array.isArray(importedData.ddays)) {
          state.ddays = importedData.ddays;
          if (Array.isArray(importedData.categories)) {
            state.categories = importedData.categories;
            saveCategories();
          }
          saveData();
          renderCategoryChips();
          renderCategorySelectOptions();
          renderFilteredList();
          alert('디데이 및 카테고리가 성공적으로 복원되었습니다!');
          document.getElementById('backupModal').classList.remove('active');
        } else {
          alert('올바른 디데이 백업 파일 형식이 아닙니다.');
        }
      } catch (err) {
        alert('JSON 파일 읽기 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  });
}

function openCategoryModal() {
  resetCategoryForm();
  renderCategoryManageList();
  document.getElementById('categoryModal').classList.add('active');
}
