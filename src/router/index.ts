import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
// import Projection from '../views/ProjectionView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  // {
  //   path: '/projection',
  //   name: 'Projection',
  //   component: Projection,
  // },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
