# Task Management Mobile App

A React Native task management application built with Expo featuring authentication, offline support, and notifications.

## Features

- JWT-based authentication
- Create, edit, and delete tasks
- Task filtering (all, upcoming, past)
- Offline support with automatic sync
- Push notifications for due tasks
- Modern UI with Material Design

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure backend (for mobile testing):**
   - Update `config/api.ts` with your backend IP address:
   ```typescript
   const DEV_MACHINE_IP = '192.168.1.28'; // Replace with your machine's IP
   ```

3. **Start the app:**
```bash
npm start
```

4. **Run on device:**
   - Scan QR code with Expo Go app
   - Or press `i` for iOS simulator, `a` for Android emulator

## Demo Login

- **Username**: admin
- **Password**: password

## Tech Stack

- React Native + Expo
- TypeScript
- AsyncStorage for local data
- Expo Notifications
- Expo Router for navigation

## API Format

**Authentication:**
```json
{
  "status_code": 200,
  "data": {"access_token": "JWT_TOKEN"}
}
```

**Tasks:**
```json
{
  "status_code": 200,
  "data": [
    {
      "id": 1,
      "title": "Task Title",
      "due_date": "2024-01-15",
      "user": {"id": 1, "username": "admin"}
    }
  ]
}
```

## Troubleshooting

**Network request failed on mobile:**
- Find your machine's IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- Update `config/api.ts` with the correct IP address

**Push notifications not working:**
- Local notifications work in Expo Go
- For remote push notifications, create a development build