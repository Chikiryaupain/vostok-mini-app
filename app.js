const app = document.querySelector('#app');
const telegram = window.Telegram?.WebApp;
const inTelegram = Boolean(telegram?.initData);
const telegramUser = telegram?.initDataUnsafe?.user?.id;
const storageKey = 'vostok-quest.v1' + (telegramUser ? '.' + telegramUser : '');
const total = quest.sectors.length;
const fresh = () => ({ started: false, opened: 0, pending: false, rewarded: false });
let progress = load();
let screen = initialScreen();
let selected = Math.min(progress.opened, total - 1);
let code = '';
let retryingCode = false;
let codeScreenHeight = 0;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Number.isInteger(saved.opened) || saved.opened < 0 || saved.opened > total) return fresh();
    return {
      opened: saved.opened,
      started: saved.started === true || saved.opened > 0 || saved.pending === true,
      pending: saved.pending === true && saved.opened < total,
      rewarded: saved.rewarded === true && saved.opened === total,
    };
  } catch {
    return fresh();
  }
}

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* Текущий сеанс продолжится в памяти. */ }
}

function initialScreen() {
  if (progress.rewarded) return 'reward';
  if (progress.pending) return 'confirmed';
  if (progress.opened === total) return 'mission';
  return progress.started ? 'map' : 'welcome';
}

const number = value => String(value).padStart(2, '0');
const sectorStatus = index => index < progress.opened ? 'opened' : index === progress.opened ? 'active' : 'locked';
const go = (next, focus = true) => {
  retryingCode = next === 'code' && screen === 'incorrect';
  if (retryingCode) code = '';
  screen = next;
  render();
  window.scrollTo(0, 0);
  if (focus) app.querySelector('h1')?.focus({ preventScroll: true });
};

function back() {
  switch (screen) {
    case 'briefing': go('welcome'); break;
    case 'instructions': go('briefing'); break;
    case 'map': go(progress.opened ? 'welcome' : 'instructions'); break;
    case 'code': go('map'); break;
    case 'incorrect': go('code'); break;
    case 'confirmed': go('map'); break;
    case 'unlocked':
    case 'assembly':
    case 'mission': go('map'); break;
    case 'reward': go('mission'); break;
  }
}

const button = (label, action, type = 'primary') =>
  `<button class="button ${type}" type="button" data-action="${action}">${label}</button>`;
const title = (text, className = '') => `<h1 tabindex="-1" class="${className}">${text}</h1>`;
const brand = `<span class="brand" aria-hidden="true">
  <img src="./assets/Endfield.svg" width="1099" height="183" alt="">
  <span>×</span>
  <img src="./assets/museum.svg" width="982" height="221" alt="">
</span>`;
const earth = `<div class="earth" aria-hidden="true"></div>`;
const avatar = '<img class="avatar" src="./assets/avatar.png" width="82" height="82" alt="">';

function mapArt() {
  const { halls, links } = quest.map;
  return `<svg class="floorplan" viewBox="0 0 445 698" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Секторы музея">
    <defs>
      <pattern id="fog" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#161614"/><path d="M0 0V5" stroke="#24241f" stroke-width="1"/></pattern>
    </defs>
    <g aria-hidden="true">${links.map((d, index) =>
      `<path class="hall-links${index < progress.opened ? ' traversed' : ''}" d="${d}"/>`).join('')}</g>
    <g>
      ${quest.sectors.map(({ id, hall }, index) => {
        const [points, x, y] = halls[id];
        const status = sectorStatus(index);
        const labels = { active: 'текущий сектор', opened: 'открыт', locked: 'в тумане' };
        return `<g class="room ${status} ${index === selected ? 'selected' : ''}" role="button"
          tabindex="0" aria-pressed="${index === selected}" data-action="select:${index}"
          aria-label="Сектор ${id}, ${hall}, ${labels[status]}">
          <polygon points="${points}"/>
          <g transform="translate(${x},${y})" aria-hidden="true">
            <text class="room-number" text-anchor="middle" y="${status === 'locked' ? -5 : 7}">${id}</text>
            ${status === 'locked' ? '<path class="lock" transform="translate(0 11)" d="M-5 -2h10v9h-10z M-3 -2v-3a3 3 0 0 1 6 0v3"/>' : ''}
          </g>
        </g>`;
      }).join('')}
      <g aria-hidden="true">
        <rect class="control-tag" x="278" y="100" width="32" height="83" stroke-dasharray="4 3"/>
        <text class="control-text" text-anchor="middle" transform="translate(294 142) rotate(-90)" y="4">ЦУП</text>
        <rect class="control-tag" x="312" y="23" width="84" height="24"/>
        <text class="control-text" text-anchor="middle" x="354" y="40">ФИНИШ</text>
      </g>
      ${progress.opened === 0 ? `<g aria-hidden="true">
        <path class="entrance-route" d="M75 652V670H39"/>
        <circle class="entrance-dot" cx="39" cy="670" r="5"/>
        <text class="entrance-text" x="52" y="684">ВХОД · ТЫ ЗДЕСЬ</text>
      </g>` : ''}
    </g>
  </svg>`;
}

