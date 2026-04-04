/**
 * React Navigation type definitions for the mobile app.
 */

import type { TRTCRoomConfig } from '@deskpilot/shared';

export type RootStackParamList = {
  Home: undefined;
  Remote: {
    roomId: string;
    pcUserId: string;
    mobileRoomConfig: TRTCRoomConfig;
  };
};
