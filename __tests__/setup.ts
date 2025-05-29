import "react-native-gesture-handler/jestSetup";

// Mock the Zustand persist storage
jest.mock("zustand/middleware", () => ({
  ...jest.requireActual("zustand/middleware"),
  persist: (fn: any) => fn,
}));

// Mock react-native modules
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
  },
}));

// Mock Expo modules
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  cacheDirectory: "/mock/cache/",
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(),
    setPlaybackRate: jest.fn(),
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
    currentTime: 0,
    duration: 180,
  })),
  setAudioModeAsync: jest.fn(),
  AudioStatus: {},
}));

// Mock MD5
jest.mock("md5", () => ({
  __esModule: true,
  default: jest.fn((input: string) => `hashed_${input}`),
}));

// Mock theme context
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#000000",
      text: "#ffffff",
      primary: "#1DB954",
      surface: "#282828",
      border: "#404040",
      textSecondary: "#b3b3b3",
      error: "#e22134",
      cardBackground: "#181818",
    },
  }),
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Setup global fetch mock
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
