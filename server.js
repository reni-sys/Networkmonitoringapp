const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MQTT Configuration
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_BROKER);

// Store real-time data
const networkData = {
    computers: [
        { id: 1, name: 'Workstation-01', ip: '192.168.1.101', os: 'Windows 11', cpu: 23, ram: 50, status: 'online' },
        { id: 2, name: 'Workstation-02', ip: '192.168.1.102', os: 'Windows 10', cpu: 45, ram: 75, status: 'online' },
        { id: 3, name: 'Server-Main', ip: '192.168.1.10', os: 'Ubuntu 22.04', cpu: 89, ram: 87, status: 'warning' },
        { id: 4, name: 'Laptop-Sales', ip: '192.168.1.150', os: 'macOS Ventura', cpu: 12, ram: 75, status: 'online' },
        { id: 5, name: 'Workstation-03', ip: '192.168.1.103', os: 'Windows 11', cpu: 0, ram: 0, status: 'offline' }
    ],
    network: {
        interfaces: [
            { name: 'Ethernet 0', ip: '192.168.1.1/24', upload: 1200, download: 890 },
            { name: 'WiFi Adapter', ip: '192.168.1.2/24', upload: 450, download: 320 },
            { name: 'Ethernet 1', ip: '10.0.0.1/16', upload: 780, download: 650 }
        ],
        traffic: [],
        bandwidth: []
    },
    alerts: [],
    health: {
        score: 90,
        availability: 99.8,
        latency: 12,
        packetLoss: 0.01,
        jitter: 3
    }
};

// Initialize traffic data with historical values
for (let i = 11; i >= 0; i--) {
    const time = new Date();
    time.setMinutes(time.getMinutes() - i * 5);
    networkData.network.traffic.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        incoming: Math.floor(Math.random() * 500) + 400,
        outgoing: Math.floor(Math.random() * 400) + 300
    });
}

// MQTT Connection
mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT Broker:', MQTT_BROKER);
    
    // Subscribe to monitoring topics
    mqttClient.subscribe('lab/monitoring/#', (err) => {
        if (!err) {
            console.log('✅ Subscribed to lab/monitoring/#');
        } else {
            console.error('❌ MQTT Subscribe Error:', err);
        }
    });
    
    // Also subscribe to common network monitoring topics
    mqttClient.subscribe('network/#');
    mqttClient.subscribe('devices/#');
    mqttClient.subscribe('sensors/#');
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log(`📨 MQTT Message - Topic: ${topic}, Data:`, data);
        
        // Process different types of MQTT messages
        if (topic.includes('network')) {
            processNetworkData(data);
        } else if (topic.includes('device') || topic.includes('computer')) {
            processDeviceData(data);
        } else if (topic.includes('alert') || topic.includes('alarm')) {
            processAlertData(data);
        } else {
            // Generic data processing
            processGenericData(topic, data);
        }
        
        // Broadcast to all connected clients
        io.emit('mqtt-data', { topic, data });
        
    } catch (error) {
        console.error('❌ Error processing MQTT message:', error.message);
        // Handle non-JSON data
        processGenericData(topic, { raw: message.toString() });
    }
});

mqttClient.on('error', (error) => {
    console.error('❌ MQTT Error:', error.message);
});

mqttClient.on('offline', () => {
    console.warn('⚠️  MQTT Client is offline');
});

mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT Client reconnecting...');
});

// Process network data from MQTT
function processNetworkData(data) {
    if (data.down_mbps !== undefined || data.up_mbps !== undefined) {
        const trafficEntry = {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            incoming: data.down_mbps || 0,
            outgoing: data.up_mbps || 0
        };
        
        networkData.network.traffic.push(trafficEntry);
        if (networkData.network.traffic.length > 12) {
            networkData.network.traffic.shift();
        }
        
        // Update interface stats
        if (networkData.network.interfaces[0]) {
            networkData.network.interfaces[0].download = data.down_mbps || networkData.network.interfaces[0].download;
            networkData.network.interfaces[0].upload = data.up_mbps || networkData.network.interfaces[0].upload;
        }
    }
}

// Process device data from MQTT
function processDeviceData(data) {
    if (data.device_id || data.name) {
        const device = networkData.computers.find(c => 
            c.id === data.device_id || c.name === data.name
        );
        
        if (device) {
            if (data.cpu !== undefined) device.cpu = data.cpu;
            if (data.ram !== undefined) device.ram = data.ram;
            if (data.status) device.status = data.status;
            
            // Check for high CPU alerts
            if (data.cpu > 85) {
                generateAlert('warning', `High CPU usage on ${device.name}: ${data.cpu}%`);
            }
        }
    }
}

// Process alert data from MQTT
function processAlertData(data) {
    if (data.message || data.alert) {
        generateAlert(data.severity || 'info', data.message || data.alert);
    }
}

// Process generic data
function processGenericData(topic, data) {
    console.log(`📡 Processing generic data from ${topic}:`, data);
}

