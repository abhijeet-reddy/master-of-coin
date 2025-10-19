import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';

// Placeholder components - will be created later
const Dashboard = () => <div>Dashboard</div>;
const Login = () => <div>Login</div>;
const Register = () => <div>Register</div>;
const NotFound = () => <div>404 - Not Found</div>;

// Define routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
    ],
  },
]);

// Router component
export const AppRouter = () => {
  return <RouterProvider router={router} />;
};

export default router;