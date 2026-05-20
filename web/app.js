const state = {
  data: null,
  view: "dashboard",
  mode: null,
  activeQuestions: [],
  index: 0,
  answers: [],
  wrongIds: JSON.parse(localStorage.getItem("wrongIds") || "[]"),
  timer: null,
  endsAt: null,
};

const titles = {
  dashboard: "準備狀態",
  practice: "章節練習",
  exam: "模擬測驗",
  review: "錯題複習",
};

const $ = (selector) => document.querySelector(selector);

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function sample(items, count) {
  return shuffle(items).slice(0, count);
}

function saveWrongIds() {
  localStorage.setItem("wrongIds", JSON.stringify([...new Set(state.wrongIds)]));
}

function showView(view) {
  state.view = view;
  $(".active-view")?.classList.remove("active-view");
  $(`#${view}-view`).classList.add("active-view");
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  $("#view-title").textContent = titles[view];
  $("#timer").hidden = view !== "exam" || !state.timer;
  render();
}

function renderDashboard() {
  const total = state.data.questions.length;
  const wrong = state.wrongIds.length;
  const chapters = state.data.chapters
    .map(
      (chapter) => `
        <article class="chapter">
          <div>
            <h3>${chapter.id} ${chapter.title}</h3>
            <span>${chapter.count} 題</span>
          </div>
          <button class="secondary" data-practice="${chapter.id}" type="button">開始</button>
        </article>
      `,
    )
    .join("");

  $("#dashboard-view").innerHTML = `
    <div class="stats-grid">
      <article class="stat"><span>總題庫</span><strong>${total}</strong></article>
      <article class="stat"><span>正式測驗</span><strong>${state.data.exam.questionCount} 題</strong></article>
      <article class="stat"><span>測驗時間</span><strong>${state.data.exam.durationMinutes} 分</strong></article>
      <article class="stat"><span>錯題本</span><strong>${wrong}</strong></article>
    </div>
    <div class="actions">
      <button class="primary" id="start-exam" type="button">開始 20 題模擬考</button>
      <button class="secondary" id="quick-practice" type="button">隨機練習 20 題</button>
      <button class="secondary" id="review-wrong" type="button">複習錯題</button>
    </div>
    <div class="chapter-grid">${chapters}</div>
  `;

  $("#start-exam").addEventListener("click", startExam);
  $("#quick-practice").addEventListener("click", () => startPractice("all"));
  $("#review-wrong").addEventListener("click", () => showView("review"));
  document.querySelectorAll("[data-practice]").forEach((button) => {
    button.addEventListener("click", () => startPractice(button.dataset.practice));
  });
}

function renderPracticeSetup() {
  const options = state.data.chapters
    .map((chapter) => `<option value="${chapter.id}">${chapter.id} ${chapter.title}</option>`)
    .join("");
  $("#practice-view").innerHTML = `
    <div class="result-panel">
      <h3>選擇練習範圍</h3>
      <p class="muted">練習模式會立即顯示正解，適合刷題和建立錯題本。</p>
      <div class="select-row">
        <select id="chapter-select">
          <option value="all">全部題庫隨機 20 題</option>
          ${options}
        </select>
        <button class="primary" id="practice-start" type="button">開始練習</button>
      </div>
    </div>
  `;
  $("#practice-start").addEventListener("click", () => startPractice($("#chapter-select").value));
}

function startPractice(chapterId) {
  const pool =
    chapterId === "all"
      ? state.data.questions
      : state.data.questions.filter((question) => question.chapter === chapterId);
  state.mode = "practice";
  state.activeQuestions = sample(pool, Math.min(20, pool.length));
  state.index = 0;
  state.answers = [];
  stopTimer();
  showView("practice");
  renderQuestion();
}

function startExam() {
  state.mode = "exam";
  state.activeQuestions = sample(state.data.questions, state.data.exam.questionCount);
  state.index = 0;
  state.answers = [];
  state.endsAt = Date.now() + state.data.exam.durationMinutes * 60 * 1000;
  state.timer = window.setInterval(tick, 500);
  showView("exam");
  tick();
  renderQuestion();
}

function stopTimer() {
  window.clearInterval(state.timer);
  state.timer = null;
  state.endsAt = null;
  $("#timer").hidden = true;
}