// Generate alert
function generateAlert(severity, message) {
    const alert = {
        id: Date.now(),
        severity,
        message,
        time: new Date().toISOString(),
        acknowledged: false
    };
    
    networkData.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (networkData.alerts.length > 50) {
        networkData.alerts = networkData.alerts.slice(0, 50);
    }
    
    // Broadcast alert to all clients
    io.emit('alert', alert);
}

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    // Send current state to new client
    socket.emit('initial-data', {
        computers: networkData.computers,
        network: networkData.network,
        alerts: networkData.alerts.slice(0, 10),
        health: networkData.health
    });
    
    // Handle client messages
    socket.on('acknowledge-alert', (alertId) => {
        const alert = networkData.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            io.emit('alert-updated', alert);
        }
    });
    
    socket.on('restart-device', (deviceId) => {
        const device = networkData.computers.find(c => c.id === deviceId);
        if (device) {
            generateAlert('info', `Restart command sent to ${device.name}`);
            // In real implementation, send command via MQTT
            mqttClient.publish(`devices/${deviceId}/command`, 'restart');
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// REST API Endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        computers: networkData.computers.length,
        online: networkData.computers.filter(c => c.status === 'online').length,
        alerts: networkData.alerts.filter(a => !a.acknowledged).length
    });
});

app.get('/api/computers', (req, res) => {
    res.json(networkData.computers);
});

app.get('/api/network', (req, res) => {
    res.json(networkData.network);
});

app.get('/api/alerts', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    res.json(networkData.alerts.slice(0, limit));
});

app.get('/api/health', (req, res) => {
    res.json(networkData.health);
});

app.get('/api/traffic', (req, res) => {
    res.json(networkData.network.traffic);
});

// Simulation mode (when no MQTT data is received)
let simulationInterval;
let lastMqttMessage = Date.now();

mqttClient.on('message', () => {
    lastMqttMessage = Date.now();
});

function startSimulation() {
    simulationInterval = setInterval(() => {
        // Only simulate if no MQTT messages received in last 30 seconds
        if (Date.now() - lastMqttMessage > 30000) {
            // Simulate network traffic
            const trafficEntry = {
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                incoming: Math.floor(Math.random() * 500) + 400,
                outgoing: Math.floor(Math.random() * 400) + 300
            };
            
            networkData.network.traffic.push(trafficEntry);
            if (networkData.network.traffic.length > 12) {
                networkData.network.traffic.shift();
            }
            
            // Update interface stats
            networkData.network.interfaces[0].download = trafficEntry.incoming;
            networkData.network.interfaces[0].upload = trafficEntry.outgoing;
            
            // Simulate device CPU/RAM changes
            networkData.computers.forEach(computer => {
                if (computer.status === 'online') {
                    computer.cpu = Math.max(5, Math.min(95, computer.cpu + Math.floor(Math.random() * 10) - 5));
                    computer.ram = Math.max(20, Math.min(95, computer.ram + Math.floor(Math.random() * 6) - 3));
                    
                    // Check for alerts
                    if (computer.cpu > 85 && computer.cpu - 5 <= 85) {
                        generateAlert('warning', `High CPU usage on ${computer.name}: ${computer.cpu}%`);
                    }
                }
            });
            
            // Update health score
            const avgCpu = networkData.computers
                .filter(c => c.status === 'online')
                .reduce((sum, c) => sum + c.cpu, 0) / 
                networkData.computers.filter(c => c.status === 'online').length;
            
            networkData.health.score = Math.max(50, Math.min(100, 100 - avgCpu / 5));
            networkData.health.latency = Math.max(5, Math.min(50, networkData.health.latency + Math.random() * 4 - 2));
            
            // Broadcast updates
            io.emit('data-update', {
                traffic: networkData.network.traffic,
                computers: networkData.computers,
                health: networkData.health
            });
            
            // Random alerts
            if (Math.random() > 0.9) {
                const messages = [
                    'Network latency spike detected',
                    'New device connected to network',
                    'Backup completed successfully',
                    'High memory usage detected'
                ];
                const types = ['warning', 'info', 'success', 'warning'];
                const idx = Math.floor(Math.random() * messages.length);
                generateAlert(types[idx], messages[idx]);
            }
        }
    }, 5000);
}

// Start simulation
startSimulation();

// Serve the dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 Network Monitoring Dashboard Server                  ║
║                                                           ║
║   📡 Server running on: http://localhost:${PORT}            ║
║   🔌 Socket.IO ready for real-time updates                ║
║   📊 MQTT Broker: ${MQTT_BROKER}                            ║
║                                                           ║
║   API Endpoints:                                          ║
║   • GET /api/status    - System status                    ║
║   • GET /api/computers - Computer list                    ║
║   • GET /api/network   - Network data                     ║
║   • GET /api/alerts    - Recent alerts                    ║
║   • GET /api/health    - Health score                     ║
║   • GET /api/traffic   - Traffic history                  ║
║                                                           ║
║   Press Ctrl+C to stop the server                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    mqttClient.end();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});