function mapScreen() {
  const current = quest.sectors[selected];
  const status = sectorStatus(selected);
  const allOpen = progress.opened === total;
  const action = allOpen ? 'mission' : status === 'active' ? 'enter-code' : 'active-sector';
  const label = allOpen ? 'Перейти в ЦУП' : status === 'active' ? 'Ввести код' : 'К текущему сектору';
  const detail = allOpen ? 'Маршрут завершён. Финал в ЦУП.'
    : status === 'opened' ? 'Открытый сектор' : status === 'locked' ? 'Закрытый сектор' : 'Текущий сектор';
  return `<section class="screen map-screen">
    <div class="map-top">
      <div>
        ${title('Карта музея', 'mono map-title')}
        <div class="counter" role="img" aria-label="Открыто ${progress.opened} из ${total} секторов">
          <img src="./assets/sector-mark.png" alt="">
          <span>${number(Math.min(progress.opened + 1, total))}<span class="counter-total">/${number(total)}</span></span>
          <span class="sector-sequence" aria-hidden="true">${quest.sectors.map((_, index) => `<i class="${sectorStatus(index)}"></i>`).join('')}</span>
        </div>
      </div>
      ${button('Сборка <span aria-hidden="true">↗</span>', 'assembly', 'ghost compact')}
    </div>
    <div class="map-art">${mapArt()}<span class="map-corners" aria-hidden="true"></span></div>
    <div class="map-info">
      <div class="map-caption"><div class="eyebrow mono">${detail}${allOpen ? '' : ` <strong>${current.id}</strong>`}</div><img src="./assets/sector-signal.svg" alt=""></div>
      <h2>${allOpen ? 'Центр управления полётами' : current.hall.replace(' — ', ' —<br>')}</h2>
    </div>
    <div class="actions">${button(label, action)}</div>
  </section>`;
}

function codeScreen() {
  const sector = quest.sectors[progress.opened];
  return `<section class="screen code-screen">
    <div class="card guide">
      <div class="eyebrow mono">Проводник</div>
      <h2 class="display">Ивонна</h2>
      <p>${retryingCode ? 'Посмотри на табличку ещё раз. Все четыре цифры стоят в том же порядке? Попытки не ограничены.' : sector.guide}</p>
      ${avatar}
    </div>
    <form id="code-form" class="code-form">
      <div class="card assignment">
        <div class="eyebrow mono">Регистратор данных</div>
        ${title('Сектор <strong class="sector-id">' + sector.id.padStart(3, '0') + '</strong>')}
        <p>${sector.clue}</p>
      </div>
      <div class="card code-entry">
        <label class="visually-hidden" for="code">Код с таблички</label>
        <div class="code-field">
          <div class="code-slots" aria-hidden="true">${Array.from({ length: 4 }, (_, index) => `<span style="--order:${index}"><b>0</b></span>`).join('')}</div>
          <input id="code" name="code" type="text" inputmode="numeric" maxlength="4"
            pattern="[0-9]{4}" autocomplete="off" enterkeyhint="done" required>
        </div>
        <button class="button primary" name="confirm-code" type="submit" disabled>Подтвердить</button>
      </div>
    </form>
  </section>`;
}

