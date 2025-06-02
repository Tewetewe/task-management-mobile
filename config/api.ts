const DEV_MACHINE_IP = '192.168.1.28';
const API_PORT = '3000';

export const API_CONFIG = {
  BASE_URL: `http://${DEV_MACHINE_IP}:${API_PORT}`,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      LOGOUT: '/auth/logout',
    },
    TASKS: '/tasks',
  },
  DEMO_CREDENTIALS: {
    USERNAME: 'admin',
    PASSWORD: 'password',
  }
};

export const API_BASE_URL = API_CONFIG.BASE_URL;

if (__DEV__) {
  console.log('API Configuration:', {
    baseUrl: API_CONFIG.BASE_URL,
    endpoints: API_CONFIG.ENDPOINTS,
    demoCredentials: API_CONFIG.DEMO_CREDENTIALS
  });
} 