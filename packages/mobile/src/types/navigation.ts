/**
 * React Navigation type definitions for the mobile app.
 */

export type RootStackParamList = {
  Home: undefined;
  Remote: {
    sessionId: string;
    roomId: string;
  };
};
