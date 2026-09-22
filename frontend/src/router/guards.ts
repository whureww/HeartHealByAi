import type { Router, NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

export function setupGuards(router: Router) {
  router.beforeEach(async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ) => {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()

    // 如果已登录但没有用户信息，尝试获取
    if (userStore.token && !userStore.userInfo) {
      // 按错误类型分流：会话过期（拦截器抛出）立即登出；
      // 仅真网络抖动（如 "Network Error"）时静默重试一次，避免偶发断网直接踢回登录页
      const fetchInfo = () => userStore.getInfo()
      const isAuthError = (e: unknown) => /过期|401/.test(String((e as Error)?.message || ''))
      try {
        await fetchInfo()
      } catch (e) {
        console.error('获取用户信息失败:', e)
        if (!isAuthError(e)) {
          await new Promise((r) => setTimeout(r, 1500))
          try {
            await fetchInfo()
          } catch (e2) {
            console.error('重试后仍失败:', e2)
            await userStore.logout()
            next('/login')
            return
          }
        } else {
          await userStore.logout()
          next('/login')
          return
        }
      }
    }

    const isAuthenticated = userStore.isLoggedIn
    const publicPaths = ['/login', '/register', '/forget-password']

    // 已登录用户访问公开页面，根据角色重定向
    if (isAuthenticated && publicPaths.includes(to.path)) {
      const role = userStore.userInfo?.role
      
      if (role === 2) {
        // 专家 → 专家工作台
        next('/expert')
      } else if (role === 3) {
        // 管理员 → AI 对话（/dashboard）
        next('/dashboard')
      } else {
        // 普通用户 → AI 对话（/dashboard）
        next('/dashboard')
      }
      return
    }

    // 未登录用户访问需要认证的页面，重定向到登录
    if (to.meta.auth && !isAuthenticated) {
      next('/login')
      return
    }

    // 角色权限检查（统一处理）
    if (to.meta.requiresAuth && !isAuthenticated) {
      next('/login')
      return
    }

    // 管理员专属路由检查
    if (to.meta.role === 3) {
      if (!isAuthenticated) {
        next('/login')
        return
      }

      const role = userStore.userInfo?.role
      if (role !== 3) {
        // 非管理员访问管理员路由，跳转到 AI 对话
        next('/dashboard')
        return
      }
    }

    // 专家专属路由检查
    if (to.meta.role === 2) {
      if (!isAuthenticated) {
        next('/login')
        return
      }

      const role = userStore.userInfo?.role
      if (role !== 2) {
        // 非专家访问专家路由，跳转到 AI 对话
        next('/dashboard')
        return
      }
    }

    next()
  })
}
