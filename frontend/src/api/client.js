import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor dodający token autoryzacyjny JWT do każdego zapytania
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("wedding_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor wyłapujący wygaśnięcie tokena (401) lub brak uprawnień (403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const isPublicRoute = window.location.pathname.startsWith("/rsvp");
      const isAuthEndpoint = error.config?.url?.includes("/auth/login");
      if (!isPublicRoute && !isAuthEndpoint) {
        localStorage.removeItem("wedding_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;