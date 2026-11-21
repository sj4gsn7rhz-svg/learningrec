    /* ==========================================================================
       Safe Storage Module (Protects against Mobile / In-App WebView SecurityError)
       ========================================================================== */
    const SafeStorage = {
      memoryFallback: {},
      getItem(key) {
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
            return window.localStorage.getItem(key);
          }
        } catch (e) {
          console.warn('[SafeStorage] Read restricted, using memory fallback:', e);
        }
        return this.memoryFallback[key] || null;
      },
      setItem(key, val) {
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
            window.localStorage.setItem(key, String(val));
            return;
          }
        } catch (e) {
          console.warn('[SafeStorage] Write restricted, using memory fallback:', e);
        }
        this.memoryFallback[key] = String(val);
      },
      removeItem(key) {
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
            window.localStorage.removeItem(key);
          }
        } catch (e) {
          console.warn('[SafeStorage] Remove restricted:', e);
        }
        delete this.memoryFallback[key];
      },
      clear() {
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
            window.localStorage.clear();
          }
        } catch (e) {
          console.warn('[SafeStorage] Clear restricted:', e);
        }
        this.memoryFallback = {};
      }
    };

    /* ==========================================================================
       Global State Management & Local Storage Keys
       ========================================================================== */
    const STORAGE_KEY_DIAGNOSIS = 'studymate_diagnosis_v2';
    const STORAGE_KEY_REPORT    = 'studymate_report_v2';
    const STORAGE_KEY_PLAN      = 'studymate_plan_v2';
    const STORAGE_KEY_CHAT      = 'studymate_chat_v2';
    const STORAGE_KEY_SETTINGS  = 'studymate_settings_v2';
    const STORAGE_KEY_HISTORY   = 'studymate_history_v2';

    const AppState = {
      activePage: 'home',
      settings: {
        theme: 'light',
        fontSize: 'medium',
        aiStyle: 'balanced', // 'friendly' | 'balanced' | 'professional'
        apiKey: ''
      },
      diagnosis: {
        learnerType: 'high', // REQUIRED
        examName: '',        // OPTIONAL
        subject: '',         // REQUIRED
        currentScore: '',    // OPTIONAL
        targetScore: '',     // REQUIRED
        examDate: '',        // OPTIONAL
        studyHours: 4.0,     // REQUIRED
        painPoints: ['problem', 'time'], // OPTIONAL
        painPointEtc: '',    // OPTIONAL
        additionalInfo: '',  // OPTIONAL
        condition: 'normal', // OPTIONAL ('none', 'very_bad', 'bad', 'normal', 'good', 'very_good')
        mealStatus: 'done',  // OPTIONAL ('none', 'done', 'hungry', 'soon', 'etc')
        lastDiagnosisDate: null
      },
      report: null,
      myStudy: {
        todayTasks: [],
        schedule: [],
        reflection: { understanding: 4, reviewNeeded: 'no', memo: '', date: '' }
      },
      history: [],
      chatMessages: []
    };

    /* ==========================================================================
       Initialization
       ========================================================================== */
    document.addEventListener('DOMContentLoaded', () => {
      loadSavedData();
      applySettings();
      checkReturningUser();
      renderHistoryList();
    });

    function loadSavedData() {
      try {
        const savedSettings = SafeStorage.getItem(STORAGE_KEY_SETTINGS);
        if (savedSettings) AppState.settings = Object.assign(AppState.settings, JSON.parse(savedSettings));

        const savedDiagnosis = SafeStorage.getItem(STORAGE_KEY_DIAGNOSIS);
        if (savedDiagnosis) AppState.diagnosis = Object.assign(AppState.diagnosis, JSON.parse(savedDiagnosis));

        const savedReport = SafeStorage.getItem(STORAGE_KEY_REPORT);
        if (savedReport) AppState.report = JSON.parse(savedReport);

        const savedPlan = SafeStorage.getItem(STORAGE_KEY_PLAN);
        if (savedPlan) AppState.myStudy = JSON.parse(savedPlan);

        const savedChat = SafeStorage.getItem(STORAGE_KEY_CHAT);
        if (savedChat) AppState.chatMessages = JSON.parse(savedChat);

        const savedHist = SafeStorage.getItem(STORAGE_KEY_HISTORY);
        if (savedHist) AppState.history = JSON.parse(savedHist);
      } catch (e) {
        console.warn('Storage load failed:', e);
      }
    }

    function checkReturningUser() {
      const box = document.getElementById('returning-user-box');
      if (AppState.diagnosis && AppState.diagnosis.subject && AppState.report) {
        box.classList.add('visible');
        const dDate = AppState.diagnosis.lastDiagnosisDate || '최근';
        document.getElementById('returning-meta-info').innerText = `${AppState.diagnosis.subject} (${dDate})`;
        document.getElementById('returning-user-desc').innerText = 
          `목표: ${AppState.diagnosis.targetScore || '성적 향상'} | 설정 공부 시간: ${AppState.diagnosis.studyHours}시간. 맞춤형 계획이 준비되어 있습니다.`;
      } else {
        box.classList.remove('visible');
      }
    }

    function startFreshDiagnosis() {
      navigateTo('diagnosis');
      showToast('새로운 학습 정보를 입력해주세요.');
    }

    /* ==========================================================================
       Navigation (SPA View Router)
       ========================================================================== */
    function navigateTo(pageId) {
      if (pageId === 'report' && !AppState.report) {
        showToast('먼저 필수 학습 정보를 입력하여 AI 진단을 받아주세요.');
        pageId = 'diagnosis';
      }

      AppState.activePage = pageId;

      document.querySelectorAll('.page-view').forEach(view => {
        view.classList.remove('active');
      });
      const targetView = document.getElementById(`page-${pageId}`);
      if (targetView) targetView.classList.add('active');

      document.querySelectorAll('.desktop-nav .nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === pageId);
      });
      document.querySelectorAll('.mobile-nav .mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === pageId);
      });

      if (pageId === 'report' && AppState.report) {
        renderReportView();
      } else if (pageId === 'mystudy') {
        renderMyStudyView();
      } else if (pageId === 'coach') {
        renderChatView();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ==========================================================================
       Settings & Customizations
       ========================================================================== */
    function toggleTheme() {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      AppState.settings.theme = newTheme;
      saveSettingsState();
      updateThemeIcon(newTheme);
      showToast(`${newTheme === 'dark' ? '다크 모드' : '라이트 모드'}가 적용되었습니다.`);
    }

    function updateThemeIcon(theme) {
      const icon = document.getElementById('theme-icon');
      if (theme === 'dark') {
        icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
      } else {
        icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
      }
    }

    function setFontSize(size) {
      document.documentElement.setAttribute('data-font-size', size);
      AppState.settings.fontSize = size;
      document.querySelectorAll('#chip-font-size .chip').forEach(c => {
        c.classList.toggle('selected', c.getAttribute('data-value') === size);
      });
      saveSettingsState();
    }

    function setAiStyle(style) {
      AppState.settings.aiStyle = style;
      document.querySelectorAll('#chip-ai-style .chip').forEach(c => {
        c.classList.toggle('selected', c.getAttribute('data-value') === style);
      });
      saveSettingsState();
      if (AppState.report) {
        AppState.report.encouragement = generateEncouragementMessage(AppState.diagnosis);
        const encEl = document.getElementById('encouragement-message');
        if (encEl) encEl.innerText = AppState.report.encouragement;
      }
    }

    function applySettings() {
      document.documentElement.setAttribute('data-theme', AppState.settings.theme);
      updateThemeIcon(AppState.settings.theme);
      document.documentElement.setAttribute('data-font-size', AppState.settings.fontSize);
      setFontSize(AppState.settings.fontSize);
      setAiStyle(AppState.settings.aiStyle);
      const apiInput = document.getElementById('input-api-key');
      if (apiInput && AppState.settings.apiKey) apiInput.value = AppState.settings.apiKey;
    }

    function saveSettingsState() {
      SafeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(AppState.settings));
    }

    function openSettingsModal() {
      document.getElementById('modal-settings').classList.add('active');
    }

    function closeSettingsModal() {
      document.getElementById('modal-settings').classList.remove('active');
    }

    function saveSettings() {
      const apiKeyInput = document.getElementById('input-api-key');
      if (apiKeyInput) {
        AppState.settings.apiKey = apiKeyInput.value.trim();
      }
      saveSettingsState();
      closeSettingsModal();
      showToast('설정이 저장되었습니다.');
      if (AppState.activePage === 'coach') renderChatView();
    }

    function resetAllData() {
      if (!confirm('정말로 모든 진단 기록, 플랜, 대화 내용을 초기화하시겠습니까? (되돌릴 수 없습니다)')) return;
      SafeStorage.clear();
      showToast('모든 데이터가 초기화되었습니다.');
      setTimeout(() => location.reload(), 600);
    }

    /* ==========================================================================
       Diagnosis Form Handling (Strict Required vs Optional Separation)
       ========================================================================== */
    function selectChip(groupName, value) {
      if (groupName === 'learner-type') {
        AppState.diagnosis.learnerType = value;
        document.querySelectorAll('#chip-learner-type .chip').forEach(c => {
          c.classList.toggle('selected', c.getAttribute('data-value') === value);
        });
        const examGroup = document.getElementById('exam-detail-group');
        examGroup.style.display = (value === 'exam') ? 'block' : 'none';
      } else if (groupName === 'meal-status') {
        AppState.diagnosis.mealStatus = value;
        document.querySelectorAll('#chip-meal-status .chip').forEach(c => {
          c.classList.toggle('selected', c.getAttribute('data-value') === value);
        });
      }
    }

    function toggleMultiChip(el, groupName, isEtc = false) {
      el.classList.toggle('selected');
      const val = el.getAttribute('data-value');
      
      if (groupName === 'pain') {
        if (el.classList.contains('selected')) {
          if (!AppState.diagnosis.painPoints.includes(val)) AppState.diagnosis.painPoints.push(val);
        } else {
          AppState.diagnosis.painPoints = AppState.diagnosis.painPoints.filter(p => p !== val);
        }

        if (isEtc) {
          const etcGroup = document.getElementById('pain-etc-group');
          etcGroup.style.display = el.classList.contains('selected') ? 'block' : 'none';
        }
      }
    }

    function selectCondition(val) {
      AppState.diagnosis.condition = val;
      document.querySelectorAll('#condition-grid .condition-item').forEach(item => {
        item.classList.toggle('selected', item.getAttribute('data-value') === val);
      });
    }

    function updateHoursLabel(val) {
      const floatVal = parseFloat(val);
      const hours = Math.floor(floatVal);
      const minutes = (floatVal % 1) * 60;
      const label = `${floatVal.toFixed(1)}시간 (${hours}시간 ${minutes}분)`;
      document.getElementById('slider-hours-label').innerText = label;
      AppState.diagnosis.studyHours = floatVal;
    }

    function handleDiagnosisSubmit(e) {
      e.preventDefault();

      // Required Inputs Validation (Strict Rule)
      const subjectInput = document.getElementById('input-subject');
      const targetScoreInput = document.getElementById('input-target-score');
      let isValid = true;
      let firstMissingEl = null;

      if (!subjectInput.value.trim()) {
        subjectInput.classList.add('error');
        document.getElementById('err-subject').classList.add('visible');
        if (!firstMissingEl) firstMissingEl = subjectInput;
        isValid = false;
      } else {
        subjectInput.classList.remove('error');
        document.getElementById('err-subject').classList.remove('visible');
      }

      if (!targetScoreInput.value.trim()) {
        targetScoreInput.classList.add('error');
        document.getElementById('err-target-score').classList.add('visible');
        if (!firstMissingEl) firstMissingEl = targetScoreInput;
        isValid = false;
      } else {
        targetScoreInput.classList.remove('error');
        document.getElementById('err-target-score').classList.remove('visible');
      }

      if (!isValid) {
        showToast('필수 항목을 모두 입력해야 분석을 시작할 수 있습니다.');
        if (firstMissingEl) {
          firstMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstMissingEl.focus();
        }
        return;
      }

      // Collect Required & Optional Data
      AppState.diagnosis.subject = subjectInput.value.trim();
      AppState.diagnosis.targetScore = targetScoreInput.value.trim();
      AppState.diagnosis.currentScore = document.getElementById('input-current-score').value.trim(); // Optional
      AppState.diagnosis.examDate = document.getElementById('input-exam-date').value; // Optional
      AppState.diagnosis.examName = document.getElementById('input-exam-name').value.trim(); // Optional
      AppState.diagnosis.painPointEtc = document.getElementById('input-pain-etc').value.trim(); // Optional
      AppState.diagnosis.additionalInfo = document.getElementById('input-additional').value.trim(); // Optional
      AppState.diagnosis.lastDiagnosisDate = new Date().toLocaleDateString('ko-KR');

      // Save to storage
      SafeStorage.setItem(STORAGE_KEY_DIAGNOSIS, JSON.stringify(AppState.diagnosis));

      // Trigger Stepwise Loading Animation
      startAnalysisWithAnimation();
    }

    function startAnalysisWithAnimation() {
      const overlay = document.getElementById('loading-overlay');
      const label = document.getElementById('loading-step-label');
      overlay.classList.add('active');

      const steps = [
        "학습 정보를 확인하고 있어요 📚",
        "맞춤형 학습 전략을 준비하고 있어요 ✨",
        "학습 계획 및 최적 시간표를 정리하고 있어요 😊"
      ];

      let currentStep = 0;
      label.innerText = steps[currentStep];

      const stepInterval = setInterval(() => {
        currentStep++;
        if (currentStep < steps.length) {
          label.innerText = steps[currentStep];
        } else {
          clearInterval(stepInterval);
          generateAIAnalysisReport();
          overlay.classList.remove('active');
          navigateTo('report');
          showToast('맞춤형 학습 분석이 완료되었습니다!');
        }
      }, 650);
    }

    /* ==========================================================================
       AI Learning Analysis Engine (Dynamic Rule-Based & Real Input Dependency)
       ========================================================================== */
    function generateAIAnalysisReport() {
      const d = AppState.diagnosis;
      const hours = d.studyHours;
      const totalMinutes = Math.round(hours * 60);

      // 1. Calculate Timetable and Validate exact total time (No overflow)
      // Block size: 30m if <= 2h, else 50m
      const blockMinutes = hours <= 2 ? 30 : 50; 
      const restMinutes = hours <= 2 ? 5 : 10;
      const schedule = [];
      let currentMin = 0;
      let startHour = 14; // Default starting from 14:00

      let blockCount = 0;
      while (currentMin < totalMinutes) {
        const remaining = totalMinutes - currentMin;
        if (remaining <= 20) {
          schedule.push({
            timeRange: formatTimeRange(startHour, currentMin, remaining),
            activity: `${d.subject} 당일 학습 마무리 & 오답 점검`,
            type: 'study',
            purpose: '오늘 학습한 핵심 개념 3가지 리마인드 및 취약 노트 정리'
          });
          currentMin += remaining;
          break;
        }

        const studyDuration = Math.min(blockMinutes, remaining);
        blockCount++;
        schedule.push({
          timeRange: formatTimeRange(startHour, currentMin, studyDuration),
          activity: `${d.subject} [집중 블록 ${blockCount}] : ${getBlockTaskName(d, blockCount)}`,
          type: 'study',
          purpose: blockCount === 1 ? '기본 개념 및 취약 공식 정밀 복습' : '유형별 심화 문제 풀이 및 오답 분석'
        });
        currentMin += studyDuration;

        if (currentMin + restMinutes <= totalMinutes) {
          schedule.push({
            timeRange: formatTimeRange(startHour, currentMin, restMinutes),
            activity: `리프레시 휴식 (스트레칭 / 수분 섭취)`,
            type: 'rest',
            purpose: '뇌 피로도 완화 및 인출 기억 응고화 시간'
          });
          currentMin += restMinutes;
        }
      }

      // 2. Dynamic Methods TOP 3 based on Learner Type & Subject & Pain Points
      const methods = getDynamicMethods(d);

      // 3. Condition & Meal Handling (Do NOT assume if not provided)
      let conditionSectionBlock = null;
      if (d.condition && d.condition !== 'none') {
        conditionSectionBlock = {
          title: `당일 컨디션 (${translateCondition(d.condition)}) 맞춤 처방`,
          text: getConditionAdvice(d.condition)
        };
      } else {
        conditionSectionBlock = {
          title: `당일 컨디션 (미입력)`,
          text: "컨디션 정보가 입력되지 않아 일반적인 권장 집중 리듬을 적용합니다. 피로감이 느껴질 경우 50분 공부 후 반드시 10분간 휴식을 취하세요."
        };
      }

      let mealSectionBlock = null;
      if (d.mealStatus && d.mealStatus !== 'none') {
        mealSectionBlock = {
          title: `현재 식사 상태 (${translateMeal(d.mealStatus)}) 맞춤 가이드`,
          text: getMealAdvice(d.mealStatus)
        };
      } else {
        mealSectionBlock = {
          title: `현재 식사 상태 (미입력)`,
          text: "식사 상태 정보가 입력되지 않았습니다. 학습 중 뇌의 집중력을 위해 틈틈이 미온수를 섭취해 주시는 것을 권장합니다."
        };
      }

      // 4. D-Day handling
      let dDayText = "시험일정 미입력 (상시 학습)";
      let dDayAnalysis = "시험 일정이 입력되지 않아 상시 실력 배양 표준 모드로 설정되었습니다.";
      if (d.examDate) {
        const today = new Date();
        const target = new Date(d.examDate);
        const diffTime = target - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          dDayText = `D-${diffDays}일 남음`;
          if (diffDays <= 7) dDayAnalysis = `시험이 ${diffDays}일 남은 직전 마무리 단계입니다. 새로운 고난도 문제 진입을 중단하고 기출 오답 복습과 실전 시간 배분에 집중하세요.`;
          else if (diffDays <= 30) dDayAnalysis = `시험까지 약 한 달(${diffDays}일) 남았습니다. 빈출 유형을 집중 타격하고 모의고사를 주 1~2회 병행하며 실전 감각을 끌어올려야 합니다.`;
          else dDayAnalysis = `시험까지 ${diffDays}일로 시간적 여유가 있습니다. 개념 원리를 확실히 잡고 취약 단원을 완벽히 소화하는 정공법을 추천합니다.`;
        } else if (diffDays === 0) {
          dDayText = `D-Day (오늘)`;
          dDayAnalysis = "시험 당일입니다! 가벼운 요약 노트만 가볍게 훑으며 마인드 컨트롤에 집중하세요.";
        } else {
          dDayText = `종료된 일정 (${Math.abs(diffDays)}일 경과)`;
          dDayAnalysis = "시험 일정이 지났습니다. 다음 시험 일정을 재설정해 주세요.";
        }
      }

      // 5. Current Score vs Target Score handling
      let currentScoreText = d.currentScore ? d.currentScore : "현재 수준 미입력 (진단 권장)";
      let scoreGapAnalysis = "";
      if (d.currentScore) {
        scoreGapAnalysis = `현재 '${d.currentScore}'에서 최종 목표 '${d.targetScore}'까지 도달하기 위해 필요한 성적 향상 폭을 분석했습니다. 단순 점수 상승이 아닌, 감점으로 이어지는 취약 단원의 개념적 누수를 메우는 전략이 필요합니다.`;
      } else {
        scoreGapAnalysis = `현재 성적이 입력되지 않아 목표 성취 기준('${d.targetScore}')에 맞춘 표준 최적화 로드맵을 제안합니다. 향후 현재 점수를 입력하시면 더욱 정교한 Gap 분석이 가능합니다.`;
      }

      // 6. Pain Points Handling
      let painSummaryText = "";
      if (d.painPoints && d.painPoints.length > 0) {
        painSummaryText = d.painPoints.map(p => translatePain(p)).join(', ');
        if (d.painPointEtc) painSummaryText += ` (${d.painPointEtc})`;
      } else {
        painSummaryText = "특정 고민 미선택 (전반적 균형 학습)";
      }

      // 7. Today Tasks TOP 2~3
      const todayTasks = [
        `${d.subject} ${methods[0].name.split(' ')[0]} 방식으로 핵심 개념 20분간 백지 인출`,
        `대표 유형 및 기출 문제 ${hours >= 4 ? '10문제' : '5문제'} 풀이 후 오답 원인 분석`,
        `오늘 학습 종료 전 10분간 셀프 리플렉션 노트 3줄 작성`
      ];

      // Assemble 7 Sections Data
      const reportData = {
        isGenerated: true,
        isDemo: !AppState.settings.apiKey,
        generatedAt: new Date().toLocaleString('ko-KR'),
        learnerType: d.learnerType,
        subject: d.subject,
        summary: {
          currentState: currentScoreText,
          targetScore: d.targetScore,
          dDayText: dDayText,
          weaknesses: painSummaryText,
          topPriority: `${d.subject} 핵심 개념 정립 및 필수 오답 유형 집중 공략`,
          recommendedMethod: methods[0].name,
          recommendReason: methods[0].reason,
          todayTasks: todayTasks
        },
        sections: [
          {
            id: 'sec1',
            title: '① AI 학습 상태 종합 분석',
            icon: '📊',
            isExpanded: true,
            isChecked: true,
            blocks: [
              { title: '현재 학습 수준과 목표 비교', text: scoreGapAnalysis },
              { title: '확인된 주요 취약 영역 및 고민', text: `확인된 학습 고민: [${painSummaryText}]. 학습자 유형(${translateLearner(d.learnerType)})의 특성을 고려할 때, 조급함을 버리고 정해진 분량을 깊이 있게 이해하는 것이 우선입니다.` },
              { title: '전문가 분석 근거 및 추가 확인 정보', text: `인지과학 학습 연구에 따르면 본인이 '안다고 착각하는 지점'을 시험 전에 발견하는 것이 성적 상승의 결정적 요인입니다. ${d.additionalInfo ? `(추가 전달사항 반영: "${d.additionalInfo}")` : ''}` }
            ]
          },
          {
            id: 'sec2',
            title: '② 목표 달성 가능성 및 학습 우선순위',
            icon: '🎯',
            isExpanded: false,
            isChecked: false,
            blocks: [
              { title: '목표의 현실성 및 기간 분석', text: `${dDayAnalysis} 하루 가용 시간(${hours}시간)을 고려할 때, 무리하게 전 범위를 훑기보다는 '시험에 빈출되는 핵심 단원 3개'를 정복하는 압축 학습이 가장 현실적입니다.` },
              { title: '우선 학습할 과목 단원 및 문제 유형', text: `1순위: 배점이 높고 정형화된 준킬러 유형 | 2순위: 개념 정의를 묻는 기본 문항 완벽 정복 | 3순위: 최고난도 킬러 문항 (기본기 안정화 이후 진행)` },
              { title: '우선순위 선정 이유 & 대안 목표', text: `기본 점수를 확보하지 못한 상태에서 고난도 문항에 시간을 쏟으면 학습 피로감만 커집니다. 확실히 맞힐 수 있는 문항의 정답률을 95% 이상으로 만드는 것이 목표 달성의 최단 경로입니다.` }
            ]
          },
          {
            id: 'sec3',
            title: '③ 개인 맞춤형 공부법 TOP 3',
            icon: '💡',
            isExpanded: false,
            isChecked: true,
            methods: methods
          },
          {
            id: 'sec4',
            title: '④ 맞춤형 학습 계획 및 시간표',
            icon: '⏱️',
            isExpanded: false,
            isChecked: true,
            timetable: schedule,
            totalStudyMinutes: totalMinutes,
            validationNote: `오늘 총 계획 시간: ${hours}시간 (${totalMinutes}분) = 순수 집중 학습 ${schedule.filter(s => s.type === 'study').reduce((acc, cur) => acc + parseInt(cur.timeRange.split('(')[1]), 0)}분 + 리프레시 휴식 시간 합계 검증 완료 (시간 초과 없음).`
          },
          {
            id: 'sec5',
            title: '⑤ 취약 영역 개선 및 개념 이해 전략',
            icon: '🔍',
            isExpanded: false,
            isChecked: false,
            blocks: [
              { title: '개념 이해 순서 (3단계 파이프라인)', text: '1. 용어의 정확한 정의 파악 → 2. 공식이나 원리의 유도 과정 직접 필사 → 3. 예제 문제를 통해 적용 맥락 확인' },
              { title: '오답 원인 정밀 분해 (오답 4유형)', text: '틀린 이유를 4가지(①개념 미숙지, ②문제 조건 오독, ③단순 계산 실수, ④시간 부족)로 명확히 라벨링하여 오답 원인별 맞춤 대책을 세우세요.' },
              { title: '반복 복습 주기 (망각 곡선 극복)', text: '당일 저녁 10분 복습 → 2일 뒤 백지 인출 → 7일 뒤 주말 누적 테스트를 통해 단기 기억을 장기 기억으로 전이시킵니다.' }
            ]
          },
          {
            id: 'sec6',
            title: '⑥ 컨디션 기반 학습·휴식·간식 추천',
            icon: '🍵',
            isExpanded: false,
            isChecked: false,
            blocks: [
              conditionSectionBlock,
              mealSectionBlock,
              { title: '지속 가능한 뇌 건강 관리', text: '공부 도중 눈이 뻐근할 때는 화면이나 책에서 시선을 떼고 20초간 6m 먼 곳을 바라보며 안구 근육을 이완시켜 주세요.' }
            ]
          },
          {
            id: 'sec7',
            title: '⑦ 학습 성과 점검 및 개선 방향',
            icon: '📈',
            isExpanded: false,
            isChecked: false,
            blocks: [
              { title: '일일 성과 점검 기준', text: '오늘 푼 문제의 개수보다 "틀린 문제를 다른 사람에게 막힘없이 설명할 수 있는가?"를 핵심 완료 기준으로 삼습니다.' },
              { title: '기존 학습 계획 수정 방향', text: '오늘 목표했던 분량의 80% 이상을 완수했다면 훌륭합니다. 미진했던 과제는 내일 첫 30분 복습 블록으로 이관하여 보완하세요.' }
            ]
          }
        ],
        encouragement: generateEncouragementMessage(d)
      };

      AppState.report = reportData;
      SafeStorage.setItem(STORAGE_KEY_REPORT, JSON.stringify(reportData));

      // Synchronize with MyStudy Plan
      AppState.myStudy.todayTasks = reportData.summary.todayTasks.map((t, idx) => ({
        id: 'task_' + Date.now() + '_' + idx,
        title: t,
        subject: d.subject,
        priority: idx === 0 ? '최우선' : '보통',
        duration: '50분',
        done: false
      }));
      AppState.myStudy.schedule = schedule;
      SafeStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(AppState.myStudy));
    }

    function getBlockTaskName(d, blockIdx) {
      const sub = d.subject.toLowerCase();
      if (sub.includes('수학') || sub.includes('math')) {
        return blockIdx === 1 ? '기본 개념 공식 유도 및 필수 예제 5제' : '유형별 기출 문제 풀이 및 풀이 과정 정서';
      } else if (sub.includes('영어') || sub.includes('토익') || sub.includes('어학')) {
        return blockIdx === 1 ? '핵심 구문 분석 및 필수 단어 암기' : '기출 독해 지문 문맥 추론 및 패러프레이징 분석';
      } else if (sub.includes('국어')) {
        return blockIdx === 1 ? '비문학/문학 지문 구조 독해 및 문단 요약' : '선지 근거 찾기 및 발문 조건 정밀 대조';
      } else {
        return blockIdx === 1 ? '핵심 개념 요약 정리 및 기본 용어 숙지' : '실전 기출 문항 풀이 및 오답 분석';
      }
    }

    function getDynamicMethods(d) {
      const sub = d.subject.toLowerCase();
      const learner = d.learnerType;

      // Method 1: Tailored to subject/learner
      let m1 = {
        name: "3단계 능동적 인출(Active Recall) & 백지 복습법",
        desc: "개념서를 덮고 오늘 공부한 핵심 원리를 백지에 스스로 도식화하고 인출해보는 메타인지 공부법입니다.",
        reason: `'${d.subject}' 학습에서 가장 중요한 것은 단순 눈독서가 아닌 '머릿속 지식을 끄집어내는 인출 능력'이기 때문입니다.`,
        effect: "기억 유지율 300% 향상 및 본인이 모르는 '착각의 영역' 즉각 발견",
        steps: ["1단계: 25분간 핵심 개념 집중 독해", "2단계: 책을 덮고 A4 용지에 목차와 공식 기억나는 대로 적기", "3단계: 책을 다시 펼쳐 누락된 내용 빨간펜으로 채우기"],
        caution: "처음에는 기억이 잘 안 나더라도 좌절하지 말고 5분간 최대한 스스로 떠올리려 노력해야 뇌신경이 강화됩니다."
      };

      if (sub.includes('수학') || sub.includes('코딩') || sub.includes('알고리즘')) {
        m1 = {
          name: "풀이 분기점 역추적 & 파인만 설명 기법",
          desc: "문제가 막혔을 때 바로 해설지를 보지 않고, 내가 전개한 식의 논리적 오류 지점을 찾아 친구에게 설명하듯 말해보는 공부법입니다.",
          reason: `'${d.subject}' 과목은 풀이 단계 간의 논리적 연결 고리를 스스로 증명해야 실전 응용력이 생기기 때문입니다.`,
          effect: "신유형 및 고난도 준킬러 문제 접근력 대폭 강화",
          steps: ["1단계: 막힌 지점에서 멈추고 문제 조건 3가지 다시 확인", "2단계: '왜 이 공식을 써야 하는가?' 1줄 말해보기", "3단계: 정답 도출 후 해설의 최단 경로 풀이와 비교"],
          caution: "해설지를 보고 이해한 것을 본인이 풀 수 있는 것으로 착각하지 마세요."
        };
      } else if (sub.includes('토익') || sub.includes('영어') || sub.includes('공무원') || sub.includes('자격')) {
        m1 = {
          name: "기출 단권화 & 분산 반복(Spaced Repetition) 회독법",
          desc: "틀린 지문과 문항의 핵심 포인트를 기본서 단 한 권에 표시하고 1일-3일-7일 주기로 누적 복습하는 방법입니다.",
          reason: `수험 및 객관식 시험은 빈출 지문의 익숙도를 극대화하여 문제 풀이 시간을 단축하는 것이 핵심이기 때문입니다.`,
          effect: "실전 시험 시간 20% 단축 및 헷갈리는 함정 선지 소거율 극대화",
          steps: ["1단계: 기출 문제 풀이 후 정답 선지와 오답 선지의 이유 체크", "2단계: 해설의 핵심 키워드를 요약 노트에 단권화", "3단계: 다음 날 공부 시작 전 어제 체크한 지문 10분간 속독"],
          caution: "여러 권의 문제집을 풀기보다 양질의 기출 1권을 3회독하는 것이 훨씬 안전합니다."
        };
      }

      // Method 2: Tailored to pain point
      let m2 = {
        name: "오답 3원칙(왜 틀렸는가? / 무엇을 몰랐는가? / 어떻게 풀 것인가?)",
        desc: "단순히 해설지를 베끼는 오답노트가 아니라, 나의 사고 오류 과정을 역추적하는 분석법입니다.",
        reason: `현재 겪고 계신 학습 고민을 극복하기 위해 가장 효과적인 실전 교정 전략입니다.`,
        effect: "유사 변형 문제 정답률 대폭 상승 및 반복되는 실수 패턴 원천 차단",
        steps: ["1단계: 틀린 문제의 발문에서 출제자가 요구한 숨은 조건 밑줄", "2단계: 내가 잘못 전개한 풀이의 첫 번째 분기점 찾기", "3단계: 올바른 핵심 개념 키워드 1줄 적고 3일 뒤 다시 풀기"],
        caution: "해설지를 덮고 끝까지 혼자 풀어내야 온전히 본인의 실력이 됩니다."
      };

      // Method 3: Timetable & Routine
      let m3 = {
        name: `${d.studyHours <= 2 ? '25/5 포모도로 집중 스프린트' : '50/10 포모도로 블록 타임제'}`,
        desc: "정해진 집중 시간 후 완전한 휴식을 엄격히 분리하여 뇌의 인지 과부하를 방지하는 시간 관리 기법입니다.",
        reason: `오늘 가용 시간 ${d.studyHours}시간을 오차 없이 완주하고 뇌 피로도를 최소화하기 위한 필수 루틴입니다.`,
        effect: "장시간 공부 시 뒷심 유지 및 번아웃 예방",
        steps: ["1단계: 타이머를 맞추고 스마트폰은 시야 밖으로 치우기", "2단계: 알람이 울리면 즉시 필기도구를 내려놓고 휴식", "3단계: 휴식 중에는 스마트폰 대신 먼 곳 바라보기 및 심호흡"],
        caution: "휴식 시간에 SNS나 숏폼을 보면 도파민 과다로 다음 블록 집중력이 파괴됩니다."
      };

      return [m1, m2, m3];
    }

    function getConditionAdvice(cond) {
      if (cond === 'very_bad' || cond === 'bad') {
        return "오늘은 컨디션이 저하된 상태이므로 무리한 신규 킬러 문항 진입보다는 '기존 오답 다시 풀기' 및 '기본 개념 요약 읽기' 위주의 저부하 학습을 권장합니다. 휴식 간격을 넉넉히 가져가세요.";
      } else if (cond === 'good' || cond === 'very_good') {
        return "최고의 컨디션입니다! 가장 에너지가 충만한 학습 초반 1~2블록에 본인이 가장 두려워했던 고난도 단원이나 취약 유형을 공략하세요. 흡수율이 극대화됩니다.";
      } else {
        return "안정적인 보통 컨디션입니다. 계획된 50/10 리듬을 꾸준히 유지하시고, 3블록 이후 가벼운 스트레칭으로 맑은 정신을 유지하세요.";
      }
    }

    function getMealAdvice(meal) {
      if (meal === 'hungry') {
        return "출출한 상태에서는 뇌의 포도당 공급이 부족해 집중력이 급격히 떨어집니다. 식사 전이라면 아몬드 한 줌, 바나나, 또는 따뜻한 두유 등 가벼운 건강 간식을 먼저 섭취 후 공부를 시작하세요.";
      } else if (meal === 'done') {
        return "식사 직후 식곤증이 올 수 있습니다. 첫 20분은 졸음을 유발하는 긴 줄글 독해보다는 손을 직접 움직이는 가벼운 문제 풀이나 요약 필기로 시작하세요.";
      } else if (meal === 'soon') {
        return "곧 식사 예정이므로 긴 호흡의 과제보다는 20분 내로 끝낼 수 있는 어휘 암기나 공식 암기 블록을 배치하세요.";
      } else {
        return "학습 중 틈틈이 미온수를 마셔 뇌의 수분을 충분히 보충해 주세요.";
      }
    }

    function generateEncouragementMessage(d) {
      const style = AppState.settings.aiStyle;
      if (style === 'friendly') {
        return `"${d.subject} 공부하느라 정말 고생 많아요! 🥰 작은 한 문제라도 내 손으로 제대로 풀어낸다면 성적은 반드시 따라온답니다. 오늘 준비한 계획대로 차근차근 해봐요. 언제나 곁에서 응원할게요! 🌸✨"`;
      } else if (style === 'professional') {
        return `"목표 성적(${d.targetScore}) 달성은 올바른 전략과 규칙적인 실행의 누적 결과입니다. 감정에 흔들리지 않고 정해진 시간표와 복습 원칙을 지켜나갈 때 가장 빠르고 확실한 성과를 얻을 수 있습니다. 📘"`;
      } else {
        return `"완벽하지 않아도 괜찮습니다. 중요한 것은 남과의 비교가 아닌 어제보다 조금 더 나아진 나의 배움입니다. 오늘의 ${d.studyHours}시간 집중이 분명 의미 있는 결실로 이어질 거예요. 힘내세요! 😊🍀"`;
      }
    }

    function formatTimeRange(startH, currentMin, durationMin) {
      const startTotal = startH * 60 + currentMin;
      const endTotal = startTotal + durationMin;

      const sh = Math.floor(startTotal / 60) % 24;
      const sm = startTotal % 60;
      const eh = Math.floor(endTotal / 60) % 24;
      const em = endTotal % 60;

      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(sh)}:${pad(sm)} ~ ${pad(eh)}:${pad(em)} (${durationMin}분)`;
    }

    function translatePain(p) {
      const map = {
        concept: "개념 이해 부족",
        problem: "문제 풀이 어려움",
        memorize: "암기 어려움",
        focus: "집중력 부족",
        time: "시간 관리 부족",
        method: "공부 방법을 모르겠음",
        etc: "기타 학습 고민"
      };
      return map[p] || p;
    }

    function translateCondition(c) {
      const map = {
        none: "선택 안 함",
        very_bad: "매우 나쁨 😫",
        bad: "나쁨 😞",
        normal: "보통 😐",
        good: "좋음 🙂",
        very_good: "매우 좋음 😄"
      };
      return map[c] || c;
    }

    function translateMeal(m) {
      const map = {
        none: "선택 안 함",
        done: "식사 완료",
        hungry: "배고픔",
        soon: "곧 식사 예정",
        etc: "기타/간식"
      };
      return map[m] || m;
    }

    /* ==========================================================================
       Render Report View
       ========================================================================== */
    function renderReportView() {
      const rep = AppState.report;
      if (!rep) return;

      // Meta Badges
      document.getElementById('rep-learner-badge').innerText = translateLearner(rep.learnerType);
      document.getElementById('rep-subject-badge').innerText = rep.subject;
      document.getElementById('rep-mode-badge').innerText = rep.isDemo ? '⚡ 규칙 기반 맞춤형 학습 추천 시스템' : '🤖 Gemini AI 분석 엔진';
      document.getElementById('rep-date-label').innerText = `분석 일시: ${rep.generatedAt}`;

      // Core Summary
      document.getElementById('sum-status-target').innerText = `${rep.summary.currentState} ➡️ ${rep.summary.targetScore} (${rep.summary.dDayText})`;
      document.getElementById('sum-weakness').innerText = rep.summary.weaknesses;
      document.getElementById('sum-priority').innerText = rep.summary.topPriority;
      document.getElementById('sum-method').innerText = rep.summary.recommendedMethod;
      document.getElementById('sum-method-reason').innerText = rep.summary.recommendReason;

      // Today Tasks
      const tasksContainer = document.getElementById('sum-today-tasks');
      tasksContainer.innerHTML = '';
      rep.summary.todayTasks.forEach(task => {
        const li = document.createElement('li');
        li.innerText = task;
        tasksContainer.appendChild(li);
      });

      // Render 7 Detailed Sections
      const container = document.getElementById('detailed-sections-container');
      container.innerHTML = '';

      rep.sections.forEach((sec) => {
        const card = document.createElement('div');
        card.className = `detail-card ${sec.isExpanded ? 'expanded' : ''}`;
        card.id = `card-${sec.id}`;

        let bodyHtml = '';

        if (sec.methods) {
          bodyHtml = sec.methods.map((m, mIdx) => `
            <div class="detail-content-block" style="background-color:var(--bg-card-subtle); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem;">
              <div style="font-weight:700; color:var(--primary); font-size:1.02rem; margin-bottom:0.3rem;">
                추천 ${mIdx+1}: ${m.name}
              </div>
              <p style="margin-bottom:0.4rem; color:var(--text-main); font-size:0.9rem;">${m.desc}</p>
              <div style="font-size:0.83rem; color:var(--text-muted); margin-bottom:0.4rem;">
                <strong>적합 이유:</strong> ${m.reason}
              </div>
              <div style="font-size:0.83rem; color:var(--success); margin-bottom:0.5rem;">
                <strong>기대 효과:</strong> ${m.effect}
              </div>
              <div style="background-color:var(--bg-card); padding:0.6rem; border-radius:var(--radius-sm); font-size:0.85rem; margin-bottom:0.4rem;">
                <strong>실천 순서:</strong>
                <ul style="margin-left:1.2rem; margin-top:0.25rem;">
                  ${m.steps.map(s => `<li>${s}</li>`).join('')}
                </ul>
              </div>
              <div style="font-size:0.8rem; color:var(--warning);">
                ⚠️ <strong>주의사항:</strong> ${m.caution}
              </div>
            </div>
          `).join('');
        } else if (sec.timetable) {
          bodyHtml = `
            <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom:0.6rem;">
              ${sec.validationNote}
            </div>
            <div style="overflow-x:auto;">
              <table class="timetable-table">
                <thead>
                  <tr>
                    <th>시간대</th>
                    <th>학습 과목 및 활동</th>
                    <th>구분</th>
                    <th>활동 목적</th>
                  </tr>
                </thead>
                <tbody>
                  ${sec.timetable.map(t => `
                    <tr class="${t.type === 'rest' ? 'rest-row' : ''}">
                      <td><strong>${t.timeRange}</strong></td>
                      <td>${t.activity}</td>
                      <td><span class="badge ${t.type === 'rest' ? 'badge-mint' : 'badge-primary'}">${t.type === 'rest' ? '휴식' : '공부'}</span></td>
                      <td style="font-size:0.82rem; color:var(--text-muted);">${t.purpose}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        } else if (sec.blocks) {
          bodyHtml = sec.blocks.map(b => `
            <div class="detail-content-block">
              <div class="detail-block-title">
                <span>🔹</span> ${b.title}
              </div>
              <div style="color:var(--text-main); font-size:0.92rem; padding-left:1.2rem; border-left:2px solid var(--border-color);">
                ${b.text}
              </div>
            </div>
          `).join('');
        }

        card.innerHTML = `
          <div class="detail-card-header" onclick="toggleSection('${sec.id}')">
            <div class="detail-card-left">
              <input type="checkbox" class="detail-checkbox" ${sec.isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleSectionCheck('${sec.id}', this.checked)" title="요약 대상 선택">
              <div class="detail-card-title">
                <span>${sec.icon}</span> ${sec.title}
              </div>
            </div>
            <div class="detail-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); askAiAboutSection('${sec.id}')" title="이 내용으로 AI 상담 시작">
                💬 AI에게 질문하기
              </button>
              <span class="chevron-icon">▼</span>
            </div>
          </div>
          <div class="detail-card-body">
            ${bodyHtml}
          </div>
        `;

        container.appendChild(card);
      });

      // Encouragement Message
      document.getElementById('encouragement-message').innerText = rep.encouragement;
    }

    function toggleSection(secId) {
      const card = document.getElementById(`card-${secId}`);
      if (!card) return;
      card.classList.toggle('expanded');
      const sec = AppState.report.sections.find(s => s.id === secId);
      if (sec) sec.isExpanded = card.classList.contains('expanded');
    }

    function toggleSectionCheck(secId, isChecked) {
      const sec = AppState.report.sections.find(s => s.id === secId);
      if (sec) sec.isChecked = isChecked;
    }

    function toggleAllSections(expand) {
      if (!AppState.report) return;
      AppState.report.sections.forEach(sec => {
        sec.isExpanded = expand;
        const card = document.getElementById(`card-${sec.id}`);
        if (card) {
          if (expand) card.classList.add('expanded');
          else card.classList.remove('expanded');
        }
      });
    }

    function translateLearner(type) {
      const map = {
        middle: '중학생 (기초/내신)',
        high: '고등학생 (내신/수능)',
        univ: '대학생 (학점/전공)',
        exam: '수험생 (자격증/고시)'
      };
      return map[type] || '학생';
    }

    /* ==========================================================================
       Section Summarization & Modal
       ========================================================================== */
    function summarizeSelectedSections() {
      const rep = AppState.report;
      if (!rep) return;

      const checkedSections = rep.sections.filter(s => s.isChecked);
      if (checkedSections.length === 0) {
        showToast('요약할 상세 분석 카드를 1개 이상 체크박스로 선택해주세요.');
        return;
      }

      let summaryHtml = `
        <div style="margin-bottom:1rem; padding:0.75rem; background-color:var(--primary-light); border-radius:var(--radius-md); font-size:0.88rem; color:var(--primary); font-weight:600;">
          총 ${checkedSections.length}개 선택 항목의 핵심 학습 가이드 종합 요약본입니다.
        </div>
      `;

      checkedSections.forEach(s => {
        summaryHtml += `
          <div style="margin-bottom:1.2rem; border-bottom:1px dashed var(--border-color); padding-bottom:0.8rem;">
            <h4 style="font-size:1rem; font-weight:700; color:var(--text-main); margin-bottom:0.4rem;">
              ${s.icon} ${s.title}
            </h4>
        `;
        if (s.blocks) {
          s.blocks.forEach(b => {
            summaryHtml += `
              <div style="font-size:0.88rem; margin-bottom:0.35rem; color:var(--text-muted);">
                <strong>• ${b.title}:</strong> ${b.text}
              </div>
            `;
          });
        } else if (s.methods) {
          summaryHtml += `
            <div style="font-size:0.88rem; color:var(--text-muted);">
              <strong>• 추천 공부법 1순위:</strong> ${s.methods[0].name} (${s.methods[0].reason})
            </div>
          `;
        } else if (s.timetable) {
          summaryHtml += `
            <div style="font-size:0.88rem; color:var(--text-muted);">
              <strong>• 시간표 요약:</strong> ${s.validationNote}
            </div>
          `;
        }
        summaryHtml += `</div>`;
      });

      document.getElementById('modal-summary-content').innerHTML = summaryHtml;
      document.getElementById('modal-summary').classList.add('active');
    }

    function closeSummaryModal() {
      document.getElementById('modal-summary').classList.remove('active');
    }

    function copySelectedSummaryText() {
      const content = document.getElementById('modal-summary-content').innerText;
      navigator.clipboard.writeText(content).then(() => {
        showToast('요약 내용이 클립보드에 복사되었습니다.');
      }).catch(() => {
        showToast('복사에 실패했습니다. 수동으로 복사해주세요.');
      });
    }

    function copyFullReportSummary() {
      const rep = AppState.report;
      if (!rep) return;
      const text = `[StudyMate AI - ${rep.subject} 맞춤 학습 요약]\n` +
                   `• 현재 vs 목표: ${rep.summary.currentState} -> ${rep.summary.targetScore}\n` +
                   `• 취약 영역: ${rep.summary.weaknesses}\n` +
                   `• 최우선 과제: ${rep.summary.topPriority}\n` +
                   `• 추천 공부법: ${rep.summary.recommendedMethod}\n` +
                   `• 오늘 실천 과제:\n${rep.summary.todayTasks.map((t, i) => `  ${i+1}. ${t}`).join('\n')}`;
      navigator.clipboard.writeText(text).then(() => {
        showToast('핵심 요약이 클립보드에 복사되었습니다.');
      });
    }

    function savePlanToMyStudy() {
      showToast('학습 계획이 나의 학습 공간에 성공적으로 저장되었습니다!');
      navigateTo('mystudy');
    }

    function reAnalyze() {
      if (confirm('현재 입력된 정보로 학습 계획을 재분석하시겠습니까?')) {
        startAnalysisWithAnimation();
      }
    }

    /* ==========================================================================
       AI Chat Coach (Consultation & Dynamic Plan Modification)
       ========================================================================== */
    function askAiAboutSection(secId) {
      const sec = AppState.report.sections.find(s => s.id === secId);
      if (!sec) return;

      navigateTo('coach');
      
      const prompt = `[${sec.title}] 항목에 대해 더 자세한 추천 이유와 실천 시 겪을 수 있는 어려움을 해결하는 팁을 알려줘!`;
      addChatMessage('user', prompt, sec.title);
      generateCoachReply(prompt, sec.title);
    }

    function sendQuickPrompt(promptText) {
      document.getElementById('chat-input-text').value = '';
      addChatMessage('user', promptText);
      generateCoachReply(promptText);
    }

    function handleChatSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input-text');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      addChatMessage('user', text);
      generateCoachReply(text);
    }

    function addChatMessage(sender, text, context = null) {
      const msg = {
        id: 'msg_' + Date.now(),
        sender: sender,
        text: text,
        context: context,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };
      AppState.chatMessages.push(msg);
      SafeStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(AppState.chatMessages));
      renderChatBubble(msg);
    }

    function renderChatView() {
      const box = document.getElementById('chat-messages-box');
      box.innerHTML = '';

      if (AppState.chatMessages.length === 0) {
        addChatMessage('ai', `안녕하세요! 전담 AI 학습 코치입니다. 😊🍀\n선택하신 '${AppState.diagnosis.subject || '학습'}' 과목에 대해 궁금한 점이나 시간표 조정이 필요하시면 언제든 편하게 질문해 주세요!`);
      } else {
        AppState.chatMessages.forEach(msg => renderChatBubble(msg));
      }

      const isRealAi = !!AppState.settings.apiKey;
      document.getElementById('chat-mode-badge').innerText = isRealAi ? '🤖 Gemini 실시간 AI 연결' : '⚡ 규칙 기반 맞춤 코칭 모드';
      document.getElementById('chat-system-status').innerText = isRealAi 
        ? '🤖 Google Gemini AI와 1:1 실시간 대화 중입니다.' 
        : '💡 현재 브라우저 내장 규칙 기반 맞춤 코칭 가이드가 작동 중입니다.';
    }

    function renderChatBubble(msg) {
      const box = document.getElementById('chat-messages-box');
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.sender}`;

      let contextHtml = '';
      if (msg.context) {
        contextHtml = `<div class="chat-bubble-context">연계 항목: ${msg.context}</div><br>`;
      }

      bubble.innerHTML = `
        ${contextHtml}
        <div>${msg.text.replace(/\n/g, '<br>')}</div>
        <div class="chat-bubble-time">${msg.time}</div>
      `;

      box.appendChild(bubble);
      box.scrollTop = box.scrollHeight;
    }

    async function generateCoachReply(userQuery, contextTitle = null) {
      if (AppState.settings.apiKey) {
        try {
          await callGeminiApi(userQuery, contextTitle);
          return;
        } catch (err) {
          console.error('Gemini API call failed, falling back to rule engine:', err);
          showToast('Gemini API 연결 지연으로 규칙 기반 코칭 엔진으로 전환합니다.');
        }
      }

      // Rule-based conversational logic
      setTimeout(() => {
        let reply = "";
        const style = AppState.settings.aiStyle;
        const sub = AppState.diagnosis.subject || "해당 과목";

        if (userQuery.includes('여유') || userQuery.includes('줄여') || userQuery.includes('시간표')) {
          reply = `네, 학생분의 피로도를 고려하여 시간표를 30분 여유롭게 단축하고 휴식 간격을 15분으로 늘려 조정했습니다!\n\n` +
                  `[수정된 계획 제안]\n• 1블록: ${sub} 필수 개념 및 오답 복습 (35분)\n• 휴식: 15분 편안한 스트레칭\n• 2블록: 핵심 문제 5개 선별 풀이 (35분)\n\n` +
                  `이 수정된 시간표를 '나의 학습 공간'에 즉시 반영하시겠습니까?`;
        } else if (userQuery.includes('인출') || userQuery.includes('암기') || userQuery.includes('비법')) {
          reply = `암기가 잘 안 되는 것은 학생분의 기억력이 나빠서가 아니라, '입력(Input) 중심'으로만 공부했기 때문입니다. 😊\n\n` +
                  `[효과적인 백지 인출 3단계 팁]\n1. 20분간 눈으로 읽은 뒤 책을 완전히 덮으세요.\n2. 머릿속에 떠오르는 공식과 키워드 3가지만 종이에 거칠게 적어보세요.\n3. 책을 열고 빠뜨린 핵심을 색깔 펜으로 표시하세요.\n\n이렇게 '인출 실패'를 경험할 때 뇌의 시냅스가 가장 강력하게 형성됩니다!`;
        } else if (userQuery.includes('실수') || userQuery.includes('오답') || userQuery.includes('계산')) {
          reply = `계산 실수나 문제 조건 오독을 줄이기 위한 가장 확실한 방법은 **'문제 발문 끊어 읽기'**입니다.\n\n` +
                  `1. 문제에서 '단, ~이다', '모든 양수 x' 같은 제한 조건에는 무조건 동그라미를 치세요.\n` +
                  `2. 풀이 과정을 연습장 구석에 날려 쓰지 말고 줄이 쳐진 연습장에 단계별로 번호를 매기며 정서하세요.\n` +
                  `3. 시험 종료 5분 전에는 푼 문제를 새로 푸는 게 아니라 '조건 누락 여부'만 검토해도 1개 등급이 올라갑니다!`;
        } else {
          reply = `'${sub}' 학습에서 가장 중요한 것은 지금 마주한 1개의 개념을 온전히 자신의 언어로 설명할 수 있는가입니다.\n\n` +
                  `추천해 드린 공부법 중 첫 단계부터 오늘 바로 20분만 시작해 보세요. 작은 성공 경험이 쌓이면 목표 점수는 자연스럽게 달성됩니다. 더 구체적으로 알고 싶은 단원이 있다면 언제든 말씀해 주세요! 🍀`;
        }

        if (style === 'friendly') {
          reply = "🥰 " + reply + " 함께 힘내봐요! 파이팅! ✨";
        } else if (style === 'professional') {
          reply = "📘 [AI 전담 코치 분석] " + reply;
        }

        addChatMessage('ai', reply);
      }, 600);
    }

    async function callGeminiApi(userQuery, contextTitle) {
      const apiKey = AppState.settings.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const systemPrompt = `당신은 대한민국 학생/수험생을 위한 1:1 맞춤형 AI 전담 학습 코치 StudyMate AI입니다.
학습자 유형: ${AppState.diagnosis.learnerType}, 과목: ${AppState.diagnosis.subject}, 현재수준: ${AppState.diagnosis.currentScore || '미입력'}, 목표: ${AppState.diagnosis.targetScore}, 오늘 가능시간: ${AppState.diagnosis.studyHours}시간.
응답 스타일: ${AppState.settings.aiStyle}.
원칙: 1) 전문성과 정확성을 우선하며 모든 추천에 이유(무엇을, 왜, 어떻게, 기대효과)를 제공합니다. 2) 친근하고 격려하는 어조를 유지하되 과장된 성공을 단정하지 않습니다. 3) 간결하고 실천 가능한 솔루션을 제공합니다.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n[사용자 질문]\n컨텍스트: ${contextTitle || '전체 학습 진단'}\n질문: ${userQuery}` }] }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API error status: ${response.status}`);
      }

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성하지 못했습니다.";
      addChatMessage('ai', aiText);
    }

    function clearChatHistory() {
      if (confirm('대화 기록을 비우시겠습니까?')) {
        AppState.chatMessages = [];
        SafeStorage.removeItem(STORAGE_KEY_CHAT);
        renderChatView();
        showToast('대화 기록이 삭제되었습니다.');
      }
    }

    function copyChatHistory() {
      if (AppState.chatMessages.length === 0) return;
      const text = AppState.chatMessages.map(m => `[${m.sender.toUpperCase()} - ${m.time}]\n${m.text}`).join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        showToast('전체 대화 내용이 복사되었습니다.');
      });
    }

    /* ==========================================================================
       My Study Page (Checklist, Timetable, Reflection, History)
       ========================================================================== */
    function renderMyStudyView() {
      const myStudy = AppState.myStudy;
      const diag = AppState.diagnosis;

      document.getElementById('plan-subject-title').innerText = `${diag.subject || '학습'} 성적 향상 플랜`;
      document.getElementById('plan-date-badge').innerText = diag.lastDiagnosisDate || new Date().toLocaleDateString('ko-KR');

      // 1. Render Checklist
      const checklistContainer = document.getElementById('tasks-checklist-container');
      checklistContainer.innerHTML = '';

      if (!myStudy.todayTasks || myStudy.todayTasks.length === 0) {
        checklistContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            등록된 오늘 학습 과제가 없습니다. 먼저 <a href="javascript:navigateTo('diagnosis')" style="color:var(--primary); font-weight:700;">학습 진단</a>을 받거나 위에서 과제를 추가해 보세요.
          </div>
        `;
      } else {
        myStudy.todayTasks.forEach(task => {
          const item = document.createElement('div');
          item.className = `task-item ${task.done ? 'completed' : ''}`;
          item.innerHTML = `
            <div class="task-left">
              <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} onchange="toggleTaskDone('${task.id}', this.checked)">
              <div>
                <div class="task-text" style="font-size:0.95rem; font-weight:600; color:var(--text-main);">${task.title}</div>
                <div class="task-meta">
                  <span>⏱️ ${task.duration}</span>
                  <span>•</span>
                  <span class="badge ${task.priority === '최우선' ? 'badge-primary' : 'badge-mint'}">${task.priority}</span>
                </div>
              </div>
            </div>
            <button class="icon-btn" style="width:30px; height:30px;" onclick="deleteTask('${task.id}')" title="과제 삭제">
              ✕
            </button>
          `;
          checklistContainer.appendChild(item);
        });
      }

      updateProgressStats();

      // 2. Render Schedule Timetable
      const tbody = document.getElementById('mystudy-timetable-body');
      tbody.innerHTML = '';

      if (!myStudy.schedule || myStudy.schedule.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">시간표 정보가 없습니다.</td></tr>`;
      } else {
        myStudy.schedule.forEach(t => {
          const tr = document.createElement('tr');
          if (t.type === 'rest') tr.className = 'rest-row';
          tr.innerHTML = `
            <td><strong>${t.timeRange}</strong></td>
            <td>${t.activity}</td>
            <td><span class="badge ${t.type === 'rest' ? 'badge-mint' : 'badge-primary'}">${t.type === 'rest' ? '휴식' : '공부'}</span></td>
            <td style="font-size:0.82rem; color:var(--text-muted);">${t.purpose}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Reflection
      if (myStudy.reflection) {
        if (myStudy.reflection.understanding) document.getElementById('reflect-understanding').value = myStudy.reflection.understanding;
        if (myStudy.reflection.reviewNeeded) document.getElementById('reflect-need-review').value = myStudy.reflection.reviewNeeded;
        if (myStudy.reflection.memo) document.getElementById('reflect-memo').value = myStudy.reflection.memo;
      }
    }

    function toggleTaskDone(taskId, isDone) {
      const task = AppState.myStudy.todayTasks.find(t => t.id === taskId);
      if (task) {
        task.done = isDone;
        saveMyStudyState();
        renderMyStudyView();
        if (isDone) showToast('과제를 완료했습니다! 멋져요 👏');
      }
    }

    function deleteTask(taskId) {
      AppState.myStudy.todayTasks = AppState.myStudy.todayTasks.filter(t => t.id !== taskId);
      saveMyStudyState();
      renderMyStudyView();
      showToast('과제가 삭제되었습니다.');
    }

    function updateProgressStats() {
      const tasks = AppState.myStudy.todayTasks || [];
      const total = tasks.length;
      const completed = tasks.filter(t => t.done).length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      document.getElementById('tasks-progress-percent').innerText = `${percent}%`;
      document.getElementById('tasks-progress-count').innerText = `완료 ${completed} / ${total}개 과제`;
      document.getElementById('tasks-progress-fill').style.width = `${percent}%`;
    }

    function resetTodayTasks() {
      if (confirm('오늘 과제 체크리스트를 모두 미완료 상태로 초기화하시겠습니까?')) {
        AppState.myStudy.todayTasks.forEach(t => t.done = false);
        saveMyStudyState();
        renderMyStudyView();
        showToast('체크리스트가 초기화되었습니다.');
      }
    }

    function saveMyStudyState() {
      SafeStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(AppState.myStudy));
    }

    function openAddTaskModal() {
      document.getElementById('input-new-task-title').value = '';
      document.getElementById('modal-add-task').classList.add('active');
    }

    function closeAddTaskModal() {
      document.getElementById('modal-add-task').classList.remove('active');
    }

    function confirmAddTask() {
      const title = document.getElementById('input-new-task-title').value.trim();
      if (!title) {
        showToast('과제명을 입력해 주세요.');
        return;
      }

      const duration = document.getElementById('input-new-task-duration').value;
      const priority = document.getElementById('input-new-task-priority').value;

      const newTask = {
        id: 'task_' + Date.now(),
        title: title,
        subject: AppState.diagnosis.subject || '학습',
        priority: priority,
        duration: duration,
        done: false
      };

      if (!AppState.myStudy.todayTasks) AppState.myStudy.todayTasks = [];
      AppState.myStudy.todayTasks.push(newTask);
      saveMyStudyState();
      closeAddTaskModal();
      renderMyStudyView();
      showToast('새 과제가 추가되었습니다.');
    }

    function saveReflectionRecord() {
      const understanding = document.getElementById('reflect-understanding').value;
      const reviewNeeded = document.getElementById('reflect-need-review').value;
      const memo = document.getElementById('reflect-memo').value.trim();

      AppState.myStudy.reflection = {
        understanding: understanding,
        reviewNeeded: reviewNeeded,
        memo: memo,
        date: new Date().toLocaleDateString('ko-KR')
      };
      saveMyStudyState();

      const guideBox = document.getElementById('reflection-next-guide');
      guideBox.style.display = 'block';
      if (reviewNeeded === 'yes' || understanding <= 2) {
        guideBox.innerHTML = `<strong>💡 AI 다음 학습 가이드:</strong> 오늘 어려웠던 부분을 내일 첫 학습 시작 전 20분간 우선 복습하는 [보충 리마인드 루틴]을 추천합니다. 무리한 진도 나가기는 지양하세요!`;
      } else {
        guideBox.innerHTML = `<strong>💡 AI 다음 학습 가이드:</strong> 개념 이해도가 높습니다! 다음 단계인 실전 기출 문항 및 준킬러 문제 풀이로 진도를 확장해 나가세요. 잘하고 계십니다!`;
      }

      const histItem = {
        id: 'hist_' + Date.now(),
        date: new Date().toLocaleDateString('ko-KR'),
        subject: AppState.diagnosis.subject || '자율학습',
        completedTasks: AppState.myStudy.todayTasks.filter(t => t.done).length,
        totalTasks: AppState.myStudy.todayTasks.length,
        memo: memo || '특이사항 없음'
      };

      AppState.history.unshift(histItem);
      SafeStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(AppState.history));
      renderHistoryList();

      showToast('오늘의 학습 회고와 기록이 저장되었습니다! 👏');
    }

    function renderHistoryList() {
      const container = document.getElementById('history-list-container');
      if (!container) return;

      if (!AppState.history || AppState.history.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); padding:0.5rem 0;">저장된 이전 기록이 없습니다.</div>`;
        return;
      }

      container.innerHTML = AppState.history.map((h) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color);">
          <div>
            <strong>${h.date} - ${h.subject}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted); margin-left:0.5rem;">(과제 완료: ${h.completedTasks}/${h.totalTasks})</span>
            <div style="font-size:0.82rem; color:var(--text-light);">${h.memo}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="deleteHistoryItem('${h.id}')">삭제</button>
        </div>
      `).join('');
    }

    function deleteHistoryItem(id) {
      AppState.history = AppState.history.filter(h => h.id !== id);
      SafeStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(AppState.history));
      renderHistoryList();
      showToast('기록이 삭제되었습니다.');
    }

    function clearAllHistory() {
      if (confirm('저장된 모든 학습 이력 기록을 삭제하시겠습니까?')) {
        AppState.history = [];
        SafeStorage.removeItem(STORAGE_KEY_HISTORY);
        renderHistoryList();
        showToast('모든 기록이 삭제되었습니다.');
      }
    }

    /* ==========================================================================
       Toast Helper
       ========================================================================== */
    function showToast(message) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span>🍀</span> <span>${message}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
      }, 2700);
    }
