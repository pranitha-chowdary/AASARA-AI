# Aasara React Native (Expo) - Conversion Summary

This document summarizes the conversion from React web to React Native using Expo for instant iPhone preview.

## Why React Native + Expo?

| Aspect | Benefit |
|--------|---------|
| **Cross-Platform** | Single codebase for iOS and Android |
| **Instant Preview** | Scan QR code, see app on physical iPhone immediately |
| **No App Store Delay** | Development and testing before submission |
| **Code Reuse** | Share logic with React web (Context, API calls) |
| **TypeScript Support** | Same type safety as React web |

## Ported Components

### LoginScreen.tsx
**From**: React AuthView.tsx
**Changes**:
- HTML → React Native (View, TextInput, TouchableOpacity)
- CSS Tailwind → StyleSheet for dark theme
- Same three tabs: Sign Up, Sign In, Admin
- Same validation and error handling
- Same demo credentials hardcoded for admin

### WorkerDashboardScreen.tsx
**From**: React RealTimeDashboard.tsx (cleaned version)
**Changes**:
- Removed unnecessary cards (kept only Shift Status, Premium, Disruption Alert)
- ScrollView instead of div container
- StyleSheet instead of Tailwind classes
- Same 5-second polling for disruptions
- Same subscription data display
- Shift toggle button for in-app state

### AdminDashboardScreen.tsx
**From**: React AdminDashboard.tsx
**Changes**:
- Worker grid selection (horizontal cards)
- Disruption type button grid (5 disruption types)
- Same real-time trigger functionality
- Summary card showing ready state
- Icon emoji representation instead of images

## Project Structure

```
app-rn/
├── App.tsx                    # Entry point with providers
├── app.json                   # Expo config
├── package.json               # Expo + React Native deps
├── babel.config.js            # Babel config for Expo
├── .gitignore                 # Git ignore patterns
│
├── app/
│   ├── navigation/
│   │   └── RootNavigator.tsx      # Stack nav (Login → App)
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Auth state (login/logout)
│   │   └── DisruptionContext.tsx  # Disruption polling (5sec)
│   │
│   ├── screens/
│   │   ├── LoginScreen.tsx        # Tabs: SignUp, SignIn, Admin
│   │   ├── WorkerDashboardScreen.tsx  # Worker view
│   │   └── AdminDashboardScreen.tsx   # Admin control
│   │
│   └── services/
│       └── api.ts                 # Axios client + interceptors
│
├── README.md                  # Quick start guide
├── SETUP.md                   # Detailed setup instructions
└── QUICKSTART.md              # 5-minute quickstart
```

## Key Differences from Web App

| Feature | Web React | React Native |
|---------|-----------|------------|
| **Rendering** | HTML DOM | Native Components |
| **UI Framework** | Tailwind CSS | React Native StyleSheet |
| **HTTP Client** | fetch / Axios | Axios (same) |
| **Storage** | localStorage | AsyncStorage |
| **Navigation** | React Router | React Navigation |
| **State** | Context API (same) | Context API (same) |
| **Styling** | CSS classes | StyleSheet objects |
| **Layout** | Flexbox (CSS) | Flexbox (RN) |
| **Responsive** | Media queries | Screen dimensions |

## Dependencies Added

```json
{
  "dependencies": {
    "expo": "^50.0.0",
    "react-native": "0.73.6",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "axios": "^1.6.2",
    "react-native-reanimated": "~3.5.4"
  }
}
```

## Authentication Flow

```
User Opens App
    ↓
AuthContext checks stored token in AsyncStorage
    ↓
    ├─ Token found? → Show user dashboard
    └─ No token? → Show LoginScreen
        ├─ Sign Up → workerSignUp() → Store token → Dashboard
        ├─ Sign In → workerSignIn() → Store token → Dashboard
        └─ Admin → adminLogin() → Store token → AdminDashboard
```

## Real-Time Disruption Flow

```
WorkerDashboardScreen mounts
    ↓
DisruptionContext.startPolling()
    ↓
Every 5 seconds:
  - Calls checkActiveDisruption()
  - Updates disruptionContext.activeDisruption
  - Component automatically re-renders
    ↓
User sees live disruption alert with:
  - Disruption type with emoji
  - Severity level
  - Color-coded by disruption type
  - Timestamp
```

## Styling Strategy

All screens use a **dark-first design** inspired by the web dashboard:

```
Light Text: #f1f5f9
Dark Background: #0f172a
Card Background: #1e293b
Borders: #334155
Worker Color: #10b981 (green)
Admin Color: #f97316 (orange)
Error Color: #ef4444 (red)
```

