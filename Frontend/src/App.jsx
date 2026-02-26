import { useEffect, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Escuchar cambios de sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar favoritos cuando hay sesión
  useEffect(() => {
    if (session?.user?.id) {
      fetchFavorites();
    }
  }, [session]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setFavorites([]);
    setMovies([]);
  };

  const fetchFavorites = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`${API_URL}/favorites/${session.user.id}`);
      const data = await response.json();
      setFavorites(data);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
    }
  };

  const searchMovies = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/movies?s=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.Search) {
        setMovies(data.Search);
      } else {
        setMovies([]);
        setError(data.error || 'No se encontraron películas');
      }
    } catch (err) {
      setError('Error al buscar películas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (movie) => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`${API_URL}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imdb_id: movie.imdbID,
          title: movie.Title,
          year: movie.Year,
          poster: movie.Poster,
          user_id: session.user.id,
        }),
      });

      if (response.ok) {
        fetchFavorites();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al agregar a favoritos');
      }
    } catch (err) {
      console.error('Error al agregar favorito:', err);
    }
  };

  const removeFromFavorites = async (id) => {
    try {
      const response = await fetch(`${API_URL}/favorites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFavorites();
      }
    } catch (err) {
      console.error('Error al eliminar favorito:', err);
    }
  };

  const isFavorite = (imdbID) => {
    return favorites.some((fav) => fav.imdb_id === imdbID);
  };

  // Loading inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  // Pantalla de Login/Registro
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-white text-center mb-8">Movie Finder</h1>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex mb-6">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  authMode === 'login'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  authMode === 'register'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {authError && (
                <p className="text-red-400 text-xs bg-red-950/50 p-2 rounded border border-red-900">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors text-sm"
              >
                {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Interfaz principal (usuario autenticado)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Movie Finder</h1>
            <p className="text-sm text-slate-400 mt-0.5">{session.user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Buscador */}
        <section className="mb-12">
          <form onSubmit={searchMovies} className="flex gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar películas..."
              className="flex-1 px-4 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
        </section>

        {/* Error */}
        {error && (
          <div className="text-center text-red-400 mb-8 p-4 bg-red-950/50 rounded-md border border-red-900">
            {error}
          </div>
        )}

        {/* Resultados de búsqueda */}
        {movies.length > 0 && (
          <section className="mb-14">
            <h2 className="text-lg font-semibold text-white mb-5 pb-2 border-b border-slate-800">
              Resultados de búsqueda
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {movies.map((movie) => (
                <div
                  key={movie.imdbID}
                  className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors"
                >
                  <div className="aspect-[2/3]">
                    <img
                      src={
                        movie.Poster !== 'N/A'
                          ? movie.Poster
                          : 'https://via.placeholder.com/300x450/1e293b/64748b?text=Sin+imagen'
                      }
                      alt={movie.Title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-slate-100 line-clamp-2 leading-tight">
                      {movie.Title}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">{movie.Year}</p>
                    <button
                      onClick={() => addToFavorites(movie)}
                      disabled={isFavorite(movie.imdbID)}
                      className={`w-full mt-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        isFavorite(movie.imdbID)
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isFavorite(movie.imdbID) ? 'Agregado' : 'Agregar a Favoritos'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Favoritos */}
        <section>
          <div className="flex items-center gap-3 mb-5 pb-2 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Mis Favoritos</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              {favorites.length}
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800">
              <p className="text-sm">No tienes películas favoritas.</p>
              <p className="text-xs mt-1 text-slate-600">Busca y agrega películas a tu lista.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {favorites.map((movie) => (
                <div
                  key={movie.id}
                  className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors"
                >
                  <div className="aspect-[2/3] relative">
                    <img
                      src={
                        movie.poster !== 'N/A'
                          ? movie.poster
                          : 'https://via.placeholder.com/300x450/1e293b/64748b?text=Sin+imagen'
                      }
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-slate-100 line-clamp-2 leading-tight">
                      {movie.title}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">{movie.year}</p>
                    <button
                      onClick={() => removeFromFavorites(movie.id)}
                      className="w-full mt-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-red-900 hover:text-red-200 border border-slate-700 hover:border-red-800 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-slate-600 text-xs border-t border-slate-900 mt-16">
        Movie Finder — Prueba Técnica Fullstack
      </footer>
    </div>
  );
}

export default App;
