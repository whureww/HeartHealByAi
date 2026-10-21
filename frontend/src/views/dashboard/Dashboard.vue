<template>
  <div class="app-wrap">
    <!-- 左侧导航栏 -->
    <aside class="left-sidebar">
      <div class="logo-box">
        <div class="logo-mark"><AppIcon name="brand" :size="19" /></div>
        <div class="logo-text">
          <h2>{{ $t('common.appName') }}</h2>
          <p>{{ $t('dashboard.nav.subtitle') }}</p>
        </div>
      </div>
      <nav class="menu-list">
        <button
          v-for="item in menuItems"
          :key="item.id"
          :class="{ active: currentPage === item.id }"
          @click="switchPage(item.id)">
          <AppIcon :name="item.icon" :size="17" />
          <span class="menu-text">{{ $t(item.name) }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="footer-user">
          <div class="footer-avatar">
            <img
              v-if="userStore.userInfo?.avatar"
              :src="userStore.userInfo.avatar"
              :alt="$t('dashboard.common.avatar')"
            />
            <span v-else class="footer-avatar-text">{{ userStore.userInfo?.username?.[0]?.toUpperCase() || '?' }}</span>
          </div>
          <span class="footer-name">{{ userStore.userInfo?.username || $t('dashboard.common.defaultUser') }}</span>
          <button class="btn-logout" :title="$t('dashboard.settings.logout')" @click="logout">
            <AppIcon name="logout" :size="16" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 中间主内容区 -->
    <div class="main-content">
      <!-- 空白提示 -->
      <div v-if="!currentPage" class="empty-tip">
        {{ $t('dashboard.common.emptyTip') }}
      </div>

      <!-- 1. AI倾诉页面 -->
      <div v-if="currentPage === 'chat'" class="page show">
        <div class="chat-layout">
          <!-- 左侧：可折叠会话列表 -->
          <aside :class="['session-sidebar', { collapsed: sessionCollapsed }]">
            <div class="session-head">
              <template v-if="!sessionCollapsed">
                <span class="session-title">{{ $t('dashboard.session.history') }}</span>
                <button class="ss-icon-btn" :title="$t('dashboard.session.collapseSidebar')" @click="sessionCollapsed = true">
                  <AppIcon name="back" :size="14" />
                </button>
              </template>
              <button v-else class="ss-icon-btn" :title="$t('dashboard.session.expandSidebar')" @click="sessionCollapsed = false">
                <AppIcon name="chevronRight" :size="14" />
              </button>
            </div>

            <button class="new-chat-btn" :class="{ mini: sessionCollapsed }" @click="startNewSession">
              <AppIcon name="plus" :size="14" />
              <span v-if="!sessionCollapsed">{{ $t('dashboard.chat.newSession') }}</span>
            </button>

            <div v-if="!sessionCollapsed" class="session-list">
              <div
                v-for="s in chatSessions"
                :key="s.session_id"
                :class="['session-item', { active: s.session_id === activeSessionId }]"
                :title="Number(s.locked) === 1 ? $t('dashboard.session.createdAtLocked', { time: formatSessionFull(s.created_at) }) : $t('dashboard.session.createdAt', { time: formatSessionFull(s.created_at) })"
                @click="openSession(s.session_id)"
              >
                <AppIcon name="chat" :size="14" class="si-icon" />
                <div class="si-body">
                  <span class="si-title">{{ s.title || $t('dashboard.session.untitled') }}</span>
                  <span class="si-meta">
                    <AppIcon name="clock" :size="11" />
                    {{ $t('dashboard.session.meta', { time: formatSessionTime(s.created_at), count: s.message_count }) }}
                  </span>
                </div>
                <button
                  class="si-act"
                  :class="{ 'is-locked': Number(s.locked) === 1 }"
                  :title="Number(s.locked) === 1 ? $t('dashboard.session.lockedTip') : $t('dashboard.session.lockTip')"
                  @click.stop="toggleLock(s)"
                >
                  <AppIcon name="lock" :size="13" />
                </button>
                <button
                  v-if="Number(s.locked) !== 1"
                  class="si-act si-del"
                  :title="$t('dashboard.session.delete')"
                  @click.stop="removeSession(s)"
                >
                  <AppIcon name="trash" :size="13" />
                </button>
              </div>
              <div v-if="!chatSessions.length" class="session-empty">
                {{ $t('dashboard.session.empty') }}
              </div>
            </div>
          </aside>

          <!-- 右侧：聊天主区 -->
          <div class="card chat-card chat-main">
            <div class="chat-head">
              <h3>{{ $t('dashboard.chat.title') }}</h3>
              <div class="chat-head-tools">
                <!-- 实时翻译开关 + 目标语言 + 视图模式（译文不落库，仅本次展示） -->
                <div class="translate-picker">
                  <button
                    class="model-chip"
                    :class="{ open: chatTranslateMenu, active: chatTranslateEnabled }"
                    :title="$t('dashboard.chat.translateTip')"
                    @click.stop="chatTranslateMenu = !chatTranslateMenu"
                  >
                    <AppIcon name="globe" :size="12" />
                    <span>{{ chatTranslateEnabled ? langLabel(chatTranslateTarget) : $t('dashboard.chat.translate') }}</span>
                    <AppIcon name="chevronDown" :size="12" />
                  </button>
                  <div v-if="chatTranslateMenu" class="translate-menu" @click.stop>
                    <div class="tm-row">
                      <span>{{ $t('dashboard.chat.enableTranslate') }}</span>
                      <button
                        class="tm-switch"
                        :class="{ on: chatTranslateEnabled }"
                        role="switch"
                        :aria-checked="chatTranslateEnabled"
                        @click="toggleChatTranslate"
                      ><span class="tm-knob"></span></button>
                    </div>
                    <div class="tm-row">
                      <span>{{ $t('dashboard.chat.translateTarget') }}</span>
                      <select v-model="chatTranslateTarget" class="tm-select" :disabled="!chatTranslateEnabled">
                        <option v-for="code in TRANSLATE_LANGS" :key="code" :value="code">{{ langLabel(code) }}</option>
                      </select>
                    </div>
                    <div class="tm-row">
                      <span>{{ $t('dashboard.chat.viewMode') }}</span>
                      <div class="tm-seg">
                        <button :class="{ on: chatViewMode === 'original' }" @click="chatViewMode = 'original'">{{ $t('dashboard.chat.viewOriginal') }}</button>
                        <button :class="{ on: chatViewMode === 'translated' }" @click="chatViewMode = 'translated'">{{ $t('dashboard.chat.viewTranslated') }}</button>
                        <button :class="{ on: chatViewMode === 'bilingual' }" @click="chatViewMode = 'bilingual'">{{ $t('dashboard.chat.viewBilingual') }}</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="model-picker">
                  <button
                    class="model-chip"
                    :title="$t('dashboard.chat.modelConfigTip')"
                    @click="openModelSettings"
                  >
                    <AppIcon name="spark" :size="12" />
                    <span>{{ selectedModelLabel }}</span>
                    <AppIcon name="chevronDown" :size="12" />
                  </button>
                </div>
              </div>
            </div>
            <div class="chat-box" ref="chatBox">
              <button
                v-if="hasMoreMsgs && !sessionLoading"
                class="load-more-btn"
                :disabled="loadingMore"
                @click="loadMoreMessages"
              >{{ loadingMore ? $t('dashboard.chat.loadingMore') : $t('dashboard.chat.loadMore') }}</button>
              <div class="msg-item">
                <div class="msg-ai selectable-text">{{ $t('dashboard.chat.greeting') }}</div>
              </div>
              <div v-for="(msg, index) in chatMessages" :key="index" class="msg-item">
                <!-- AI 消息：存在译文且非原文视图时按 译文/双语 展示（历史消息无译文回落原文） -->
                <div
                  v-if="msg.type === 'ai' && msg.translated && chatViewMode !== 'original'"
                  class="msg-ai selectable-text"
                >
                  <template v-if="chatViewMode === 'bilingual'">{{ msg.content }}</template>
                  <div :class="{ 'msg-translated': chatViewMode === 'bilingual' }">{{ msg.translated }}</div>
                </div>
                <div v-else :class="[msg.type === 'user' ? 'msg-user' : 'msg-ai', 'selectable-text']">{{ msg.content }}</div>
              </div>
              <!-- 流式输出中的 AI 消息（开启翻译时译文随句追加；译文未到前先显示原文） -->
              <div v-if="streamingContent || streamingTranslated" class="msg-item">
                <div class="msg-ai selectable-text streaming">
                  <template v-if="chatViewMode === 'original' || !streamingTranslated">{{ streamingContent }}</template>
                  <div v-if="chatViewMode !== 'original' && streamingTranslated" :class="{ 'msg-translated': chatViewMode === 'bilingual' }">{{ streamingTranslated }}</div>
                  <span class="cursor">|</span>
                </div>
              </div>
            </div>
            <div class="input-row">
              <input
                v-model="chatInput"
                type="text"
                :placeholder="$t('dashboard.chat.inputPlaceholder')"
                @keyup.enter="sendChat"
                :disabled="aiLoading">
              <button class="btn-send-chat" @click="sendChat" :disabled="aiLoading || !chatInput.trim()">
                <AppIcon v-if="!aiLoading" name="send" :size="15" />
                <AppIcon v-else name="spark" :size="15" class="spin" />
                <span>{{ aiLoading ? $t('dashboard.chat.thinking') : $t('dashboard.chat.send') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 心理测评页面 -->
      <div v-if="currentPage === 'test'" class="page show">
        <TestList
          v-if="userStore.currentTestView === 'list'"
          @view-history="userStore.switchTestView('history')"
          @start-test="onStartTest"
          @start-ai-test="onStartAiTest"
        />
        <TestHistory 
          v-else-if="userStore.currentTestView === 'history'" 
          @go-back="userStore.resetTestView()"
          @view-detail="onViewDetail"
        />
        <TestResultDetail
          v-else-if="userStore.currentTestView === 'detail' && userStore.currentResultId !== null"
          :result-id="userStore.currentResultId"
          @go-back="userStore.switchTestView('history')"
        />
      </div>

      <!-- 3. 专家问诊页面 -->
      <div v-if="currentPage === 'doctor'" class="page show">
        <div class="card">
          <h3>{{ $t('dashboard.doctor.title') }}</h3>
          <!-- 仅首次（无缓存数据）显示加载条：重取时静默刷新，避免加载条把已有内容向下压 -->
          <div v-if="loading.doctors && !userStore.doctors.length" class="loading-text">{{ $t('dashboard.common.loading') }}</div>
          <div class="scroll-content doc-scroll">
            <div class="doc-grid">
              <div v-for="doc in userStore.doctors" :key="doc.id" class="doc-card">
                <div class="doc-card-head">
                  <img v-if="doc.avatar" :src="doc.avatar" class="doc-avatar" alt="" />
                  <span v-else class="doc-avatar doc-avatar-fallback">{{ (docField(doc, 'name') || '?').charAt(0) }}</span>
                  <div class="doc-head-info">
                    <h4>{{ docField(doc, 'name') }}</h4>
                    <span class="doc-title">{{ docField(doc, 'title') }}</span>
                  </div>
                  <span class="online-badge" :class="{ online: isUserOnline(doc.user_id) }">
                    <span class="status-dot" :class="{ online: isUserOnline(doc.user_id) }"></span>
                    {{ isUserOnline(doc.user_id) ? $t('dashboard.doctor.online') : $t('dashboard.doctor.offline') }}
                  </span>
                </div>
                <div class="doc-card-body">
                  <p class="doc-specialty"><span class="doc-label">{{ $t('dashboard.doctor.specialtyLabel') }}</span>{{ docField(doc, 'specialty') || $t('dashboard.doctor.notFilled') }}</p>
                  <p class="doc-intro"><span class="doc-label">{{ $t('dashboard.doctor.introLabel') }}</span>{{ docField(doc, 'intro') || $t('dashboard.doctor.noIntro') }}</p>
                </div>
                <div class="doc-card-foot">
                  <button class="btn-book" @click="bookDoctor(doc)">{{ $t('dashboard.doctor.bookNow') }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 周期AI分析报告 -->
      <div v-if="currentPage === 'analysis'" class="page show">
        <div class="card">
          <h3>{{ $t('dashboard.report.title') }}</h3>
          <p class="sub-title">
            {{ $t('dashboard.report.subtitle') }}
          </p>
          <div class="time-select">
            <DateSelect v-model="startDate" />
            <span>{{ $t('dashboard.report.to') }}</span>
            <DateSelect v-model="endDate" />
            <button @click="createReport" :disabled="reportLoading">
              {{ reportLoading ? $t('dashboard.report.generating') : $t('dashboard.report.generateBtn') }}
            </button>
          </div>
          <div class="scroll-content">
            <div v-if="reportLoading" class="loading-text">
              <AppIcon name="spark" class="spin" /> {{ $t('dashboard.report.loadingTip') }}
            </div>
            <div v-else-if="!reportContent" class="report-empty">
              <div class="report-empty-mark"><AppIcon name="moon" :size="22" /></div>
              <p class="report-empty-title">{{ $t('dashboard.report.emptyTitle') }}</p>
              <p class="report-empty-sub">{{ $t('dashboard.report.emptySub') }}</p>
            </div>
            <div v-else class="report-result selectable-text">
              <div class="report-doc" v-html="reportHtml"></div>
            </div>
          </div>
          <!-- 导出报告按钮（已翻译时可切换原文/译文视图；翻译前可选 32 语种目标语言） -->
          <div v-if="reportContent && !reportLoading" class="report-actions">
            <template v-if="!translationText">
              <select v-model="reportTranslateTarget" class="btn-export lang-select" :disabled="translating">
                <option v-for="code in TRANSLATE_LANGS" :key="code" :value="code">{{ langLabel(code) }}</option>
              </select>
              <button
                class="btn-export"
                :disabled="translating"
                @click="translateCurrentReport"
              ><AppIcon name="globe" :size="15" /> {{ translating ? $t('dashboard.report.translating') : $t('dashboard.report.translate') }}</button>
            </template>
            <button
              v-else
              class="btn-export"
              @click="showingTranslation = !showingTranslation"
            ><AppIcon name="globe" :size="15" /> {{ showingTranslation ? $t('dashboard.report.viewOriginal') : $t('dashboard.report.viewTranslation') }}</button>
            <button class="btn-export" @click="exportReport"><AppIcon name="fileText" :size="15" /> {{ $t('dashboard.report.copyContent') }}</button>
            <button class="btn-export" @click="downloadReport"><AppIcon name="download" :size="15" /> {{ $t('dashboard.report.exportHtml') }}</button>
          </div>
        </div>
      </div>

      <!-- 5. 个人中心页面 -->
      <div v-if="currentPage === 'user'" class="page show">
        <div class="settings-page">

          <!-- 用户信息头部 - 可点击编辑 -->
          <div class="settings-profile" @click="showEditProfile">
            <div class="user-avatar">
              <img
                v-if="userStore.userInfo?.avatar"
                :src="userStore.userInfo.avatar"
                class="avatar-img"
                :alt="$t('dashboard.common.avatar')"
              />
              <div v-else class="avatar-placeholder">
                {{ userStore.userInfo?.username?.[0]?.toUpperCase() || '?' }}
              </div>
            </div>
            <div class="user-base-info">
              <h4>{{ userStore.userInfo?.username || $t('dashboard.common.defaultUser') }}</h4>
              <p>{{ userRoleText }}</p>
            </div>
            <span class="edit-icon"><AppIcon name="edit" :size="16" /></span>
          </div>

          <!-- 普通用户统计 -->
          <div v-if="userStore.userInfo?.role === 1" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>{{ $t('dashboard.stats.myData') }}</h3></div>
            <div class="settings-group-body">
            <div v-if="loading.stats" class="loading-text">{{ $t('dashboard.common.loading') }}</div>
            <div v-else class="user-data-list">
              <div class="data-item">
                <div class="num">{{ userChatCount }}</div>
                <div class="text">{{ $t('dashboard.stats.chatCount') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.testCount || 0 }}</div>
                <div class="text">{{ $t('dashboard.stats.testCount') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.doctorCount || 0 }}</div>
                <div class="text">{{ $t('dashboard.stats.doctorCount') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.reportCount || 0 }}</div>
                <div class="text">{{ $t('dashboard.stats.reportCount') }}</div>
              </div>
            </div>
            </div>
          </div>

          <!-- 专家统计 -->
          <div v-if="userStore.userInfo?.role === 2" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>{{ $t('dashboard.stats.expertData') }}</h3></div>
            <div class="settings-group-body">
            <div v-if="loading.stats" class="loading-text">{{ $t('dashboard.common.loading') }}</div>
            <div v-else class="user-data-list expert-stats">
              <div class="data-item">
                <div class="num">{{ expertStats.pendingCount }}</div>
                <div class="text">{{ $t('dashboard.stats.pendingAppointments') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.completedCount }}</div>
                <div class="text">{{ $t('dashboard.stats.completedSessions') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.unfinishedCount }}</div>
                <div class="text">{{ $t('dashboard.stats.unfinishedSessions') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.totalPatients }}</div>
                <div class="text">{{ $t('dashboard.stats.totalUsers') }}</div>
              </div>
            </div>
            </div>
          </div>

          <!-- 管理员统计 -->
          <div v-if="userStore.userInfo?.role === 3" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>{{ $t('dashboard.stats.platformData') }}</h3></div>
            <div class="settings-group-body">
            <div v-if="loading.stats" class="loading-text">{{ $t('dashboard.common.loading') }}</div>
            <div v-else class="user-data-list admin-stats">
              <div class="data-item">
                <div class="num">{{ adminStats.totalUsers }}</div>
                <div class="text">{{ $t('dashboard.stats.registeredUsers') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalExperts }}</div>
                <div class="text">{{ $t('dashboard.stats.registeredExperts') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalAppointments }}</div>
                <div class="text">{{ $t('dashboard.stats.totalAppointments') }}</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalTests }}</div>
                <div class="text">{{ $t('dashboard.stats.completedTests') }}</div>
              </div>
            </div>
            </div>
          </div>

          <!-- 外观设置 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="sun" :size="15" /><h3>{{ $t('settings.appearance') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('settings.theme') }}</span>
                <span class="setting-desc">{{ $t('settings.themeDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <div class="theme-options">
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'light' }" @click="settingsStore.setTheme('light')">
                    <AppIcon name="sun" :size="15" /><span>{{ $t('settings.light') }}</span>
                  </button>
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'dark' }" @click="settingsStore.setTheme('dark')">
                    <AppIcon name="moon" :size="15" /><span>{{ $t('settings.dark') }}</span>
                  </button>
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'system' }" @click="settingsStore.setTheme('system')">
                    <AppIcon name="monitor" :size="15" /><span>{{ $t('settings.system') }}</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('settings.language') }}</span>
                <span class="setting-desc">{{ $t('settings.languageDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <div class="theme-options">
                  <button class="theme-option" :class="{ selected: settingsStore.locale === 'zh-CN' }" @click="settingsStore.setLocale('zh-CN')">
                    <span>{{ $t('dashboard.settings.langZh') }}</span>
                  </button>
                  <button class="theme-option" :class="{ selected: settingsStore.locale === 'en' }" @click="settingsStore.setLocale('en')">
                    <span>English</span>
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>

          <!-- 通知设置 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="bell" :size="15" /><h3>{{ $t('dashboard.settings.notifications') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.messageReminder') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.messageReminderDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <select v-model="settingsStore.notifications" @change="settingsStore.setNotifications(settingsStore.notifications)" class="setting-select">
                  <option value="all">{{ $t('dashboard.notification.all') }}</option>
                  <option value="important">{{ $t('dashboard.notification.importantOnly') }}</option>
                  <option value="none">{{ $t('dashboard.notification.none') }}</option>
                </select>
              </div>
            </div>
            <div class="setting-item" @click="settingsStore.toggleSound()">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.sound') }}</span>
                <span class="setting-desc">{{ settingsStore.soundEnabled ? $t('dashboard.settings.on') : $t('dashboard.settings.off') }}</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.soundEnabled }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div v-if="userStore.userInfo?.role === 3" class="setting-item" @click="sendTestNotification">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.testNotification') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.testNotificationDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            </div>
          </div>

          <!-- 窗口行为 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="monitor" :size="15" /><h3>{{ $t('dashboard.settings.window') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.closeAction') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.closeActionDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <select v-model="settingsStore.closeAction" @change="settingsStore.setCloseAction(settingsStore.closeAction)" class="setting-select">
                  <option value="ask">{{ $t('dashboard.window.ask') }}</option>
                  <option value="minimize">{{ $t('dashboard.window.minimize') }}</option>
                  <option value="exit">{{ $t('dashboard.window.exit') }}</option>
                </select>
              </div>
            </div>
            </div>
          </div>

          <!-- 数据管理 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="fileText" :size="15" /><h3>{{ $t('dashboard.settings.data') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="exportData">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.exportData') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.exportDataDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="importData">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.importData') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.importDataDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="clearData">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.clearData') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.clearDataDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="settingsStore.toggleAutoBackup()">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.autoBackup') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.autoBackupDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.autoBackup }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div class="setting-item" v-if="settingsStore.autoBackup">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.backupInterval') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.backupIntervalDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <select v-model.number="settingsStore.backupInterval" class="setting-select">
                  <option :value="1">{{ $t('dashboard.interval.day') }}</option>
                  <option :value="3">{{ $t('dashboard.interval.days3') }}</option>
                  <option :value="7">{{ $t('dashboard.interval.week') }}</option>
                  <option :value="14">{{ $t('dashboard.interval.weeks2') }}</option>
                  <option :value="30">{{ $t('dashboard.interval.month') }}</option>
                </select>
              </div>
            </div>
            </div>
          </div>

          <!-- AI 记忆 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="spark" :size="15" /><h3>{{ $t('dashboard.settings.aiMemory') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" v-if="memoryStatus && !memoryStatus.enabled">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.aiMemoryDisabled') }}</span>
              </div>
            </div>
            <template v-else>
              <div class="setting-item" v-if="memoryLoading">
                <div class="setting-item-left">
                  <span class="setting-desc">{{ $t('dashboard.common.loading') }}</span>
                </div>
              </div>
              <div class="setting-item" v-else-if="memoryList.length === 0">
                <div class="setting-item-left">
                  <span class="setting-desc">{{ $t('dashboard.settings.memoryEmpty') }}</span>
                </div>
              </div>
              <div v-else class="memory-list">
                <div class="memory-item" v-for="m in memoryList" :key="m.id">
                  <div class="memory-content">{{ m.content }}</div>
                  <button class="memory-delete" :disabled="memoryDeleting" @click="onDeleteMemory(m.id)" :title="$t('dashboard.settings.memoryDelete')">
                    <AppIcon name="trash" :size="14" />
                  </button>
                </div>
              </div>
              <div class="setting-item" v-if="memoryList.length > 0" @click="onClearMemories">
                <div class="setting-item-left">
                  <span>{{ $t('dashboard.settings.memoryClear') }}</span>
                  <span class="setting-desc">{{ $t('dashboard.settings.memoryClearDesc') }}</span>
                </div>
                <div class="setting-item-right">
                  <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
                </div>
              </div>
            </template>
            </div>
          </div>

          <!-- 隐私安全 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="shield" :size="15" /><h3>{{ $t('dashboard.settings.privacy') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="settingsStore.toggleLockOnLeave()">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.lockOnLeave') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.lockOnLeaveDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.lockOnLeave }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div class="setting-item" v-if="settingsStore.lockOnLeave">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.lockTimeout') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.lockTimeoutDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <select v-model.number="settingsStore.lockTimeout" class="setting-select">
                  <option :value="1">{{ $t('dashboard.lockTime.m1') }}</option>
                  <option :value="5">{{ $t('dashboard.lockTime.m5') }}</option>
                  <option :value="10">{{ $t('dashboard.lockTime.m10') }}</option>
                  <option :value="30">{{ $t('dashboard.lockTime.m30') }}</option>
                </select>
              </div>
            </div>
            </div>
          </div>

          <!-- 账号安全 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="lock" :size="15" /><h3>{{ $t('dashboard.settings.account') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="showChangePassword">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.changePassword') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.changePasswordDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="logout">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.logout') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.logoutDesc') }}</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            </div>
          </div>

          <!-- 关于 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="info" :size="15" /><h3>{{ $t('dashboard.settings.about') }}</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.version') }}</span>
                <span class="setting-desc">{{ updateDesc }}</span>
                <!-- 下载进度条（仅下载中显示） -->
                <div v-if="updatePhase === 'downloading'" class="update-progress">
                  <div class="update-progress-track">
                    <div class="update-progress-fill" :style="{ width: updateProgress.percent + '%' }"></div>
                  </div>
                  <span class="update-progress-text">{{ updateProgressText }}</span>
                  <button class="btn-cancel-download" @click="onCancelDownload">{{ $t('dashboard.update.cancel') }}</button>
                </div>
              </div>
              <button
                class="btn-check-update"
                :class="{ 'btn-install-ready': updatePhase === 'ready' }"
                :disabled="updatePhase === 'checking' || updatePhase === 'downloading'"
                @click="onUpdateAction"
              >
                {{ updatePhaseText }}
              </button>
            </div>
            <div class="setting-item">
              <div class="setting-item-left">
                <span>{{ $t('dashboard.settings.hotkey') }}</span>
                <span class="setting-desc">{{ $t('dashboard.settings.hotkeyDesc') }}</span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. 专家工作台 - 预约管理 -->
      <div v-if="currentPage === 'expert'" class="page show">
        <AppointmentList @view-detail="onViewAppointmentDetail" />
      </div>

      <!-- 6.1 专家工作台 - 我的名片 -->
      <div v-if="currentPage === 'expert-card'" class="page show scrollable">
        <MyCard />
      </div>

      <!-- 6.2 专家工作台 - 我的问卷（列表） -->
      <div v-if="currentPage === 'my-tests'" class="page show scrollable">
        <MyTests embedded @create="onCreateTest" @edit="onEditTest" />
      </div>

      <!-- 6.3 专家工作台 - 新建/编辑问卷 -->
      <div v-if="currentPage === 'my-tests-edit'" class="page show scrollable">
        <TestEdit mode="expert" :test-id="editingTestId" @saved="onTestSaved" @cancel="onTestCancel" />
      </div>

      <!-- 7. 专家工作台 - 预约详情 -->
      <div v-if="currentPage === 'expert-detail'" class="page show">
        <AppointmentDetail 
          :id="currentAppointmentId" 
          @go-back="switchPage('expert')" 
          @status-updated="onStatusUpdated"
        />
      </div>

      <!-- 8. 用户 - 我的预约 -->
      <div v-if="currentPage === 'my-appointments'" class="page show">
        <UserAppointmentList 
          :online-user-ids="onlineUserIds"
          @view-detail="onViewUserAppointmentDetail" 
        />
      </div>

      <!-- 9. 用户 - 预约详情（聊天） -->
      <div v-if="currentPage === 'user-appointment-detail'" class="page show">
        <AppointmentDetail 
          :id="currentAppointmentId" 
          @go-back="switchPage('my-appointments')" 
        />
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <ChangePasswordDialog ref="changePasswordRef" />
    <ModelSettingsDialog ref="modelSettingsRef" @changed="onModelsChanged" />
    
    <!-- 编辑资料弹窗 -->
    <EditProfileDialog 
      v-model:visible="showEditDialog"
      @saved="onProfileSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch, provide, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL, getAuthToken } from '@/config'
import { useUserStore } from '@/stores/user'
import { useSettingsStore } from '@/stores/settings'
import { saveChat, saveAnalysisReport, clearAllData, createAppointment, getChatHistory, getChatSessions, createChatSession, lockChatSession, refreshSessionSummary, deleteChatSession, getChatModels, getUserAppointments, getAnalysisReports } from '@/api/user'
import { useLoadingStore } from '@/stores/loading'
import { chatWithAIStream, generateReport } from '@/api/ai'
import { getMemoryStatus, listMemories, deleteMemory, clearMemories, type MemoryItem } from '@/api/memory'
import { getTestHistory } from '@/api/tests'
import { alert, success, confirm, error } from '@/utils/dialog'
import TestList from './TestList.vue'
import TestHistory from '../tests/TestHistory.vue'
import TestResultDetail from '../tests/TestResultDetail.vue'
import AppointmentList from '../expert/AppointmentList.vue'
import MyCard from '../expert/MyCard.vue'
import AppointmentDetail from '../expert/AppointmentDetail.vue'
import UserAppointmentList from '../expert/UserAppointmentList.vue'
import MyTests from '../expert/MyTests.vue'
import TestEdit from '../admin/TestEdit.vue'
import ChangePasswordDialog from "../../components/ChangePasswordDialog.vue"
import ModelSettingsDialog from "../../components/ModelSettingsDialog.vue"
import EditProfileDialog from "../../components/EditProfileDialog.vue"
import AppIcon from '@/components/AppIcon.vue'
import { showToast } from '@/utils/notify'
import { bindChatNotification, registerChatOpener } from '@/utils/taskbar'
import { checkUpdate, downloadUpdate, cancelDownload, installUpdate, onUpdateProgress, hasRemindedUpdate, markUpdateReminded, type UpdateInfo, type UpdatePhase, type DownloadProgress } from '@/utils/updater'
import { isTauri } from '@/utils/secureStore'
import { renderReportHtml, reportToPlainText } from '@/utils/reportRender'
import { translateReport } from '@/api/ai'
import DateSelect from '@/components/DateSelect.vue'

const streamingContent = ref('')
const isStreaming = ref(false)    
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const currentPage = ref('')
const currentAppointmentId = ref(0)
const chatInput = ref('')
const chatMessages = ref<{type: string, content: string, translated?: string}[]>([])

// ===== 聊天实时翻译（bilibili Index-Translate 公共翻译引擎，译文不落库）=====
const TRANSLATE_LANGS = [
  'en', 'zh', 'de', 'fr', 'es', 'ja', 'ko', 'pt', 'ru', 'ar', 'it', 'nl', 'pl',
  'ro', 'sv', 'tr', 'hi', 'vi', 'th', 'id', 'ms', 'fil', 'ukr_cyrl', 'fas_arab',
  'ces_latn', 'ell_grek', 'dan_latn', 'hun_latn', 'fin_latn', 'nob_latn', 'slk_latn', 'bul_cyrl'
]
const chatTranslateEnabled = ref(false)
const chatTranslateTarget = ref('en')
const chatViewMode = ref<'original' | 'translated' | 'bilingual'>('original')
const chatTranslateMenu = ref(false)
// 流式过程中的译文累积（与 streamingContent 并行增长）
const streamingTranslated = ref('')
// 语言显示名走 i18n（dashboard.langs.*，中英双语对齐）
const langLabel = (code: string) => t(`dashboard.langs.${code}`)

const toggleChatTranslate = () => {
  chatTranslateEnabled.value = !chatTranslateEnabled.value
  if (chatTranslateEnabled.value) {
    // 开启翻译时默认双语视图（原文在上、译文在下，译文滞后到达也不遮挡）
    if (chatViewMode.value === 'original') chatViewMode.value = 'bilingual'
  } else {
    chatViewMode.value = 'original'
    chatTranslateMenu.value = false
  }
}
// 点击弹层外部收起翻译菜单
const onDocClickForTranslate = (e: MouseEvent) => {
  const el = document.querySelector('.translate-picker')
  if (el && !el.contains(e.target as Node)) chatTranslateMenu.value = false
}
onMounted(() => document.addEventListener('click', onDocClickForTranslate))
onUnmounted(() => document.removeEventListener('click', onDocClickForTranslate))
// AI 对话会话：侧栏列表 + 当前激活会话
const chatSessions = ref<any[]>([])
const activeSessionId = ref('')
const sessionCollapsed = ref(false)
const sessionLoading = ref(false)
// 当前会话是否还有更早消息未加载（分页用）
const hasMoreMsgs = ref(false)

const genSessionId = () => {
  // 去掉连字符外的特殊字符不必要，uuid 本身满足 [a-zA-Z0-9-]
  return (crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
}

const formatSessionTime = (time: string) => {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${p(d.getHours())}:${p(d.getMinutes())}`
  const sameYear = d.getFullYear() === now.getFullYear()
  return sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 完整时间（悬浮提示用）：含日期与时分秒
const formatSessionFull = (time: string) => {
  if (!time) return ''
  const d = new Date(time)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// 拉取会话列表；返回最新的会话 id（供首次进入自动打开）
const loadChatSessions = async (): Promise<string> => {
  try {
    const res = await getChatSessions() as any
    chatSessions.value = res?.data || []
  } catch (e) {
    console.error('获取会话列表失败:', e)
    chatSessions.value = []
  }
  return chatSessions.value[0]?.session_id || ''
}

// 打开指定会话，加载其消息（分页：先取最近 50 条，更早的点「加载更多」向上追加）
const openSession = async (sessionId: string) => {
  if (!sessionId || sessionId === activeSessionId.value) return
  activeSessionId.value = sessionId
  sessionLoading.value = true
  try {
    const res = await getChatHistory(sessionId, { limit: 50 }) as any
    chatMessages.value = (res?.data || []).map((msg: any) => ({
      type: msg.type,
      content: msg.content
    }))
    hasMoreMsgs.value = !!res?.hasMore
  } catch (e) {
    console.error('获取会话消息失败:', e)
    chatMessages.value = []
    hasMoreMsgs.value = false
  } finally {
    sessionLoading.value = false
  }
  scrollToBottom()
}

// 向上加载更早的消息：追加到头部并保持当前滚动位置（不跳底）
const loadingMore = ref(false)
const loadMoreMessages = async () => {
  if (!activeSessionId.value || loadingMore.value || !hasMoreMsgs.value) return
  loadingMore.value = true
  try {
    const box = chatBox.value
    const prevHeight = box?.scrollHeight || 0
    const prevTop = box?.scrollTop || 0
    const res = await getChatHistory(activeSessionId.value, {
      limit: 50,
      offset: chatMessages.value.length
    }) as any
    const older = (res?.data || []).map((msg: any) => ({ type: msg.type, content: msg.content }))
    if (older.length) chatMessages.value = [...older, ...chatMessages.value]
    hasMoreMsgs.value = !!res?.hasMore
    nextTick(() => {
      if (box) box.scrollTop = box.scrollHeight - prevHeight + prevTop
    })
  } catch (e) {
    console.error('加载更早消息失败:', e)
  } finally {
    loadingMore.value = false
  }
}

// 新建对话：立即创建会话记录（服务端返回会话 id），空对话也会出现在侧栏列表；
// 若当前已是空的新对话则复用，避免连点产生一堆空会话
const startNewSession = async () => {
  if (aiLoading.value || isStreaming.value) return
  if (
    chatMessages.value.length === 0 &&
    activeSessionId.value &&
    chatSessions.value.some((s) => s.session_id === activeSessionId.value)
  ) return
  try {
    const res = await createChatSession() as any
    if (res?.data?.session_id) {
      activeSessionId.value = res.data.session_id
      await loadChatSessions()
    } else {
      activeSessionId.value = genSessionId()
    }
  } catch (e) {
    console.error('创建会话失败:', e)
    // 离线兜底：本地生成 id，首条消息落库时服务端会自动补建会话行
    activeSessionId.value = genSessionId()
  }
  chatMessages.value = []
  hasMoreMsgs.value = false
  chatInput.value = ''
}

// 锁定 / 解锁：锁定后对话置顶且不可删除
const toggleLock = async (s: any) => {
  try {
    await lockChatSession(s.session_id, !Number(s.locked))
    // 成功时不弹提醒：锁按钮高亮 + 置顶排序本身就是状态反馈
    await loadChatSessions()
  } catch (e: any) {
    error(e?.response?.data?.message || t('dashboard.errors.operationFailed'))
  }
}

// 让 AI 总结对话标题：首轮回复后必刷，之后每 6 条消息刷新一次
const maybeSummarize = (sessionId: string) => {
  const s = chatSessions.value.find((x) => x.session_id === sessionId)
  const count = chatMessages.value.length
  const need = !s || s.title === '新对话' || (count > 0 && count % 6 === 0)
  if (!need) return
  refreshSessionSummary(sessionId)
    .then((res: any) => {
      const newTitle = res?.data?.title
      if (newTitle) {
        const cur = chatSessions.value.find((x) => x.session_id === sessionId)
        if (cur) cur.title = newTitle
      }
    })
    .catch(() => {})
}

// ===== 对话模型管理：配置弹窗（自带网关地址+Key 加密存储），芯片为入口 =====
interface CustomModel { model: string; base_url: string; key_hint: string; selected: boolean }
const modelInfo = ref<{ available: string[]; custom: CustomModel[]; selected: string | null; gateway_enabled: boolean }>({
  available: [], custom: [], selected: null, gateway_enabled: false
})
const modelSettingsRef = ref<InstanceType<typeof ModelSettingsDialog> | null>(null)

const selectedModelLabel = computed(() => modelInfo.value.selected || t('dashboard.chat.defaultModel'))

const loadChatModels = async () => {
  try {
    const res: any = await getChatModels()
    if (res?.data) modelInfo.value = res.data
  } catch (e) {
    console.error('模型列表加载失败:', e)
  }
}

// 打开独立的模型配置弹窗（列表/添加/编辑/删除/测试连接/切换）
const openModelSettings = () => {
  modelSettingsRef.value?.show()
}

// 弹窗内切换/删除模型后同步标题栏芯片显示
const onModelsChanged = (selected: string | null) => {
  modelInfo.value.selected = selected
}

// 删除会话（锁定中的对话不可删除，与后端校验一致）
const removeSession = async (s: any) => {
  if (Number(s.locked)) {
    error(t('dashboard.session.cannotDeleteLocked'))
    return
  }
  const ok = await confirm(t('dashboard.session.deleteConfirm', { title: (s.title || t('dashboard.session.untitled')).slice(0, 20) }), t('dashboard.session.delete'))
  if (!ok) return
  try {
    await deleteChatSession(s.session_id)
    const wasActive = s.session_id === activeSessionId.value
    await loadChatSessions()
    if (wasActive) {
      // 删除的是当前会话：自动切到最近一个，没有则进入空白新对话
      const next = chatSessions.value[0]?.session_id || ''
      if (next) {
        activeSessionId.value = ''
        await openSession(next)
      } else {
        startNewSession()
      }
    }
    // 删除成功不弹提醒：列表项消失 + 自动切换会话本身就是反馈
  } catch (e: any) {
    error(e?.response?.data?.message || t('dashboard.errors.deleteFailed'))
  }
}
const chatBox = ref<HTMLElement | null>(null)
const startDate = ref('')
const endDate = ref('')
// 报告区占位哨兵：仅用于内部状态判断，不会展示给用户
const REPORT_LOADING = '__REPORT_LOADING__'
const REPORT_FAILED = '__REPORT_FAILED__'
const reportContent = ref('')
const changePasswordRef = ref<InstanceType<typeof ChangePasswordDialog> | null>(null)

// ===== 新增：编辑资料弹窗 =====
const showEditDialog = ref(false)

import { getExpertStats } from '@/api/expert'
import { getAdminStats } from '@/api/admin'

// 专家统计数据
const expertStats = ref({
  pendingCount: 0,
  completedCount: 0,
  unfinishedCount: 0,
  totalPatients: 0
})

// 管理员统计数据
const adminStats = ref({
  totalUsers: 0,
  totalExperts: 0,
  totalAppointments: 0,
  totalTests: 0
})

// 用户角色文字
const userRoleText = computed(() => {
  const role = userStore.userInfo?.role
  if (role === 2) return t('dashboard.role.expert')
  if (role === 3) return t('dashboard.role.admin')
  return t('dashboard.role.user')
})

// 加载专家统计数据
const loadExpertStats = async () => {
  try {
    const res = await getExpertStats() as any
    expertStats.value = res.data
  } catch (e) {
    console.error('获取专家统计失败:', e)
  }
}

// 加载管理员统计数据
const loadAdminStats = async () => {
  try {
    const res = await getAdminStats() as any
    adminStats.value = res.data
  } catch (e) {
    console.error('获取管理员统计失败:', e)
  }
}

// AI 加载状态
const aiLoading = ref(false)
const reportLoading = ref(false)

// 报告 Markdown → 结构化 HTML（占位文案/加载中的提示文本不参与渲染）
// 译文视图：translationText 存在且 showingTranslation 时展示译文，原文始终保留
const translationText = ref('')
const translating = ref(false)
const showingTranslation = ref(false)
const displayedReport = computed(() => {
  if (translationText.value && showingTranslation.value) return translationText.value
  return reportContent.value
})
const reportHtml = computed(() => {
  const text = displayedReport.value
  if (!text || text === REPORT_LOADING || text === REPORT_FAILED) return ''
  return renderReportHtml(text)
})

// 报告 AI 翻译：bilibili Index-Translate 公共网关（32 语种，后端不可用时自动回落主厂模型）
// 按所选目标语言翻译已生成报告（不落库、不覆盖原文）
const reportTranslateTarget = ref(settingsStore.locale === 'en' ? 'zh' : 'en')
const translateCurrentReport = async () => {
  if (translating.value || !reportContent.value) return
  translating.value = true
  try {
    const res = await translateReport(reportContent.value, reportTranslateTarget.value)
    if (res?.translated) {
      translationText.value = res.translated
      showingTranslation.value = true
    }
  } catch (e: any) {
    await error(e?.message || t('dashboard.report.translateFailed'))
  } finally {
    translating.value = false
  }
}
const resetReportTranslation = () => {
  translationText.value = ''
  showingTranslation.value = false
}
// 语言切换后译文与目标语言不再匹配，重置回原文视图；目标语言默认随界面语言取互补
watch(() => settingsStore.locale, (loc) => {
  reportTranslateTarget.value = loc === 'en' ? 'zh' : 'en'
  resetReportTranslation()
})
// 已有译文时切换目标语言 → 重置回原文，便于按新语言重新翻译
watch(reportTranslateTarget, () => {
  if (translationText.value) resetReportTranslation()
})

// ===== Socket.IO 全局连接 =====
const socket = shallowRef<Socket | null>(null)
const onlineUserIds = ref<Set<number>>(new Set())

// 提供给子组件使用
provide('onlineUserIds', onlineUserIds)
provide('socket', socket)

// 判断某个用户是否在线
const isUserOnline = (userId: number | undefined) => {
  if (!userId) return false
  return onlineUserIds.value.has(userId)
}

// 专家名片双语展示：英文界面优先 _en 字段（后端 /users/doctors 返回 name_en 等字段），留空回落中文
const docField = (doc: any, field: 'name' | 'title' | 'specialty' | 'intro'): string => {
  if (settingsStore.locale === 'en') {
    const en = doc?.[`${field}_en`]
    if (en) return en
  }
  return doc?.[field] || ''
}

// 初始化 Socket 连接
const initSocket = () => {
  if (!userStore.userInfo?.id) return
  
  // 如果全局 Socket 已存在且连接中，复用
  const existingSocket = (window as any).__globalSocket__
  if (existingSocket && existingSocket.connected) {
    socket.value = existingSocket
    setupDashboardListeners(existingSocket)
    return
  }
  
  if (socket.value) {
    socket.value.disconnect()
  }

  socket.value = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  // 保存为全局 Socket
  ;(window as any).__globalSocket__ = socket.value

  const sock = socket.value

  sock.on('connect', () => {
    console.log('Dashboard Socket 已连接')
    sock.emit('authenticate', { userId: userStore.userInfo!.id, token: getAuthToken() })
  })

  setupDashboardListeners(sock)
}

const setupDashboardListeners = (sock: Socket) => {
  // 后台私聊消息提醒（系统通知 + 任务栏频闪），幂等绑定，任意页面均生效
  bindChatNotification(sock)

  sock.on('disconnect', () => {
    console.log('Dashboard Socket 已断开')
    onlineUserIds.value.clear()
  })

  // 监听用户在线状态变更
  sock.on('user-status-change', (data: { userId: number, isOnline: boolean }) => {
    if (data.isOnline) {
      onlineUserIds.value.add(data.userId)
    } else {
      onlineUserIds.value.delete(data.userId)
    }
    console.log(`用户 ${data.userId} 状态: ${data.isOnline ? '在线' : '离线'}`)
  })

  // 认证后收到的在线名单快照：整体替换，修正打开页面时已在线专家的误显离线
  sock.on('online-users', (data: { userIds: number[] }) => {
    onlineUserIds.value = new Set(data.userIds || [])
  })

  // 被强制登出（服务器要求）
  sock.on('force-logout', (data: { message: string }) => {
    alert(data.message || t('dashboard.errors.forceLoggedOut'))
    disconnectSocket()
    userStore.logout()
    router.replace('/login')
  })

  // 管理员上下架专家名片 → 实时刷新专家列表
  sock.on('doctor-list-updated', () => {
    userStore.getDoctors().catch(() => {})
  })

  sock.on('error', (err: any) => {
    console.error('Socket 错误:', err)
  })
}

// 断开 Socket
const disconnectSocket = () => {
  if (socket.value) {
    socket.value.disconnect()
    ;(window as any).__globalSocket__ = null
    socket.value = null
    onlineUserIds.value.clear()
  }
}

// 发送一条真实系统通知，验证通知中心效果
const sendTestNotification = () => {
  showToast(t('dashboard.notifyTest.title'), t('dashboard.notifyTest.body'), true)
}

// 显示修改密码弹窗
const showChangePassword = () => {
  changePasswordRef.value?.show()
}

// ===== 新增：显示编辑资料弹窗 =====
const showEditProfile = () => {
  showEditDialog.value = true
}

// ===== 新增：资料保存成功回调 =====
const onProfileSaved = () => {
  // 资料已更新，刷新用户信息
  userStore.getInfo()
}

// 复制纯文本报告（译文视图下复制译文）
const exportReport = async () => {
  try {
    const plainText = reportToPlainText(displayedReport.value)

    await navigator.clipboard.writeText(plainText)
    await success(t('dashboard.report.copied'), t('dashboard.report.copySuccessTitle'))
  } catch (e) {
    const textarea = document.createElement('textarea')
    textarea.value = reportToPlainText(displayedReport.value)
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    await success(t('dashboard.report.copied'), t('dashboard.report.copySuccessTitle'))
  }
}

// 导出 HTML 文件（译文视图下导出译文）
const downloadReport = () => {
  if (!displayedReport.value) {
    alert(t('dashboard.report.generateFirst'))
    return
  }

  // 与界面同源渲染：Markdown → 结构化 HTML（reportRender 内部已做实体转义）
  const bodyHtml = renderReportHtml(displayedReport.value)

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${t('dashboard.report.htmlTitle')}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; padding: 48px 24px; max-width: 820px; margin: 0 auto; line-height: 1.9; color: #332e27; background: #faf7f2; }
    .doc { background: #fff; border: 1px solid #eadfce; border-radius: 12px; padding: 40px 48px; box-shadow: 0 2px 16px rgba(90, 70, 40, 0.06); }
    .doc-header { border-bottom: 1px solid #eadfce; padding-bottom: 18px; margin-bottom: 26px; }
    .doc-title { font-size: 22px; font-weight: 700; color: #332e27; margin: 0 0 10px; letter-spacing: 1px; }
    .doc-meta { font-size: 13px; color: #8a8378; }
    .doc-meta span { margin-right: 18px; }
    h2 { font-size: 17px; color: #a96a2c; margin: 30px 0 12px; padding-left: 10px; border-left: 3px solid #a96a2c; }
    h3 { font-size: 15px; color: #7a5a2e; margin: 20px 0 8px; }
    p { margin: 8px 0; font-size: 14px; }
    strong { color: #5a4632; }
    ul, ol { margin: 8px 0; padding-left: 22px; }
    li { margin: 6px 0; font-size: 14px; }
    hr { border: none; border-top: 1px dashed #eadfce; margin: 22px 0; }
    code { background: #f4efe6; padding: 1px 6px; border-radius: 4px; font-size: 13px; }
    @media print { body { background: #fff; padding: 0; } .doc { border: none; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="doc-header">
      <p class="doc-title">${t('dashboard.report.docTitle')}</p>
      <div class="doc-meta">
        <span>${t('dashboard.report.period', { start: startDate.value, end: endDate.value })}</span>
        <span>${t('dashboard.report.generatedAt', { time: new Date().toLocaleString(settingsStore.locale === 'en' ? 'en-US' : 'zh-CN') })}</span>
      </div>
    </div>
    ${bodyHtml}
  </div>
</body>
</html>`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = t('dashboard.report.fileName', { start: startDate.value, end: endDate.value })
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

const loading = ref({
  stats: false,
  tests: false,
  doctors: false
})

interface MenuItem {
  id: string
  name: string
  icon: string
}

// 普通用户菜单（name 为 i18n key，模板中统一 $t 渲染）
const baseMenuItems: MenuItem[] = [
  { id: 'chat', name: 'dashboard.nav.chat', icon: 'chat' },
  { id: 'test', name: 'dashboard.nav.test', icon: 'clipboard' },
  { id: 'doctor', name: 'dashboard.nav.doctor', icon: 'stethoscope' },
  { id: 'analysis', name: 'dashboard.nav.analysis', icon: 'chart' },
  { id: 'my-appointments', name: 'dashboard.nav.myAppointments', icon: 'calendar' },
  { id: 'user', name: 'dashboard.nav.user', icon: 'user' }
]

// 管理员菜单项
const adminMenuItem: MenuItem = {
  id: 'admin',
  name: 'dashboard.nav.admin',
  icon: 'settings'
}

// 动态菜单：根据 role 显示不同入口
const menuItems = computed<MenuItem[]>(() => {
  // role=2 专家：只显示专家工作台 + 我的名片 + 我的问卷 + 个人中心
  if (userStore.userInfo?.role === 2) {
    return [
      { id: 'expert', name: 'dashboard.nav.expert', icon: 'stethoscope' },
      { id: 'expert-card', name: 'dashboard.nav.expertCard', icon: 'fileText' },
      { id: 'my-tests', name: 'dashboard.nav.myTests', icon: 'list' },
      { id: 'user', name: 'dashboard.nav.user', icon: 'user' }
    ]
  }

  // 普通用户和管理员：显示基础菜单
  const items = [...baseMenuItems]

  // role=3 管理员：添加管理后台和预约管理
  if (userStore.userInfo?.role === 3) {
    items.push(adminMenuItem)
  }

  return items
})

// ===== 检查更新（Gitee Releases） =====
// 流程：检查 → 发现新版停下来等用户决定 → 下载（进度条+可取消）→ 安装
const updatePhase = ref<UpdatePhase>('idle')
const updateInfo = ref<UpdateInfo | null>(null)
const updateError = ref('')
const updateProgress = ref<DownloadProgress>({ received: 0, total: 0, percent: 0 })
const downloadedPath = ref('') // 已下载完成的安装包本地路径
let unlistenProgress: (() => void) | null = null

const formatMB = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
const updateProgressText = computed(() => {
  const p = updateProgress.value
  if (p.total > 0) {
    return t('dashboard.update.progress', { received: formatMB(p.received), total: formatMB(p.total), percent: p.percent })
  }
  return t('dashboard.update.downloaded', { size: formatMB(p.received) })
})

const updateDesc = computed(() => {
  const cur = updateInfo.value?.current_version || '0.6.1'
  const base = t('dashboard.update.appVersion', { version: cur })
  if (updatePhase.value === 'available' && updateInfo.value?.has_update) {
    return t('dashboard.update.availableDesc', { latest: updateInfo.value.latest_version, current: cur })
  }
  if (updatePhase.value === 'downloading' && updateInfo.value) {
    return t('dashboard.update.downloadingDesc', { latest: updateInfo.value.latest_version })
  }
  if (updatePhase.value === 'ready' && updateInfo.value) {
    return t('dashboard.update.readyDesc', { latest: updateInfo.value.latest_version })
  }
  if (updatePhase.value === 'idle' && updateInfo.value && !updateInfo.value.has_update) {
    return `${base} · ${t('dashboard.update.upToDate')}`
  }
  if (updateError.value) {
    return `${base} · ${updateError.value}`
  }
  return base
})

const updatePhaseText = computed(() => {
  switch (updatePhase.value) {
    case 'checking': return t('dashboard.update.checking')
    case 'available': return t('dashboard.update.downloadUpdate')
    case 'downloading': return t('dashboard.update.downloading')
    case 'ready': return t('dashboard.update.installNow')
    default: return t('dashboard.update.checkUpdate')
  }
})

const onUpdateAction = async () => {
  if (!isTauri()) {
    updateError.value = t('dashboard.update.browserMode')
    return
  }
  switch (updatePhase.value) {
    case 'ready':
      await doInstall()
      break
    case 'available':
      await startDownload()
      break
    default:
      await doCheck()
  }
}

const doCheck = async () => {
  updatePhase.value = 'checking'
  updateError.value = ''
  try {
    const info = await checkUpdate()
    updateInfo.value = info
    if (info.has_update) {
      if (info.download_url) {
        // 发现新版：不自动下载，交给用户决定
        updatePhase.value = 'available'
      } else {
        updateError.value = t('dashboard.update.noAttachment')
        updatePhase.value = 'idle'
      }
    } else {
      updatePhase.value = 'idle'
    }
  } catch (e: any) {
    updateError.value = (typeof e === 'string' ? e : e?.message) || t('dashboard.update.checkFailed')
    updatePhase.value = 'idle'
  }
}

const startDownload = async () => {
  if (!updateInfo.value?.download_url) return
  updatePhase.value = 'downloading'
  updateError.value = ''
  updateProgress.value = { received: 0, total: 0, percent: 0 }
  unlistenProgress = await onUpdateProgress((p) => { updateProgress.value = p })
  try {
    downloadedPath.value = await downloadUpdate(updateInfo.value.download_url)
    updatePhase.value = 'ready'
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message || ''
    if (msg.includes('__CANCELLED__')) {
      // 用户取消：删除临时文件后回到「可下载」状态
      updatePhase.value = 'available'
    } else {
      updateError.value = msg || t('dashboard.update.downloadFailed')
      updatePhase.value = 'available'
    }
  } finally {
    unlistenProgress?.()
    unlistenProgress = null
  }
}

const onCancelDownload = async () => {
  try {
    await cancelDownload()
  } catch {
    // Rust 侧中断时 invoke 可能随任务取消一起失败，忽略即可
  }
}

const doInstall = async () => {
  if (!downloadedPath.value) {
    // 没有本地安装包（异常情况），退回可下载状态
    updatePhase.value = 'available'
    return
  }
  updateError.value = ''
  try {
    await installUpdate(downloadedPath.value) // 内部会退出程序并唤起安装器
  } catch (e: any) {
    updateError.value = (typeof e === 'string' ? e : e?.message) || t('dashboard.update.installFailed')
    updatePhase.value = 'available'
  }
}

// 启动静默检查：有新版时仅提示文案与「下载更新」按钮，不自动下载
const silentCheckUpdate = async () => {
  if (!isTauri()) return
  try {
    const info = await checkUpdate()
    updateInfo.value = info
    if (info.has_update) {
      updatePhase.value = info.download_url ? 'available' : 'idle'
      // 每次运行只弹一次提醒：从管理后台返回前台会重新挂载本组件，
      // 但模块级标记保证 toast 不再重复
      if (!hasRemindedUpdate()) {
        markUpdateReminded()
        await showToast(t('dashboard.update.newVersionToast', { version: info.latest_version }), '')
      }
    }
  } catch {
    // 静默失败不打扰用户
  }
}

onMounted(async () => {
  if (userStore.isLoggedIn) {
    try {
      await userStore.getInfo()
      await userStore.loadAvatar()
    } catch (e) {
      console.error('获取用户信息失败:', e)
    }
  }

  initSocket()

  // 启动静默检查更新（后台执行，不阻塞首屏）
  void silentCheckUpdate()

  // 根据角色加载不同数据
  loading.value.stats = true
  try {
    if (userStore.userInfo?.role === 2) {
      await loadExpertStats()
    } else if (userStore.userInfo?.role === 3) {
      await loadAdminStats()
    } else {
      await userStore.getStats()
    }
  } catch (e) {
    console.error('获取统计数据失败:', e)
  } finally {
    loading.value.stats = false
  }

  // 加载聊天记录（普通用户和管理员）：拉会话列表并自动打开最近一个会话
  if (userStore.userInfo?.role === 1 || userStore.userInfo?.role === 3) {
    const latest = await loadChatSessions()
    if (latest) {
      await openSession(latest)
    } else {
      // 无任何历史会话：准备一个待发的空白新对话
      activeSessionId.value = genSessionId()
      chatMessages.value = []
    }
    // 全量消息仍入 store，供统计与导出使用
    userStore.getChatHistory().catch(() => {})
  }

  // 设置默认页面
  if (!currentPage.value) {
    if (userStore.userInfo?.role === 2) {
      switchPage('expert')      // 专家 → 专家工作台页面
    } else if (userStore.userInfo?.role === 3) {
      switchPage('chat')        // 管理员 → AI对话
    } else {
      switchPage('chat')        // 普通用户 → AI对话
    }
  }
})


onUnmounted(() => {
  disconnectSocket()
})

// 监听路由变化
watch(() => route.path, (newPath) => {
  if (newPath === '/dashboard' && userStore.userInfo?.role === 2) {
    switchPage('expert')
  }
})

const userChatCount = computed(() => {
  return userStore.chatHistory?.filter((msg: any) => msg.type === 'user').length || 0
})

const switchPage = async (pageId: string) => {
  // 管理后台跳转到独立路由
  if (pageId === 'admin') {
    router.push('/admin')
    return
  }

  // ===== 新增：从管理后台返回时，清除 from=admin 标记 =====
  if (route.query.from === 'admin') {
    router.replace({ path: '/dashboard', query: {} })
  }

  currentPage.value = pageId

  if (pageId === 'test') {
    userStore.switchTestView('list')
  } else {
    userStore.resetTestView()
  }

  // ===== 修复：切换到个人中心时，根据角色重新加载统计数据 =====
  if (pageId === 'user') {
    void loadMemoryData()
    loading.value.stats = true
    try {
      if (userStore.userInfo?.role === 2) {
        await loadExpertStats()
      } else if (userStore.userInfo?.role === 3) {
        await loadAdminStats()
      } else {
        await userStore.getStats()
      }
    } catch (e) {
      console.error('刷新统计数据失败:', e)
    } finally {
      loading.value.stats = false
    }
  }

  // 每次进入专家列表页都重新拉取：管理员可能已下架/上架名片，不能用缓存
  if (pageId === 'doctor') {
    loading.value.doctors = true
    try {
      await userStore.getDoctors()
    } catch (e) {
      console.error('获取专家列表失败:', e)
    } finally {
      loading.value.doctors = false
    }
  }
}

const onViewAppointmentDetail = (id: number) => {
  currentAppointmentId.value = id
  currentPage.value = 'expert-detail'
}

// ===== 专家问卷：新建 / 编辑 / 返回列表（在 Dashboard 内切换，不离开应用外壳） =====
const editingTestId = ref<number | null>(null)
const onCreateTest = () => {
  editingTestId.value = null
  currentPage.value = 'my-tests-edit'
}
const onEditTest = (id: number) => {
  editingTestId.value = id
  currentPage.value = 'my-tests-edit'
}
const onTestSaved = () => {
  currentPage.value = 'my-tests'
}
const onTestCancel = () => {
  currentPage.value = 'my-tests'
}

const onViewUserAppointmentDetail = (id: number) => {
  currentAppointmentId.value = id
  currentPage.value = 'user-appointment-detail'
}

// QQ 式后台消息点击直达：任务栏提醒回前台后跳到未读聊天（用户端入口）
registerChatOpener((id) => {
  currentAppointmentId.value = id
  currentPage.value = 'user-appointment-detail'
})

// ===== 新增：处理预约状态更新事件 =====
const onStatusUpdated = async () => {
  console.log('【Dashboard】收到状态更新，刷新统计数据')
  if (userStore.userInfo?.role === 2) {
    loading.value.stats = true
    try {
      await loadExpertStats()
    } catch (e) {
      console.error('刷新专家统计失败:', e)
    } finally {
      loading.value.stats = false
    }
  }
}

const onStartTest = (testId: number) => {
  router.push(`/tests/do/${testId}`)
}

const onStartAiTest = () => {
  router.push('/tests/ai')
}

const onViewDetail = (resultId: number) => {
  userStore.switchTestView('detail', resultId)
}

// ===== 流式 AI 聊天 =====
const sendChat = async () => {
  const val = chatInput.value.trim()
  if (!val || aiLoading.value || isStreaming.value) return

  // 当前无激活会话时（首次进入未打开任何会话），先创建一个
  if (!activeSessionId.value) activeSessionId.value = genSessionId()
  const sessionId = activeSessionId.value
  const isNewSession = !chatSessions.value.some(s => s.session_id === sessionId)

  // 1. 显示用户消息
  chatMessages.value.push({ type: 'user', content: val })
  chatInput.value = ''
  scrollToBottom()

  // 用户消息立即落库：流中断/中途关闭应用/AI 返回空时不再连带丢失；
  // await 保证用户消息先于 AI 回复入库，配合后端 id 次级排序时序才稳定
  try {
    await saveChat({ content: val, type: 'user', session_id: sessionId })
    // 新对话的首条消息已入库 → 刷新侧栏列表（标题取首条用户消息）
    if (isNewSession) await loadChatSessions()
  } catch (e) {
    console.error('保存用户消息失败:', e)
  }

  // 2. 构建消息历史：只传最近 30 条（后端还有同规格窗口兜底，减少传输体积）
  const messageHistory = chatMessages.value.slice(-30).map(msg => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }))

  aiLoading.value = true
  isStreaming.value = true
  streamingContent.value = ''
  streamingTranslated.value = ''

  try {
    // 3. 调用流式 AI 接口（开启实时翻译时后端按句同步翻译，译文经 onTranslated 送达）
    await chatWithAIStream(
      messageHistory,
      (content: string) => {
        // 逐字接收
        streamingContent.value += content
        scrollToBottom()
      },
      (err: string) => {
        console.error('流式输出错误:', err)
        // 流中断保留半截内容：已接收部分上屏并落库，不再「说一半就消失」
        if (streamingContent.value) {
          const partial = streamingContent.value
          chatMessages.value.push({ type: 'ai', content: partial, translated: streamingTranslated.value || undefined })
          streamingContent.value = ''
          streamingTranslated.value = ''
          void saveChat({ content: partial, type: 'ai', session_id: sessionId })
            .then(() => loadChatSessions())
            .catch(() => {})
          maybeSummarize(sessionId)
        }
        isStreaming.value = false
        aiLoading.value = false
        // 失败回填：把本轮用户消息放回输入框，修改后即可直接重发
        chatInput.value = val
        scrollToBottom()
      },
      () => {
        // 流式输出完成
        console.log('流式输出完成')
        isStreaming.value = false
        aiLoading.value = false

        // 把流式内容保存到消息列表（开启实时翻译时译文一并挂到消息上，仅本次展示不落库）
        if (streamingContent.value) {
          const finalContent = streamingContent.value
          chatMessages.value.push({ type: 'ai', content: finalContent, translated: streamingTranslated.value || undefined })
          streamingContent.value = ''
          streamingTranslated.value = ''

          // AI 回复落库（用户消息已在发送时保存）；落库后刷新侧栏列表，
          // 让「N 条」计数与最近活跃排序实时跟上，而不是停在打开时的旧值
          void saveChat({ content: finalContent, type: 'ai', session_id: sessionId })
            .then(() => loadChatSessions())
            .catch(() => {})
          // 首轮回复后 / 每 6 条消息：让 AI 总结更新对话标题
          maybeSummarize(sessionId)
        }

        scrollToBottom()
      },
      {
        testCount: userStore.stats?.testCount || 0,
        username: userStore.userInfo?.username
      },
      sessionId,
      {
        translateTo: chatTranslateEnabled.value ? chatTranslateTarget.value : undefined,
        onTranslated: (c: string) => {
          streamingTranslated.value += c
          scrollToBottom()
        }
      }
    )

  } catch (e: any) {
    console.error('AI 回复失败:', e)
    isStreaming.value = false
    aiLoading.value = false
    streamingContent.value = ''
    streamingTranslated.value = ''

    chatMessages.value.push({
      type: 'ai',
      content: t('dashboard.chat.aiErrorMessage')
    })
    // 请求层失败（未收到任何流内容）：同样回填输入框方便重发
    chatInput.value = val
    scrollToBottom()
  }
}

const bookDoctor = async (doc: any) => {
  try {
    await createAppointment({ doctorId: doc.id })
    await success(t('dashboard.doctor.bookSuccess', { name: docField(doc, 'name') }), t('dashboard.doctor.bookSuccessTitle'))
  } catch (e: any) {
    await error(e.message || t('dashboard.doctor.bookFailed'))
  }
}

// ===== AI 生成报告 =====
const createReport = async () => {
  if (!startDate.value || !endDate.value) {
    await alert(t('dashboard.report.dateRequired'), t('dashboard.report.dateError'))
    return
  }

  reportContent.value = REPORT_LOADING
  reportLoading.value = true
  resetReportTranslation()

  try {
    // 拉取用户已完成的测评记录，按报告时间段过滤后一并提供给 AI 分析
    let results: any[] = []
    try {
      const hres = await getTestHistory() as any
      const rows: any[] = hres?.data || []
      results = rows
        .filter((r) => {
          const day = String(r.completed_at || '').slice(0, 10)
          return day && day >= startDate.value && day <= endDate.value
        })
        .map((r) => ({
          test_name: r.name,
          total_score: r.total_score,
          result_level: r.result_level,
          result_desc: r.result_desc,
          completed_at: r.completed_at
        }))
    } catch (e) {
      console.error('获取测评历史失败（报告将仅基于对话数据生成）:', e)
    }

    const res = await generateReport({
      chatHistory: chatMessages.value,
      testResults: results,
      startDate: startDate.value,
      endDate: endDate.value
    })

    // res 直接就是 { success: true, report: '...', usage: {...} }
    const report = res.report

    if (!report) {
      throw new Error(t('dashboard.report.generateFailed'))
    }

    reportContent.value = report

    await saveAnalysisReport({
      startDate: startDate.value,
      endDate: endDate.value,
      content: reportContent.value.replace(/\n/g, '<br/>')
    })
    await userStore.getStats()
  } catch (e: any) {
    console.error('生成报告失败:', e)
    reportContent.value = REPORT_FAILED
    await error(t('dashboard.report.generateFailed'))
  } finally {
    reportLoading.value = false
  }
}

// 本地设置快照键（与 main.ts DEFAULT_CONFIG 一致，排除会话凭据）
const BACKUP_SETTING_KEYS = ['theme', 'notifications', 'soundEnabled', 'closeAction', 'autoBackup', 'backupInterval', 'lockOnLeave', 'lockTimeout']

const exportData = async () => {
  const loadingStore = useLoadingStore()
  loadingStore.show(t('dashboard.backup.collecting'))
  try {
    // 并行拉取四类服务端数据（单项失败不阻断整体导出）
    const [chat, tests, appts, reports] = await Promise.all([
      getChatHistory().catch(() => null),
      getTestHistory().catch(() => null),
      getUserAppointments().catch(() => null),
      getAnalysisReports().catch(() => null)
    ])

    // 本地设置快照（纯偏好项，不含 token/邮箱等凭据）
    const localSettings: Record<string, string> = {}
    for (const k of BACKUP_SETTING_KEYS) {
      const v = localStorage.getItem(k)
      if (v !== null) localSettings[k] = v
    }

    const data = {
      app: 'xinyu-backup',
      version: 2,
      exportTime: new Date().toISOString(),
      user: {
        username: userStore.userInfo?.username || '',
        email: userStore.userInfo?.email || ''
      },
      chatHistory: chat?.data || [],
      testResults: tests?.data || [],
      appointments: appts?.data || [],
      analysisReports: reports?.data || [],
      localSettings
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const day = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = t('dashboard.backup.fileName', { day })
    a.click()
    URL.revokeObjectURL(url)

    const total = data.chatHistory.length + data.testResults.length + data.appointments.length + data.analysisReports.length
    await success(
      t('dashboard.backup.exportedSummary', {
        chat: data.chatHistory.length,
        tests: data.testResults.length,
        appts: data.appointments.length,
        reports: data.analysisReports.length
      }),
      total ? t('dashboard.backup.exportSuccess') : t('dashboard.backup.exportEmpty')
    )
  } catch (e) {
    console.error('导出失败:', e)
    await error(t('dashboard.backup.exportFailedMsg'), t('dashboard.backup.exportFailedTitle'))
  } finally {
    loadingStore.hide()
  }
}

const importData = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return

    let data: any
    try {
      data = JSON.parse(await file.text())
    } catch {
      await error(t('dashboard.backup.invalidJson'), t('dashboard.backup.importFailedTitle'))
      return
    }

    // 备份文件校验：应用标识 + 聊天记录数组
    if (data?.app !== 'xinyu-backup' || !Array.isArray(data.chatHistory)) {
      await error(t('dashboard.backup.notBackupFile'), t('dashboard.backup.formatErrorTitle'))
      return
    }

    const chatCount = data.chatHistory.filter((m: any) => m?.content && m?.type).length
    const testCount = Array.isArray(data.testResults) ? data.testResults.length : 0
    const reportCount = Array.isArray(data.analysisReports) ? data.analysisReports.length : 0
    const apptCount = Array.isArray(data.appointments) ? data.appointments.length : 0

    const ok = await confirm(
      t('dashboard.backup.importConfirm', {
        chat: chatCount,
        tests: testCount,
        appts: apptCount,
        reports: reportCount
      }),
      t('dashboard.backup.importConfirmTitle')
    )
    if (!ok) return

    const loadingStore = useLoadingStore()
    loadingStore.show(t('dashboard.backup.restoring', { done: 0, total: chatCount }))
    try {
      // 恢复聊天记录到服务端（逐条写入，chat_records 仅存 content/type）
      let done = 0
      for (const msg of data.chatHistory) {
        if (msg?.content && msg?.type) {
          await saveChat({ content: String(msg.content), type: String(msg.type) })
          done++
          if (done % 20 === 0) loadingStore.show(t('dashboard.backup.restoring', { done, total: chatCount }))
        }
      }

      // 应用备份中的本地设置（自动备份开关、周期等偏好）
      let applied = 0
      if (data.localSettings && typeof data.localSettings === 'object') {
        for (const [k, v] of Object.entries(data.localSettings)) {
          if (BACKUP_SETTING_KEYS.includes(k)) {
            localStorage.setItem(k, String(v))
            applied++
          }
        }
        // 同步设置 store（周期/开关等直接改了 localStorage，需要刷新 Pinia 状态）
        await settingsStore.refreshFromLocal()
      }

      // 重新拉取聊天与统计：按会话打开最近一个，其余入侧栏列表
      await userStore.getChatHistory()
      const latest = await loadChatSessions()
      if (latest) {
        activeSessionId.value = ''
        await openSession(latest)
      } else {
        activeSessionId.value = genSessionId()
        chatMessages.value = []
      }
      await userStore.getStats()

      await success(
        applied
          ? t('dashboard.backup.restoredWithSettings', { done, applied })
          : t('dashboard.backup.restored', { done }),
        t('dashboard.backup.importSuccessTitle')
      )
    } catch (err) {
      console.error('导入失败:', err)
      await error(t('dashboard.backup.importPartialErrorMsg'), t('dashboard.backup.importFailedTitle'))
    } finally {
      loadingStore.hide()
    }
  }
  input.click()
}

const clearData = async () => {
  const ok = await confirm(t('dashboard.backup.clearConfirm'), t('dashboard.backup.clearConfirmTitle'))
  if (ok) {
    try {
      await clearAllData()
      chatMessages.value = []
      userStore.chatHistory = []
      chatSessions.value = []
      activeSessionId.value = genSessionId()
      await userStore.getStats()
      await success(t('dashboard.backup.clearedMsg'), t('dashboard.backup.clearedTitle'))
    } catch (e: any) {
      await error(e?.message || t('dashboard.backup.clearFailed'), t('dashboard.backup.clearFailed'))
    }
  }
}

// ===== AI 记忆管理（个人中心）：查看 / 删除 / 清空 AI 自动抽取的长期记忆 =====
const memoryStatus = ref<{ enabled: boolean } | null>(null)
const memoryList = ref<MemoryItem[]>([])
const memoryLoading = ref(false)
const memoryDeleting = ref(false)

const loadMemoryData = async () => {
  memoryLoading.value = true
  try {
    const status = await getMemoryStatus() as any
    memoryStatus.value = status?.data || { enabled: false }
    if (memoryStatus.value.enabled) {
      const res = await listMemories() as any
      memoryList.value = res?.data || []
    }
  } catch (e) {
    console.error('加载 AI 记忆失败:', e)
    memoryStatus.value = { enabled: false }
  } finally {
    memoryLoading.value = false
  }
}

const onDeleteMemory = async (id: number) => {
  const ok = await confirm(t('dashboard.settings.memoryDeleteConfirm'), t('dashboard.settings.memoryDeleteConfirmTitle'))
  if (!ok) return
  memoryDeleting.value = true
  try {
    await deleteMemory(id)
    memoryList.value = memoryList.value.filter(m => m.id !== id)
    await success(t('dashboard.settings.memoryDeleted'), t('dashboard.settings.aiMemory'))
  } catch (e: any) {
    await error(e?.message || t('dashboard.settings.memoryDeleteFailed'), t('dashboard.settings.aiMemory'))
  } finally {
    memoryDeleting.value = false
  }
}

const onClearMemories = async () => {
  const ok = await confirm(t('dashboard.settings.memoryClearConfirm'), t('dashboard.settings.memoryClearConfirmTitle'))
  if (!ok) return
  memoryDeleting.value = true
  try {
    await clearMemories()
    memoryList.value = []
    await success(t('dashboard.settings.memoryCleared'), t('dashboard.settings.aiMemory'))
  } catch (e: any) {
    await error(e?.message || t('dashboard.settings.memoryDeleteFailed'), t('dashboard.settings.aiMemory'))
  } finally {
    memoryDeleting.value = false
  }
}

const logout = async () => {
  // 断开 Socket 连接
  disconnectSocket()
  await userStore.logout()
  router.replace('/login')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) {
      chatBox.value.scrollTop = chatBox.value.scrollHeight
    }
  })
}

</script>

<style scoped>
/* 流式输出样式：全页唯一的"呼吸光"时刻 */
.streaming {
  animation: fadeIn 0.1s ease;
  box-shadow: 0 0 24px var(--glow);
}

.spin {
  animation: spin 1.2s linear infinite;
  vertical-align: -0.15em;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--accent);
  margin-left: 2px;
  animation: blink 1s infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0.8; }
  to { opacity: 1; }
}
.report-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-export:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.app-wrap {
  display: flex;
  width: 100vw;
  height: calc(100vh - var(--titlebar-h));
  overflow: hidden !important;
  box-sizing: border-box;
}

.left-sidebar {
  width: 232px;
  min-width: 232px;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
  box-sizing: border-box;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 6px 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text h2 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.logo-text p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.menu-list button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius-ctl);
  background: transparent;
  text-align: left;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.menu-list button:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.menu-list button.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.footer-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.footer-avatar-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.footer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.btn-logout {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s var(--ease-out);
}

.btn-logout:hover {
  background: var(--accent-soft);
  color: var(--danger);
}

.main-content {
  flex: 1;
  height: 100%;
  padding: 20px 24px;
  overflow: hidden !important;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  min-width: 0;
  box-sizing: border-box;
}

.empty-tip {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 16px;
}

.page {
  display: none;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}

.page.show {
  display: flex;
  flex-direction: column;
}

/* 内容自适应高度的页面（专家名片 / 我的问卷 / 问卷表单）：
   .main-content 为 overflow:hidden，页面需自带滚动容器才能翻页。
   仅对这类页面开启；预约列表等已自带内部滚动的页面不加，避免出现多余滚动条。 */
.page.scrollable {
  overflow-y: auto;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
/* 专家统计样式 */
.expert-stats .data-item:nth-child(1) .num {
  color: var(--warning);
}

.expert-stats .data-item:nth-child(2) .num {
  color: var(--success);
}

.expert-stats .data-item:nth-child(3) .num {
  color: var(--danger);
}

.expert-stats .data-item:nth-child(4) .num {
  color: var(--accent);
}

/* 管理员统计样式 */
.admin-stats .data-item .num {
  color: var(--accent);
}

.card h3 {
  margin-bottom: 16px;
  color: var(--text-primary);
  font-size: 16px;
  flex-shrink: 0;
}

.sub-title {
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
}

/* 仅报告生成区保留预留高度（滚动容器内），其余加载态自然收拢 */
.scroll-content .loading-text {
  min-height: 132px;
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ===== AI 对话页：会话侧栏布局 ===== */
.chat-layout {
  display: flex;
  align-items: stretch;
  gap: 14px;
  width: 100%;
  flex: 1;          /* 撑满 .page.show 列容器剩余高度，否则整块塌缩成内容高 */
  min-height: 0;
}

.session-sidebar {
  flex: none;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  transition: width 0.22s var(--ease-out);
  overflow: hidden;
}

.session-sidebar.collapsed {
  width: 52px;
  padding: 14px 8px;
  align-items: center;
}

.session-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  width: 100%;
}

.session-sidebar.collapsed .session-head {
  justify-content: center;
}

.session-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.ss-icon-btn {
  flex: none;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
}

.ss-icon-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: var(--radius-ctl);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s var(--ease-out);
}

.new-chat-btn:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-style: solid;
}

.new-chat-btn.mini {
  padding: 8px 0;
  width: 100%;
}

.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 -4px;
  padding: 0 4px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  transition: background 0.15s var(--ease-out);
  position: relative;
}

.session-item:hover {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.session-item.active {
  background: var(--accent-soft);
}

.session-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}

.si-icon {
  flex: none;
  color: var(--text-muted);
}

.session-item.active .si-icon {
  color: var(--accent);
}

.si-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.si-title {
  font-size: 12.5px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.si-meta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.si-act {
  flex: none;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  opacity: 0;
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
}

.session-item:hover .si-act {
  opacity: 1;
}

/* 锁定中的对话：锁图标常显并使用主题色标识 */
.si-act.is-locked {
  opacity: 1;
  color: var(--accent);
}

.si-act:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.si-del:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.session-empty {
  padding: 14px 6px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.chat-card {
  padding: 20px 24px;
  max-width: 800px;
}

/* 聊天页主卡片自适应铺满剩余宽度（须置于 .chat-card 之后覆盖 800px 限宽） */
.chat-main {
  flex: 1;
  min-width: 0;
  max-width: none;
}

/* 聊天头部：标题 + 模型选择器 */
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.model-picker {
  position: relative;
  flex-shrink: 0;
}

.model-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--accent-soft);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  max-width: 220px;
  transition: color 0.15s, border-color 0.15s;
}

.model-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-chip:hover,
.model-chip.open {
  color: var(--accent);
  border-color: var(--accent);
}

/* 聊天头部工具区：翻译选择器 + 模型选择器 */
.chat-head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.translate-picker {
  position: relative;
}

.model-chip.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* 翻译设置弹层（不透明背景，圆角卡片） */
.translate-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 240px;
  padding: 12px 14px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.tm-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--accent-soft);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.tm-switch .tm-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  transition: transform 0.15s;
}

