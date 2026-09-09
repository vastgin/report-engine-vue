import { createRouter, createWebHistory } from 'vue-router'
import DesignerView from '@/views/DesignerView.vue'
import PreviewView from '@/views/PreviewView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DashboardPreviewView from '@/views/DashboardPreviewView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/design' },
    { path: '/design', name: 'design', component: DesignerView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/dashboard/preview', name: 'dashboard-preview', component: DashboardPreviewView },
    { path: '/preview', name: 'preview', component: PreviewView }
  ]
})

export default router