function tick() {
  const remaining = Math.max(0, state.endsAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  $("#time-left").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (remaining <= 0) finishSession();
}

function renderQuestion() {
  const question = state.activeQuestions[state.index];
  const target = state.mode === "exam" ? "#exam-view" : "#practice-view";
  const answered = state.answers[state.index];
  const isPractice = state.mode === "practice";
  const progress = ((state.index + 1) / state.activeQuestions.length) * 100;

  $(target).innerHTML = `
    <div class="progress"><span style="width:${progress}%"></span></div>
    <article class="question-panel">
      <div class="question-head">
        <span class="meta">${question.chapter} ${question.chapterTitle}</span>
        <strong>${state.index + 1} / ${state.activeQuestions.length}</strong>
      </div>
      <p class="question">${question.question}</p>
      <div class="options">
        ${question.options
          .map((option) => {
            const showAnswer = isPractice && answered;
            const selectedWrong = answered === option.key && answered !== question.answer;
            const className = showAnswer && option.key === question.answer ? "correct" : selectedWrong ? "wrong" : "";
            return `
              <button class="option ${className}" data-answer="${option.key}" type="button" ${answered ? "disabled" : ""}>
                <span class="key">${option.key}</span>
                <span>${option.text}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      ${renderFeedback(question, answered)}
      <div class="actions">
        <button class="secondary" id="leave-session" type="button">回總覽</button>
        ${answered || state.mode === "exam" ? `<button class="primary" id="next-question" type="button">${state.index + 1 === state.activeQuestions.length ? "完成" : "下一題"}</button>` : ""}
      </div>
    </article>
  `;

  document.querySelectorAll(".option").forEach((button) => {
    button.addEventListener("click", () => answerQuestion(button.dataset.answer));
  });
  $("#leave-session").addEventListener("click", () => {
    stopTimer();
    showView("dashboard");
  });
  $("#next-question")?.addEventListener("click", nextQuestion);
}

function renderFeedback(question, answered) {
  if (!answered || state.mode !== "practice") return "";
  const correct = answered === question.answer;
  const text = correct ? "答對了" : `答錯了，正解是 ${question.answer}`;
  return `<p class="feedback ${correct ? "good" : "bad"}">${text}</p>`;
}

function answerQuestion(answer) {
  const question = state.activeQuestions[state.index];
  state.answers[state.index] = answer;
  if (answer !== question.answer) {
    state.wrongIds.push(question.id);
  } else {
    state.wrongIds = state.wrongIds.filter((id) => id !== question.id);
  }
  saveWrongIds();
  if (state.mode === "exam") {
    nextQuestion();
    return;
  }
  renderQuestion();
}

function nextQuestion() {
  if (state.index + 1 >= state.activeQuestions.length) {
    finishSession();
    return;
  }
  state.index += 1;
  renderQuestion();
}

function finishSession() {
  const questions = state.activeQuestions;
  const correct = questions.filter((question, idx) => state.answers[idx] === question.answer).length;
  const score = Math.round((correct / questions.length) * 100);
  const missed = questions.filter((question, idx) => state.answers[idx] !== question.answer);
  stopTimer();
  const passed = score >= state.data.exam.passingScore;
  const target = state.mode === "exam" ? "#exam-view" : "#practice-view";

  $(target).innerHTML = `
    <article class="result-panel">
      <span class="muted">${state.mode === "exam" ? "模擬測驗結果" : "練習結果"}</span>
      <div class="result-score ${passed ? "pass" : "fail"}">${score} 分</div>
      <p>${correct} / ${questions.length} 題正確，${passed ? "達到及格標準" : "尚未達到 80 分及格標準"}。</p>
      <div class="actions">
        <button class="primary" id="again" type="button">再測一次</button>
        <button class="secondary" id="home" type="button">回總覽</button>
      </div>
      ${renderMissed(missed)}
    </article>
  `;

  $("#again").addEventListener("click", () => (state.mode === "exam" ? startExam() : startPractice("all")));
  $("#home").addEventListener("click", () => showView("dashboard"));
}

function renderMissed(missed) {
  if (!missed.length) return "";
  return `
    <div class="miss-list">
      ${missed
        .map(
          (question) => `
            <div class="miss-item">
              <strong>${question.chapter} 第 ${question.number} 題</strong>
              <p>${question.question}</p>
              <span class="muted">正解：${question.answer}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderReview() {
  const wrongSet = new Set(state.wrongIds);
  const wrongQuestions = state.data.questions.filter((question) => wrongSet.has(question.id));
  if (!wrongQuestions.length) {
    $("#review-view").innerHTML = `
      <div class="result-panel">
        <h3>目前沒有錯題</h3>
        <p class="muted">練習或模擬考答錯後，題目會自動收進這裡。</p>
        <button class="primary" id="review-start-empty" type="button">開始模擬考</button>
      </div>
    `;
    $("#review-start-empty").addEventListener("click", startExam);
    return;
  }

  $("#review-view").innerHTML = `
    <div class="result-panel">
      <h3>錯題本</h3>
      <p class="muted">共 ${wrongQuestions.length} 題。答對後會自動移出錯題本。</p>
      <div class="actions">
        <button class="primary" id="review-start" type="button">開始錯題練習</button>
        <button class="danger" id="clear-wrong" type="button">清空錯題</button>
      </div>
      ${renderMissed(wrongQuestions.slice(0, 20))}
    </div>
  `;
  $("#review-start").addEventListener("click", () => {
    state.mode = "practice";
    state.activeQuestions = sample(wrongQuestions, Math.min(20, wrongQuestions.length));
    state.index = 0;
    state.answers = [];
    showView("practice");
    renderQuestion();
  });
  $("#clear-wrong").addEventListener("click", () => {
    state.wrongIds = [];
    saveWrongIds();
    renderReview();
  });
}

function render() {
  if (!state.data) return;
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "practice" && !state.activeQuestions.length) renderPracticeSetup();
  if (state.view === "review") renderReview();
  if (state.view === "exam" && !state.activeQuestions.length) {
    $("#exam-view").innerHTML = `
      <div class="result-panel">
        <h3>20 題模擬測驗</h3>
        <p class="muted">正式規格為 4 選 1 單選題、答錯不倒扣、80 分及格。</p>
        <button class="primary" id="exam-start-panel" type="button">開始測驗</button>
      </div>
    `;
    $("#exam-start-panel").addEventListener("click", startExam);
  }
}

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    stopTimer();
    state.activeQuestions = [];
    state.answers = [];
    showView(button.dataset.view);
  });
});

fetch("questions.json")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    render();
  });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