Example StyleSheet:
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  }
});
```

## Testing Scenarios

### Scenario 1: Worker Sign Up & View Dashboard
1. Open app on iPhone
2. Go to "Sign Up" tab
3. Enter test data (Full Name, Email, Phone, Password)
4. Tap "Create Account"
5. Automatically logged in to worker dashboard
6. See Shift Status, Premium, Disruption Alert cards

### Scenario 2: Admin Trigger Disruption
1. On browser tab, open admin dashboard (localhost:5173)
2. Login as admin@aasara.ai / admin123456
3. Select a worker from list
4. Choose disruption type (monsoon, heatwave, etc.)
5. Click trigger
6. On iPhone—disruption alerts updates within 5 seconds

### Scenario 3: Multiple Workers
1. Create 2 worker accounts via sign up (different emails)
2. On admin dashboard—both appear in worker list
3. Trigger disruption for each independently
4. Each worker sees their own disruption alert

## API Integration

The ApiService class mirrors the React web app:

**Authentication**:
- `workerSignUp(email, password, fullName, phoneNumber)` → POST /auth/signup
- `workerSignIn(email, password)` → POST /auth/signin
- `adminLogin(email, password)` → POST /admin/login

**Disruption**:
- `checkActiveDisruption()` → GET /disruption/check-active
- `triggerDisruption(workerId, type, severity)` → POST /admin/trigger-disruption
- `getAllWorkers()` → GET /admin/workers

**Subscriptions**:
- `getActiveSubscription()` → GET /subscription/get-active

**Token Management**:
- Axios interceptor automatically injects Bearer token
- Token persisted in AsyncStorage
- `logout()` clears stored token

## Hot Reload & Debugging

**Hot Reload**:
- Edit a file and save
- Fast refresh automatically reloads component
- No state loss (usually)

**Force Reload**:
- Press `r` in Expo terminal

**Debugger**:
- Press `j` in Expo terminal to open web debugger
- Inspect network requests, state, console logs

## Performance Considerations

| Aspect | Optimization |
|--------|-------------|
| **Bundle Size** | Expo handles; ~30MB on device |
| **Memory** | Native components are efficient |
| **API Calls** | 5-sec polling, not continuous |
| **Rendering** | React Native optimizes automatically |
| **Storage** | AsyncStorage is async, non-blocking |

## Known Limitations (vs App Store Native)

1. Cannot push notifications until configured
2. No direct camera access without additional setup
3. App store submission requires `eas build`
4. Some native APIs require expo plugins
5. Performance may differ from native Kotlin/Swift

## Building for App Stores

### iOS Build
```bash
eas build --platform ios
# Output: .ipa file for TestFlight
```

### Android Build
```bash
eas build --platform android
# Output: .aab file for Google Play
```

### Local Build (Mac only)
```bash
eas build --platform ios --local
npx expo run:ios  # Build + run on simulator
```

## Next Steps After Testing

1. **Add Features**: Implement worker preferences, history, etc.
2. **Push Notifications**: Setup Firebase Cloud Messaging
3. **Location Services**: Add GPS tracking (if needed)
4. **Build**: Use `eas build` for binary builds
5. **Store Submission**: Follow Apple/Google submission process
6. **Beta Testing**: Share TestFlight link with beta testers

## Comparison Summary

### React Web (Current - port 5173)
- ✅ Desktop full-featured
- ✅ Admin dashboard accessible
- ✅ Complex dashboards
- ✅ Easy debugging in browser
- ❌ Not mobile-optimized
- ❌ Not accessible on iPhone

### Flutter (Created - /aasara_flutter)
- ✅ Native iOS/Android performance
- ✅ Professional app store deployment
- ✅ Best performance
- ❌ Different codebase (Dart)
- ❌ Slower iteration during development
- ❌ Requires native build tools

### React Native + Expo (Current - /app-rn) 
- ✅ **Instant iPhone preview via QR code** ← Main advantage
- ✅ **Single codebase for iOS + Android**
- ✅ Shared React knowledge
- ✅ Fast iteration (hot reload)
- ✅ AsyncStorage + Context (familiar patterns)
- ⚠️ Performance between native and web
- ⚠️ Requires `eas build` for app stores

## FAQ

### Q: Can I run both React and React Native simultaneously?
**A**: Yes! `npm start` in web directory (port 5173) and `expo start` in app-rn directory (separate port). Both can run simultaneously.

### Q: Will my worker/admin accounts sync between web and React Native?
**A**: Yes! Both connect to the same backend at `localhost:5001`. Authentication, disruptions, worker lists are all shared.

### Q: What if I need to deploy React Native to AppStore?
**A**: Use `eas build --platform ios` to create binary, then submit via App Store Connect.

### Q: Can I use this on Android?
**A**: Absolutely! Same codebase works on Android via Expo Go. Use `expo start` and scan on Android device.

### Q: How do I debug API calls?
**A**: 
1. Check network tab: Press `j` in Expo terminal
2. Add console.log in api.ts
3. Check backend logs on localhost:5001
4. Use Postman to test endpoints directly

## Summary

The React Native Expo app provides your team with **instant mobile access** via QR code scanning on physical iPhone/Android devices. Perfect for quick testing, stakeholder demos, and rapid iteration before app store deployment.

**Total Implementation Time**: ~30 minutes
**Time to First Test on iPhone**: ~2 minutes (after npm install)
**Lines of Code**: ~1000 (screens, contexts, navigation, services)