.tm-switch.on {
  background: var(--accent);
  border-color: var(--accent);
}

.tm-switch.on .tm-knob {
  transform: translateX(16px);
  border-color: var(--accent);
}

.tm-select {
  max-width: 150px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary, var(--text-secondary));
  background: var(--accent-soft);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
}

.tm-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tm-seg {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.tm-seg button {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--card-bg);
  border: none;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.tm-seg button + button {
  border-left: 1px solid var(--border-color);
}

.tm-seg button.on {
  color: var(--accent);
  background: var(--accent-soft);
}

/* AI 消息双语视图：译文区（上方加分隔线，视觉与原文区分） */
.msg-translated {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
  opacity: 0.92;
}

/* 报告翻译目标语言下拉（沿用 btn-export 胶囊外观，仅微调内距） */
.lang-select {
  width: auto;
  min-width: 130px;
  padding-top: 7px;
  padding-bottom: 7px;
  cursor: pointer;
}

.chat-box {
  flex: 1;
  overflow-y: auto;
  background: transparent;
  border-radius: 12px;
  padding: 8px 4px 12px;
  margin-bottom: 12px;
  min-height: 0;
  box-sizing: border-box;
}

/* 顶部「加载更早的消息」按钮 */
.load-more-btn {
  display: block;
  margin: 0 auto 12px;
  padding: 5px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--accent-soft);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}

