import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AboutPage } from '../pages/AboutPage/AboutPage';
import { HomePage } from '../pages/HomePage/HomePage';
import { RootLayout } from './RootLayout/RootLayout';

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/about', component: AboutPage });

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, aboutRoute]),
  defaultViewTransition: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
