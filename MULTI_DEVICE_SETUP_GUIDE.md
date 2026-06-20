# Multi-Device Monitoring Setup Guide

## Overview

The Network Monitoring Dashboard now supports **multi-device monitoring**. Multiple computers can send their monitoring data to the same dashboard simultaneously without data overlap.

## Architecture

```
┌─────────────────┐
│  Dashboard PC   │  ← Runs: node server.js
│  (Web Server)   │     MQTT Broker: Mosquitto
└────────┬────────┘
         │
         │ MQTT (lab/monitoring/#)
         │
    ┌────┴────┐
    │          │
┌───▼───┐  ┌──▼────┐  ┌────────┐
│ PC 1  │  │ PC 2  │  │ PC 3   │  ← Each runs: python agent.py
│DESKTOP│  │LAPTOP │  │SERVER  │     BROKER_URL = "DASHBOARD_IP"
└───────┘  └───────┘  └────────┘
```

## Setup Instructions

### 1. Dashboard PC (Main Server)

**Step 1:** Install MQTT Broker (Mosquitto)
```bash
# Windows: Download from https://mosquitto.org/download/
# Run installer and install as service

# Or use Docker:
docker run -d -p 1883:1883 -p 9001:9001 eclipse-mosquitto
```

**Step 2:** Configure Mosquitto (optional - for remote access)
```bash
# Edit mosquitto.conf
listener 1883
allow_anonymous true
listener 9001
protocol websockets
```

**Step 3:** Start Dashboard
```bash
npm install
node server.js
```

Open browser: `http://localhost:3000`

### 2. Client PCs (Monitored Computers)

**Step 1:** Copy `agent.py` to each computer

**Step 2:** Edit `agent.py` on each computer:
```python
# Change this line to point to dashboard PC's IP address
BROKER_URL = "192.168.1.100"  # Dashboard PC's IP
PORT = 1883
```

**Step 3:** Install dependencies:
```bash
pip install paho-mqtt psutil
```

**Step 4:** Run agent:
```bash
python agent.py
```

Expected output:
```
[*] Mencari interface aktif dengan akses internet...
    [+] Terpilih: Ethernet (192.168.1.101)
Connected to MQTT Broker
Publishing to lab/monitoring/DESKTOP-RENI
[+] Subscribed to: lab/control/DESKTOP-RENI
[14:30:00] CPU: 25% (8 Threads)
```

### 3. Verify Multi-Device Monitoring

**On Dashboard PC:**

1. Open browser to `http://localhost:3000`
2. Watch the **Recent Alerts** panel
3. When each client connects, you should see:
   ```
   New Device Connected
   DESKTOP-RENI berhasil terhubung
   ```
   ```
   New Device Connected
   LAPTOP-BUDI berhasil terhubung
   ```

4. Go to **Computer Management** page
5. All connected devices should appear in the table:
   - DESKTOP-RENI
   - LAPTOP-BUDI
   - PC-LAB-01
   - etc.

## Testing Multi-Device Features

### Test 1: Multiple Devices Appear

1. Start agent on PC1 (DESKTOP-RENI)
   - Check: Device appears in table
   - Check: Alert shows "New Device Connected"

2. Start agent on PC2 (LAPTOP-BUDI)
   - Check: Both devices appear in table
   - Check: New alert for LAPTOP-BUDI

3. Start agent on PC3 (PC-LAB-01)
   - Check: All three devices appear
   - Check: Data doesn't overlap

### Test 2: Dashboard Cards Update

- **Total Computers:** Should show 3
- **Active Networks:** Should show number of online devices
- **Alerts:** Should show number of offline devices

### Test 3: Online/Offline Detection

1. Stop agent on PC2 (Ctrl+C)
2. Wait 10 seconds
3. Check: PC2 marked as "Offline" in table
4. Check: Alert shows "Device Offline"
5. Restart agent on PC2
6. Check: PC2 marked as "Online" again
7. Check: Alert shows "Device Online"

### Test 4: Remote Control

1. In Computer Management table, find a device
2. Click action buttons:
   - 💬 **Message**: Send popup message
   - 🔒 **Lock**: Lock screen
   - 🔄 **Restart**: Restart computer
   - ⏻ **Shutdown**: Shutdown computer
3. Verify command executes on target PC

### Test 5: Device Metrics

Each device shows:
- **Hostname** (from `data.id`)
- **IP Address** (from `data.network.ip`)
- **Operating System** (from `data.info.os`)
- **CPU Usage** (from `data.metrics.cpu.percent`)
- **RAM Usage** (from `data.metrics.ram`)
- **Status** (Online/Offline)

## Troubleshooting

### Devices Not Appearing

**Check MQTT Broker:**
```bash
# On dashboard PC
netstat -an | grep 1883
# Should show LISTENING on port 1883
```

**Check Client Connection:**
```bash
# On client PC, test connection
telnet 192.168.1.100 1883
# Should connect successfully
```

