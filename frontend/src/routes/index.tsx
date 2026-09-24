import { createBrowserRouter, RouterProvider } from 'react-router';
import { lazy } from '@/utils/lazy';
import PrivateLayout from '@/layouts/private';

const CourseListPage = lazy(() => import('@/pages/course-list'));
const CourseContentPage = lazy(() => import('@/pages/course-content'));
const StudentPage = lazy(() => import('@/pages/student'));

const router = createBrowserRouter([
	{
		path: '/',
		Component: PrivateLayout,
		children: [
			{ index: true, Component: CourseListPage },
			{ path: 'courses/:courseId', Component: CourseContentPage },
			{ path: 'students', Component: StudentPage },
		],
	},
]);

const AppRoutes = () => <RouterProvider router={router} />;

export default AppRoutes;