function statusScreen(kind) {
  const sector = quest.sectors[progress.opened - 1];
  const messages = {
    confirmed: { title: 'Данные успешно подтверждены', credit: 'Доступ разрешён',
      body: 'Код с таблички подошёл.<br>Открой сектор, чтобы получить<br>ещё одну деталь «Востока».', button: 'Открыть сектор', action: 'unlock' },
    incorrect: { title: 'Этот код<br>не подошёл', credit: 'Можно повторить',
      body: 'Сверь цифры на табличке<br>рядом с нужным экспонатом<br>и введи код ещё раз.', button: 'Попробовать ещё раз', action: 'retry' },
    unlocked: { tag: 'Новая область', title: 'Сектор открыт', credit: '<b>+1</b> сектор',
      body: `Ты получил деталь ракеты:<br>«${sector?.part}».<br>Следующий сектор — на карте.`,
      button: 'Продолжить', action: progress.opened === total ? 'mission' : 'next-sector' },
    mission: { tag: 'Оператор, отличная работа!', title: 'Миссия успешно выполнена!', credit: '<b>100%</b> прогресс',
      body: 'Ты собрал все восемь деталей<br>ракеты «Восток». Забери награду<br>в Центре управления полётами.',
      button: 'Получить награду', action: 'claim' },
  };
  const result = messages[kind];
  return `<section class="screen result ${kind}">
    ${result.tag ? `<div class="eyebrow mono result-tag">${result.tag}</div>` : ''}
    <div class="result-center">
      <div class="status-icon" aria-hidden="true">
        <svg class="sector-diamonds" viewBox="0 0 320 214" fill="none" aria-hidden="true">
          <g id="sector-rings"><path class="diamond-outer" pathLength="100" d="M160 3 264 107 160 211 56 107Z" stroke="#536f92" stroke-dasharray="6 1 .4 1"/>
          <path class="diamond-middle" pathLength="100" d="M160 23 244 107 160 191 76 107Z" stroke="#456994"/>
          <g class="diamond-light"><path pathLength="100" d="M160 35 232 107 160 179 88 107Z" stroke="#bbdfff" stroke-width="2.5" stroke-linejoin="round"/></g>
          <path class="diamond-accents" d="m151 36 9-9 9 9m62 62 9 9-9 9m-62 62-9 9-9-9m-62-62-9-9 9-9" stroke="#78b9eb" stroke-width="2"/>
        </g>
        </svg><svg class="unlock-symbol" viewBox="0 0 100 100" aria-hidden="true">
          ${kind === 'mission' ? `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">
            <path d="M29 26H15v8q0 17 21 18m35-26h14v8q0 17-21 18"/>
            <path d="M28 20h44l-3 23q-3 17-19 21-16-4-19-21Z" fill="currentColor"/>
            <path d="M50 62v14m-14 5h28l-6-6H42Z"/>
          </g>` : kind === 'unlocked' ? `<path d="M34 51V34a16 16 0 0 1 32 0v17" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
          <rect x="24" y="48" width="52" height="38" rx="8" fill="currentColor"/>
          <path d="M50 61v10" stroke="#12232b" stroke-width="6" stroke-linecap="round"/>` : `<path d="${kind === 'confirmed' ? 'M20 51l20 20 40-43' : 'M27 27l46 46M73 27L27 73'}" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`}
        </svg>
      </div>
      ${title(result.title)}
      <p>${result.body}</p>
    </div>
    <div class="actions">
      <p class="eyebrow mono result-footer">${kind === 'unlocked' ? `<svg class="credit-stripes" width="51" height="12" viewBox="0 0 42.5 10" fill="currentColor" aria-hidden="true">
        <path d="M7.5 0 0 10h8l7.5-10Z"/><path d="M21 0l-7.5 10h8L29 0Z"/><path d="M34.5 0 27 10h8l7.5-10Z"/>
      </svg>` : ''}<span class="sector-credit">${result.credit}</span></p>
      ${button(result.button, result.action)}
    </div>
  </section>`;
}