**Check MQTT Publish:**
```bash
# On dashboard PC, subscribe to see messages
mosquitto_sub -t "lab/monitoring/#" -v

# On client PC, publish test message
mosquitto_pub -t "lab/monitoring/TEST-PC" -m '{"id":"TEST-PC","status":"online"}'
```

### Devices Overwriting Each Other

**Problem:** Only one device shows at a time

**Solution:** Ensure each agent has unique hostname:
```python
# agent.py automatically uses:
HOSTNAME = socket.gethostname()
# This should be different on each PC
```

If hostnames are same, manually set:
```python
HOSTNAME = "DESKTOP-RENI"  # Unique name
```

### Connection Refused

**Problem:** Client can't connect to broker

**Solution:**
1. Check firewall on dashboard PC allows port 1883
2. Check Mosquitto is running:
   ```bash
   # Windows
   net start mosquitto
   
   # Linux
   systemctl status mosquitto
   ```
3. Verify `BROKER_URL` in agent.py points to correct IP

### Dashboard Shows No Data

**Check Browser Console:**
- Press F12 → Console
- Look for `[MQTT] Device Connected` logs
- Look for any errors

**Check MQTT Subscription:**
```javascript
// In app.js, verify subscription:
mqttClient.subscribe('lab/monitoring/#', (err) => {
    if (!err) {
        console.log('SUBSCRIBE BERHASIL');
    }
});
```

## Network Configuration

### Same Network (Recommended)
All PCs on same local network (192.168.x.x):
```python
# agent.py
BROKER_URL = "192.168.1.100"  # Dashboard PC local IP
```

### Different Networks (Advanced)
If PCs are on different networks:
1. Configure port forwarding on dashboard router (1883 → dashboard PC)
2. Use public IP or DDNS:
```python
BROKER_URL = "your-domain.com"  # or public IP
```

## Security Considerations

### For Production Use

1. **Enable MQTT Authentication:**
```bash
# mosquitto.conf
allow_anonymous false
password_file /etc/mosquitto/passwd
```

2. **Use TLS/SSL:**
```bash
# mosquitto.conf
listener 8883
certfile /path/to/cert.pem
keyfile /path/to/key.pem
```

3. **Update agent.py:**
```python
client.username_pw_set("username", "password")
client.tls_set("/path/to/ca.crt")
```

4. **Firewall Rules:**
```bash
# Only allow specific IPs
iptables -A INPUT -p tcp --dport 1883 -s 192.168.1.0/24 -j ACCEPT
```

## Logging

### Dashboard Logs (Browser Console)
```
[MQTT] Device Connected: DESKTOP-RENI
[MQTT] Device Updated: DESKTOP-RENI
[MQTT] Device Connected: LAPTOP-BUDI
[DASHBOARD] Total: 2, Online: 2, Offline: 0
```

### Agent Logs (Terminal)
```
Connected to MQTT Broker
Publishing to lab/monitoring/DESKTOP-RENI
[+] Subscribed to: lab/control/DESKTOP-RENI
[14:30:00] CPU: 25% (8 Threads)
[CONTROL] Received command: message
[CONTROL] Showing message: Hello from Dashboard
```

## Verification Checklist

- [ ] MQTT Broker running on dashboard PC
- [ ] Dashboard accessible at `http://localhost:3000`
- [ ] Client PC1 agent running and connected
- [ ] Client PC2 agent running and connected
- [ ] Client PC3 agent running and connected
- [ ] All devices appear in Computer Management table
- [ ] Dashboard cards show correct counts
- [ ] Online/offline detection working
- [ ] Remote control commands working
- [ ] No data overlap between devices
- [ ] Alerts showing device connect/disconnect

## Example Multi-Device Scenario

**Setup:**
- Dashboard PC: 192.168.1.100
- PC1 (DESKTOP-RENI): 192.168.1.101
- PC2 (LAPTOP-BUDI): 192.168.1.102
- PC3 (SERVER-LAB): 192.168.1.103

**Steps:**
1. Start Mosquitto on 192.168.1.100
2. Start dashboard: `node server.js`
3. On PC1: `python agent.py` (BROKER_URL = "192.168.1.100")
4. On PC2: `python agent.py` (BROKER_URL = "192.168.1.100")
5. On PC3: `python agent.py` (BROKER_URL = "192.168.1.100")

**Expected Result:**
- Dashboard shows 3 devices in table
- Total Computers: 3
- Online: 3
- Each device shows its own metrics
- Can control each device independently

## Support

If you encounter issues:

1. Check all logs (browser console + agent terminal)
2. Verify network connectivity between PCs
3. Test MQTT with command-line tools
4. Review `TWO_WAY_COMMUNICATION_GUIDE.md`
5. Review `IMPLEMENTATION_COMPLETE.md`

---

**Status:** ✅ Multi-Device Monitoring Ready
**Last Updated:** 2026-06-16