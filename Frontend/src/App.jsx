import { useEffect, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

// Componente de Skeleton para carga
const MovieSkeleton = () => (
  <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800 animate-pulse">
    <div className="aspect-[2/3] bg-slate-800" />
    <div className="p-3">
      <div className="h-4 bg-slate-800 rounded mb-2" />
      <div className="h-3 bg-slate-800 rounded w-1/2 mb-3" />
      <div className="h-7 bg-slate-800 rounded" />
    </div>
  </div>
);

// Componente de Spinner
const Spinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  return (
    <svg
      className={`animate-spin text-indigo-500 ${sizeClasses[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState('');
  const [error, setError] = useState('');
  const [addingFavorite, setAddingFavorite] = useState(null);
  const [removingFavorite, setRemovingFavorite] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

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
    setAuthSubmitting(true);

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
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setFavorites([]);
    setMovies([]);
    setHasSearched(false);
  };

  const fetchFavorites = async () => {
    if (!session?.user?.id) return;

    setFavoritesLoading(true);
    setFavoritesError('');

    try {
      const response = await fetch(`${API_URL}/favorites/${session.user.id}`);

      if (!response.ok) {
        throw new Error('Error al cargar favoritos');
      }

      const data = await response.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
      setFavoritesError('No se pudieron cargar tus favoritos. Intenta de nuevo.');
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const searchMovies = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const response = await fetch(`${API_URL}/movies?s=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error('Error de conexión con el servidor');
      }

      const data = await response.json();

      if (data.Search) {
        setMovies(data.Search);
        setError('');
      } else {
        setMovies([]);
        setError(data.error || 'No se encontraron películas para tu búsqueda');
      }
    } catch (err) {
      setMovies([]);
      setError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (movie) => {
    if (!session?.user?.id) return;

    setAddingFavorite(movie.imdbID);

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
        await fetchFavorites();
      } else {
        const data = await response.json();
        setError(data.error || 'Error al agregar a favoritos');
      }
    } catch (err) {
      setError('No se pudo agregar a favoritos. Intenta de nuevo.');
      console.error('Error al agregar favorito:', err);
    } finally {
      setAddingFavorite(null);
    }
  };

  const removeFromFavorites = async (id) => {
    setRemovingFavorite(id);

    try {
      const response = await fetch(`${API_URL}/favorites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchFavorites();
      } else {
        setFavoritesError('No se pudo eliminar. Intenta de nuevo.');
      }
    } catch (err) {
      setFavoritesError('Error de conexión. Intenta de nuevo.');
      console.error('Error al eliminar favorito:', err);
    } finally {
      setRemovingFavorite(null);
    }
  };

  const isFavorite = (imdbID) => {
    return favorites.some((fav) => fav.imdb_id === imdbID);
  };

  // Loading inicial con animación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-slate-400 text-sm">Cargando aplicación...</p>
      </div>
    );
  }

  // Pantalla de Login/Registro
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Movie Finder</h1>
            <p className="text-slate-400 text-sm">Descubre y guarda tus películas favoritas</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl shadow-slate-950/50">
            <div className="flex mb-6 bg-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  authMode === 'login'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  authMode === 'register'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authSubmitting}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm disabled:opacity-50"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authSubmitting}
                  minLength={6}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm disabled:opacity-50"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {authError && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/50 p-3 rounded-lg border border-red-900">
                  <svg
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {authSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Procesando...</span>
                  </>
                ) : authMode === 'login' ? (
                  'Iniciar Sesión'
                ) : (
                  'Crear Cuenta'
                )}
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
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Movie Finder</h1>
            <p className="text-xs text-slate-400 mt-0.5">{session.user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Buscador */}
        <section className="mb-10">
          <form onSubmit={searchMovies} className="flex gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar películas por título..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span className="hidden sm:inline">Buscando</span>
                </>
              ) : (
                'Buscar'
              )}
            </button>
          </form>
        </section>

        {/* Estado de carga de búsqueda */}
        {loading && (
          <section className="mb-14">
            <h2 className="text-lg font-semibold text-white mb-5 pb-2 border-b border-slate-800">
              Buscando películas...
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {[...Array(6)].map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          </section>
        )}

        {/* Error de búsqueda */}
        {error && !loading && (
          <div className="max-w-md mx-auto mb-10">
            <div className="flex flex-col items-center text-center p-6 bg-slate-900 rounded-xl border border-slate-800">
              <div className="w-12 h-12 bg-red-950 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <p className="text-slate-300 text-sm mb-2">{error}</p>
              <button
                onClick={() => setError('')}
                className="text-indigo-400 text-sm hover:text-indigo-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {!loading && movies.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center justify-between mb-5 pb-2 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Resultados de búsqueda</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                {movies.length} encontradas
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {movies.map((movie) => (
                <div
                  key={movie.imdbID}
                  className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-900/50 group"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    <img
                      src={
                        movie.Poster !== 'N/A'
                          ? movie.Poster
                          : 'https://via.placeholder.com/300x450/1e293b/64748b?text=Sin+imagen'
                      }
                      alt={movie.Title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-slate-100 line-clamp-2 leading-tight mb-1">
                      {movie.Title}
                    </h3>
                    <p className="text-slate-500 text-xs mb-3">{movie.Year}</p>
                    <button
                      onClick={() => addToFavorites(movie)}
                      disabled={isFavorite(movie.imdbID) || addingFavorite === movie.imdbID}
                      className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                        isFavorite(movie.imdbID)
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-default'
                          : addingFavorite === movie.imdbID
                          ? 'bg-indigo-600/50 text-white cursor-wait'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {addingFavorite === movie.imdbID ? (
                        <>
                          <Spinner size="sm" />
                          <span>Agregando</span>
                        </>
                      ) : isFavorite(movie.imdbID) ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Agregado</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Estado vacío de búsqueda */}
        {!loading && hasSearched && movies.length === 0 && !error && (
          <div className="max-w-md mx-auto mb-10">
            <div className="flex flex-col items-center text-center p-8 bg-slate-900 rounded-xl border border-slate-800">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <p className="text-slate-300 text-sm mb-1">No encontramos resultados</p>
              <p className="text-slate-500 text-xs">Intenta con otro término de búsqueda</p>
            </div>
          </div>
        )}

        {/* Favoritos */}
        <section>
          <div className="flex items-center justify-between mb-5 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Mis Favoritos</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                {favorites.length}
              </span>
            </div>
            {favoritesError && (
              <button
                onClick={fetchFavorites}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Reintentar
              </button>
            )}
          </div>

          {/* Error de favoritos */}
          {favoritesError && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-900 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{favoritesError}</span>
            </div>
          )}

          {/* Loading de favoritos */}
          {favoritesLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {[...Array(3)].map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Lista de favoritos */}
          {!favoritesLoading && favorites.length === 0 && !favoritesError && (
            <div className="flex flex-col items-center text-center py-16 bg-slate-900/50 rounded-xl border border-slate-800">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <p className="text-slate-300 text-sm mb-1">No tienes películas favoritas</p>
              <p className="text-slate-500 text-xs">Busca y agrega películas a tu colección</p>
            </div>
          )}

          {!favoritesLoading && favorites.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {favorites.map((movie) => (
                <div
                  key={movie.id}
                  className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-900/50 group"
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    <img
                      src={
                        movie.poster !== 'N/A'
                          ? movie.poster
                          : 'https://via.placeholder.com/300x450/1e293b/64748b?text=Sin+imagen'
                      }
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-slate-100 line-clamp-2 leading-tight mb-1">
                      {movie.title}
                    </h3>
                    <p className="text-slate-500 text-xs mb-3">{movie.year}</p>
                    <button
                      onClick={() => removeFromFavorites(movie.id)}
                      disabled={removingFavorite === movie.id}
                      className="w-full py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-red-900 hover:text-red-200 border border-slate-700 hover:border-red-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {removingFavorite === movie.id ? (
                        <>
                          <Spinner size="sm" />
                          <span>Eliminando</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Eliminar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-600 text-xs border-t border-slate-900 mt-16">
        <p>Movie Finder — Prueba Técnica Fullstack</p>
      </footer>
    </div>
  );
}

export default App;
