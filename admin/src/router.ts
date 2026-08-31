import { createRouter, createWebHistory } from 'vue-router';
import { auth } from './auth';

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('./views/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresPermission: 'object-types:manage' },
      children: [
        { path: '', redirect: '/layers' },
        {
          path: 'layers',
          name: 'layers',
          component: () => import('./views/LayersView.vue'),
        },
        {
          path: 'object-types',
          name: 'object-types',
          component: () => import('./views/ObjectTypesView.vue'),
        },
        {
          path: 'relation-types',
          name: 'relation-types',
          component: () => import('./views/RelationTypesView.vue'),
        },
        {
          path: 'routes',
          name: 'routes',
          component: () => import('./views/RoutesView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  if (!auth.state.loaded) {
    await auth.loadUser();
  }
  if (to.meta.requiresAuth && !auth.state.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresPermission && !auth.hasPermission(to.meta.requiresPermission as string)) {
    return { name: 'login' };
  }
  return true;
});

export default router;
