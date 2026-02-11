import { createRouter, createWebHashHistory } from 'vue-router'
// Projection will be lazy-loaded to enable code-splitting

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      // lazy-load HomeView when route is visited to enable code-splitting
      component: () => import('@/views/HomeView.vue'),
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
