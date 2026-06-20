# Network Monitoring Dashboard

A real-time network monitoring dashboard built with Node.js, Socket.IO, and MQTT integration.

## Features

- **Real-time Monitoring**: Live updates of network traffic, device status, and performance metrics
- **Dashboard**: Overview of key metrics including total computers, active networks, alerts, and uptime
- **Computer Management**: View and manage all computers on the network with CPU/RAM monitoring
- **Network Overview**: Network topology visualization, interface statistics, and VLAN configuration
- **Analytics**: Bandwidth usage charts, traffic distribution, device performance, and health scores
- **Settings**: Configurable notifications, monitoring intervals, security settings, and appearance
- **MQTT Integration**: Supports MQTT brokers for IoT device data ingestion
- **Simulation Mode**: Automatic data simulation when MQTT is not available

## Architecture

```
┌─────────────┐    WebSocket     ┌─────────────┐
│   Browser   │◄────────────────►│  Node.js    │
│  (Frontend) │                  │   Server    │
└─────────────┘                  └──────┬──────┘
                                        │
                                        │ MQTT
                                        ▼
                                ┌─────────────┐
                                │ MQTT Broker │
                                │  (Optional) │
                                └─────────────┘
```

## Installation

1. **Install Node.js** (v14 or higher)
   - Download from [nodejs.org](https://nodejs.org)

2. **Clone or download this project**

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the server**:
   ```bash
   npm start
   ```
   Or directly:
   ```bash
   node server.js
   ```

5. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## MQTT Configuration

The dashboard automatically connects to an MQTT broker at `mqtt://localhost:1883` by default.

### Configure MQTT Broker

Set the `MQTT_BROKER` environment variable:

```bash
# Windows (Command Prompt)
set MQTT_BROKER=mqtt://your-broker-host:1883

# Windows (PowerShell)
$env:MQTT_BROKER="mqtt://your-broker-host:1883"

# Linux/Mac
export MQTT_BROKER="mqtt://your-broker-host:1883"
```

### Expected MQTT Topics

The dashboard subscribes to these topics:
- `lab/monitoring/#` - Main monitoring data
- `network/#` - Network-specific data
- `devices/#` - Device status updates
- `sensors/#` - Sensor readings

### MQTT Message Format

**Network Traffic:**
```json
{
  "down_mbps": 850,
  "up_mbps": 620
}
```

**Device Status:**
```json
{
  "device_id": 1,
  "name": "Workstation-01",
  "cpu": 45,
  "ram": 67,
  "status": "online"
}
```

**Alerts:**
```json
{
  "severity": "warning",
  "message": "High CPU usage detected"
}
```

## API Endpoints

The server provides REST API endpoints:

- `GET /api/status` - System status overview
- `GET /api/computers` - List of all computers
- `GET /api/network` - Network data and interfaces
- `GET /api/alerts` - Recent alerts (limit with `?limit=10`)
- `GET /api/health` - Network health score
- `GET /api/traffic` - Traffic history

## Socket.IO Events

### Client → Server
- `acknowledge-alert` - Mark alert as acknowledged
- `restart-device` - Send restart command to device

### Server → Client
- `initial-data` - Initial dashboard data on connection
- `data-update` - Real-time data updates
- `mqtt-data` - Raw MQTT data received
- `alert` - New alert notification
- `alert-updated` - Alert status updated

## Simulation Mode

If no MQTT messages are received for 30 seconds, the server automatically switches to simulation mode and generates realistic fake data for demonstration purposes.

## Project Structure

```
JARINGANKOMPUTER/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styles
├── js/
│   └── app.js          # Frontend JavaScript
├── server.js           # Node.js backend server
├── package.json        # Dependencies configuration
└── README.md           # This file
```

## Technologies Used

- **Backend**: Node.js, Express, Socket.IO, MQTT.js
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js
- **Icons**: Font Awesome
- **Real-time**: Socket.IO for WebSocket communication

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Development

For development with auto-reload:

```bash
npm install -g nodemon
npm run dev
```

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Ensure Node.js is properly installed
- Check console for error messages

### No real-time updates
- Check if Socket.IO client is loading (check browser console)
- Verify WebSocket connection in browser dev tools
- Ensure server is running on correct port

### MQTT not connecting
- Verify MQTT broker is running
- Check broker address and port
- Review server console for MQTT connection status

## License

MIT License - Feel free to use and modify for your projects.

## Support

For issues or questions, please check the console logs in both browser and server for error messages.