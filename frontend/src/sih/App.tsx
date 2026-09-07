import { ThemeProvider } from "./lib/theme";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Workbench from "./pages/Workbench";

function Root() {
  const { user } = useAuth();
  return user ? <Workbench /> : <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  );
}
