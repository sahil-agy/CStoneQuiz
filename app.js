/**
 * Interactive Assessment & Quiz Application Engine
 * Supports preset question banks and Gemini 2.5 Flash AI Question Generator.
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let activeQuestions = [];
  let currentQuestionIndex = 0;
  let userAnswers = {}; // questionId -> selectedOptionIndex
  let flaggedQuestions = new Set();
  
  let timerInterval = null;
  let timeRemaining = 0;
  let timeElapsed = 0;
  let quizStartTime = 0;
  let isQuizFinished = false;

  // Configuration
  let selectedSet = 'set2';
  let quizMode = 'all';
  let timerOption = 'none';
  let instantFeedback = false;

  // DOM Elements
  const welcomeView = document.getElementById('welcomeView');
  const quizView = document.getElementById('quizView');
  const resultsView = document.getElementById('resultsView');

  // Tabs
  const tabPresets = document.getElementById('tabPresets');
  const tabGeminiAi = document.getElementById('tabGeminiAi');
  const panelPresets = document.getElementById('panelPresets');
  const panelGeminiAi = document.getElementById('panelGeminiAi');

  // Controls
  const startQuizBtn = document.getElementById('startQuizBtn');
  const generateAiQuizBtn = document.getElementById('generateAiQuizBtn');
  const aiLoadingModal = document.getElementById('aiLoadingModal');
  const aiLoadingStatus = document.getElementById('aiLoadingStatus');
  const aiProgressFill = document.getElementById('aiProgressFill');

  const setSelect = document.getElementById('questionSetSelect');
  const modeSelect = document.getElementById('quizModeSelect');
  const timerSelect = document.getElementById('timerSelect');
  const feedbackToggle = document.getElementById('feedbackToggle');

  const aiCountSelect = document.getElementById('aiCountSelect');
  const aiTopicSelect = document.getElementById('aiTopicSelect');
  const aiDifficultySelect = document.getElementById('aiDifficultySelect');
  const aiFeedbackToggle = document.getElementById('aiFeedbackToggle');

  const questionCounter = document.getElementById('questionCounter');
  const timerPill = document.getElementById('timerPill');
  const timerDisplay = document.getElementById('timerDisplay');
  const progressFill = document.getElementById('progressFill');
  const navDotsContainer = document.getElementById('navDotsContainer');

  const moduleBadge = document.getElementById('moduleBadge');
  const questionText = document.getElementById('questionText');
  const optionsGrid = document.getElementById('optionsGrid');
  const flagBtn = document.getElementById('flagBtn');

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');

  // Results DOM Elements
  const percentageDisplay = document.getElementById('percentageDisplay');
  const resultsBadge = document.getElementById('resultsBadge');
  const scoreBreakdownText = document.getElementById('scoreBreakdownText');
  const gaugeProgress = document.getElementById('gaugeProgress');

  const metricTotalScore = document.getElementById('metricTotalScore');
  const metricPercentage = document.getElementById('metricPercentage');
  const metricCorrect = document.getElementById('metricCorrect');
  const metricIncorrect = document.getElementById('metricIncorrect');
  const metricTime = document.getElementById('metricTime');

  const reviewList = document.getElementById('reviewList');
  const retakeBtn = document.getElementById('retakeBtn');
  const filterTabs = document.querySelectorAll('.filter-tab');

  // Tab switching
  if (tabPresets && tabGeminiAi) {
    tabPresets.addEventListener('click', () => {
      tabPresets.classList.add('active');
      tabGeminiAi.classList.remove('active');
      panelPresets.style.display = 'grid';
      panelGeminiAi.style.display = 'none';
    });

    tabGeminiAi.addEventListener('click', () => {
      tabGeminiAi.classList.add('active');
      tabPresets.classList.remove('active');
      panelGeminiAi.style.display = 'grid';
      panelPresets.style.display = 'none';
    });
  }

  // Event Listeners
  startQuizBtn.addEventListener('click', startPresetQuiz);
  generateAiQuizBtn.addEventListener('click', generateAndStartAiQuiz);

  prevBtn.addEventListener('click', () => navigateQuestion(-1));
  nextBtn.addEventListener('click', () => navigateQuestion(1));
  flagBtn.addEventListener('click', toggleFlagCurrentQuestion);
  submitBtn.addEventListener('click', confirmSubmitQuiz);
  retakeBtn.addEventListener('click', resetToWelcome);

  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderReviewList(e.target.dataset.filter);
    });
  });

  // Start Preset Quiz
  function startPresetQuiz() {
    selectedSet = setSelect ? setSelect.value : 'set2';
    quizMode = modeSelect.value;
    timerOption = timerSelect.value;
    instantFeedback = feedbackToggle.checked;

    let pool = [];
    if (selectedSet === 'set1') {
      pool = QUIZ_QUESTION_SETS.set1.questions;
    } else if (selectedSet === 'set2') {
      pool = QUIZ_QUESTION_SETS.set2.questions;
    } else if (selectedSet === 'combined') {
      pool = [...QUIZ_QUESTION_SETS.set1.questions, ...QUIZ_QUESTION_SETS.set2.questions];
    } else {
      pool = QUIZ_QUESTIONS;
    }

    let source = [...pool];
    if (quizMode === 'random10') {
      source = shuffleArray(source).slice(0, 10);
    } else if (quizMode === 'random15') {
      source = shuffleArray(source).slice(0, 15);
    }
    activeQuestions = source;

    initializeQuizState();
  }

  // Generate & Start AI Quiz with Gemini
  async function generateAndStartAiQuiz() {
    const count = parseInt(aiCountSelect.value, 10);
    const topic = aiTopicSelect.value;
    const difficulty = aiDifficultySelect.value;
    instantFeedback = aiFeedbackToggle.checked;
    timerOption = 'none';

    // Show Loading Modal
    aiLoadingModal.style.display = 'flex';
    aiProgressFill.style.width = '20%';
    aiLoadingStatus.textContent = 'Analyzing 60 sample questions from context...';

    setTimeout(() => {
      aiProgressFill.style.width = '60%';
      aiLoadingStatus.textContent = 'Asking Gemini 3.8 Flash to synthesize new questions...';
    }, 1200);

    try {
      const response = await fetch('/generate-ai-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, topic, difficulty })
      });

      const data = await response.json();

      if (data.success && data.questions && data.questions.length > 0) {
        aiProgressFill.style.width = '100%';
        aiLoadingStatus.textContent = 'Questions generated successfully!';

        setTimeout(() => {
          aiLoadingModal.style.display = 'none';
          activeQuestions = data.questions;
          initializeQuizState();
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to generate AI questions.');
      }
    } catch (err) {
      alert(`Error generating AI quiz: ${err.message}\nPlease make sure server.py is running.`);
      aiLoadingModal.style.display = 'none';
    }
  }

  function initializeQuizState() {
    currentQuestionIndex = 0;
    userAnswers = {};
    flaggedQuestions.clear();
    timeElapsed = 0;
    isQuizFinished = false;

    if (timerOption !== 'none') {
      timeRemaining = parseInt(timerOption, 10);
      timerPill.style.display = 'flex';
      startTimer();
    } else {
      timerPill.style.display = 'none';
    }

    quizStartTime = Date.now();

    switchView(quizView);
    renderQuestionNavigation();
    loadQuestion(currentQuestionIndex);
  }

  function startTimer() {
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeRemaining--;
      timeElapsed++;
      updateTimerDisplay();

      if (timeRemaining <= 60) {
        timerPill.classList.add('warning');
      }

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        alert('Time is up! Submitting your assessment automatically.');
        finishQuiz();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function renderQuestionNavigation() {
    navDotsContainer.innerHTML = '';
    activeQuestions.forEach((q, idx) => {
      const dot = document.createElement('button');
      dot.className = 'dot-btn';
      dot.textContent = idx + 1;
      dot.dataset.index = idx;

      if (userAnswers[q.id] !== undefined) {
        dot.classList.add('answered');
      }
      if (flaggedQuestions.has(q.id)) {
        dot.classList.add('flagged');
      }
      if (idx === currentQuestionIndex) {
        dot.classList.add('active');
      }

      dot.addEventListener('click', () => {
        currentQuestionIndex = idx;
        loadQuestion(currentQuestionIndex);
      });

      navDotsContainer.appendChild(dot);
    });
  }

  function loadQuestion(index) {
    const question = activeQuestions[index];
    questionCounter.innerHTML = `Question <span>${index + 1}</span> of ${activeQuestions.length}`;
    progressFill.style.width = `${((index + 1) / activeQuestions.length) * 100}%`;

    if (question.module) {
      moduleBadge.style.display = 'block';
      moduleBadge.textContent = question.module;
    } else {
      moduleBadge.style.display = 'none';
    }

    questionText.textContent = `${index + 1}. ${question.question}`;
    optionsGrid.innerHTML = '';

    const selectedOption = userAnswers[question.id];

    question.options.forEach((optText, optIdx) => {
      const optionCard = document.createElement('div');
      optionCard.className = 'option-card';
      
      const optionKey = document.createElement('div');
      optionKey.className = 'option-key';
      optionKey.textContent = String.fromCharCode(65 + optIdx);

      const optionLabel = document.createElement('div');
      optionLabel.className = 'option-text';
      optionLabel.textContent = optText;

      optionCard.appendChild(optionKey);
      optionCard.appendChild(optionLabel);

      if (selectedOption === optIdx) {
        optionCard.classList.add('selected');
      }

      if (instantFeedback && selectedOption !== undefined) {
        if (optIdx === question.correctIndex) {
          optionCard.classList.add('correct-feedback');
        } else if (optIdx === selectedOption) {
          optionCard.classList.add('incorrect-feedback');
        }
      }

      optionCard.addEventListener('click', () => {
        userAnswers[question.id] = optIdx;
        loadQuestion(index);
        renderQuestionNavigation();
      });

      optionsGrid.appendChild(optionCard);
    });

    if (flaggedQuestions.has(question.id)) {
      flagBtn.classList.add('flagged');
      flagBtn.innerHTML = '★ Flagged for Review';
    } else {
      flagBtn.classList.remove('flagged');
      flagBtn.innerHTML = '☆ Flag Question';
    }

    prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
    if (index === activeQuestions.length - 1) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    }

    renderQuestionNavigation();
  }

  function navigateQuestion(direction) {
    const newIdx = currentQuestionIndex + direction;
    if (newIdx >= 0 && newIdx < activeQuestions.length) {
      currentQuestionIndex = newIdx;
      loadQuestion(currentQuestionIndex);
    }
  }

  function toggleFlagCurrentQuestion() {
    const qId = activeQuestions[currentQuestionIndex].id;
    if (flaggedQuestions.has(qId)) {
      flaggedQuestions.delete(qId);
    } else {
      flaggedQuestions.add(qId);
    }
    loadQuestion(currentQuestionIndex);
  }

  function confirmSubmitQuiz() {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = activeQuestions.length;
    
    if (answeredCount < totalCount) {
      const unanswered = totalCount - answeredCount;
      if (!confirm(`You have ${unanswered} unanswered question(s). Are you sure you want to submit?`)) {
        return;
      }
    }
    finishQuiz();
  }

  function finishQuiz() {
    clearInterval(timerInterval);
    isQuizFinished = true;
    if (timerOption === 'none') {
      timeElapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    }

    let correctCount = 0;
    activeQuestions.forEach(q => {
      if (userAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const totalQuestions = activeQuestions.length;
    const incorrectCount = Object.keys(userAnswers).length - correctCount;
    const unansweredCount = totalQuestions - Object.keys(userAnswers).length;
    
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    percentageDisplay.textContent = `${percentage}%`;
    metricTotalScore.textContent = `${correctCount} / ${totalQuestions}`;
    metricPercentage.textContent = `${percentage}%`;
    metricCorrect.textContent = correctCount;
    metricIncorrect.textContent = incorrectCount + unansweredCount;
    
    const mins = Math.floor(timeElapsed / 60);
    const secs = timeElapsed % 60;
    metricTime.textContent = `${mins}m ${secs}s`;

    scoreBreakdownText.textContent = `You scored ${correctCount} out of ${totalQuestions} points (${percentage}% accuracy).`;

    const strokeOffset = 565 - (565 * percentage) / 100;
    setTimeout(() => {
      gaugeProgress.style.strokeDashoffset = strokeOffset;
    }, 100);

    if (percentage >= 90) {
      resultsBadge.textContent = '🌟 Master / Distinction';
      resultsBadge.style.color = '#10B981';
    } else if (percentage >= 75) {
      resultsBadge.textContent = '🏅 High Merit';
      resultsBadge.style.color = '#06B6D4';
    } else if (percentage >= 60) {
      resultsBadge.textContent = '👍 Pass';
      resultsBadge.style.color = '#F59E0B';
    } else {
      resultsBadge.textContent = '📚 Needs Improvement';
      resultsBadge.style.color = '#EF4444';
    }

    renderReviewList('all');
    switchView(resultsView);
  }

  function renderReviewList(filter = 'all') {
    reviewList.innerHTML = '';

    activeQuestions.forEach((q, idx) => {
      const userAnsIdx = userAnswers[q.id];
      const isCorrect = userAnsIdx === q.correctIndex;
      const isUnanswered = userAnsIdx === undefined;

      if (filter === 'correct' && !isCorrect) return;
      if (filter === 'incorrect' && (isCorrect || isUnanswered)) return;
      if (filter === 'unanswered' && !isUnanswered) return;

      const card = document.createElement('div');
      card.className = `review-card ${isUnanswered ? 'unanswered' : isCorrect ? 'correct' : 'incorrect'}`;

      let statusHtml = '';
      if (isUnanswered) {
        statusHtml = '<span class="review-status-tag status-unanswered">Unanswered</span>';
      } else if (isCorrect) {
        statusHtml = '<span class="review-status-tag status-correct">✓ Correct (+1 pt)</span>';
      } else {
        statusHtml = '<span class="review-status-tag status-incorrect">✗ Incorrect (0 pt)</span>';
      }

      const userAnsText = isUnanswered ? 'None selected' : q.options[userAnsIdx];
      const correctAnsText = q.options[q.correctIndex];

      let explanationHtml = '';
      if (q.explanation) {
        explanationHtml = `
          <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px rgba(255,255,255,0.08) solid; font-size: 0.85rem; color: #94A3B8;">
            <strong style="color: var(--accent-cyan);">Explanation & Guidance:</strong> ${q.explanation}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="review-card-header">
          <span>Question ${idx + 1} of ${activeQuestions.length} ${q.module ? '• ' + q.module : ''}</span>
          ${statusHtml}
        </div>
        <div class="review-q-text">${q.question}</div>
        <div class="review-ans-comparison">
          <div class="ans-row">
            <span class="ans-label">Your Answer:</span>
            <span style="color: ${isCorrect ? 'var(--color-success)' : isUnanswered ? 'var(--color-warning)' : 'var(--color-danger)'};">${userAnsText}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Correct Answer:</span>
            <span style="color: var(--color-success); font-weight: 600;">${correctAnsText}</span>
          </div>
          ${explanationHtml}
        </div>
      `;

      reviewList.appendChild(card);
    });
  }

  function resetToWelcome() {
    switchView(welcomeView);
  }

  function switchView(view) {
    welcomeView.classList.remove('active');
    quizView.classList.remove('active');
    resultsView.classList.remove('active');
    view.classList.add('active');
  }

  function shuffleArray(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
});
