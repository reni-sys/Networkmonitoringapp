// Network Monitoring Dashboard - JavaScript Application


// Socket.IO connection
let deviceData = {};
let computers = {};
let lastSeen = {};
let alerts = [];
let socket = null;
let realTimeData = {
    computers: [],
    network: { traffic: [], interfaces: [] },
    health: { score: 90 }
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initMobileMenu();
    initCharts();
    initSettings();
    initToastNotifications();
    initTableActions();
    initSocketIO(); // Initialize Socket.IO connection
    initDataSimulation();
});

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetPage = this.dataset.page;

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Show target page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === targetPage) {
                    page.classList.add('active');
                }
            });

            // Update page title
            pageTitle.textContent = this.querySelector('span').textContent;

            // Redraw charts when switching to analytic page
            if (targetPage === 'analytic') {
                setTimeout(() => {
                    if (bandwidthChart) bandwidthChart.resize();
                    if (trafficDistChart) trafficDistChart.resize();
                }, 100);
            }

            // Redraw topology when switching to network page
            if (targetPage === 'network') {
                setTimeout(() => {
                    drawNetworkTopology();
                }, 100);
            }
        });
    });
}

//Fungsi Add Alert
function addAlert(title, message, type) {

    const alertsList = document.getElementById("alertsList");

    if (!alertsList) return;

    // hapus tulisan No alerts
    if (alertsList.innerHTML.includes("No alerts")) {
        alertsList.innerHTML = "";
    }

    const alertItem = document.createElement("div");

    alertItem.className = "alert-item";

    alertItem.innerHTML = `
        <div>
            <strong>${title}</strong>
            <p>${message}</p>
            <small>${new Date().toLocaleTimeString()}</small>
        </div>
    `;

    alertsList.prepend(alertItem);

    // maksimal 10 alert
    while (alertsList.children.length > 10) {
        alertsList.removeChild(alertsList.lastChild);
    }
}

//FUNGSI table otomatis di computer management
function renderComputerTable(filter = "all") {

    const tbody = document.getElementById('computerTableBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    Object.values(computers).forEach(pc => {

        const cpu = pc.metrics?.cpu?.percent || 0;

        const ramUsed = pc.metrics?.ram?.used_gb || 0;
        const ramTotal = pc.metrics?.ram?.total_gb || 0;
        const ramPercent = pc.metrics?.ram?.percent || 0;

        let statusClass = pc.status === 'offline' ? 'offline' : 'online';
        let statusText = pc.status === 'offline' ? 'Offline' : 'Online';

        if (cpu > 85 || ramPercent > 85) {
            statusClass = 'warning';
            statusText = 'Warning';
        }

        // FILTER STATUS
        if (filter !== 'all' && statusClass !== filter) {
            return;
        }

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <i class="fas fa-desktop"></i>
                ${pc.id}
            </td>

            <td>${pc.network?.ip || '-'}</td>

            <td>${pc.info?.os || '-'}</td>

            <td>${cpu}%</td>

            <td>${ramUsed}GB / ${ramTotal}GB</td>

            <td>
                <span class="status ${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td class="actions">
                <button class="btn-icon action-btn" title="Message" data-action="message" data-hostname="${pc.id}">
                    <i class="fas fa-comment-dots"></i>
                </button>
                <button class="btn-icon action-btn" title="Lock" data-action="lock" data-hostname="${pc.id}">
                    <i class="fas fa-lock"></i>
                </button>
                <button class="btn-icon action-btn" title="Restart" data-action="restart" data-hostname="${pc.id}">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="btn-icon action-btn" title="Shutdown" data-action="shutdown" data-hostname="${pc.id}">
                    <i class="fas fa-power-off"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}
//Fungsi Shutdown PC
function shutdownPC(hostname) {

    console.log("Kirim shutdown ke:", hostname);

    mqttClient.publish(
        `lab/control/${hostname}`,
        JSON.stringify({
            command: "shutdown"
        })
    );
}
//FUNGSI WAKTU AKTIF/UPTIME
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
}
// ============================================
// MOBILE MENU
// ============================================
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('expanded');
        }
    });
}