.load-more-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}

.load-more-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.msg-item {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.msg-item:has(.msg-user) {
  justify-content: flex-end;
}

.msg-ai {
  max-width: 68%;
  padding: 10px 14px;
  background: var(--msg-ai-bg);
  border-radius: 14px 14px 14px 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

.msg-user {
  max-width: 68%;
  padding: 10px 14px;
  background: var(--msg-user-bg);
  border-radius: 14px 14px 4px 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

/* AI 输入中动画 */
.typing-indicator {
  font-size: 13px;
  color: var(--text-muted);
}

.typing-indicator span {
  animation: blink 1.4s infinite both;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

.input-row {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  height: 44px;
  box-sizing: border-box;
}

.input-row input {
  flex: 1;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  outline: none;
  font-size: 14px;
  height: 100%;
  background: var(--input-bg);
  color: var(--text-primary);
  box-sizing: border-box;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.input-row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input-row input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.btn-send-chat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 22px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.btn-send-chat:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-send-chat:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.test-item {
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: 0.2s;
}

.test-item:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.test-item h4 {
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 14px;
}

.test-item p {
  font-size: 12px;
  color: var(--text-muted);
}

/* 专家卡片网格：自适应列数，窄窗口 1 列宽卡 */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

/* 悬浮上浮 translateY(-2px) 会把首行卡片顶出滚动区被裁切，预留顶部空间 */
.doc-scroll {
  padding-top: 6px;
}

.doc-card {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 16px;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}

.doc-card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border-color));
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.doc-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.doc-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 18px;
  font-weight: 600;
}

.doc-head-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-head-info h4 {
  color: var(--text-primary);
  font-size: 14.5px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-title {
  font-size: 12px;
  color: var(--text-secondary);
}

.doc-card-body {
  flex: 1;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-label {
  display: inline-block;
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 4px;
  padding: 1px 6px;
  margin-right: 8px;
  flex-shrink: 0;
  vertical-align: 1px;
}

.doc-specialty {
  font-size: 12.5px;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.55;
}

.doc-intro {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-card-foot {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.doc-card-foot .btn-book {
  width: 100%;
}

.online-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  transition: color 0.3s;
}

.online-badge.online {
  color: var(--success);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  transition: background 0.3s;
}

.status-dot.online {
  background: var(--success);
}

.btn-book {
  border: none;
  padding: 8px 14px;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.btn-book:hover {
  background: var(--accent-strong);
}

.time-select {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.time-select input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.time-select input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.time-select button {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.time-select button:hover:not(:disabled) {
  background: var(--accent-strong);
}

.time-select button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.report-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  gap: 4px;
}

.report-empty-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  box-shadow: 0 0 28px var(--glow);
}

.report-empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.report-empty-sub {
  margin: 0;
  max-width: 340px;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.report-result {
  padding: 22px 26px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
}

/* ===== 报告排版：结构化文档观感 ===== */
.report-doc {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-primary);
}

.report-doc :deep(h2) {
  font-size: 15.5px;
  font-weight: 600;
  color: var(--accent);
  margin: 26px 0 10px;
  padding-left: 10px;
  border-left: 3px solid var(--accent);
  line-height: 1.4;
}

.report-doc :deep(h2:first-child) {
  margin-top: 0;
}

.report-doc :deep(h3) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 18px 0 8px;
}

.report-doc :deep(p) {
  margin: 8px 0;
}

.report-doc :deep(strong) {
  color: var(--accent);
  font-weight: 600;
}

.report-doc :deep(ul),
.report-doc :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}

.report-doc :deep(li) {
  margin: 6px 0;
}

.report-doc :deep(li::marker) {
  color: var(--accent);
}

.report-doc :deep(hr) {
  border: none;
  border-top: 1px dashed var(--border-color);
  margin: 20px 0;
}

.report-doc :deep(code) {
  background: var(--bg-tertiary, rgba(127, 127, 127, 0.12));
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12.5px;
}

/* ===== 个人中心/设置页：分组卡片布局 ===== */
.settings-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  max-width: 720px;
  /* 弹性列布局中让固定最大宽度的内容列水平居中，不再贴左 */
  margin: 0 auto;
  padding: 18px 22px 32px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-page::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

/* ===== 用户信息头部卡片（可点击编辑） ===== */
.settings-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.2s var(--ease-out);
}

.settings-profile:hover {
  border-color: var(--border-strong);
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--accent);
  font-weight: 600;
}

.user-base-info h4 {
  font-size: 16px;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.user-base-info p {
  font-size: 12px;
  color: var(--text-muted);
}

.edit-icon {
  margin-left: auto;
  display: inline-flex;
  color: var(--text-muted);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.settings-profile:hover .edit-icon {
  opacity: 1;
}

/* ===== 统计 ===== */
.user-data-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 18px;
}

.data-item {
  background: var(--input-bg);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.data-item .num {
  font-size: 20px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.data-item .text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== 设置分组卡片 ===== */
.settings-group {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.settings-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 18px 11px;
  border-bottom: 1px solid var(--border-color);
}

.settings-group-head svg {
  color: var(--accent);
}

.settings-group-head h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

/* 条目自带左右内边距：hover 高亮铺满整行，不再出现贴文字的残缺色块 */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out);
}

/* AI 记忆列表：条目化展示 + 右侧删除，跟随设置面板黑白极简风格 */
.memory-list {
  display: flex;
  flex-direction: column;
}

.memory-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 18px;
  border-bottom: 1px solid var(--border-color);
}

.memory-item:last-child {
  border-bottom: none;
}

.memory-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-primary);
  word-break: break-word;
}

