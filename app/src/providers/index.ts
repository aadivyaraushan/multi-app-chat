import { MockProvider } from './MockProvider';
import { ChatProvider } from './types';

export * from './types';

// Which backend the app runs against. Set EXPO_PUBLIC_MATRIX_BASE_URL (and the
// login vars below) to point at a real homeserver + bridges; leave it unset to
// run the seeded MockProvider used by demos and the e2e suite.
export interface ProviderConfig {
  matrixBaseUrl?: string;
  matrixUserId?: string;
  matrixAccessToken?: string;
  matrixPassword?: string;
}

export function readProviderConfig(): ProviderConfig {
  return {
    matrixBaseUrl: process.env.EXPO_PUBLIC_MATRIX_BASE_URL,
    matrixUserId: process.env.EXPO_PUBLIC_MATRIX_USER_ID,
    matrixAccessToken: process.env.EXPO_PUBLIC_MATRIX_ACCESS_TOKEN,
    matrixPassword: process.env.EXPO_PUBLIC_MATRIX_PASSWORD,
  };
}

export function createProvider(config: ProviderConfig = readProviderConfig()): ChatProvider {
  if (config.matrixBaseUrl) {
    // Loaded lazily so the seeded app never pulls matrix-js-sdk into its bundle.
    const { MatrixProvider } = require('./MatrixProvider') as typeof import('./MatrixProvider');
    return new MatrixProvider({
      baseUrl: config.matrixBaseUrl,
      userId: config.matrixUserId,
      accessToken: config.matrixAccessToken,
      password: config.matrixPassword,
    });
  }
  return new MockProvider();
}