// ============================================
// CHARTS
// ============================================
let trafficChart = null;
let bandwidthChart = null;
let trafficDistChart = null;

function initCharts() {
    initTrafficChart();
    initBandwidthChart();
    //initTrafficDistChart();
}

function initTrafficChart() {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(13, 138, 188, 0.3)');
    gradient.addColorStop(1, 'rgba(13, 138, 188, 0.0)');

    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45', '10:50', '10:55'],
            datasets: [{
                label: 'Incoming Traffic (Mbps)',
                data: [450, 520, 480, 610, 580, 720, 680, 750, 820, 780, 850, 920],
                borderColor: '#0D8ABC',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6
            }, {
                label: 'Outgoing Traffic (Mbps)',
                data: [320, 380, 350, 420, 400, 480, 450, 520, 580, 540, 600, 650],
                borderColor: '#2ecc71',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#a0a0a0',
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(45, 58, 92, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0a0'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(45, 58, 92, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0a0',
                        callback: function(value) {
                            return value + ' Mbps';
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function initBandwidthChart() {
    const ctx = document.getElementById('bandwidthChart').getContext('2d');

    bandwidthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Upload (GB)',
                data: [45, 52, 38, 61, 55, 28, 35],
                backgroundColor: '#0D8ABC',
                borderRadius: 4
            }, {
                label: 'Download (GB)',
                data: [120, 145, 110, 165, 150, 85, 95],
                backgroundColor: '#9b59b6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#a0a0a0',
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#a0a0a0'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(45, 58, 92, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#a0a0a0',
                        callback: function(value) {
                            return value + ' GB';
                        }
                    }
                }
            }
        }
    });
}

function initTrafficChart() {
    
    const ctx = document.getElementById('trafficChart').getContext('2d');

    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Traffic Download (Mbps)',
                data: [],
                borderColor: '#0D8ABC',
                backgroundColor: 'rgba(13,138,188,0.2)',
                fill: true,
                tension: 0.4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,

            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        color: '#ffffff'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return value + ' Mbps';
                        }
                    }
                }
            }
        }

    });

}

