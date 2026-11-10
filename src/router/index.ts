import { createRouter, createWebHistory } from 'vue-router'
import TrainingApp from '../TrainingApp.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'week', component: TrainingApp },
    { path: '/plan', name: 'plan', component: TrainingApp },
    { path: '/activities', name: 'activities', component: TrainingApp },
    { path: '/settings', name: 'settings', component: TrainingApp },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