function assemblyScreen() {
  return `<section class="screen assembly">
    <div class="card assembly-header">
      <div class="assembly-count">
        <span class="eyebrow mono">Детали</span>
        <span class="part-total"><strong>${number(progress.opened)}</strong> / ${number(total)}</span>
      </div>
      ${title('Сборка ракеты')}
    <div role="progressbar" aria-label="Сборка ракеты" aria-valuenow="${progress.opened}" aria-valuemin="0" aria-valuemax="${total}" class="assembly-meter">
      ${quest.sectors.map((_, index) => `<span class="${index < progress.opened ? 'collected' : ''}"></span>`).join('')}
    </div>
    </div>
    <ol class="parts">
      ${quest.sectors.map(({ id, part }, index) => {
        const found = index < progress.opened;
        return `<li class="card ${found ? 'collected' : 'locked'}"><small class="eyebrow mono">Сектор ${id}</small>
          <strong>${found ? part : 'Под замком'}</strong>
          <span class="part-caption">${found ? '<span class="part-check" aria-hidden="true">✓</span> Получена' : 'Открой сектор ' + id}</span></li>`;
      }).join('')}
    </ol>
    <div class="actions">${button('Вернуться к карте', 'map')}</div>
  </section>`;
}

const views = {
  welcome: () => `<section class="screen welcome">
    <div class="hero">${title('<span class="operation-label">Операция</span> «Восток»', 'display')}</div>
    <div class="welcome-intro">
      <p>Пройди залы музея, найди коды у экспонатов и собери ракету к старту.</p>
      ${button(progress.rewarded ? 'К награде' : progress.started ? 'Продолжить квест' : 'Отправиться в путь', 'start')}
    </div>
  </section>`,
  briefing: () => `<section class="screen briefing">
    ${earth}
    <div class="card briefing-card">
      <div class="eyebrow mono mission-label">Новое задание</div>
      ${title('Исследовательская<br>операция: космос')}
      <p>Вам предстоит отправиться в исследовательскую экспедицию по Музею космонавтики. Изучайте экспонаты, собирайте данные и открывайте новые секторы.</p>
    </div>
    <div class="actions">${button('Начать путешествие', 'instructions')}</div>
  </section>`,
  instructions: () => `<section class="screen instructions">
    <div class="card guide">
      <div class="eyebrow mono">Проводник</div>
      ${title('Ивонна', 'display')}
      <p>Для прохождения миссии перемещайся по музею и внимательно изучай экспонаты. Правильный ответ откроет следующий сектор.</p>
      ${avatar}
    </div>
    <div class="card instructions-card">
      <h2 class="eyebrow mono">Цели операции <img src="./assets/stripes.svg" alt=""></h2>
      <ol>
        <li><span>Найди открытый сектор на карте и нажми на область</span></li>
        <li>Отыщи метку «Датаграма» у экспоната — код на табличке</li>
        <li>Введи код: сектор откроется, а ты получишь деталь ракеты</li>
      </ol>
      <p>Собери все 8 деталей ракеты и приходи в ЦУП — там старт квеста и выдача призов</p>
    </div>
    <div class="actions">${button('Принять задание', 'begin')}</div>
  </section>`,
  map: mapScreen,
  code: codeScreen,
  confirmed: () => statusScreen('confirmed'),
  incorrect: () => statusScreen('incorrect'),
  unlocked: () => statusScreen('unlocked'),
  mission: () => statusScreen('mission'),
  reward: () => `<section class="screen briefing">
    ${earth}
    <div class="card briefing-card">
      <div class="eyebrow mono mission-label">Награда разблокирована</div>
      ${title('Поздравляем<br>с успешным<br>прохождением!')}
      <p>Тебя ждёт <span class="reward-name">памятный подарок коллаборации</span>. ${quest.reward}</p>
    </div>
    <div class="actions">
      ${button('Закончить путешествие', 'finish')}
    </div>
  </section>`,
  assembly: assemblyScreen,
};

function bindShortWords(text) {
  return text
    .replace(/([\p{L}\p{N}]+) +(?=\S)/gu, (match, word) =>
      /^(а|и|к|в|с|у|о|на|из|за|от|до|по|во|со|об|ко|не|но|без|для)$/iu.test(word) ? word + '\u00a0' : match)
    .replace(/(сектор|секторе|блок|№) +(?=\d|[А-ЯЁ](?!\p{L}))/giu, '$1\u00a0')
    .replace(/ +(?=[—·])/gu, '\u00a0');
}

const dockSize = new ResizeObserver(([entry]) => {
  if (entry.target.isConnected) measureDock(entry.target);
});