// ============================================
// NETWORK TOPOLOGY CANVAS
// ============================================
function drawNetworkTopology() {
    const canvas = document.getElementById('topologyCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Network nodes data
    const nodes = [
        { x: width / 2, y: height / 2, label: 'Core Router', type: 'core', connections: [1, 2, 3, 4] },
        { x: width * 0.25, y: height * 0.3, label: 'Switch A', type: 'switch', connections: [5, 6] },
        { x: width * 0.75, y: height * 0.3, label: 'Switch B', type: 'switch', connections: [7, 8] },
        { x: width * 0.5, y: height * 0.7, label: 'Firewall', type: 'firewall', connections: [] },
        { x: width * 0.5, y: height * 0.15, label: 'Internet', type: 'cloud', connections: [] },
        { x: width * 0.1, y: height * 0.5, label: 'Server 1', type: 'server', connections: [] },
        { x: width * 0.15, y: height * 0.65, label: 'Server 2', type: 'server', connections: [] },
        { x: width * 0.85, y: height * 0.5, label: 'Workstations', type: 'devices', connections: [] },
        { x: width * 0.9, y: height * 0.65, label: 'WiFi AP', type: 'ap', connections: [] }
    ];

    // Draw connections
    ctx.strokeStyle = 'rgba(13, 138, 188, 0.4)';
    ctx.lineWidth = 2;

    const connections = [
        [0, 4], [0, 1], [0, 2], [0, 3],
        [1, 5], [1, 6], [2, 7], [2, 8]
    ];

    connections.forEach(([from, to]) => {
        ctx.beginPath();
        ctx.moveTo(nodes[from].x, nodes[from].y);
        ctx.lineTo(nodes[to].x, nodes[to].y);
        ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node, index) => {
        let color, icon, radius;

        switch(node.type) {
            case 'core':
                color = '#0D8ABC';
                icon = '🌐';
                radius = 30;
                break;
            case 'switch':
                color = '#2ecc71';
                icon = '🔀';
                radius = 25;
                break;
            case 'firewall':
                color = '#e74c3c';
                icon = '🛡️';
                radius = 25;
                break;
            case 'cloud':
                color = '#9b59b6';
                icon = '☁️';
                radius = 25;
                break;
            case 'server':
                color = '#f39c12';
                icon = '🖥️';
                radius = 20;
                break;
            case 'devices':
                color = '#3498db';
                icon = '💻';
                radius = 20;
                break;
            case 'ap':
                color = '#1abc9c';
                icon = '📡';
                radius = 20;
                break;
        }

        // Draw circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw icon
        ctx.font = `${radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, node.x, node.y);

        // Draw label
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.fillStyle = '#a0a0a0';
        ctx.fillText(node.label, node.x, node.y + radius + 15);
    });
}

// ============================================
// SETTINGS
// ============================================
function initSettings() {
    const themeSelect = document.getElementById('themeSelect');
    
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            const theme = this.value;
            if (theme === 'auto') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            showToast('Theme changed to ' + theme, 'success');
        });
    }

    // Save settings button
    const saveBtn = document.querySelector('.settings-actions .btn-primary');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            showToast('Settings saved successfully!', 'success');
        });
    }

    // Reset settings button
    const resetBtn = document.querySelector('.settings-actions .btn-secondary');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            showToast('Settings reset to defaults', 'info');
        });
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function initToastNotifications() {
    // Notification bell click
    const notificationBell = document.querySelector('.notifications');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            showToast('You have 3 unread notifications', 'info');
        });
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon;
    switch(type) {
        case 'success': icon = 'fa-check-circle'; break;
        case 'warning': icon = 'fa-exclamation-circle'; break;
        case 'error': icon = 'fa-times-circle'; break;
        default: icon = 'fa-info-circle';
    }

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// TABLE ACTIONS
// ============================================
function initTableActions() {
    // Search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('.data-table tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Filter functionality
    const filterSelect = document.querySelector('.filter-select');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            const filterValue = this.value;
            renderComputerTable(filterValue);
        });
    }

    // Event delegation for action buttons (handles dynamically created buttons)
    const tbody = document.getElementById('computerTableBody');
    if (tbody) {
        tbody.addEventListener('click', function(e) {
            const actionBtn = e.target.closest('.action-btn');
            if (!actionBtn) return;
            
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            const hostname = actionBtn.dataset.hostname;
            
            switch(action) {
                case 'message':
                    showMessageDialog(hostname);
                    break;
                case 'lock':
                    if (confirmAction('lock', hostname)) {
                        sendCommand(hostname, 'lock');
                    }
                    break;
                case 'restart':
                    if (confirmAction('restart', hostname)) {
                        sendCommand(hostname, 'restart');
                    }
                    break;
                case 'shutdown':
                    if (confirmAction('shutdown', hostname)) {
                        sendCommand(hostname, 'shutdown');
                    }
                    break;
            }
        });
    }

    // Pagination
    document.querySelectorAll('.btn-page').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.btn-page').forEach(b => b.classList.remove('active'));
            if (!this.querySelector('i')) {
                this.classList.add('active');
            }
        });
    });
}

// ============================================
// DATA SIMULATION
// ============================================
function initDataSimulation() {
    // Simulate real-time data updates
    setInterval(() => {
        // Update random CPU/RAM values in table
        const cpuCells = document.querySelectorAll('.data-table tbody tr');
        cpuCells.forEach((row, index) => {
            const status = row.querySelector('.status');
            if (status && status.classList.contains('online')) {
                const cpuCell = row.querySelectorAll('td')[3];
                if (cpuCell && cpuCell.textContent !== '-') {
                    const currentCpu = parseInt(cpuCell.textContent);
                    const change = Math.floor(Math.random() * 10) - 5;
                    const newCpu = Math.max(5, Math.min(95, currentCpu + change));
                    cpuCell.textContent = newCpu + '%';
                    
                    // Update performance chart if on analytic page
                    updatePerformanceBar(index, newCpu);
                }
            }
        });

        // Randomly update health score
        const scoreCircle = document.querySelector('.score-fill');
        if (scoreCircle) {
            const currentOffset = parseInt(scoreCircle.style.strokeDashoffset) || 28;
            const change = Math.floor(Math.random() * 6) - 3;
            const newOffset = Math.max(0, Math.min(56, currentOffset + change));
            scoreCircle.style.strokeDashoffset = newOffset;
            
            const scoreValue = document.querySelector('.score-value span');
            if (scoreValue) {
                scoreValue.textContent = Math.round(100 - (newOffset / 283) * 100);
            }
        }
    }, 5000);

    // Simulate occasional alerts
    setInterval(() => {
        if (Math.random() > 0.7) {
            const alerts = [
                { message: 'Network latency spike detected', type: 'warning' },
                { message: 'New device connected to network', type: 'info' },
                { message: 'Backup completed successfully', type: 'success' },
                { message: 'High memory usage on Workstation-02', type: 'warning' }
            ];
            const alert = alerts[Math.floor(Math.random() * alerts.length)];
            showToast(alert.message, alert.type);
        }
    }, 15000);

    // Update traffic chart with new data
    setInterval(() => {
        if (trafficChart) {
            const data = trafficChart.data;
            data.labels.shift();
            data.labels.push(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            
            data.datasets.forEach(dataset => {
                const lastValue = dataset.data[dataset.data.length - 1];
                const change = Math.floor(Math.random() * 100) - 50;
                dataset.data.shift();
                dataset.data.push(Math.max(100, Math.min(1000, lastValue + change)));
            });
            
            trafficChart.update('none');
        }
    }, 3000);
}

function updatePerformanceBar(index, value) {
    const bars = document.querySelectorAll('.performance-item .progress');
    if (bars[index]) {
        bars[index].style.width = value + '%';
        
        // Update color based on value
        let color;
        if (value > 80) color = '#e74c3c';
        else if (value > 50) color = '#f39c12';
        else color = '#2ecc71';
        
        bars[index].style.background = color;
        
        // Update percentage text
        const header = bars[index].closest('.performance-item').querySelector('.perf-header span:last-child');
        if (header) {
            header.textContent = value + '%';
        }
    }
}

// ============================================
// RESPONSIVE ADJUSTMENTS
// ============================================
window.addEventListener('resize', function() {
    // Redraw charts on resize
    if (trafficChart) trafficChart.resize();
    if (bandwidthChart) bandwidthChart.resize();
    if (trafficDistChart) trafficDistChart.resize();
    
    // Redraw network topology
    drawNetworkTopology();
});

// Handle page visibility change
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Redraw charts when page becomes visible again
        setTimeout(() => {
            if (trafficChart) trafficChart.resize();
            if (bandwidthChart) bandwidthChart.resize();
            if (trafficDistChart) trafficDistChart.resize();
            drawNetworkTopology();
        }, 100);
    }
});

// ============================================
// SOCKET.IO REAL-TIME CONNECTION
// ============================================
function initSocketIO() {
    // Detect if we're running with the Node.js server
    const serverUrl = window.location.origin;
    
    // Load Socket.IO client dynamically if not already loaded
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => connectSocket(serverUrl);
        document.head.appendChild(script);
    } else {
        connectSocket(serverUrl);
    }
}

function connectSocket(serverUrl) {
    try {
        socket = io(serverUrl);
        
        socket.on('connect', () => {
            console.log('✅ Connected to server:', serverUrl);
            showToast('Connected to real-time server', 'success');
        });
        
        // Handle initial data
        socket.on('initial-data', (data) => {
            console.log('📥 Received initial data:', data);
            realTimeData = data;
            updateDashboardFromServer(data);
        });
        
        // Handle real-time data updates
        socket.on('data-update', (data) => {
            console.log('📊 Received data update:', data);
            if (data.traffic) updateTrafficChart(data.traffic);
            if (data.computers) updateComputersTable(data.computers);
            if (data.health) updateHealthScore(data.health);
        });
        
        // Handle MQTT data
        socket.on('mqtt-data', (data) => {
            console.log('📨 MQTT data received:', data);
            // Process MQTT-specific data if needed
        });
        
        // Handle alerts
        socket.on('alert', (alert) => {
            console.log('🚨 Alert received:', alert);
            showToast(alert.message, alert.severity);
            updateAlertsList(alert);
        });
        
        // Handle alert updates
        socket.on('alert-updated', (alert) => {
            console.log('Alert updated:', alert);
        });
        
        socket.on('disconnect', () => {
            console.warn('⚠️ Disconnected from server');
            showToast('Disconnected from server - running in simulation mode', 'warning');
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
            showToast('Cannot connect to server - running in simulation mode', 'error');
        });
        
    } catch (error) {
        console.error('❌ Socket.IO connection error:', error);
        showToast('Real-time connection failed - using simulation mode', 'warning');
    }
}

// Update dashboard with server data
function updateDashboardFromServer(data) {
    // Update computers data
    if (data.computers) {
        realTimeData.computers = data.computers;
        updateComputersTable(data.computers);
    }
    
    // Update network traffic
    if (data.network && data.network.traffic) {
        updateTrafficChart(data.network.traffic);
    }
    
    // Update health score
    if (data.health) {
        updateHealthScore(data.health);
    }
    
    // Update network interfaces
    if (data.network && data.network.interfaces) {
        updateNetworkInterfaces(data.network.interfaces);
    }
}

// Update traffic chart with real-time data
function updateTrafficChart(trafficData) {
    if (!trafficChart) return;
    
    const labels = trafficData.map(d => d.time);
    const incoming = trafficData.map(d => d.incoming);
    const outgoing = trafficData.map(d => d.outgoing);
    
    trafficChart.data.labels = labels;
    trafficChart.data.datasets[0].data = incoming;
    trafficChart.data.datasets[1].data = outgoing;
    trafficChart.update('none');
}

// Update computers table with real-time data
function updateComputersTable(computers) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    
    computers.forEach((computer, index) => {
        const row = tbody.querySelector(`tr:nth-child(${index + 1})`);
        if (row) {
            // Update CPU
            const cpuCell = row.querySelectorAll('td')[3];
            if (cpuCell && computer.cpu !== undefined) {
                cpuCell.textContent = computer.cpu + '%';
            }
            
            // Update RAM
            const ramCell = row.querySelectorAll('td')[4];
            if (ramCell && computer.ram !== undefined) {
                const totalRam = computer.ram > 50 ? '32GB' : '16GB';
                ramCell.textContent = `${Math.round(computer.ram / 100 * parseInt(totalRam))}GB / ${totalRam}`;
            }
            
            // Update status
            const statusCell = row.querySelectorAll('td')[5];
            if (statusCell) {
                const statusSpan = statusCell.querySelector('.status');
                if (statusSpan && computer.status) {
                    statusSpan.textContent = computer.status.charAt(0).toUpperCase() + computer.status.slice(1);
                    statusSpan.className = `status ${computer.status}`;
                }
            }
        }
    });
    
    // Update device list on dashboard
    updateDeviceList(computers);
}

// Update device list on dashboard
function updateDeviceList(computers) {
    const deviceList = document.querySelector('.device-list');
    if (!deviceList) return;
    
    const devices = deviceList.querySelectorAll('.device-item');
    computers.slice(0, 4).forEach((computer, index) => {
        if (devices[index]) {
            const nameEl = devices[index].querySelector('.device-name');
            const ipEl = devices[index].querySelector('.device-ip');
            const statusEl = devices[index].querySelector('.status');
            const iconEl = devices[index].querySelector('i');
            
            if (nameEl) nameEl.textContent = computer.name;
            if (ipEl) ipEl.textContent = computer.ip;
            if (statusEl) {
                statusEl.textContent = computer.status.charAt(0).toUpperCase() + computer.status.slice(1);
                statusEl.className = `status ${computer.status}`;
            }
            if (iconEl) {
                iconEl.className = `fas ${computer.status === 'online' ? 'fa-desktop online' : computer.status === 'warning' ? 'fa-server warning' : 'fa-print offline'}`;
            }
        }
    });
}

// Update health score
function updateHealthScore(health) {
    const scoreCircle = document.querySelector('.score-fill');
    const scoreValue = document.querySelector('.score-value span');
    
    if (scoreCircle && health.score !== undefined) {
        const offset = 283 - (health.score / 100) * 283;
        scoreCircle.style.strokeDashoffset = offset;
        
        if (scoreValue) {
            scoreValue.textContent = Math.round(health.score);
        }
    }
    
    // Update health details
    const scoreItems = document.querySelectorAll('.score-item');
    if (scoreItems.length >= 4) {
        if (health.availability !== undefined) {
            scoreItems[0].querySelector('.value').textContent = health.availability + '%';
        }
        if (health.latency !== undefined) {
            scoreItems[1].querySelector('.value').textContent = Math.round(health.latency) + 'ms';
        }
        if (health.packetLoss !== undefined) {
            scoreItems[2].querySelector('.value').textContent = health.packetLoss + '%';
        }
        if (health.jitter !== undefined) {
            scoreItems[3].querySelector('.value').textContent = Math.round(health.jitter) + 'ms';
        }
    }
}

// Update network interfaces
function updateNetworkInterfaces(interfaces) {
    const interfaceItems = document.querySelectorAll('.interface-item');
    interfaces.slice(0, interfaceItems.length).forEach((iface, index) => {
        if (interfaceItems[index]) {
            const uploadSpan = interfaceItems[index].querySelector('.fa-arrow-up');
            const downloadSpan = interfaceItems[index].querySelector('.fa-arrow-down');
            
            if (uploadSpan) {
                uploadSpan.parentNode.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.round(iface.upload)} Mbps`;
            }
            if (downloadSpan) {
                downloadSpan.parentNode.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.round(iface.download)} Mbps`;
            }
        }
    });
}

// Update alerts list
function updateAlertsList(alert) {
    const alertsList = document.querySelector('.alerts-list');
    if (!alertsList) return;
    
    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${alert.severity}`;
    
    let icon;
    switch(alert.severity) {
        case 'critical': icon = 'fa-times-circle'; break;
        case 'warning': icon = 'fa-exclamation-circle'; break;
        case 'success': icon = 'fa-check-circle'; break;
        default: icon = 'fa-info-circle';
    }
    
    const timeAgo = getTimeAgo(new Date(alert.time));
    
    alertItem.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="alert-content">
            <p>${alert.message}</p>
            <span>${timeAgo}</span>
        </div>
    `;
    
    alertsList.insertBefore(alertItem, alertsList.firstChild);
    
    // Keep only last 10 alerts
    if (alertsList.children.length > 10) {
        alertsList.removeChild(alertsList.lastChild);
    }
}

// Helper function to get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
}

// ============================================
// MQTT CONTROL FUNCTIONS
// ============================================

/**
 * Send command to a specific computer via MQTT
 * @param {string} hostname - Target computer hostname
 * @param {string} command - Command type: 'message', 'lock', 'restart', 'shutdown'
 * @param {string} text - Optional text for message command
 */
function sendCommand(hostname, command, text = null) {
    const controlTopic = `lab/control/${hostname}`;
    const payload = { command: command };
    
    if (text !== null) {
        payload.text = text;
    }
    
    console.log(`[SEND COMMAND] To: ${controlTopic}, Payload:`, payload);
    
    // Log command to alerts
    const commandNames = {
        'message': 'Send Message',
        'lock': 'Lock Screen',
        'restart': 'Restart Computer',
        'shutdown': 'Shutdown Computer'
    };
    
    addAlert(
        'Command Sent',
        `${commandNames[command]} to ${hostname}${text ? ': ' + text : ''}`,
        'info'
    );
    
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(controlTopic, JSON.stringify(payload), { qos: 1 });
        showToast(`Command sent to ${hostname}: ${command}`, 'success');
    } else {
        // Fallback: try to send via Socket.IO if MQTT not available
        if (socket && socket.connected) {
            socket.emit('send-control', { hostname, command, text });
            showToast(`Command queued for ${hostname}: ${command}`, 'info');
        } else {
            showToast(`Cannot connect to send command to ${hostname}`, 'error');
        }
    }
}

// Show message popup dialog
function showMessageDialog(hostname) {
    const message = prompt("Enter message to send to " + hostname + ":", "Hello from Dashboard!");
    if (message) {
        sendCommand(hostname, 'message', message);
    }
}

// Confirm dangerous actions
function confirmAction(action, hostname) {
    const actionNames = {
        'lock': 'lock the screen',
        'restart': 'restart the computer',
        'shutdown': 'shutdown the computer'
    };
    
    return confirm(`Are you sure you want to ${actionNames[action]} (${hostname})?`);
}

// ============================================
// ONLINE/OFFLINE DETECTION
// ============================================
const OFFLINE_TIMEOUT = 10000; // 10 seconds
const lastSeenTimestamps = {};

function updateLastSeen(hostname) {
    lastSeenTimestamps[hostname] = Date.now();
}

function checkOnlineStatus() {
    const now = Date.now();
    
    Object.keys(computers).forEach(hostname => {
        const lastSeen = lastSeenTimestamps[hostname] || 0;
        const timeSinceLastSeen = now - lastSeen;
        
        const wasOnline = computers[hostname].status === 'online';
        const isNowOffline = timeSinceLastSeen > OFFLINE_TIMEOUT;
        
        if (wasOnline && isNowOffline) {
            computers[hostname].status = 'offline';
            addAlert(
                'Device Offline',
                `${hostname} has been marked as offline (no data for ${Math.round(timeSinceLastSeen / 1000)}s)`,
                'warning'
            );
            renderComputerTable();
        } else if (!wasOnline && !isNowOffline && timeSinceLastSeen < OFFLINE_TIMEOUT) {
            computers[hostname].status = 'online';
            addAlert(
                'Device Online',
                `${hostname} is back online`,
                'success'
            );
            renderComputerTable();
        }
    });
}

// Check online status every 2 seconds
setInterval(checkOnlineStatus, 2000);

// ============================================
// DASHBOARD CARDS UPDATE (Multi-Device)
// ============================================
function updateDashboardCards() {
    const deviceCount = Object.keys(computers).length;
    const onlineCount = Object.values(computers).filter(c => c.status === 'online').length;
    const offlineCount = Object.values(computers).filter(c => c.status === 'offline').length;
    
    // Update Total Computers card
    const totalComputersEl = document.querySelector('.overview-card:first-child .count');
    if (totalComputersEl) {
        totalComputersEl.textContent = deviceCount;
    }
    
    // Update Online Devices count
    const onlineTrend = document.querySelector('.overview-card:first-child .trend');
    if (onlineTrend) {
        onlineTrend.innerHTML = `<i class="fas fa-arrow-up"></i> ${onlineCount} online`;
    }
    
    // Update Active Networks card (show online count)
    const activeNetworksEl = document.querySelectorAll('.overview-card')[1]?.querySelector('.count');
    if (activeNetworksEl) {
        activeNetworksEl.textContent = onlineCount;
    }
    
    // Update Alerts card (show offline count)
    const alertsCountEl = document.querySelectorAll('.overview-card')[2]?.querySelector('.count');
    if (alertsCountEl) {
        alertsCountEl.textContent = offlineCount;
    }
    
    // Update pagination info
    const paginationInfo = document.querySelector('.table-pagination span');
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${deviceCount} devices`;
    }
    
    console.log(`[DASHBOARD] Total: ${deviceCount}, Online: ${onlineCount}, Offline: ${offlineCount}`);
}

// ============================================
// MQTT OVER WEBSOCKET (Alternative connection)
// ============================================
// Keep the MQTT connection as backup/alternative
const mqttClient = typeof mqtt !== 'undefined' ? mqtt.connect('ws://localhost:9001') : null;

if (mqttClient) {
    mqttClient.on('connect', () => {
        console.log('MQTT Connected');

        mqttClient.subscribe('lab/monitoring/#', (err) => {
            if (!err) {
                console.log('SUBSCRIBE BERHASIL');
            } else {
                console.log('SUBSCRIBE GAGAL', err);
            }
        });
    });

        mqttClient.on('message', (topic, message) => {
        console.log("TOPIC:", topic);
        console.log("DATA:", message.toString());

        try {
            const data = JSON.parse(message.toString());

            // add computer and update last seen (Multi-Device Support)
            const isNewDevice = !computers[data.id];
            
            if (isNewDevice) {
                computers[data.id] = data;
                computers[data.id].status = 'online';
                console.log(`[MQTT] Device Connected: ${data.id}`);
                addAlert(
                    'New Device Connected',
                    `${data.id} berhasil terhubung`,
                    'success'
                );
            } else {
                computers[data.id] = { ...computers[data.id], ...data };
                console.log(`[MQTT] Device Updated: ${data.id}`);
            }
            
            updateLastSeen(data.id);
            renderComputerTable();
            updateDashboardCards();

            // Show metrics for the most recently updated device on dashboard
            // CPU
            const cpuElement = document.getElementById("cpuValue");
            if (cpuElement && data.metrics?.cpu?.percent !== undefined) {
                cpuElement.innerText = data.metrics.cpu.percent + "%";
                if (data.metrics.cpu.percent > 85) {
                    addAlert(
                        "High CPU Usage",
                        `${data.id}: CPU mencapai ${data.metrics.cpu.percent}%`,
                        "warning"
                    );
                }
            }

            // RAM
            const ramElement = document.getElementById("ramValue");
            if (ramElement && data.metrics?.ram?.used_gb !== undefined) {
                const ramUsed = data.metrics.ram.used_gb;
                const ramTotal = data.metrics.ram.total_gb;
                const ramPercent = Math.round((ramUsed / ramTotal) * 100);
                ramElement.innerText = `${ramUsed.toFixed(1)} / ${ramTotal} GB (${ramPercent}%)`;
                if (data.metrics.ram.percent > 85) {
                    addAlert(
                        "High RAM Usage",
                        `${data.id}: RAM mencapai ${data.metrics.ram.percent}%`,
                        "warning"
                    );
                }
            }

            // STORAGE
            const storageElement = document.getElementById("storageValue");
            if (storageElement && data.metrics?.storage?.percent !== undefined) {
                storageElement.innerText = `${data.metrics.storage.percent}%`;
                if (data.metrics.storage.percent > 85) {
                    addAlert(
                        "Storage Warning",
                        `${data.id}: Disk terpakai ${data.metrics.storage.percent}%`,
                        "warning"
                    );
                }
            }

            // UPTIME
            if (data.info && data.info.uptime) {
                const uptimeElement = document.getElementById("uptimeValue");
                if (uptimeElement) {
                    uptimeElement.textContent = data.info.uptime;
                    
                    const uptime = data.info.uptime;
                    if (uptime.includes("0h") || uptime.includes("0m") || uptime.includes("1m")) {
                        addAlert(
                            "Device Rebooted",
                            `${data.id}: Device baru saja menyala (uptime: ${uptime})`,
                            "info"
                        );
                    }
                }
            }

            // Device Status (show most recent device)
            const deviceNameEl = document.getElementById("deviceName");
            const deviceIpEl = document.getElementById("deviceIp");
            const deviceStatusEl = document.getElementById("deviceStatus");
            const deviceUserEl = document.getElementById("deviceUser");
            
            if (deviceNameEl && data.id) {
                deviceNameEl.textContent = data.id;
            }
            if (deviceIpEl && data.network?.ip) {
                deviceIpEl.textContent = data.network.ip;
            }
            if (deviceStatusEl && data.status) {
                deviceStatusEl.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
            }
            if (deviceUserEl && data.user) {
                deviceUserEl.textContent = data.user;
            }

            // TRAFFIC NETWORK (aggregate from all devices)
            if (trafficChart && data.network?.down_mbps !== undefined) {
                trafficChart.data.labels.push(new Date().toLocaleTimeString());
                trafficChart.data.datasets[0].data.push(data.network.down_mbps);

                if (trafficChart.data.labels.length > 20) {
                    trafficChart.data.labels.shift();
                    trafficChart.data.datasets[0].data.shift();
                }

                console.log(`[${data.id}] Mbps:`, data.network.down_mbps);
                trafficChart.update('none');
            }

        } catch (e) {
            console.error('Error parsing MQTT message:', e);
        }
    });
}