.memory-delete {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
}

.memory-delete:hover {
  background: var(--border-color);
  color: var(--danger);
}

.memory-delete:disabled {
  opacity: 0.5;
  cursor: default;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background: var(--accent-soft);
}

/* 悬浮时条目标题同步染上琥珀色，形成明确的方向感 */
.setting-item:hover .setting-item-left span:first-child {
  color: var(--accent);
}

.setting-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-item-left span:first-child {
  font-size: 14px;
  color: var(--text-primary);
  transition: color 0.15s var(--ease-out);
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.setting-item-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 检查更新按钮 */
.btn-check-update {
  padding: 6px 14px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-check-update:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.btn-check-update:disabled {
  opacity: 0.6;
  cursor: default;
}

/* 下载就绪态：主色高亮，明确可点击 */
.btn-check-update.btn-install-ready {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn-check-update.btn-install-ready:hover:not(:disabled) {
  background: var(--accent-hover, var(--accent));
  color: #fff;
  opacity: 0.9;
}

/* 下载进度条 */
.update-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  max-width: 340px;
}

.update-progress-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.2s ease;
}

.update-progress-text {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.btn-cancel-download {
  padding: 2px 10px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-cancel-download:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

.setting-select {
  appearance: none;
  -webkit-appearance: none;
  min-width: 118px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 30px 0 12px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  /* 自绘下拉箭头（SVG 全量百分号编码，空格未转义会导致 WebView2 渲染失败、箭头缺失） */
  background-color: var(--input-bg);
  background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='12'%20height='12'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23a8947a'%20stroke-width='2.4'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='m6%209%206%206%206-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 30px;
  text-overflow: ellipsis;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.setting-select:hover {
  border-color: var(--border-strong);
}

.setting-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* 下拉展开项：WebView 暗色主题下原生白底白字不可读，强制跟随卡片配色 */
.setting-select option {
  background: var(--card-bg);
  color: var(--text-primary);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  white-space: nowrap;
}

.theme-option:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.theme-option.selected {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background: var(--border-strong);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  background: var(--on-accent);
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(20px);
}

.arrow {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
}

.scroll-content::-webkit-scrollbar,
.chat-box::-webkit-scrollbar,
.menu-list::-webkit-scrollbar {
  width: 0px;
  background: transparent;
}

.user-card,
.scroll-content,
.chat-box,
.menu-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

@media (max-width: 900px) {
  .left-sidebar {
    width: 190px;
    min-width: 190px;
  }

  .card {
    max-width: 100%;
  }
}

@media (max-width: 700px) {
  .left-sidebar {
    width: 60px;
    min-width: 60px;
    padding: 16px 8px;
  }

  .logo-text {
    display: none;
  }

  .logo-box {
    justify-content: center;
    margin-left: 0;
    margin-right: 0;
  }

  .footer-name,
  .btn-logout {
    display: none;
  }

  .footer-user {
    justify-content: center;
  }

  .menu-list button {
    padding: 10px;
    justify-content: center;
  }

  .menu-list button .menu-text {
    display: none;
  }

  .doc-grid {
    grid-template-columns: 1fr;
  }

  .user-data-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
