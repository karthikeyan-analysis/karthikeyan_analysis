import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { PublicAuthProvider } from './context/PublicAuthContext';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <PublicAuthProvider>
          <RouterProvider router={router} />
        </PublicAuthProvider>
      </DataProvider>
    </AuthProvider>
  );
}
