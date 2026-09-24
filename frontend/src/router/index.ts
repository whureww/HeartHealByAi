import { createRouter, createWebHistory } from 'vue-router'
import { setupGuards } from './guards'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgetPassword from '../views/ForgetPassword.vue'
import AdminLayout from '../views/admin/AdminLayout.vue';
import UserManage from '../views/admin/UserManage.vue';
import TestManage from '../views/admin/TestManage.vue';
import TestEdit from '../views/admin/TestEdit.vue';
import AdminAppointmentList from '@/views/admin/AdminAppointmentList.vue' 

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login, meta: { auth: false } },
  { path: '/register', component: Register, meta: { auth: false } },
  { path: '/forget-password', component: ForgetPassword, meta: { auth: false } },
  {
    path: '/dashboard',
    component: () => import('../views/dashboard/Dashboard.vue'),
    meta: { auth: true }
  },
  {
    path: '/tests/do/:id',
    component: () => import('../views/tests/DoTest.vue'),
    meta: { auth: true }
  },
  // 专家工作台
  {
    path: '/expert',
    component: () => import('../views/expert/ExpertLayout.vue'),
    meta: { requiresAuth: true, role: 2 },
    children: [
      {
        path: '',
        redirect: '/expert/appointments'
      },
      {
        path: 'appointments',
        component: () => import('../views/expert/AppointmentList.vue')
      },
      {
        path: 'appointments/:id',
        component: () => import('../views/expert/AppointmentDetail.vue')
      },
      {
        path: 'my-card',
        component: () => import('../views/expert/MyCard.vue')
      }
    ]
  },
  // 管理后台
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, role: 3 },
    children: [
      {
        path: '',
        redirect: '/admin/users'
      },
      {
        path: 'users',
        component: UserManage
      },
      {
        path: 'tests',
        component: TestManage
      },
      {
        path: 'tests/create',
        component: TestEdit
      },
      {
        path: 'tests/edit/:id',
        component: TestEdit
      },
      {
        path: 'appointments',
        component: AdminAppointmentList
      },
      {
        path: 'doctor-cards',
        component: () => import('../views/admin/DoctorCardReview.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

setupGuards(router)

export default router
