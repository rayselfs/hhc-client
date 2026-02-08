import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/HomeView.vue'
// Projection will be lazy-loaded to enable code-splitting

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
    },
    {
      path: '/projection',
      name: 'Projection',
      // lazy-load ProjectionView when route is visited
      component: () => import('@/views/ProjectionView.vue'),
    },
  ],
})

export default router