function measureDock(dock) {
  dock.parentElement.style.setProperty('--dock-space', dock.offsetHeight + 'px');
}

function revealCodeRow() {
  const input = document.activeElement;
  if (input?.id !== 'code') return;
  const scroll = input.closest('.screen-scroll');
  const card = input.closest('.code-entry').getBoundingClientRect();
  const viewport = window.visualViewport;
  const bounds = scroll.getBoundingClientRect();
  const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
  const bottom = Math.min(bounds.bottom, viewport ? viewport.offsetTop + viewport.height : innerHeight);
  if (card.bottom > bottom) scroll.scrollTop += Math.ceil(card.bottom - bottom);
  else if (card.top < top && card.height <= bottom - top) scroll.scrollTop -= Math.ceil(top - card.top);
}

const codeViewport = new ResizeObserver(revealCodeRow);
app.addEventListener('focusin', event => {
  if (event.target.id !== 'code') return;
  codeViewport.observe(event.target.closest('.screen-scroll'));
  window.visualViewport?.addEventListener('scroll', revealCodeRow);
});

function stopTrackingCodeRow() {
  codeViewport.disconnect();
  window.visualViewport?.removeEventListener('scroll', revealCodeRow);
}
app.addEventListener('focusout', event => {
  if (event.target.id === 'code') stopTrackingCodeRow();
});

function render(animate = true) {
  stopTrackingCodeRow();
  dockSize.disconnect();
  app.innerHTML = `<div class="app-shell" data-screen="${screen}" ${animate ? 'data-enter' : ''}>
    <div class="screen-scroll">
      <header>
        <button class="brand-restart" type="button" data-action="restart" aria-label="Начать квест заново — Endfield × Музей космонавтики" title="Начать квест заново">${brand}</button>
        ${screen !== 'welcome' && !inTelegram ? button('←', 'back', 'back ghost') : ''}
      </header>
      ${views[screen]()}
    </div>
    ${screen === 'code' ? '' : `<footer class="floating-controls">
      <div class="primary-dock"></div>
    </footer>`}
  </div>`;
  const primary = app.querySelector('.screen .button.primary');
  app.querySelector('.primary-dock')?.append(primary);
  const actions = app.querySelector('.screen .actions');
  if (actions && !actions.childElementCount) actions.remove();
  const words = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  while (words.nextNode()) {
    const node = words.currentNode;
    node.data = bindShortWords(node.data);
  }
  app.querySelector('[data-action="back"]')?.setAttribute('aria-label', 'Назад');
  if (inTelegram && telegram.isVersionAtLeast?.('6.1')) {
    if (screen === 'welcome') telegram.BackButton.hide();
    else telegram.BackButton.show();
  }
  const dock = app.querySelector('.floating-controls');
  if (dock) {
    measureDock(dock);
    dockSize.observe(dock);
  } else {
    codeScreenHeight = app.querySelector('.app-shell').clientHeight;
    syncCode();
  }
}

function syncCode() {
  const field = app.querySelector('#code');
  if (field.value !== code) field.value = code;
  const row = field.parentElement;
  row.style.setProperty('--cursor', Math.min(code.length, 3));
  row.classList.toggle('complete', code.length === 4);
  row.querySelectorAll('.code-slots b').forEach((digit, index) => {
    const value = code[index] || '';
    if ((digit.dataset.value || '') === value) return;
    digit.dataset.value = value;
    digit.textContent = value || '0';
    digit.animate([{ opacity: 0, transform: 'translateY(45%)' }, { opacity: 1, transform: 'none' }], { duration: 150, easing: 'ease-out' });
  });
  field.form.elements.namedItem('confirm-code').disabled = code.length !== 4 || field.readOnly;
}

function haptic(type) {
  if (inTelegram && telegram.isVersionAtLeast?.('6.1')) telegram.HapticFeedback.notificationOccurred(type);
}

function restart() {
  progress = fresh();
  selected = 0;
  code = '';
  save();
  go('welcome');
}

