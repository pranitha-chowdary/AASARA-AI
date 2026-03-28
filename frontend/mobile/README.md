# Aasara React Native (Expo)

A cross-platform mobile app for the Aasara delivery safety platform, built with React Native and Expo. Test instantly on iOS or Android via Expo Go.

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your iPhone or Android device
- Backend running on `localhost:5001`

### Installation

1. **Clone/navigate to project:**
   ```bash
   cd /project\ 7/app-rn
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Adjust API URL (if needed):**
   Edit `app/services/api.ts` and change `API_URL` from `http://localhost:5001/api` to your backend server's URL if running on different machine.

4. **Start Expo:**
   ```bash
   expo start
   # or
   npx expo start
   ```

5. **Open on your device:**
   - **iOS**: Scan the QR code with your iPhone camera, tap notification to open in Expo Go
   - **Android**: Open Expo Go app and scan the QR code from terminal

### Admin Test Credentials
- Email: `admin@aasara.ai`
- Password: `admin123456`

### Worker Test Account
Create a new account using the Sign Up tab with:
- Full Name: Any name
- Email: Any valid email
- Phone: Any phone number
- Password: Any password (min 6 chars recommended)

## Architecture

### Auth Flow
1. **Sign Up** (Worker): Creates new worker account, auto-logs in
2. **Sign In** (Worker): Existing worker login
3. **Admin Login**: Hardcoded credentials (demo mode)
4. Authentication stored in AsyncStorage (persistent across app restarts)

### Real-Time Features
- **5-second Polling**: Disruption status automatically refreshed every 5 seconds
- **Admin Triggering**: Admin can instantly trigger disruptions for workers
- **Live Alerts**: Workers see active disruptions with severity level

### State Management
- **AuthContext**: User login/logout, role management
- **DisruptionContext**: Real-time polling for disruption updates
- **AsyncStorage**: Persistent token storage

## Components

### Screens
- **LoginScreen.tsx**: Tabbed authentication (Sign Up, Sign In, Admin)
- **WorkerDashboardScreen.tsx**: Shift status, premium subscription, active disruption alerts
- **AdminDashboardScreen.tsx**: Worker selection, disruption type selection, trigger button

### Services
- **api.ts**: Axios-based API client with token auto-injection via interceptors

### Contexts
- **AuthContext.tsx**: Authentication state and methods
- **DisruptionContext.tsx**: Disruption polling logic

### Navigation
- **RootNavigator.tsx**: Stack-based navigation (Login → App → Dashboard)

## API Integration

All endpoints from backend are available:

**Auth Endpoints**:
- `POST /api/auth/signup` - Worker registration
- `POST /api/auth/signin` - Worker login
- `POST /api/admin/login` - Admin login
- `GET /api/auth/me` - Current user info

**Disruption Endpoints**:
- `GET /api/disruption/check-active` - Check active disruption for worker
- `POST /api/admin/trigger-disruption` - Trigger disruption for worker
- `GET /api/admin/workers` - Get all workers (admin only)

**Subscription Endpoint**:
- `GET /api/subscription/get-active` - Get active subscription

## Project Structure

```
app-rn/
├── App.tsx                          # Entry point
├── app.json                         # Expo configuration
├── package.json                     # Dependencies
├── babel.config.js                  # Babel config
├── app/
│   ├── navigation/
│   │   └── RootNavigator.tsx       # Navigation setup
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Auth state
│   │   └── DisruptionContext.tsx   # Disruption polling
│   ├── screens/
│   │   ├── LoginScreen.tsx         # Authentication
│   │   ├── WorkerDashboardScreen.tsx
│   │   └── AdminDashboardScreen.tsx
│   └── services/
│       └── api.ts                  # API client
```

## Styling

All screens use StyleSheet with a dark theme:
- Background: `#0f172a` (dark navy)
- Cards: `#1e293b` (lighter navy)
- Green: `#10b981` (worker/success color)
- Orange: `#f97316` (admin/warning color)
- Red: `#ef4444` (errors/danger)

## Testing Workflow

### Test Worker Disruption Alert
1. Start backend: `npm run dev` in main project
2. Start Expo: `npx expo start`
3. Scan QR code on iPhone with Expo Go
4. Create new worker account or sign in
5. Open another browser tab, go to admin dashboard
6. Trigger a disruption for your worker
7. On iPhone, see the alert update within 5 seconds

### Test Admin Panel
1. Go to Admin tab on login screen
2. Enter demo credentials
3. Select a worker from the list
4. Choose disruption type (monsoon, heatwave, curfew, pollution, strike)
5. Click "Trigger Disruption"
6. Open worker view in another Expo device to see the alert

## Troubleshooting

### API Connection Issues
- Ensure backend is running on `localhost:5001`
- Check network connectivity
- On physical device, use machine IP instead of localhost
  - Get IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
  - Update `api.ts`: `http://YOUR_IP:5001/api`

### Auth Token Issues
- Test credentials may not exist if backend was reset
- Create new worker account instead
- Token is stored in AsyncStorage, persists across app restarts

### Hot Reload Not Working
- Restart Expo: Press `r` in terminal
- Reload manually: Press `w` in Expo (web view)
- Clear cache: Delete node_modules and reinstall

## Building for App Stores

### iOS
```bash
eas build --platform ios
# Or for local development build:
eas build --platform ios --local
```

### Android
```bash
eas build --platform android
# Or for local development build:
eas build --platform android --local
```

## Environment Variables

Create `.env` file in project root (optional for local testing):
```
EXPO_PUBLIC_API_URL=http://localhost:5001/api
```

Then update `api.ts` to use:
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';
```

## Next Steps

1. **Test on iPhone**: Scan QR code with physical device in Expo Go
2. **Build for Production**: Use `eas build` for app store submission
3. **Add More Features**: Worker preferences, route history, notifications
4. **Real Notifications**: Implement push notifications with Firebase Cloud Messaging
5. **Native Modules**: Add location services, camera access, etc.

## Expo Go Installation

**iPhone**: 
- Search "Expo Go" in App Store
- Install and open
- Scan QR code from terminal

**Android**:
- Search "Expo Go" in Google Play Store
- Install and open
- Scan QR code from terminal

## Support

For issues specific to this Expo app, check:
- Expo documentation: https://docs.expo.dev
- React Native docs: https://reactnative.dev
- GitHub issues from similar projects

## License

All rights reserved © 2025 Aasara Platforms
