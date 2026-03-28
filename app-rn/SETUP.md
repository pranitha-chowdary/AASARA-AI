# Aasara React Native - Detailed Setup Guide

This guide walks you through setting up the React Native Expo app step-by-step.

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org
   - Verify: `node --version` (should be v18+)
   - Verify npm: `npm --version` (should be v8+)

2. **Git** (optional, for version control)
   - Download: https://git-scm.com
   - Verify: `git --version`

3. **Expo CLI** (global package)
   ```bash
   npm install -g expo-cli
   # Verify:
   expo --version
   ```

4. **Expo Go App** (on your iPhone or Android device)
   - **iPhone**: Download from App Store (search "Expo Go")
   - **Android**: Download from Google Play Store (search "Expo Go")

### Backend Requirement
- Aasara backend running on `localhost:5001`
- Ensure POST requests work with this URLs:
  - `/api/auth/signup`
  - `/api/auth/signin`
  - `/api/admin/login`
  - `/api/disruption/check-active`
  - `/api/admin/trigger-disruption`
  - `/api/admin/workers`
  - `/api/subscription/get-active`

## Step 1: Install Dependencies

Navigate to the project directory:
```bash
cd /path/to/project\ 7/app-rn
```

Install npm packages:
```bash
npm install
```

Wait for full installation (may take 2-5 minutes). You should see a `node_modules` folder created.

## Step 2: Configure Backend URL

By default, the app connects to `localhost:5001`. 

**For local testing on simulator:**
No changes needed if backend runs on your machine's `localhost:5001`.

**For testing on physical iPhone/Android:**
1. Find your machine's IP address:
   ```bash
   # On Mac/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # On Windows:
   ipconfig | grep "IPv4"
   ```
   Example output: `192.168.1.100`

2. Edit `app/services/api.ts`:
   ```typescript
   const API_URL = 'http://192.168.1.100:5001/api'; // Replace with your IP
   ```

## Step 3: Start the Metro Bundler

In the project directory, start Expo:
```bash
npm start
```

Or use the Expo CLI directly:
```bash
expo start
```

You should see terminal output like:
```
Starting Expo CLI...
[Connected to Expo](https://expo.io)
[QR Code displayed]
...
web  Metro waiting on exp://...
```

## Step 4: Run on iPhone (via Expo Go)

### Method A: Via QR Code (Recommended)
1. **Open Expo Go app** on your iPhone
2. **Tap the camera icon** at the bottom
3. **Scan the QR code** shown in your terminal
4. **Tap the notification** to open the app

### Method B: Via Link
1. Terminal shows: `Press a to open in browser and hit Ctrl+K to see available dev tools`
2. **Copy the URL** from terminal (looks like `exp://...`)
3. On iPhone, **paste into Safari address bar**
4. **Tap "Open in Expo Go"**

### Method C: Manual Entry
1. In Expo Go, tap "Enter URL manually"
2. Enter the connection string from terminal

## Step 5: Run on Android (via Expo Go)

Similar to iPhone:
1. **Open Expo Go app** on Android device
2. **Tap the QR code icon** at the bottom
3. **Scan the QR code** from terminal
4. App will load automatically

## Step 6: Test Authentication

Once app is running:

### Test Worker Sign Up
1. Go to **"Sign Up"** tab
2. Enter test data:
   - Full Name: John Delivery
   - Email: john@example.com
   - Phone: 555-0123
   - Password: password123
3. Tap **"Create Account"**
4. Should automatically log in to worker dashboard

### Test Worker Sign In
1. Go to **"Sign In"** tab
2. Use credentials from previous sign up
3. Tap **"Sign In"**

### Test Admin Login
1. Go to **"Admin"** tab
2. Enter demo credentials:
   - Email: `admin@aasara.ai`
   - Password: `admin123456`
3. Tap **"Admin Login"**
4. Should see list of available workers

## Step 7: Test Real-Time Disruption

### Setup (Two Devices)
Device 1: iPhone with worker account open to dashboard
Device 2: Browser with admin dashboard

### Trigger Disruption
1. **On Device 2 (Browser Admin)**:
   - Go to http://localhost:5173 (React web dashboard)
   - Login as admin
   - Select a worker
   - Choose disruption type
   - Click trigger

2. **On Device 1 (iPhone Worker)**:
   - Watch the "Active Disruption Alert" card
   - Within 5 seconds, should show the triggered disruption
   - Card background changes based on disruption type

## Step 8: Development Commands

### Common Commands

| Command | Use Case |
|---------|----------|
| `npm start` | Start dev server |
| `expo start` | Alternative start command |
| `npm install <package>` | Add new dependency |
| `npm update` | Update all dependencies |
| `npm outdated` | Check for outdated packages |
| `npx expo prebuild` | Generate native folders (.ios, .android) |

### Debugging

**React Native Debugger** (recommended):
1. Download: https://github.com/jhen0409/react-native-debugger
2. Install and run the app
3. Press `d` in Metro terminal
4. Press `j` for debugger

**Built-in Network Inspector**:
1. Enable in Expo: Press `j` in terminal
2. Or press `Ctrl+Shift+D` in Metro

## Step 9: Troubleshooting

### Issue: "Cannot find module" error
**Solution**: 
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### Issue: API requests failing (Network Error)
**Solution**:
1. Verify backend is running: `curl http://localhost:5001/api/health`
2. If on physical device, use your machine IP (see Step 2)
3. Check firewall settings allow port 5001

### Issue: App won't open after scanning QR
**Solution**:
1. Make sure Expo Go is **fully installed**
2. Restart the Expo app
3. Restart Expo server: Press `Ctrl+C` and `npm start` again
4. Try another device

### Issue: Metro bundler slow/crashes
**Solution**:
```bash
# Clear cache and restart
npm start -- --reset-cache
```

### Issue: Old version of app running
**Solution**:
1. Press `r` in Metro terminal to reload
2. Force close Expo Go and reopen
3. Delete app and rescan QR

### Issue: Changes not appearing
**Solution**:
1. Press `r` in Metro for automatic reload (if enabled)
2. Close and reopen app in Expo Go
3. Restart Metro bundler

## Step 10: Device Requirements

### Minimum iOS Version
- iOS 13.0 or later
- Check in Expo Go settings

### Minimum Android Version
- Android 5.0 or later

### Network Requirements
- Must be on **same WiFi network** as backend
- Or use same machine (localhost) for simulator

## Next Steps

After successful testing:

1. **Add Features**: Modify screens in `app/screens/`
2. **Customize Styling**: Edit StyleSheet in component files
3. **Add Navigation**: Extend `app/navigation/RootNavigator.tsx`
4. **Build for Production**: Follow building guide in README.md
5. **Deploy to App Stores**: Use Expo EAS build service

## Getting Help

### For Expo Issues
- Docs: https://docs.expo.dev
- Community: https://forums.expo.dev

### For React Native Issues
- Docs: https://reactnative.dev
- Community: https://stackoverflow.com/questions/tagged/react-native

### For Aasara Specific Issues
- Check backend logs: `npm run dev` output
- Verify backend endpoints with Postman
- Check API response format matches expectations

## Useful Links

- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Expo CLI Reference](https://docs.expo.dev/reference/expo-cli/)
- [AsyncStorage Docs](https://react-native-async-storage.github.io/async-storage/)
- [React Navigation](https://reactnavigation.org)

## Support Notes

If you have questions:
1. Check the README.md first
2. Review app/services/api.ts for backend endpoints
3. Check app/contexts/ for state management
4. Run `npm list` to verify all dependencies installed