function handleAction(action) {
  if (action.startsWith('select:')) {
    selected = Number(action.split(':')[1]);
    render(false);
    app.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
    return;
  }
  switch (action) {
    case 'start': go(progress.started ? initialScreen() : 'briefing'); break;
    case 'begin':
      progress.started = true;
      save();
      go('map');
      break;
    case 'enter-code':
      if (progress.opened === total) break;
      if (progress.pending) { go('confirmed'); break; }
      code = '';
      go('code');
      break;
    case 'retry':
      code = '';
      go('code');
      break;
    case 'unlock':
      if (!progress.pending || progress.opened === total) break;
      progress.opened += 1;
      progress.pending = false;
      selected = progress.opened - 1;
      save();
      haptic('success');
      go(progress.opened === total ? 'mission' : 'unlocked');
      break;
    case 'next-sector':
    case 'active-sector':
      selected = Math.min(progress.opened, total - 1);
      go('map');
      break;
    case 'mission':
      if (progress.opened === total) go('mission');
      break;
    case 'claim':
      if (progress.opened !== total) break;
      progress.rewarded = true;
      save();
      go('reward');
      break;
    case 'finish': go('welcome'); break;
    case 'restart':
      if (inTelegram && telegram.isVersionAtLeast?.('6.2')) {
        telegram.showConfirm('Начать заново и сбросить прогресс?', ok => { if (ok) restart(); });
      } else if (window.confirm('Начать заново и сбросить прогресс?')) restart();
      break;
    case 'back': back(); break;
    case 'map':
    case 'assembly':
    case 'instructions': go(action); break;
  }
}

app.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) handleAction(action);
});

app.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const room = event.target.closest('.room');
  if (!room) return;
  event.preventDefault();
  handleAction(room.dataset.action);
});

app.addEventListener('input', event => {
  if (event.target.id !== 'code') return;
  code = event.target.value.replace(/[^0-9]/g, '').slice(0, 4);
  syncCode();
});

function dismissCodeKeyboard(form) {
  const shell = form.closest('.app-shell');
  const wasShortened = codeScreenHeight - shell.clientHeight > 80;
  form.elements.code.blur();
  if (!wasShortened) return;

  // Some webviews restore a different height when their browser toolbar reappears.
  return new Promise(resolve => {
    const deadline = performance.now() + 1000;
    function checkHeight() {
      if (!form.isConnected || shell.clientHeight >= codeScreenHeight - 8 || performance.now() >= deadline) resolve();
      else requestAnimationFrame(checkHeight);
    }
    requestAnimationFrame(checkHeight);
  });
}

app.addEventListener('submit', async event => {
  if (event.target.id !== 'code-form') return;
  event.preventDefault();
  if (screen !== 'code' || progress.opened >= total || code.length !== 4) return;
  const form = event.target;
  if (form.elements.code.readOnly) return;
  const valid = code === quest.sectors[progress.opened].code;
  const keyboardClosed = dismissCodeKeyboard(form);
  form.elements.code.readOnly = true;
  form.elements.namedItem('confirm-code').disabled = true;
  if (valid) {
    progress.pending = true;
    save();
  } else {
    haptic('error');
    form.classList.add('rejecting');
    await new Promise(resolve => setTimeout(resolve, 420));
  }
  await keyboardClosed;
  if (form.isConnected) go(valid ? 'confirmed' : 'incorrect');
});

// iOS can resize the visible viewport without resizing the layout viewport.
function syncViewport() {
  const viewport = window.visualViewport;
  if (viewport && viewport.scale === 1) {
    app.style.setProperty('--visible-height', viewport.height + 'px');
  } else {
    app.style.removeProperty('--visible-height');
  }
}
syncViewport();
window.visualViewport?.addEventListener('resize', syncViewport);
if (inTelegram) {
  app.classList.add('telegram');
  telegram.expand();
  if (telegram.isVersionAtLeast?.('6.1')) {
    telegram.BackButton.onClick(back);
    telegram.setHeaderColor(telegram.isVersionAtLeast('6.9') ? '#0d0d0c' : 'bg_color');
    telegram.setBackgroundColor('#0d0d0c');
  }
}
render();
if (inTelegram) telegram.ready();
window.addEventListener('load', () => {
  if (screen !== 'welcome' || navigator.connection?.saveData) return;
  const nextImage = new Image();
  nextImage.fetchPriority = 'low';
  nextImage.src = './assets/orbit.webp';
}, { once: true });
